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
import { Map as MapIcon, Satellite, Navigation, MapPinPlus, Check } from 'lucide-react';
import { generatePolylineArrows } from '../../utils/routeArrows';
import { findClosestPointOnPolyline, insertVertex } from '../../utils/routeGeometry';

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

function isPolylineLayer(layer: any): boolean {
  if (!layer || typeof layer.getLatLngs !== 'function') return false;
  const pmShape = layer.pm?.getShape?.();
  if (pmShape === 'Polygon' || pmShape === 'Rectangle') return false;
  if (
    layer.pm?._shape &&
    (layer.pm._shape.includes('Polygon') || layer.pm._shape.includes('Rectangle'))
  ) {
    return false;
  }
  if (
    layer.feature?.geometry?.type === 'Polygon' ||
    layer.feature?.geometry?.type === 'MultiPolygon'
  ) {
    return false;
  }
  return true;
}

interface RouteMapProps {
  tileProviderId: TileProviderId;
  onTileSelect: (id: TileProviderId) => void;
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
  onTileSelect,
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
  const [showGlobalArrows, setShowGlobalArrows] = useState(true);
  const showGlobalArrowsRef = useRef(true);
  const arrowLayersMapRef = useRef<Map<L.Layer, L.LayerGroup>>(new Map());
  const arrowsContainerRef = useRef<L.LayerGroup | null>(null);

  const [isAddPointMode, setIsAddPointMode] = useState(false);
  const isAddPointModeRef = useRef(false);
  const previewSnapMarkerRef = useRef<L.CircleMarker | null>(null);

  useEffect(() => {
    showGlobalArrowsRef.current = showGlobalArrows;
  }, [showGlobalArrows]);

  useEffect(() => {
    isAddPointModeRef.current = isAddPointMode;
  }, [isAddPointMode]);

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
        const showArrows =
          layer.feature?.properties?.showArrows !== undefined
            ? layer.feature.properties.showArrows
            : true;

        const name =
          layer.feature?.properties?.name !== undefined
            ? layer.feature.properties.name
            : geo.properties?.name || '';

        if (geo.type === 'Feature') {
          geo.properties = {
            ...(geo.properties || {}),
            role,
            roleName,
            color,
            fillColor,
            stroke: color,
            'stroke-width': 4,
            showArrows,
          };
          if (name) {
            geo.properties.name = name;
          } else if (geo.properties && 'name' in geo.properties) {
            delete geo.properties.name;
          }
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
              showArrows,
            };
            if (name) {
              feat.properties.name = name;
            } else if (feat.properties && 'name' in feat.properties) {
              delete feat.properties.name;
            }
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

  // Update or regenerate directional arrows for a polyline layer
  const updateLayerArrows = useCallback((layer: any) => {
    if (!arrowsContainerRef.current) return;
    if (!isPolylineLayer(layer)) return;

    // Remove previous arrow markers for this layer if any
    const existingGroup = arrowLayersMapRef.current.get(layer);
    if (existingGroup) {
      arrowsContainerRef.current.removeLayer(existingGroup);
      arrowLayersMapRef.current.delete(layer);
    }

    // Check if direction arrows are enabled globally and for this specific route
    const layerArrowsEnabled = layer.feature?.properties?.showArrows !== false;
    if (!showGlobalArrowsRef.current || !layerArrowsEnabled) {
      return;
    }

    const color =
      layer.options?.color || layer.feature?.properties?.color || DEFAULT_CATEGORY.color;
    const arrowMarkers = generatePolylineArrows(layer, color);

    if (arrowMarkers.length > 0) {
      const group = new L.LayerGroup(arrowMarkers);
      arrowsContainerRef.current.addLayer(group);
      arrowLayersMapRef.current.set(layer, group);
    }
  }, []);

