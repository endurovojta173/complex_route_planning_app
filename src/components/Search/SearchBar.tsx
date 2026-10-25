import { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Loader2, X } from 'lucide-react';
import type { SearchLocation } from '../../types/route';

interface SearchBarProps {
  onSelectLocation: (location: SearchLocation) => void;
}

interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  type?: string;
  boundingbox?: [string, string, string, string];
}

export function SearchBar({ onSelectLocation }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchLocation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    const trimmed = val.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsOpen(false);
      setIsLoading(false);
      setErrorMsg(null);
    } else {
      setIsLoading(true);
      setErrorMsg(null);
    }
  };

  // Debounced search via OpenStreetMap Nominatim API
  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      return;
    }

    // Cancel previous request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timer = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          trimmed
        )}&limit=6&addressdetails=1`;

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Search request failed');
        }

        const data: NominatimResult[] = await response.json();

        const formattedResults: SearchLocation[] = data.map((item) => ({
          id: item.place_id,
          name: item.display_name,
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          type: item.type,
          boundingBox: item.boundingbox,
        }));

        setResults(formattedResults);
        setIsOpen(true);
        setSelectedIndex(-1);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Nominatim search error:', err);
          setErrorMsg('Nelze načíst výsledky vyhledávání');
        }
      } finally {
        setIsLoading(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
    };
  }, [query]);

  const handleSelect = (location: SearchLocation) => {
    onSelectLocation(location);
    setQuery(location.name.split(',')[0]); // Shorten input text to primary place name
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        handleSelect(results[selectedIndex]);
      } else if (results.length > 0) {
        handleSelect(results[0]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="search-bar-container" ref={containerRef} id="location-search-container">
      <div className="search-input-wrapper">
        <Search className="search-icon" size={17} />
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder="Vyhledat místo, město, adresu..."
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          aria-label="Vyhledat lokaci na mapě"
          autoComplete="off"
        />

        {isLoading ? (
          <Loader2 className="search-spinner" size={16} />
        ) : query ? (
          <button
            type="button"
            className="search-clear-btn"
            onClick={handleClear}
            title="Vymazat hledání"
            aria-label="Vymazat hledání"
          >
            <X size={15} />
          </button>
        ) : null}
      </div>

      {/* Autocomplete Dropdown Results */}
      {isOpen && (
        <div className="search-dropdown" role="listbox">
          {results.length > 0 ? (
            results.map((loc, index) => {
              const parts = loc.name.split(',');
              const mainName = parts[0];
              const subDetails = parts.slice(1).join(',').trim();

              return (
                <button
                  key={loc.id}
                  type="button"
                  className={`search-dropdown-item ${selectedIndex === index ? 'selected' : ''}`}
                  onClick={() => handleSelect(loc)}
                  role="option"
                  aria-selected={selectedIndex === index}
                >
                  <div className="item-icon-wrapper">
                    <MapPin size={16} className="item-pin-icon" />
                  </div>
                  <div className="item-text-wrapper">
                    <span className="item-main-title">{mainName}</span>
                    {subDetails && <span className="item-subtitle">{subDetails}</span>}
                  </div>
                </button>
              );
            })
          ) : query.trim().length >= 2 && !isLoading ? (
            <div className="search-dropdown-empty">
              <span>{errorMsg || 'Žádné výsledky nenalezeny'}</span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
