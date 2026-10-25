import type { FeatureCollection } from 'geojson';
import type { RouteStats } from '../types/route';

export const STORAGE_KEY = 'complex_route_planner_geojson';

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
 * Persists the given GeoJSON collection to localStorage.
 */
export function saveGeoJsonToStorage(collection: FeatureCollection): void {
  try {
    const serialized = JSON.stringify(collection);
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch (error) {
    console.error('Failed to save GeoJSON to localStorage:', error);
  }
}

/**
 * Loads the saved GeoJSON collection from localStorage if available.
 */
export function loadGeoJsonFromStorage(): FeatureCollection | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
      return parsed as FeatureCollection;
    }
    return null;
  } catch (error) {
    console.error('Failed to load GeoJSON from localStorage:', error);
    return null;
  }
}

/**
 * Clears saved GeoJSON from localStorage.
 */
export function clearGeoJsonStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear GeoJSON storage:', error);
  }
}

/**
 * Triggers a client-side file download of the current GeoJSON data.
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
