import { useState, useRef } from 'react';
import type { FeatureCollection } from 'geojson';
import { RouteMap } from './components/Map/RouteMap';
import { Navbar } from './components/Header/Navbar';
import { ControlPanel } from './components/Sidebar/ControlPanel';
import { SavedMapsModal } from './components/SavedMaps/SavedMapsModal';
import { InfoModal } from './components/Info/InfoModal';
import type { RouteStats, TileProviderId, SearchLocation, SavedMapItem } from './types/route';
import {
  DEFAULT_CATEGORY,
  getSavedCategories,
  saveCustomCategoryName,
  type RouteCategory,
} from './utils/routeColors';
import {
  downloadGeoJsonFile,
  getAllSavedMaps,
  getActiveMapId,
  setActiveMapId,
  saveMapItem,
  createNewMap,
  duplicateMapItem,
  deleteMapItem,
  calculateRouteStats,
} from './utils/geoJsonStorage';
import './App.css';

export default function App() {
  const [categories, setCategories] = useState<RouteCategory[]>(() => getSavedCategories());
  const [savedMaps, setSavedMaps] = useState<SavedMapItem[]>(() => getAllSavedMaps());
  const [activeMapId, setActiveMapIdState] = useState<string>(() => getActiveMapId());
  const [isMapsModalOpen, setIsMapsModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<RouteCategory>(() => getSavedCategories()[0] || DEFAULT_CATEGORY);

  const activeMap = savedMaps.find((m) => m.id === activeMapId) || savedMaps[0];

  const [stats, setStats] = useState<RouteStats>(() => {
    return (
      activeMap?.stats || {
        totalDistanceKm: 0,
        featureCount: 0,
        lineCount: 0,
        polygonCount: 0,
        markerCount: 0,
      }
    );
  });

  const [currentTileId, setCurrentTileId] = useState<TileProviderId>('osm');
  const [currentGeoJson, setCurrentGeoJson] = useState<FeatureCollection | null>(() => {
    return activeMap?.geoJson || null;
  });
  const [importedGeoJson, setImportedGeoJson] = useState<FeatureCollection | null>(null);
  const [clearTrigger, setClearTrigger] = useState(0);
  const [searchTarget, setSearchTarget] = useState<SearchLocation | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification((curr) => (curr === msg ? null : curr));
    }, 3500);
  };

  // Synchronize GeoJSON changes to active map in localStorage
  const handleGeoJsonChange = (geo: FeatureCollection) => {
    setCurrentGeoJson(geo);
    if (activeMap) {
      const updatedMap: SavedMapItem = {
        ...activeMap,
        geoJson: geo,
        stats,
        updatedAt: new Date().toISOString(),
      };
      saveMapItem(updatedMap);
      setSavedMaps((prev) => prev.map((m) => (m.id === updatedMap.id ? updatedMap : m)));
    }
  };

  // Switch to another saved map
  const handleSelectMap = (map: SavedMapItem) => {
    setActiveMapId(map.id);
    setActiveMapIdState(map.id);
    setClearTrigger((prev) => prev + 1);

    setTimeout(() => {
      setImportedGeoJson(map.geoJson);
      setCurrentGeoJson(map.geoJson);
      setStats(map.stats);
    }, 20);

    setIsMapsModalOpen(false);
    showNotification(`Načtena mapa: ${map.name}`);
  };

  // Create new blank map
  const handleCreateNewMap = (name?: string) => {
    const newMap = createNewMap(name || `Trasa ${savedMaps.length + 1}`);
    const updated = getAllSavedMaps();
    setSavedMaps(updated);
    setActiveMapIdState(newMap.id);
    setClearTrigger((prev) => prev + 1);
    setCurrentGeoJson(newMap.geoJson);
    setStats(newMap.stats);
    setIsMapsModalOpen(false);
    showNotification(`Vytvořena nová mapa: ${newMap.name}`);
  };

  // Duplicate map
  const handleDuplicateMap = (id: string) => {
    const dup = duplicateMapItem(id);
    if (dup) {
      setSavedMaps(getAllSavedMaps());
      showNotification(`Vytvořena kopie mapy: ${dup.name}`);
    }
  };

  // Delete map
  const handleDeleteMap = (id: string) => {
    const updated = deleteMapItem(id);
    setSavedMaps(updated);
    const newActiveId = getActiveMapId();
    setActiveMapIdState(newActiveId);

    const targetMap = updated.find((m) => m.id === newActiveId) || updated[0];
    if (targetMap) {
      setClearTrigger((prev) => prev + 1);
      setTimeout(() => {
        setImportedGeoJson(targetMap.geoJson);
        setCurrentGeoJson(targetMap.geoJson);
        setStats(targetMap.stats);
      }, 20);
    }
    showNotification('Mapa byla smazána');
  };

  // Rename map
  const handleRenameMap = (id: string, newName: string) => {
    const target = savedMaps.find((m) => m.id === id);
    if (target) {
      const updated: SavedMapItem = {
        ...target,
        name: newName,
        updatedAt: new Date().toISOString(),
      };
      saveMapItem(updated);
      setSavedMaps(getAllSavedMaps());
      showNotification(`Přejmenováno na: ${newName}`);
    }
  };

  // Rename route color category
  const handleRenameCategory = (id: string, newName: string) => {
    const updated = saveCustomCategoryName(id, newName);
    setCategories(updated);
    setActiveCategory((prev) => {
      const found = updated.find((c) => c.id === id);
      return found || prev;
    });
    if (currentGeoJson) {
      setStats(calculateRouteStats(currentGeoJson, updated));
    }
    const catItem = updated.find((c) => c.id === id);
    showNotification(`Barva přejmenována na: ${catItem?.name || newName}`);
  };

  const handleExport = () => {
    const dataToExport = currentGeoJson || activeMap?.geoJson;
    if (!dataToExport || dataToExport.features.length === 0) {
      showNotification('Na mapě zatím nejsou žádné nakreslené prvky k exportu.');
      return;
    }
    const cleanName = (activeMap?.name || 'route-plan').replace(/\s+/g, '_');
    downloadGeoJsonFile(dataToExport, `${cleanName}.geojson`);
    showNotification(`Mapa "${activeMap?.name}" byla exportována.`);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
          setImportedGeoJson(parsed as FeatureCollection);
          showNotification(`Importováno ${parsed.features.length} prvků do aktivní mapy.`);
        } else {
          showNotification('Neplatný GeoJSON: očekáván objekt FeatureCollection.');
        }
      } catch (err) {
        console.error('Failed to parse uploaded GeoJSON:', err);
        showNotification('Chyba při čtení GeoJSON souboru.');
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleClear = () => {
    if (stats.featureCount === 0) {
      showNotification('Mapa je již prázdná.');
      return;
    }
    const confirmed = window.confirm(
      `Opravdu chcete vymazat všechny nakreslené prvky z mapy "${activeMap?.name}"?`
    );
    if (confirmed) {
      setClearTrigger((prev) => prev + 1);
      const emptyStats: RouteStats = {
        totalDistanceKm: 0,
        featureCount: 0,
        lineCount: 0,
        polygonCount: 0,
        markerCount: 0,
      };
      setStats(emptyStats);

      if (activeMap) {
        const clearedMap: SavedMapItem = {
          ...activeMap,
          geoJson: { type: 'FeatureCollection', features: [] },
          stats: emptyStats,
          updatedAt: new Date().toISOString(),
        };
        saveMapItem(clearedMap);
        setSavedMaps((prev) => prev.map((m) => (m.id === clearedMap.id ? clearedMap : m)));
      }

      showNotification('Všechny prvky byly z mapy odstraněny.');
    }
  };

  const handleSelectLocation = (location: SearchLocation) => {
    setSearchTarget(location);
    const shortName = location.name.split(',')[0];
    showNotification(`Vycentrováno na: ${shortName}`);
  };

  return (
    <div className="app-container">
      <Navbar
        stats={stats}
        activeMapName={activeMap?.name || 'Výchozí trasa'}
        savedMapsCount={savedMaps.length}
        onOpenMapsModal={() => setIsMapsModalOpen(true)}
        onOpenInfoModal={() => setIsInfoModalOpen(true)}
        onExport={handleExport}
        onImportClick={handleImportClick}
        onClearClick={handleClear}
        onSelectLocation={handleSelectLocation}
      />

      <main className="main-content">
        <ControlPanel
          stats={stats}
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
          categories={categories}
          onRenameCategory={handleRenameCategory}
        />

        <RouteMap
          tileProviderId={currentTileId}
          onTileSelect={setCurrentTileId}
          onStatsChange={setStats}
          onGeoJsonChange={handleGeoJsonChange}
          importGeoJsonData={importedGeoJson}
          clearTrigger={clearTrigger}
          searchTarget={searchTarget}
          activeCategory={activeCategory}
          onActiveCategoryChange={setActiveCategory}
          categories={categories}
          onRenameCategory={handleRenameCategory}
        />
      </main>

      {/* Saved Maps Manager Modal */}
      <SavedMapsModal
        isOpen={isMapsModalOpen}
        onClose={() => setIsMapsModalOpen(false)}
        maps={savedMaps}
        activeMapId={activeMapId}
        onSelectMap={handleSelectMap}
        onCreateNewMap={handleCreateNewMap}
        onDuplicateMap={handleDuplicateMap}
        onDeleteMap={handleDeleteMap}
        onRenameMap={handleRenameMap}
      />

      {/* Info & About Modal */}
      <InfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
      />

      {/* Hidden file input for GeoJSON import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".geojson,application/json,.json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Toast Notification */}
      {notification && (
        <div className="toast-notification" role="status" aria-live="polite">
          <span>{notification}</span>
        </div>
      )}
    </div>
  );
}