  // Reverse polyline vertex direction and reorient arrows
  const reversePolylineDirection = useCallback(
    (layer: any) => {
      if (!isPolylineLayer(layer)) return;
      const latlngs = layer.getLatLngs();
      if (!latlngs) return;

      if (Array.isArray(latlngs)) {
        if (Array.isArray(latlngs[0])) {
          const reversed = (latlngs as any[]).map((sub) =>
            Array.isArray(sub) ? [...sub].reverse() : sub
          );
          layer.setLatLngs(reversed);
        } else {
          const reversed = [...latlngs].reverse();
          layer.setLatLngs(reversed);
        }
      }

      updateLayerArrows(layer);
      syncLayers();
    },
    [updateLayerArrows, syncLayers]
  );

  // Insert a new vertex into a polyline and refresh its graphics & storage
  const handleInsertPointIntoPolyline = useCallback(
    (polyline: L.Polyline, latlng: L.LatLng) => {
      const map = mapInstanceRef.current;
      if (!map) return;

      const result = insertVertex(map, polyline, latlng);
      if (!result) return;

      // Update Geoman edit mode if active on this layer so vertices update
      if ((polyline as any).pm?.enabled?.()) {
        (polyline as any).pm.disable();
        (polyline as any).pm.enable();
      } else {
        (polyline as any).pm?.enable({
          allowSelfIntersection: true,
          snappable: true,
          snapDistance: 20,
        });
      }

      updateLayerArrows(polyline);
      syncLayers();

      // Show temporary pulse animation marker at inserted point
      const pulse = L.circleMarker(result.insertedLatLng, {
        radius: 8,
        color: '#ffffff',
        weight: 3,
        fillColor: (polyline.options as any).color || '#2ebd7f',
        fillOpacity: 0.95,
        interactive: false,
        pmIgnore: true,
      }).addTo(map);

      setTimeout(() => {
        if (map.hasLayer(pulse)) {
          map.removeLayer(pulse);
        }
      }, 900);
    },
    [syncLayers, updateLayerArrows]
  );

  // Toggle global arrows across all routes
  const toggleGlobalArrows = useCallback(() => {
    setShowGlobalArrows((prev) => {
      const next = !prev;
      showGlobalArrowsRef.current = next;

      if (drawnItemsRef.current) {
        drawnItemsRef.current.eachLayer((layer: any) => {
          updateLayerArrows(layer);
        });
      }
      return next;
    });
  }, [updateLayerArrows]);

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

