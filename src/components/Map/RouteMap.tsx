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
  calculateHaversineDistance,
  loadGeoJsonFromStorage,
  saveGeoJsonToStorage,
} from '../../utils/geoJsonStorage';
import {
  ROUTE_CATEGORIES,
  DEFAULT_CATEGORY,
  getCategoryById,
  getCategoryByColor,
  type RouteCategory,
} from '../../utils/routeColors';
import { RouteColorsBar } from './RouteColorsBar';

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

function createColoredMarkerIcon(color: string) {
  return L.divIcon({
    className: 'custom-colored-marker',
    html: `<div style="
      width: 22px;
      height: 22px;
      background: ${color};
      border: 2px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0,0,0,0.45);
      display: flex;
      align-items: center;
      justify-content: center;
    "><div style="width: 6px; height: 6px; background: #ffffff; border-radius: 50%;"></div></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
  });
}

interface RouteMapProps {
  tileProviderId: TileProviderId;
  onStatsChange: (stats: RouteStats) => void;
  onGeoJsonChange?: (geoJson: FeatureCollection) => void;
  importGeoJsonData: FeatureCollection | null;
  clearTrigger: number;
  searchTarget: SearchLocation | null;
  activeCategory: RouteCategory;
  onActiveCategoryChange: (cat: RouteCategory) => void;
  categories: RouteCategory[];
  onRenameCategory: (id: string, newName: string) => void;
}

export function RouteMap({
  tileProviderId,
  onStatsChange,
  onGeoJsonChange,
  importGeoJsonData,
  clearTrigger,
  searchTarget,
  activeCategory,
  onActiveCategoryChange,
  categories,
  onRenameCategory,
}: RouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const searchMarkerRef = useRef<L.Layer | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  const categoriesRef = useRef(categories);
  const onStatsChangeRef = useRef(onStatsChange);
  const onGeoJsonChangeRef = useRef(onGeoJsonChange);
  const activeCategoryRef = useRef(activeCategory);

  useEffect(() => {
    categoriesRef.current = categories;
    onStatsChangeRef.current = onStatsChange;
    onGeoJsonChangeRef.current = onGeoJsonChange;
    activeCategoryRef.current = activeCategory;
  }, [categories, onStatsChange, onGeoJsonChange, activeCategory]);

  // Synchronize drawn layers to localStorage and notify parent
  const syncLayers = useCallback(() => {
    const drawnItems = drawnItemsRef.current;
    if (!drawnItems) return;

    const features: any[] = [];
    drawnItems.eachLayer((layer: any) => {
      if (typeof layer.toGeoJSON === 'function') {
        const geo = layer.toGeoJSON();
        const role = layer.feature?.properties?.role || 'parade';
        const roleName = layer.feature?.properties?.roleName || 'Zelená';
        const color = layer.options?.color || layer.feature?.properties?.color || DEFAULT_CATEGORY.color;
        const fillColor = layer.options?.fillColor || layer.feature?.properties?.fillColor || DEFAULT_CATEGORY.fillColor;

        if (geo.type === 'Feature') {
          geo.properties = {
            ...(geo.properties || {}),
            role,
            roleName,
            color,
            fillColor,
            stroke: color,
            'stroke-width': 4,
          };
          features.push(geo);
        } else if (geo.type === 'FeatureCollection') {
          for (const feat of geo.features) {
            feat.properties = {
              ...(feat.properties || {}),
              role,
              roleName,
              color,
              fillColor,
              stroke: color,
              'stroke-width': 4,
            };
            features.push(feat);
          }
        }
      }
    });

    const collection: FeatureCollection = {
      type: 'FeatureCollection',
      features,
    };

    saveGeoJsonToStorage(collection);
    const stats = calculateRouteStats(collection, categoriesRef.current);
    onStatsChangeRef.current(stats);
    if (onGeoJsonChangeRef.current) {
      onGeoJsonChangeRef.current(collection);
    }
  }, []);

  // Update a specific layer's category and recolor it
  const updateLayerCategory = useCallback(
    (layer: any, newCat: RouteCategory) => {
      layer.feature = layer.feature || { type: 'Feature', properties: {} };
      layer.feature.properties = {
        ...(layer.feature.properties || {}),
        role: newCat.id,
        roleName: newCat.name,
        color: newCat.color,
        fillColor: newCat.fillColor,
        stroke: newCat.color,
      };

      if (typeof layer.setStyle === 'function') {
        layer.setStyle({
          color: newCat.color,
          fillColor: newCat.fillColor,
          weight: 4,
          opacity: 0.9,
        });
      } else if (typeof layer.setIcon === 'function') {
        layer.setIcon(createColoredMarkerIcon(newCat.color));
      }

      syncLayers();
    },
    [syncLayers]
  );

  // Build the recoloring popup for any drawn layer
  const createLayerPopupContent = useCallback(
    (layer: any): HTMLElement => {
      const container = document.createElement('div');
      container.className = 'layer-recolor-popup';

      const currentRole = layer.feature?.properties?.role;
      const currentColor = layer.feature?.properties?.color || layer.options?.color;
      let currentCat = DEFAULT_CATEGORY;
      if (currentRole) {
        currentCat = getCategoryById(currentRole, categoriesRef.current);
      } else if (currentColor) {
        currentCat = getCategoryByColor(currentColor, categoriesRef.current);
      }

      // Calculate distance if polyline
      let distanceText = '';
      if (typeof layer.getLatLngs === 'function') {
        try {
          const latlngs = layer.getLatLngs();
          const flat = Array.isArray(latlngs[0]) ? latlngs.flat(Infinity) : latlngs;
          let distKm = 0;
          for (let i = 0; i < flat.length - 1; i++) {
            if (flat[i] && flat[i + 1]) {
              distKm += calculateHaversineDistance(flat[i].lat, flat[i].lng, flat[i + 1].lat, flat[i + 1].lng);
            }
          }
          if (distKm > 0) {
            distanceText = distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(2)} km`;
          }
        } catch {
          // Ignore formatting issues
        }
      }

      container.innerHTML = `
        <div class="popup-top-row">
          <span class="popup-role-pill" style="border-color:${currentCat.color}; color:${currentCat.color};">
            <span class="popup-dot" style="background-color: ${currentCat.color};"></span>
            ${currentCat.name}
          </span>
          ${distanceText ? `<span class="popup-dist-badge">${distanceText}</span>` : ''}
        </div>
        <div class="popup-instruction">Vyberte novou barvu / typ úseku:</div>
        <div class="popup-buttons-grid"></div>
      `;

      const grid = container.querySelector('.popup-buttons-grid');
      if (grid) {
        const list = categoriesRef.current || ROUTE_CATEGORIES;
        list.forEach((cat) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = `popup-cat-btn ${cat.id === currentCat.id ? 'active' : ''}`;
          btn.title = cat.description;
          btn.innerHTML = `
            <span class="popup-btn-dot" style="background-color: ${cat.color};"></span>
            <span class="popup-btn-text">${cat.shortName}</span>
          `;
          btn.addEventListener('click', () => {
            updateLayerCategory(layer, cat);
            layer.closePopup();
          });
          grid.appendChild(btn);
        });
      }

      return container;
    },
    [updateLayerCategory]
  );

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

      // Attach recolor popup
      layer.bindPopup(() => createLayerPopupContent(layer), {
        className: 'custom-recolor-popup',
        maxWidth: 290,
      });
    },
    [syncLayers, createLayerPopupContent]
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

    // Set styling options for newly drawn shapes based on active category
    const initialCat = activeCategoryRef.current;
    map.pm.setPathOptions({
      color: initialCat.color,
      fillColor: initialCat.fillColor,
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
        const layer = e.layer;
        const currentCat = activeCategoryRef.current;

        layer.feature = layer.feature || { type: 'Feature', properties: {} };
        layer.feature.properties = {
          ...layer.feature.properties,
          role: currentCat.id,
          roleName: currentCat.name,
          color: currentCat.color,
          fillColor: currentCat.fillColor,
          stroke: currentCat.color,
        };

        if (typeof layer.setStyle === 'function') {
          layer.setStyle({
            color: currentCat.color,
            fillColor: currentCat.fillColor,
            weight: 4,
            opacity: 0.9,
          });
        } else if (typeof layer.setIcon === 'function') {
          layer.setIcon(createColoredMarkerIcon(currentCat.color));
        }

        drawnItems.addLayer(layer);
        bindLayerEvents(layer);
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
          style: (feature) => {
            const col = feature?.properties?.color || feature?.properties?.stroke || DEFAULT_CATEGORY.color;
            const fillCol = feature?.properties?.fillColor || DEFAULT_CATEGORY.fillColor;
            return {
              color: col,
              weight: 4,
              opacity: 0.9,
              fillColor: fillCol,
              fillOpacity: 0.25,
            };
          },
          pointToLayer: (feature, latlng) => {
            const col = feature?.properties?.color || DEFAULT_CATEGORY.color;
            return L.marker(latlng, { icon: createColoredMarkerIcon(col) });
          },
          onEachFeature: (feature, layer) => {
            (layer as any).feature = feature;
            if ((layer as any).setStyle) {
              const col = feature.properties?.color || feature.properties?.stroke || DEFAULT_CATEGORY.color;
              const fillCol = feature.properties?.fillColor || DEFAULT_CATEGORY.fillColor;
              (layer as any).setStyle({ color: col, fillColor: fillCol });
            }
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

  // Update Geoman path drawing styles whenever activeCategory changes
  useEffect(() => {
    if (mapInstanceRef.current && (mapInstanceRef.current as any).pm) {
      (mapInstanceRef.current as any).pm.setPathOptions({
        color: activeCategory.color,
        fillColor: activeCategory.fillColor,
        fillOpacity: 0.25,
        weight: 4,
      });
    }
  }, [activeCategory]);

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
        style: (feature) => {
          const col = feature?.properties?.color || feature?.properties?.stroke || DEFAULT_CATEGORY.color;
          const fillCol = feature?.properties?.fillColor || DEFAULT_CATEGORY.fillColor;
          return {
            color: col,
            weight: 4,
            opacity: 0.9,
            fillColor: fillCol,
            fillOpacity: 0.25,
          };
        },
        pointToLayer: (feature, latlng) => {
          const col = feature?.properties?.color || DEFAULT_CATEGORY.color;
          return L.marker(latlng, { icon: createColoredMarkerIcon(col) });
        },
        onEachFeature: (feature, layer) => {
          (layer as any).feature = feature;
          if ((layer as any).setStyle) {
            const col = feature.properties?.color || feature.properties?.stroke || DEFAULT_CATEGORY.color;
            const fillCol = feature.properties?.fillColor || DEFAULT_CATEGORY.fillColor;
            (layer as any).setStyle({ color: col, fillColor: fillCol });
          }
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

    // Add a visual marker for the searched place (ignored by Geoman)
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

      {/* Floating Active Category Bar */}
      <RouteColorsBar
        categories={categories}
        activeCategory={activeCategory}
        onSelectCategory={onActiveCategoryChange}
        onRenameCategory={onRenameCategory}
      />

      {!isMapReady && (
        <div className="map-loader-backdrop">
          <div className="spinner" />
          <span>Initializing Map & Drawing Engine...</span>
        </div>
      )}
    </div>
  );
}
