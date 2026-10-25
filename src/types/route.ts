import type { FeatureCollection } from 'geojson';

export interface RouteStats {
  totalDistanceKm: number;
  featureCount: number;
  lineCount: number;
  polygonCount: number;
  markerCount: number;
}

export type TileProviderId = 'osm' | 'satellite';

export interface TileProvider {
  id: TileProviderId;
  name: string;
  url: string;
  attribution: string;
  maxZoom: number;
}

export interface StoredRouteData {
  version: number;
  timestamp: string;
  name: string;
  geoJson: FeatureCollection;
}

export interface SearchLocation {
  id: string | number;
  name: string;
  lat: number;
  lon: number;
  type?: string;
  boundingBox?: [string, string, string, string];
}