      updateLayerArrows(layer);
      syncLayers();
    },
    [syncLayers, updateLayerArrows]
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

      const isMarker = typeof layer.getLatLng === 'function' && typeof layer.getLatLngs !== 'function';
      const isPolygon = typeof layer.getLatLngs === 'function' && layer.pm?.getShape?.() === 'Polygon';
      const isPolyline = isPolylineLayer(layer);
      const typeLabel = isMarker ? 'Bod' : isPolygon ? 'Polygon' : 'Úsek';
      const currentName = layer.feature?.properties?.name || '';
      const layerArrowsActive = layer.feature?.properties?.showArrows !== false;

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
          <span class="popup-type-badge">${typeLabel}</span>
          ${distanceText ? `<span class="popup-dist-badge">${distanceText}</span>` : ''}
        </div>

        <div class="popup-name-section">
          <label class="popup-name-label" for="layer-name-input">
            ${isMarker ? 'Název bodu:' : 'Název prvku:'}
          </label>
          <div class="popup-name-row">
            <input
              type="text"
              id="layer-name-input"
              class="popup-name-input"
              placeholder="${isMarker ? 'Např. Start, Cíl, Občerstvení...' : 'Zadejte název...'}"
              maxlength="40"
            />
            <button type="button" class="popup-name-save-btn" title="Uložit název (Enter)">
              Uložit
            </button>
          </div>
        </div>

        ${
          isPolyline
            ? `
        <div class="popup-direction-section">
          <div class="popup-direction-header">
            <span class="popup-direction-label">Směr chůze:</span>
            <span class="popup-direction-badge ${layerArrowsActive ? 'active' : 'inactive'}">
              ${layerArrowsActive ? 'Šipky zapnuty' : 'Šipky skryty'}
            </span>
          </div>
          <div class="popup-direction-actions">
            <button type="button" class="popup-dir-btn popup-dir-toggle-btn" title="Zapnout nebo skrýt šipky na této trase">
              ${layerArrowsActive ? 'Skrýt šipky' : 'Zobrazit šipky'}
            </button>
            <button type="button" class="popup-dir-btn popup-dir-reverse-btn" title="Obrátit směr chůze a orientaci šipek">
              ⇄ Obrátit směr
            </button>
          </div>
          <button type="button" class="popup-dir-btn popup-add-point-btn" style="width: 100%; margin-top: 0.35rem;" title="Aktivovat režim pro vkládání bodů do této trasy">
            ➕ Přidat bod do trasy
          </button>
        </div>
        `
            : ''
        }

        <div class="popup-instruction">Barva / typ:</div>
        <div class="popup-buttons-grid"></div>
      `;

      const nameInput = container.querySelector('.popup-name-input') as HTMLInputElement | null;
      const saveBtn = container.querySelector('.popup-name-save-btn') as HTMLButtonElement | null;

      if (nameInput) {
        nameInput.value = currentName;

        const applyName = () => {
          const newName = nameInput.value.trim();
          layer.feature = layer.feature || { type: 'Feature', properties: {} };
          layer.feature.properties = {
            ...(layer.feature.properties || {}),
            name: newName,
          };

          if (newName) {
            layer.unbindTooltip();
            layer.bindTooltip(newName, {
              permanent: true,
              direction: 'top',
              offset: isMarker ? [0, -14] : [0, 0],
              className: 'point-name-tooltip',
            });
          } else {
            layer.unbindTooltip();
          }

          syncLayers();
        };

        nameInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            applyName();
            if (saveBtn) {
              saveBtn.textContent = 'Uloženo ✓';
              setTimeout(() => {
                if (saveBtn) saveBtn.textContent = 'Uložit';
              }, 1200);
            }
          }
        });

        nameInput.addEventListener('change', () => {
          applyName();
        });

        if (saveBtn) {
          saveBtn.addEventListener('click', () => {
            applyName();
            saveBtn.textContent = 'Uloženo ✓';
            setTimeout(() => {
              if (saveBtn) saveBtn.textContent = 'Uložit';
            }, 1200);
          });
        }
      }

      if (isPolyline) {
        const toggleBtn = container.querySelector('.popup-dir-toggle-btn') as HTMLButtonElement | null;
        const reverseBtn = container.querySelector('.popup-dir-reverse-btn') as HTMLButtonElement | null;
        const dirBadge = container.querySelector('.popup-direction-badge') as HTMLElement | null;
        const addPtBtn = container.querySelector('.popup-add-point-btn') as HTMLButtonElement | null;

        if (toggleBtn) {
          toggleBtn.addEventListener('click', () => {
            const currentVal = layer.feature?.properties?.showArrows !== false;
            const newVal = !currentVal;
            layer.feature = layer.feature || { type: 'Feature', properties: {} };
            layer.feature.properties = {
              ...(layer.feature.properties || {}),
              showArrows: newVal,
            };
            updateLayerArrows(layer);
            syncLayers();

            toggleBtn.textContent = newVal ? 'Skrýt šipky' : 'Zobrazit šipky';
            if (dirBadge) {
              dirBadge.textContent = newVal ? 'Šipky zapnuty' : 'Šipky skryty';
              dirBadge.className = `popup-direction-badge ${newVal ? 'active' : 'inactive'}`;
            }
          });
        }

        if (reverseBtn) {
          reverseBtn.addEventListener('click', () => {
            reversePolylineDirection(layer);
            reverseBtn.textContent = 'Obráceno ✓';
            setTimeout(() => {
              if (reverseBtn) reverseBtn.textContent = '⇄ Obrátit směr';
            }, 1000);
          });
        }

        if (addPtBtn) {
          addPtBtn.addEventListener('click', () => {
            layer.closePopup();
            setIsAddPointMode(true);
          });
        }
      }

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
    [syncLayers, updateLayerCategory, updateLayerArrows, reversePolylineDirection]
  );

  const bindLayerEvents = useCallback(
    function attachEvents(layer: L.Layer) {
      layer.on('click', (e: any) => {
        if (isAddPointModeRef.current && isPolylineLayer(layer)) {
          L.DomEvent.stopPropagation(e);
          handleInsertPointIntoPolyline(layer as L.Polyline, e.latlng);
          return;
        }
      });
      layer.on('pm:edit', () => {
        updateLayerArrows(layer);
        syncLayers();
      });
      layer.on('pm:dragend', () => {
        updateLayerArrows(layer);
        syncLayers();
      });
      layer.on('pm:cut', (e: any) => {
        if (e.layer && drawnItemsRef.current) {
          drawnItemsRef.current.addLayer(e.layer);
          attachEvents(e.layer);
          updateLayerArrows(e.layer);
        }
        updateLayerArrows(layer);
        syncLayers();
      });
      layer.on('remove', () => {
        const oldGroup = arrowLayersMapRef.current.get(layer);
        if (oldGroup && arrowsContainerRef.current) {
          arrowsContainerRef.current.removeLayer(oldGroup);
          arrowLayersMapRef.current.delete(layer);
        }
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
    [syncLayers, createLayerPopupContent, updateLayerArrows, handleInsertPointIntoPolyline]
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
      crossOrigin: true,
    }).addTo(map);
    tileLayerRef.current = tileLayer;

    // FeatureGroup holding all drawn routes & features
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    drawnItemsRef.current = drawnItems;

    // LayerGroup holding all directional arrows (rendered on top of routes)
    const arrowsContainer = new L.LayerGroup().addTo(map);
    arrowsContainerRef.current = arrowsContainer;
    const arrowLayersMap = arrowLayersMapRef.current;

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
        updateLayerArrows(layer);
        syncLayers();

        // If it's a marker/point, auto-open popup for instant naming
        if (layer instanceof L.Marker || e.shape === 'Marker') {
          setTimeout(() => {
            layer.openPopup();
            const input = document.getElementById('layer-name-input') as HTMLInputElement | null;
            if (input) input.focus();
          }, 80);
        }
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
            if (feature.properties?.name) {
              const isPt = feature.geometry?.type === 'Point' || layer instanceof L.Marker;
              layer.bindTooltip(feature.properties.name, {
                permanent: true,
                direction: 'top',
                offset: isPt ? [0, -14] : [0, 0],
                className: 'point-name-tooltip',
              });
            }
            drawnItems.addLayer(layer);
            bindLayerEvents(layer);
            updateLayerArrows(layer);
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

    const handleMapMouseMove = (e: L.LeafletMouseEvent) => {
      if (!isAddPointModeRef.current || !drawnItemsRef.current) {
        if (previewSnapMarkerRef.current && map.hasLayer(previewSnapMarkerRef.current)) {
          map.removeLayer(previewSnapMarkerRef.current);
          previewSnapMarkerRef.current = null;
        }
        return;
      }

      let closestPolyline: L.Polyline | null = null;
      let minDistance = 35;
      let snappedPt: L.LatLng | null = null;
      let polylineColor = '#2ebd7f';

      drawnItemsRef.current.eachLayer((layer: any) => {
        if (isPolylineLayer(layer)) {
          const match = findClosestPointOnPolyline(map, layer, e.latlng);
          if (match && match.distancePx < minDistance) {
            minDistance = match.distancePx;
            closestPolyline = layer;
            snappedPt = match.snappedLatLng;
            polylineColor = layer.options?.color || layer.feature?.properties?.color || '#2ebd7f';
          }
        }
      });

      if (closestPolyline && snappedPt) {
        if (!previewSnapMarkerRef.current) {
          previewSnapMarkerRef.current = L.circleMarker(snappedPt, {
            radius: 6,
            color: '#ffffff',
            weight: 2,
            fillColor: polylineColor,
            fillOpacity: 0.9,
            interactive: false,
            pmIgnore: true,
            className: 'preview-snap-point-marker',
          }).addTo(map);
        } else {
          previewSnapMarkerRef.current.setLatLng(snappedPt);
          previewSnapMarkerRef.current.setStyle({
            fillColor: polylineColor,
          });
        }
      } else if (previewSnapMarkerRef.current && map.hasLayer(previewSnapMarkerRef.current)) {
        map.removeLayer(previewSnapMarkerRef.current);
        previewSnapMarkerRef.current = null;
      }
    };

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (!isAddPointModeRef.current || !drawnItemsRef.current) return;

      let closestPolyline: L.Polyline | null = null;
      let minDistance = 35;

      drawnItemsRef.current.eachLayer((layer: any) => {
        if (isPolylineLayer(layer)) {
          const match = findClosestPointOnPolyline(map, layer, e.latlng);
          if (match && match.distancePx < minDistance) {
            minDistance = match.distancePx;
            closestPolyline = layer;
          }
        }
      });

      if (closestPolyline) {
        L.DomEvent.stopPropagation(e);
        handleInsertPointIntoPolyline(closestPolyline, e.latlng);
      }
    };

    map.on('mousemove', handleMapMouseMove);
    map.on('click', handleMapClick);

    syncLayers();

    mapInstanceRef.current = map;
    setIsMapReady(true);

    // Cleanup Leaflet and Geoman instances on unmount to prevent leaks and re-render glitches
    return () => {
      map.off('mousemove', handleMapMouseMove);
      map.off('click', handleMapClick);
      if (previewSnapMarkerRef.current && map.hasLayer(previewSnapMarkerRef.current)) {
        map.removeLayer(previewSnapMarkerRef.current);
        previewSnapMarkerRef.current = null;
      }
      map.pm.removeControls();
      map.off();
      drawnItems.clearLayers();
      arrowsContainer.clearLayers();
      arrowLayersMap.clear();
      map.remove();
      mapInstanceRef.current = null;
      drawnItemsRef.current = null;
      arrowsContainerRef.current = null;
      tileLayerRef.current = null;
    };
  }, [bindLayerEvents, syncLayers, updateLayerArrows, handleInsertPointIntoPolyline]);

  // Toggle cursor style and Geoman draw when entering/exiting add-point mode
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (isAddPointMode) {
      mapContainerRef.current.classList.add('cursor-crosshair');
      mapInstanceRef.current?.pm.disableDraw();
    } else {
      mapContainerRef.current.classList.remove('cursor-crosshair');
      if (previewSnapMarkerRef.current && mapInstanceRef.current?.hasLayer(previewSnapMarkerRef.current)) {
        mapInstanceRef.current.removeLayer(previewSnapMarkerRef.current);
        previewSnapMarkerRef.current = null;
      }
    }
  }, [isAddPointMode]);

  // Support Escape key to exit add point mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAddPointModeRef.current) {
        setIsAddPointMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
      crossOrigin: true,
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
          if (feature.properties?.name) {
            const isPt = feature.geometry?.type === 'Point' || layer instanceof L.Marker;
            layer.bindTooltip(feature.properties.name, {
              permanent: true,
              direction: 'top',
              offset: isPt ? [0, -14] : [0, 0],
              className: 'point-name-tooltip',
            });
          }
          drawnItemsRef.current?.addLayer(layer);
          bindLayerEvents(layer);
          updateLayerArrows(layer);
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
  }, [importGeoJsonData, bindLayerEvents, syncLayers, updateLayerArrows]);

  // Handle clearing all layers
  useEffect(() => {
    if (clearTrigger === 0 || !drawnItemsRef.current) return;
    drawnItemsRef.current.clearLayers();
    arrowsContainerRef.current?.clearLayers();
    arrowLayersMapRef.current.clear();
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

      {/* Floating Basemap Toggle Button (Placed to the left beside the panel) */}
      <div className="basemap-floating-toggle-container">
        <button
          type="button"
          className={`basemap-toggle-btn ${tileProviderId === 'satellite' ? 'is-satellite' : 'is-osm'}`}
          onClick={() => onTileSelect(tileProviderId === 'satellite' ? 'osm' : 'satellite')}
          title={
            tileProviderId === 'satellite'
              ? 'Aktivní: Esri Satelit — Kliknutím přepnete na Standardní mapu'
              : 'Aktivní: Standardní mapa — Kliknutím přepnete na Satelit'
          }
          aria-label="Přepnout mapový podklad"
        >
          <div className="basemap-icon-wrapper">
            {tileProviderId === 'satellite' ? <Satellite size={18} /> : <MapIcon size={18} />}
          </div>
          <span className="basemap-label">
            {tileProviderId === 'satellite' ? 'Satelit' : 'Standard'}
          </span>
          <div className="basemap-indicator-dot" />
        </button>
        <div className="basemap-tooltip">
          {tileProviderId === 'satellite' ? 'Přepnout na Standard' : 'Přepnout na Satelit'}
        </div>
      </div>

      {/* Floating Direction Arrows Toggle Button (Placed right below basemap toggle) */}
      <div className="arrows-floating-toggle-container">
        <button
          type="button"
          className={`arrows-toggle-btn ${showGlobalArrows ? 'is-active' : 'is-inactive'}`}
          onClick={toggleGlobalArrows}
          title={
            showGlobalArrows
              ? 'Směrové šipky jsou zapnuté — Kliknutím je skryjete na celé mapě'
              : 'Směrové šipky jsou skryté — Kliknutím je zobrazíte'
          }
          aria-label="Přepnout směrové šipky na trasách"
        >
          <div className="arrows-icon-wrapper">
            <Navigation size={18} />
          </div>
          <span className="arrows-btn-label">
            {showGlobalArrows ? 'Šipky Zap' : 'Šipky Vyp'}
          </span>
          <div className={`arrows-indicator-dot ${showGlobalArrows ? 'is-active' : ''}`} />
        </button>
        <div className="arrows-tooltip">
          {showGlobalArrows ? 'Skrýt šipky směru' : 'Zobrazit šipky směru'}
        </div>
      </div>

      {/* Floating Add Point into Route Tool Button (Placed right below arrows toggle) */}
      <div className="add-point-floating-toggle-container">
        <button
          type="button"
          className={`add-point-toggle-btn ${isAddPointMode ? 'is-active' : 'is-inactive'}`}
          onClick={() => setIsAddPointMode((prev) => !prev)}
          title={
            isAddPointMode
              ? 'Režim vkládání bodů je aktivní — Kliknutím ukončíte'
              : 'Nástroj: Přidat bod do existující trasy'
          }
          aria-label="Nástroj přidat bod do trasy"
        >
          <div className="add-point-icon-wrapper">
            <MapPinPlus size={18} />
          </div>
          <span className="add-point-btn-label">
            {isAddPointMode ? 'Aktivní' : '+ Bod'}
          </span>
          <div className={`add-point-indicator-dot ${isAddPointMode ? 'is-active' : ''}`} />
        </button>
        <div className="add-point-tooltip">
          {isAddPointMode ? 'Ukončit vkládání bodů' : 'Přidat bod do trasy'}
        </div>
      </div>

      {/* Floating Top Banner when Add Point Mode is Active */}
      {isAddPointMode && (
        <div className="add-point-floating-banner">
          <div className="add-point-banner-content">
            <span className="add-point-banner-dot" />
            <span className="add-point-banner-text">
              <strong>Nástroj: Přidat bod</strong> — Klikněte kamkoliv na trasu pro vložení nového bodu
            </span>
          </div>
          <button
            type="button"
            className="add-point-banner-close-btn"
            onClick={() => setIsAddPointMode(false)}
            title="Ukončit vkládání bodů (Esc)"
          >
            <Check size={14} />
            <span>Hotovo</span>
          </button>
        </div>
      )}

      {!isMapReady && (
        <div className="map-loader-backdrop">
          <div className="spinner" />
          <span>Initializing Map & Drawing Engine...</span>
        </div>
      )}
    </div>
  );
}
