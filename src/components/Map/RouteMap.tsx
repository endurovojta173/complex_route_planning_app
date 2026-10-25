import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import type { FeatureCollection } from 'geojson';
import type { RouteStats, TileProviderId, SearchLocation } from '../../types/route';
import { TILE_PROVIDERS } from '../../utils/tileProviders';
import {
  calculateRouteStats,
  loadGeoJsonFromStorage,
  saveGeoJsonToStorage,
} from '../../utils/geoJsonStorage';

// Fix Leaflet default marker icons for bundlers
import markerIconPng from 'leaflet/dist/images/marker-icon.png';
import markerIcon2xPng from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadowPng from 'leaflet/dist/images/marker-shadow.png';

const DefaultMarkerIcon = L.icon({
  iconUrl: markerIconPng,
  iconRetinaUrl: markerIcon2xPng,
  shadowUrl: markerShadowPng,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultMarkerIcon;

interface RouteMapProps {
  tileProviderId: TileProviderId;
  onStatsChange: (stats: RouteStats) => void;
  onGeoJsonChange?: (geoJson: FeatureCollection) => void;
  importGeoJsonData: FeatureCollection | null;
  clearTrigger: number;
  searchTarget: SearchLocation | null;
}

export function RouteMap({
  tileProviderId,
  onStatsChange,
  onGeoJsonChange,
  importGeoJsonData,
  clearTrigger,
  searchTarget,
}: RouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const searchMarkerRef = useRef<L.Layer | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  const onStatsChangeRef = useRef(onStatsChange);
  const onGeoJsonChangeRef = useRef(onGeoJsonChange);

  useEffect(() => {
    onStatsChangeRef.current = onStatsChange;
    onGeoJsonChangeRef.current = onGeoJsonChange;
  }, [onStatsChange, onGeoJsonChange]);

  // Synchronize drawn layers to localStorage and notify parent
  const syncLayers = useCallback(() => {
    const drawnItems = drawnItemsRef.current;
    if (!drawnItems) return;

    const features: any[] = [];
    drawnItems.eachLayer((layer: any) => {
      if (typeof layer.toGeoJSON === 'function') {
        const geo = layer.toGeoJSON();
        if (geo.type === 'Feature') {
          features.push(geo);
        } else if (geo.type === 'FeatureCollection') {
          features.push(...geo.features);
        } else {
          features.push({
            type: 'Feature',
            properties: {
              stroke: '#10b981',
              'stroke-width': 4,
            },
            geometry: geo,
          });
        }
      }
    });

    const collection: FeatureCollection = {
      type: 'FeatureCollection',
      features,
    };

    saveGeoJsonToStorage(collection);
    const stats = calculateRouteStats(collection);
    onStatsChangeRef.current(stats);
    if (onGeoJsonChangeRef.current) {
      onGeoJsonChangeRef.current(collection);
    }
  }, []);

  const bindLayerEvents = useCallback(
    function attachEvents(layer: L.Layer) {
      layer.on('pm:edit', syncLayers);
      layer.on('pm:dragend', syncLayers);
      layer.on('pm:cut', (e: any) => {
        if (e.layer && drawnItemsRef.current) {
          drawnItemsRef.current.addLayer(e.layer);
          attachEvents(e.layer);
        }
        syncLayers();
      });
      layer.on('remove', () => {
        if (drawnItemsRef.current?.hasLayer(layer)) {
          drawnItemsRef.current.removeLayer(layer);
        }
        syncLayers();
      });
    },
    [syncLayers]
  );

  const initialTileProviderRef = useRef(tileProviderId);

  // Initialize Map and Geoman
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Center on central Europe default (Prague) with nice overview
    const map = L.map(mapContainerRef.current, {
      center: [50.0755, 14.4378],
      zoom: 13,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Initial base tile layer
    const initialProvider =
      TILE_PROVIDERS.find((p) => p.id === initialTileProviderRef.current) || TILE_PROVIDERS[0];
    const tileLayer = L.tileLayer(initialProvider.url, {
      attribution: initialProvider.attribution,
      maxZoom: initialProvider.maxZoom,
    }).addTo(map);
    tileLayerRef.current = tileLayer;

    // FeatureGroup holding all drawn routes & features
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    drawnItemsRef.current = drawnItems;

    // Configure Geoman controls
    map.pm.addControls({
      position: 'topleft',
      drawMarker: true,
      drawCircleMarker: false,
      drawPolyline: true,
      drawRectangle: true,
      drawPolygon: true,
      drawCircle: false,
      drawText: false,
      cutPolygon: true,
      removalMode: true,
      editMode: true,
      dragMode: true,
      rotateMode: false,
    });

    // Set styling options for newly drawn shapes
    map.pm.setPathOptions({
      color: '#10b981',
      fillColor: '#34d399',
      fillOpacity: 0.25,
      weight: 4,
    });

    // Global Geoman snap settings (essential for route branching & joining)
    map.pm.setGlobalOptions({
      snappable: true,
      snapDistance: 20,
      allowSelfIntersection: true,
      continueDrawing: false,
    });

    // Event listeners on map for Geoman operations
    const handlePmCreate = (e: any) => {
      if (e.layer) {
        drawnItems.addLayer(e.layer);
        bindLayerEvents(e.layer);
        syncLayers();
      }
    };

    const handlePmRemove = () => {
      setTimeout(syncLayers, 20);
    };

    map.on('pm:create', handlePmCreate);
    map.on('pm:remove', handlePmRemove);

    // Load saved GeoJSON from localStorage on mount
    const savedGeoJson = loadGeoJsonFromStorage();
    if (savedGeoJson && savedGeoJson.features && savedGeoJson.features.length > 0) {
      try {
        const geoLayer = L.geoJSON(savedGeoJson, {
          style: {
            color: '#10b981',
            weight: 4,
            opacity: 0.9,
            fillColor: '#34d399',
            fillOpacity: 0.25,
          },
          onEachFeature: (_feature, layer) => {
            drawnItems.addLayer(layer);
            bindLayerEvents(layer);
          },
        });

        // Fit map bounds to loaded features
        const bounds = geoLayer.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        }
      } catch (err) {
        console.error('Failed to parse and add saved GeoJSON features:', err);
      }
    }

    syncLayers();

    mapInstanceRef.current = map;
    setIsMapReady(true);

    // Cleanup Leaflet and Geoman instances on unmount to prevent leaks and re-render glitches
    return () => {
      map.pm.removeControls();
      map.off();
      drawnItems.clearLayers();
      map.remove();
      mapInstanceRef.current = null;
      drawnItemsRef.current = null;
      tileLayerRef.current = null;
    };
  }, [bindLayerEvents, syncLayers]);

  // Update Tile Layer when provider changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const provider =
      TILE_PROVIDERS.find((p) => p.id === tileProviderId) || TILE_PROVIDERS[0];

    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }

    const newLayer = L.tileLayer(provider.url, {
      attribution: provider.attribution,
      maxZoom: provider.maxZoom,
    }).addTo(mapInstanceRef.current);

    tileLayerRef.current = newLayer;
  }, [tileProviderId]);

  // Handle imported GeoJSON
  useEffect(() => {
    if (!importGeoJsonData || !drawnItemsRef.current || !mapInstanceRef.current) return;

    try {
      const geoLayer = L.geoJSON(importGeoJsonData, {
        style: {
          color: '#059669',
          weight: 4,
          opacity: 0.9,
          fillColor: '#10b981',
          fillOpacity: 0.25,
        },
        onEachFeature: (_feature, layer) => {
          drawnItemsRef.current?.addLayer(layer);
          bindLayerEvents(layer);
        },
      });

      const bounds = geoLayer.getBounds();
      if (bounds.isValid()) {
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
      }

      syncLayers();
    } catch (err) {
      console.error('Failed to render imported GeoJSON:', err);
    }
  }, [importGeoJsonData, bindLayerEvents, syncLayers]);

  // Handle clearing all layers
  useEffect(() => {
    if (clearTrigger === 0 || !drawnItemsRef.current) return;
    drawnItemsRef.current.clearLayers();
    syncLayers();
  }, [clearTrigger, syncLayers]);

  // Handle centering the map on a searched location
  useEffect(() => {
    if (!searchTarget || !mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    const { lat, lon, name, boundingBox } = searchTarget;

    // Remove previous search marker if any
    if (searchMarkerRef.current && map.hasLayer(searchMarkerRef.current)) {
      map.removeLayer(searchMarkerRef.current);
      searchMarkerRef.current = null;
    }

    // Center map with smooth fly animation
    if (boundingBox && boundingBox.length === 4) {
      // Nominatim boundingbox: [south, north, west, east]
      const [south, north, west, east] = boundingBox.map(Number);
      if (!isNaN(south) && !isNaN(north) && !isNaN(west) && !isNaN(east)) {
        map.flyToBounds(
          [
            [south, west],
            [north, east],
          ],
          {
            padding: [60, 60],
            maxZoom: 16,
            duration: 1.5,
          }
        );
      } else {
        map.flyTo([lat, lon], 15, { duration: 1.5 });
      }
    } else {
      map.flyTo([lat, lon], 15, { duration: 1.5 });
    }

    // Add a pulsing visual marker for the searched place (ignored by Geoman)
    const marker = L.circleMarker([lat, lon], {
      radius: 9,
      color: '#047857',
      weight: 3,
      fillColor: '#10b981',
      fillOpacity: 0.85,
      pmIgnore: true,
    }).addTo(map);

    const displayName = name.split(',')[0];
    marker
      .bindPopup(
        `<div style="font-family:Inter,sans-serif; min-width: 140px;">
          <div style="font-weight:600; font-size:13px; color:#0f172a;">📍 ${displayName}</div>
          <div style="font-size:11px; color:#64748b; margin-top:2px;">${name}</div>
        </div>`
      )
      .openPopup();

    searchMarkerRef.current = marker;
  }, [searchTarget]);

  return (
    <div className="map-wrapper" id="route-map-container">
      <div ref={mapContainerRef} className="leaflet-container-view" id="leaflet-map" />
      {!isMapReady && (
        <div className="map-loader-backdrop">
          <div className="spinner" />
          <span>Initializing Map & Drawing Engine...</span>
        </div>
      )}
    </div>
  );
}
