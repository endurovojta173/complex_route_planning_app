import type { FeatureCollection } from 'geojson';
import type { RouteStats, SavedMapItem } from '../types/route';

export const LEGACY_STORAGE_KEY = 'complex_route_planner_geojson';
export const MAPS_LIST_KEY = 'complex_route_planner_maps_list';
export const ACTIVE_MAP_ID_KEY = 'complex_route_planner_active_map_id';

/**
 * Calculates distance in kilometers between two lat/lng coordinates (Haversine formula).
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Computes route statistics from a GeoJSON FeatureCollection.
 */
export function calculateRouteStats(collection: FeatureCollection): RouteStats {
  let totalDistanceKm = 0;
  let lineCount = 0;
  let polygonCount = 0;
  let markerCount = 0;

  for (const feature of collection.features) {
    if (!feature.geometry) continue;

    const geometry = feature.geometry;
    if (geometry.type === 'GeometryCollection') continue;

    const { type, coordinates } = geometry;

    if (type === 'LineString') {
      lineCount++;
      const coords = coordinates as [number, number][];
      for (let i = 0; i < coords.length - 1; i++) {
        const [lon1, lat1] = coords[i];
        const [lon2, lat2] = coords[i + 1];
        totalDistanceKm += calculateHaversineDistance(lat1, lon1, lat2, lon2);
      }
    } else if (type === 'MultiLineString') {
      lineCount++;
      const multiCoords = coordinates as [number, number][][];
      for (const segment of multiCoords) {
        for (let i = 0; i < segment.length - 1; i++) {
          const [lon1, lat1] = segment[i];
          const [lon2, lat2] = segment[i + 1];
          totalDistanceKm += calculateHaversineDistance(lat1, lon1, lat2, lon2);
        }
      }
    } else if (type === 'Polygon' || type === 'MultiPolygon') {
      polygonCount++;
    } else if (type === 'Point') {
      markerCount++;
    }
  }

  return {
    totalDistanceKm: Number(totalDistanceKm.toFixed(2)),
    featureCount: collection.features.length,
    lineCount,
    polygonCount,
    markerCount,
  };
}

/**
 * Creates an empty GeoJSON FeatureCollection.
 */
export function createEmptyFeatureCollection(): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [],
  };
}

/**
 * Retrieves all saved maps from localStorage. Automatically handles migration from legacy single-map storage.
 */
export function getAllSavedMaps(): SavedMapItem[] {
  try {
    const raw = localStorage.getItem(MAPS_LIST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }

    // Check for legacy single-map storage
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    let initialCollection = createEmptyFeatureCollection();
    if (legacyRaw) {
      try {
        const parsedLegacy = JSON.parse(legacyRaw);
        if (parsedLegacy && parsedLegacy.type === 'FeatureCollection') {
          initialCollection = parsedLegacy;
        }
      } catch (e) {
        console.error('Legacy migration parse error:', e);
      }
    }

    const defaultMap: SavedMapItem = {
      id: 'map_' + Date.now(),
      name: 'Výchozí trasa',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      geoJson: initialCollection,
      stats: calculateRouteStats(initialCollection),
    };

    const initialList = [defaultMap];
    localStorage.setItem(MAPS_LIST_KEY, JSON.stringify(initialList));
    localStorage.setItem(ACTIVE_MAP_ID_KEY, defaultMap.id);

    return initialList;
  } catch (error) {
    console.error('Failed to get saved maps from localStorage:', error);
    return [];
  }
}

/**
 * Retrieves the currently active map ID.
 */
export function getActiveMapId(): string {
  try {
    const activeId = localStorage.getItem(ACTIVE_MAP_ID_KEY);
    if (activeId) return activeId;

    const maps = getAllSavedMaps();
    if (maps.length > 0) {
      localStorage.setItem(ACTIVE_MAP_ID_KEY, maps[0].id);
      return maps[0].id;
    }
    return '';
  } catch (error) {
    console.error('Failed to get active map ID:', error);
    return '';
  }
}

/**
 * Sets the currently active map ID.
 */
export function setActiveMapId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_MAP_ID_KEY, id);
  } catch (error) {
    console.error('Failed to set active map ID:', error);
  }
}

/**
 * Saves or updates a map in the local cache.
 */
