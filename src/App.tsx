import { useState, useRef } from 'react';
import type { FeatureCollection } from 'geojson';
import { RouteMap } from './components/Map/RouteMap';
import { Navbar } from './components/Header/Navbar';
import { ControlPanel } from './components/Sidebar/ControlPanel';
import type { RouteStats, TileProviderId, SearchLocation } from './types/route';
import {
  clearGeoJsonStorage,
  downloadGeoJsonFile,
  loadGeoJsonFromStorage,
} from './utils/geoJsonStorage';
import './App.css';

export default function App() {
  const [stats, setStats] = useState<RouteStats>({
    totalDistanceKm: 0,
    featureCount: 0,
    lineCount: 0,
    polygonCount: 0,
    markerCount: 0,
  });

  const [currentTileId, setCurrentTileId] = useState<TileProviderId>('osm');
  const [currentGeoJson, setCurrentGeoJson] = useState<FeatureCollection | null>(() => {
    return loadGeoJsonFromStorage();
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

  const handleExport = () => {
    const dataToExport = currentGeoJson || loadGeoJsonFromStorage();
    if (!dataToExport || dataToExport.features.length === 0) {
      showNotification('No route or shapes drawn yet to export.');
      return;
    }
    const timestamp = new Date().toISOString().slice(0, 10);
    downloadGeoJsonFile(dataToExport, `route-plan-${timestamp}.geojson`);
    showNotification('GeoJSON route exported successfully.');
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
          showNotification(`Imported ${parsed.features.length} features.`);
        } else {
          showNotification('Invalid GeoJSON: Expected a FeatureCollection.');
        }
      } catch (err) {
        console.error('Failed to parse uploaded GeoJSON:', err);
        showNotification('Error reading GeoJSON file.');
      }
      // Reset input value to allow re-uploading the same file
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleClear = () => {
    if (stats.featureCount === 0) {
      showNotification('Map is already empty.');
      return;
    }
    const confirmed = window.confirm('Are you sure you want to clear all drawn routes and features?');
    if (confirmed) {
      clearGeoJsonStorage();
      setClearTrigger((prev) => prev + 1);
      setStats({
        totalDistanceKm: 0,
        featureCount: 0,
        lineCount: 0,
        polygonCount: 0,
        markerCount: 0,
      });
      showNotification('Map and cache cleared.');
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
        onExport={handleExport}
        onImportClick={handleImportClick}
        onClearClick={handleClear}
        onSelectLocation={handleSelectLocation}
      />

      <main className="main-content">
        <ControlPanel
          stats={stats}
          currentTileId={currentTileId}
          onTileSelect={setCurrentTileId}
        />

        <RouteMap
          tileProviderId={currentTileId}
          onStatsChange={setStats}
          onGeoJsonChange={setCurrentGeoJson}
          importGeoJsonData={importedGeoJson}
          clearTrigger={clearTrigger}
          searchTarget={searchTarget}
        />
      </main>

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
