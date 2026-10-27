import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import type { FeatureCollection } from 'geojson';
import { RouteMap } from './components/Map/RouteMap';
import { RouteStatsPanel } from './components/Map/RouteStatsPanel';
import { Navbar } from './components/Header/Navbar';
import { SavedMapsModal } from './components/SavedMaps/SavedMapsModal';
import { InfoModal } from './components/Info/InfoModal';
import { ExportModal } from './components/Modals/ExportModal';
import type { RouteStats, TileProviderId, SearchLocation, SavedMapItem } from './types/route';
import {
  DEFAULT_CATEGORY,
  getSavedCategories,
  saveCustomCategoryName,
  getActiveCategoryIds,
  saveActiveCategoryIds,
  getCategoryById,
  getCategoryByColor,
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
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [activeCategoryIds, setActiveCategoryIds] = useState<string[]>(() => getActiveCategoryIds());
  const [activeCategory, setActiveCategory] = useState<RouteCategory>(() => {
    const list = getSavedCategories();
    const activeIds = getActiveCategoryIds();
    return list.find((c) => c.id === activeIds[0]) || list[0] || DEFAULT_CATEGORY;
  });

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

  // Undo / Redo change history state & refs
  const historyRef = useRef<FeatureCollection[]>([
    activeMap?.geoJson || { type: 'FeatureCollection', features: [] },
  ]);
  const historyIndexRef = useRef<number>(0);
  const isRestoringHistoryRef = useRef<boolean>(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [restoreTrigger, setRestoreTrigger] = useState<{ geoJson: FeatureCollection; id: number } | null>(null);

  const resetHistory = useCallback((initialGeoJson: FeatureCollection) => {
    historyRef.current = [initialGeoJson];
    historyIndexRef.current = 0;
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification((curr) => (curr === msg ? null : curr));
    }, 3500);
  };

  // Synchronize GeoJSON changes to active map in localStorage & track history
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

    if (isRestoringHistoryRef.current) {
      return;
    }

    const currentSnapshot = historyRef.current[historyIndexRef.current];
    if (currentSnapshot && JSON.stringify(currentSnapshot.features) === JSON.stringify(geo.features)) {
      return;
    }

    const nextHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    nextHistory.push(geo);
    if (nextHistory.length > 50) {
      nextHistory.shift();
    }
    historyRef.current = nextHistory;
    historyIndexRef.current = nextHistory.length - 1;

    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(false);
  };

  const handleUndo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;

    isRestoringHistoryRef.current = true;
    historyIndexRef.current -= 1;
    const targetGeoJson = historyRef.current[historyIndexRef.current];

    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);

    setCurrentGeoJson(targetGeoJson);
    setRestoreTrigger({ geoJson: targetGeoJson, id: Date.now() });

    if (activeMap) {
      const updatedMap: SavedMapItem = {
        ...activeMap,
        geoJson: targetGeoJson,
        updatedAt: new Date().toISOString(),
      };
      saveMapItem(updatedMap);
      setSavedMaps((prev) => prev.map((m) => (m.id === updatedMap.id ? updatedMap : m)));
    }

    setTimeout(() => {
      isRestoringHistoryRef.current = false;
    }, 60);
  }, [activeMap]);

  const handleRedo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;

    isRestoringHistoryRef.current = true;
    historyIndexRef.current += 1;
    const targetGeoJson = historyRef.current[historyIndexRef.current];

    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);

    setCurrentGeoJson(targetGeoJson);
    setRestoreTrigger({ geoJson: targetGeoJson, id: Date.now() });

    if (activeMap) {
      const updatedMap: SavedMapItem = {
        ...activeMap,
        geoJson: targetGeoJson,
        updatedAt: new Date().toISOString(),
      };
      saveMapItem(updatedMap);
      setSavedMaps((prev) => prev.map((m) => (m.id === updatedMap.id ? updatedMap : m)));
    }

    setTimeout(() => {
      isRestoringHistoryRef.current = false;
    }, 60);
  }, [activeMap]);

  // Global Keyboard shortcuts for Undo (Ctrl+Z) and Redo (Ctrl+Y / Ctrl+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (modKey && !e.altKey) {
        if (e.key === 'z' || e.key === 'Z') {
          if (e.shiftKey) {
            e.preventDefault();
            handleRedo();
          } else {
            e.preventDefault();
            handleUndo();
          }
        } else if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          handleRedo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Switch to another saved map
  const handleSelectMap = (map: SavedMapItem) => {
    setActiveMapId(map.id);
    setActiveMapIdState(map.id);
    setClearTrigger((prev) => prev + 1);

    resetHistory(map.geoJson);

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
    resetHistory(newMap.geoJson);
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
      resetHistory(targetMap.geoJson);
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

  const handleAddCategory = (id: string) => {
    setActiveCategoryIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      saveActiveCategoryIds(next);
      return next;
    });
  };

  const handleRemoveCategory = (id: string) => {
    setActiveCategoryIds((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((catId) => catId !== id);
      saveActiveCategoryIds(next);
      if (activeCategory.id === id) {
        const fallback = categories.find((c) => c.id === next[0]) || categories[0];
        setActiveCategory(fallback);
      }
      return next;
    });
  };

  // Combine user-activated category IDs with any categories used on current map
  const effectiveCategoryIds = useMemo(() => {
    const ids = new Set(activeCategoryIds);
    if (currentGeoJson && currentGeoJson.features) {
      for (const f of currentGeoJson.features) {
        const role = f.properties?.role;
        const col = f.properties?.color;
        if (role) {
          const cat = getCategoryById(role, categories);
          if (cat) ids.add(cat.id);
        } else if (col) {
          const cat = getCategoryByColor(col, categories);
          if (cat) ids.add(cat.id);
        }
      }
    }
    return Array.from(ids);
  }, [activeCategoryIds, currentGeoJson, categories]);

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
          const parsedGeo = parsed as FeatureCollection;
          setImportedGeoJson(parsedGeo);
          resetHistory(parsedGeo);
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
      const emptyGeo: FeatureCollection = { type: 'FeatureCollection', features: [] };
      const emptyStats: RouteStats = {
        totalDistanceKm: 0,
        featureCount: 0,
        lineCount: 0,
        polygonCount: 0,
        markerCount: 0,
      };
      setStats(emptyStats);
      setCurrentGeoJson(emptyGeo);

      // Record cleared state into history so the user can undo it
      if (!isRestoringHistoryRef.current) {
        const nextHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
        nextHistory.push(emptyGeo);
        if (nextHistory.length > 50) nextHistory.shift();
        historyRef.current = nextHistory;
        historyIndexRef.current = nextHistory.length - 1;
        setCanUndo(true);
        setCanRedo(false);
      }

      if (activeMap) {
        const clearedMap: SavedMapItem = {
          ...activeMap,
          geoJson: emptyGeo,
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
        savedMapsCount={savedMaps.length}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onOpenMapsModal={() => setIsMapsModalOpen(true)}
        onOpenInfoModal={() => setIsInfoModalOpen(true)}
        onExport={() => setIsExportModalOpen(true)}
        onImportClick={handleImportClick}
        onClearClick={handleClear}
        onSelectLocation={handleSelectLocation}
      />

      <main className="main-content">
        <RouteMap
          tileProviderId={currentTileId}
          onTileSelect={setCurrentTileId}
          onStatsChange={setStats}
          onGeoJsonChange={handleGeoJsonChange}
          importGeoJsonData={importedGeoJson}
          restoreGeoJsonData={restoreTrigger}
          clearTrigger={clearTrigger}
          searchTarget={searchTarget}
          activeCategory={activeCategory}
          onActiveCategoryChange={setActiveCategory}
          categories={categories}
          activeCategoryIds={effectiveCategoryIds}
          onAddCategory={handleAddCategory}
          onRemoveCategory={handleRemoveCategory}
          onRenameCategory={handleRenameCategory}
        />

        <RouteStatsPanel
          stats={stats}
          categories={categories}
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
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

      {/* Export Options Modal (PDF, SVG, GeoJSON) */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        activeMapName={activeMap?.name || 'Výchozí trasa'}
        stats={stats}
        categories={categories}
        onExportGeoJson={handleExport}
        onShowNotification={showNotification}
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