export function saveMapItem(mapItem: SavedMapItem): void {
  try {
    const maps = getAllSavedMaps();
    const existingIndex = maps.findIndex((m) => m.id === mapItem.id);

    if (existingIndex >= 0) {
      maps[existingIndex] = {
        ...mapItem,
        updatedAt: new Date().toISOString(),
      };
    } else {
      maps.push(mapItem);
    }

    localStorage.setItem(MAPS_LIST_KEY, JSON.stringify(maps));
    // Also update legacy key for backward compatibility
    if (mapItem.id === getActiveMapId()) {
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(mapItem.geoJson));
    }
  } catch (error) {
    console.error('Failed to save map item:', error);
  }
}

/**
 * Loads the currently active map GeoJSON from storage.
 */
export function loadGeoJsonFromStorage(): FeatureCollection {
  try {
    const activeId = getActiveMapId();
    const maps = getAllSavedMaps();
    const activeMap = maps.find((m) => m.id === activeId);
    if (activeMap) {
      return activeMap.geoJson;
    }
    // Fallback to legacy key
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
        return parsed;
      }
    }
  } catch (error) {
    console.error('Failed to load GeoJSON from storage:', error);
  }
  return createEmptyFeatureCollection();
}

/**
 * Saves GeoJSON to the currently active map in localStorage.
 */
export function saveGeoJsonToStorage(collection: FeatureCollection): void {
  try {
    const activeId = getActiveMapId();
    const maps = getAllSavedMaps();
    const activeMap = maps.find((m) => m.id === activeId);
    if (activeMap) {
      activeMap.geoJson = collection;
      activeMap.stats = calculateRouteStats(collection);
      activeMap.updatedAt = new Date().toISOString();
      localStorage.setItem(MAPS_LIST_KEY, JSON.stringify(maps));
    }
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(collection));
  } catch (error) {
    console.error('Failed to save GeoJSON to storage:', error);
  }
}

/**
 * Creates a brand new map in localStorage.
 */
export function createNewMap(name = 'Nová trasa'): SavedMapItem {
  const emptyGeoJson = createEmptyFeatureCollection();
  const newMap: SavedMapItem = {
    id: 'map_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    geoJson: emptyGeoJson,
    stats: {
      totalDistanceKm: 0,
      featureCount: 0,
      lineCount: 0,
      polygonCount: 0,
      markerCount: 0,
    },
  };

  saveMapItem(newMap);
  setActiveMapId(newMap.id);
  return newMap;
}

/**
 * Duplicates an existing map.
 */
export function duplicateMapItem(id: string): SavedMapItem | null {
  const maps = getAllSavedMaps();
  const original = maps.find((m) => m.id === id);
  if (!original) return null;

  const duplicated: SavedMapItem = {
    ...original,
    id: 'map_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    name: `${original.name} (Kopie)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // Deep clone GeoJSON
    geoJson: JSON.parse(JSON.stringify(original.geoJson)),
  };

  saveMapItem(duplicated);
  return duplicated;
}

/**
 * Deletes a map from localStorage.
 */
export function deleteMapItem(id: string): SavedMapItem[] {
  try {
    let maps = getAllSavedMaps();
    maps = maps.filter((m) => m.id !== id);

    // If all maps were deleted, generate a fresh empty map
    if (maps.length === 0) {
      const defaultMap: SavedMapItem = {
        id: 'map_' + Date.now(),
        name: 'Moje trasa',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        geoJson: createEmptyFeatureCollection(),
        stats: {
          totalDistanceKm: 0,
          featureCount: 0,
          lineCount: 0,
          polygonCount: 0,
          markerCount: 0,
        },
      };
      maps = [defaultMap];
    }

    localStorage.setItem(MAPS_LIST_KEY, JSON.stringify(maps));

    // If the active map was deleted, point to the first available map
    if (getActiveMapId() === id) {
      setActiveMapId(maps[0].id);
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(maps[0].geoJson));
    }

    return maps;
  } catch (error) {
    console.error('Failed to delete map item:', error);
    return getAllSavedMaps();
  }
}

/**
 * Triggers a client-side file download of the GeoJSON data.
 */
export function downloadGeoJsonFile(collection: FeatureCollection, filename = 'route-plan.geojson'): void {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(collection, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', filename);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
