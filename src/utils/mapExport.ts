import L from 'leaflet';
import { createMapPdfBlob, type PdfExportOptions } from './pdfGenerator';
import { generatePolylineArrows } from './routeArrows';

/**
 * Downloads any Blob file to user's computer
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Draws a single directional navigation arrow precisely onto the canvas
 * at the exact (x, y) coordinates with specified bearing and color.
 */
interface ExportArrowItem {
  pos: { x: number; y: number };
  bearing: number;
  color: string;
  bidirectional?: boolean;
}

/**
 * Robustly collects all active directional arrows for the map view.
 * 1. Recursively traverses the arrowsContainer (handling nested LayerGroups).
 * 2. Fallbacks to generating arrows from all active polylines if container is empty.
 */
function getMapArrows(mapContainer: HTMLElement): ExportArrowItem[] {
  const map: any = (mapContainer as any)._leaflet_map;
  if (!map || typeof map.latLngToContainerPoint !== 'function') {
    return [];
  }

  const arrows: ExportArrowItem[] = [];
  const arrowsContainer: any = (mapContainer as any)._arrows_container;

  // 1. Traverse arrowsContainer recursively
  if (arrowsContainer && typeof arrowsContainer.eachLayer === 'function') {
    const visit = (layer: any) => {
      if (!layer) return;
      if (typeof layer.getLatLng === 'function' && typeof layer.options?.arrowBearing === 'number') {
        const latlng = layer.getLatLng();
        const pos = map.latLngToContainerPoint(latlng);
        if (pos) {
          arrows.push({
            pos,
            bearing: layer.options.arrowBearing,
            color: layer.options.arrowColor || '#2ebd7f',
            bidirectional: Boolean(layer.options.arrowBidirectional),
          });
        }
      } else if (typeof layer.eachLayer === 'function') {
        layer.eachLayer((child: any) => visit(child));
      }
    };
    arrowsContainer.eachLayer((child: any) => visit(child));
  }

  // 2. Fallback: if arrowsContainer is empty, generate from all active polylines
  if (arrows.length === 0) {
    const drawnItems: any = (mapContainer as any)._drawn_items;
    const targetGroup = drawnItems && typeof drawnItems.eachLayer === 'function' ? drawnItems : map;

    if (targetGroup && typeof targetGroup.eachLayer === 'function') {
      targetGroup.eachLayer((layer: any) => {
        if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
          if (layer.feature?.properties?.showArrows !== false) {
            const color =
              layer.options?.color || layer.feature?.properties?.color || '#2ebd7f';
            const isBidi = Boolean(layer.feature?.properties?.bidirectional);
            const markers = generatePolylineArrows(layer, color, isBidi);
            for (const marker of markers) {
              const bearing = (marker.options as any)?.arrowBearing;
              const markerColor = (marker.options as any)?.arrowColor || color;
              if (typeof bearing === 'number' && typeof marker.getLatLng === 'function') {
                const pos = map.latLngToContainerPoint(marker.getLatLng());
                if (pos) {
                  arrows.push({
                    pos,
                    bearing,
                    color: markerColor,
                    bidirectional: isBidi,
                  });
                }
              }
            }
          }
        }
      });
    }
  }

  return arrows;
}

/**
 * Draws a single directional navigation arrow precisely onto the canvas
 * at the exact (x, y) coordinates with specified bearing, color, and optional bidirectional style.
 */
function drawDirectionArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  bearing: number,
  color: string,
  bidirectional?: boolean
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((bearing * Math.PI) / 180);

  // Strong dark drop shadow for maximum depth
  ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 1.5;

  if (bidirectional) {
    // 1. Crisp white double-arrow body
    ctx.beginPath();
    ctx.moveTo(0, -11.5);
    ctx.lineTo(7, -4.5);
    ctx.lineTo(2, -5.5);
    ctx.lineTo(2, 5.5);
    ctx.lineTo(7, 4.5);
    ctx.lineTo(0, 11.5);
    ctx.lineTo(-7, 4.5);
    ctx.lineTo(-2, 5.5);
    ctx.lineTo(-2, -5.5);
    ctx.lineTo(-7, -4.5);
    ctx.closePath();

    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Dark high-contrast stroke
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = '#0f172a';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // 2. Inner route-colored core
    ctx.beginPath();
    ctx.moveTo(0, -8.5);
    ctx.lineTo(4, -4.5);
    ctx.lineTo(0.8, -5.2);
    ctx.lineTo(0.8, 5.2);
    ctx.lineTo(4, 4.5);
    ctx.lineTo(0, 8.5);
    ctx.lineTo(-4, 4.5);
    ctx.lineTo(-0.8, 5.2);
    ctx.lineTo(-0.8, -5.2);
    ctx.lineTo(-4, -4.5);
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.fill();
  } else {
    // 1. Crisp white aerodynamic single arrow body
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(8.5, 3.5);
    ctx.lineTo(2.5, 1);
    ctx.lineTo(0, -2);
    ctx.lineTo(-2.5, 1);
    ctx.lineTo(-8.5, 3.5);
    ctx.closePath();

    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Dark high-contrast stroke
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = '#0f172a';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // 2. Inner route-colored core
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5.5, 2);
    ctx.lineTo(1.5, 0.3);
    ctx.lineTo(0, -1.5);
    ctx.lineTo(-1.5, 0.3);
    ctx.lineTo(-5.5, 2);
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Normalizes any Leaflet path coordinate structure into an array of coordinate rings.
 */
function getLayerRings(layer: any): L.LatLng[][] {
  if (typeof layer.getLatLngs !== 'function') return [];
  const raw = layer.getLatLngs();
  if (!Array.isArray(raw) || raw.length === 0) return [];

  if (raw[0] && typeof raw[0].lat === 'number') {
    return [raw as L.LatLng[]];
  }

  if (Array.isArray(raw[0]) && raw[0][0] && typeof raw[0][0].lat === 'number') {
    return raw as L.LatLng[][];
  }

  const flattened: L.LatLng[][] = [];
  const recurse = (arr: any[]) => {
    if (!Array.isArray(arr) || arr.length === 0) return;
    if (arr[0] && typeof arr[0].lat === 'number') {
      flattened.push(arr as L.LatLng[]);
    } else {
      arr.forEach((item) => {
        if (Array.isArray(item)) recurse(item);
      });
    }
  };
  recurse(raw);
  return flattened;
}

/**
 * Draws a Leaflet vector path (Polyline, Polygon, Rectangle, CircleMarker) directly
 * onto the 2D canvas using the map's exact projection.
 */
function drawVectorLayerToCanvas(
  ctx: CanvasRenderingContext2D,
  layer: any,
  map: any
): void {
  if (!layer) return;

  // Handle Circle or CircleMarker
  if (typeof layer.getRadius === 'function' && typeof layer.getLatLng === 'function') {
    const center = map.latLngToContainerPoint(layer.getLatLng());
    const radius = layer.getRadius();
    const strokeColor = layer.options?.color || layer.feature?.properties?.color || '#2ebd7f';
    const fillColor = layer.options?.fillColor || layer.feature?.properties?.fillColor || strokeColor;
    const weight = typeof layer.options?.weight === 'number' ? layer.options.weight : 3;

    ctx.save();
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = fillColor;
    ctx.fill();
    if (weight > 0) {
      ctx.lineWidth = weight;
      ctx.strokeStyle = strokeColor;
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (typeof layer.getLatLngs !== 'function') return;

  const isPolygon =
    layer instanceof L.Polygon ||
    layer.feature?.geometry?.type === 'Polygon' ||
    layer.feature?.geometry?.type === 'MultiPolygon' ||
    Boolean(layer.pm?.getShape && layer.pm.getShape().includes('Polygon'));

  const rings = getLayerRings(layer);
  if (rings.length === 0) return;

  const strokeColor =
    layer.options?.color || layer.feature?.properties?.color || '#2ebd7f';
  const fillColor =
    layer.options?.fillColor || layer.feature?.properties?.fillColor || strokeColor;
  const weight = typeof layer.options?.weight === 'number' ? layer.options.weight : 4;
  const opacity = typeof layer.options?.opacity === 'number' ? layer.options.opacity : 0.9;
  const fillOpacity =
    typeof layer.options?.fillOpacity === 'number'
      ? layer.options.fillOpacity
      : isPolygon
        ? 0.25
        : 0;

  ctx.save();

  // Draw polygon fill
  if (isPolygon && fillOpacity > 0) {
    ctx.beginPath();
    for (const ring of rings) {
      if (ring.length === 0) continue;
      for (let i = 0; i < ring.length; i++) {
        const pt = map.latLngToContainerPoint(ring[i]);
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.closePath();
    }
    ctx.globalAlpha = fillOpacity;
    ctx.fillStyle = fillColor;
    ctx.fill('evenodd');
  }

  // Draw vector stroke outline
  if (weight > 0 && opacity > 0) {
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = weight;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (layer.options?.dashArray) {
      const dashes = String(layer.options.dashArray)
        .split(',')
        .map((n) => parseFloat(n.trim()))
        .filter((n) => !isNaN(n));
      if (dashes.length > 0) {
        ctx.setLineDash(dashes);
      }
    }

    for (const ring of rings) {
      if (ring.length < 2) continue;
      ctx.beginPath();
      for (let i = 0; i < ring.length; i++) {
        const pt = map.latLngToContainerPoint(ring[i]);
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      if (isPolygon) {
        ctx.closePath();
      }
      ctx.stroke();
    }
  }

  ctx.restore();
}

/**
 * Converts a Leaflet vector path into an SVG path element in exact container coordinates.
 */
function layerToSvgPath(layer: any, map: any): string {
  if (!layer) return '';

  if (typeof layer.getRadius === 'function' && typeof layer.getLatLng === 'function') {
    const center = map.latLngToContainerPoint(layer.getLatLng());
    const radius = layer.getRadius();
    const strokeColor = layer.options?.color || layer.feature?.properties?.color || '#2ebd7f';
    const fillColor = layer.options?.fillColor || layer.feature?.properties?.fillColor || strokeColor;
    const weight = typeof layer.options?.weight === 'number' ? layer.options.weight : 3;
    return `<circle cx="${center.x.toFixed(1)}" cy="${center.y.toFixed(1)}" r="${radius.toFixed(1)}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${weight}" />`;
  }

  if (typeof layer.getLatLngs !== 'function') return '';

  const isPolygon =
    layer instanceof L.Polygon ||
    layer.feature?.geometry?.type === 'Polygon' ||
    layer.feature?.geometry?.type === 'MultiPolygon' ||
    Boolean(layer.pm?.getShape && layer.pm.getShape().includes('Polygon'));

  const rings = getLayerRings(layer);
  if (rings.length === 0) return '';

  const strokeColor =
    layer.options?.color || layer.feature?.properties?.color || '#2ebd7f';
  const fillColor =
    layer.options?.fillColor || layer.feature?.properties?.fillColor || strokeColor;
  const weight = typeof layer.options?.weight === 'number' ? layer.options.weight : 4;
  const opacity = typeof layer.options?.opacity === 'number' ? layer.options.opacity : 0.9;
  const fillOpacity =
    typeof layer.options?.fillOpacity === 'number'
      ? layer.options.fillOpacity
      : isPolygon
        ? 0.25
        : 0;

  let d = '';
  for (const ring of rings) {
    if (ring.length === 0) continue;
    for (let i = 0; i < ring.length; i++) {
      const pt = map.latLngToContainerPoint(ring[i]);
      d += `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)} `;
    }
    if (isPolygon) {
      d += 'Z ';
    }
  }

  const fillRule = isPolygon ? 'fill-rule="evenodd"' : '';
  const fillAttr = isPolygon && fillOpacity > 0 ? `fill="${fillColor}" fill-opacity="${fillOpacity}"` : 'fill="none"';
  const strokeAttr = weight > 0 ? `stroke="${strokeColor}" stroke-width="${weight}" stroke-opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round"` : '';

  return `<path d="${d.trim()}" ${fillAttr} ${strokeAttr} ${fillRule} />`;
}

/**
 * Captures the current Leaflet map viewport (tiles, vector overlay paths, markers, direction arrows)
 * onto an HTML Canvas element.
 */
export async function renderMapToCanvas(
  mapContainer: HTMLElement,
  options?: { scale?: number }
): Promise<HTMLCanvasElement> {
  const scale = options?.scale || 1.5; // High-DPI for crisp printing
  const rect = mapContainer.getBoundingClientRect();
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D context not available');
  }

  ctx.scale(scale, scale);

  // Background base fill: clean light map paper
  ctx.fillStyle = '#e8eee9';
  ctx.fillRect(0, 0, width, height);

  // 1. Draw all visible map tiles
  const tileImages = Array.from(
    mapContainer.querySelectorAll<HTMLImageElement>('.leaflet-tile-pane img')
  );

  for (const img of tileImages) {
    if (img.complete && img.naturalWidth > 0) {
      try {
        const imgRect = img.getBoundingClientRect();
        const x = imgRect.left - rect.left;
        const y = imgRect.top - rect.top;
        const w = imgRect.width;
        const h = imgRect.height;

        ctx.drawImage(img, x, y, w, h);
      } catch {
        // Ignore single tainted tile if any
      }
    }
  }

  // 2. Draw all vector routes and polygons directly using Leaflet map coordinates
  // (Guarantees 100% mathematical precision with tiles and direction arrows, eliminating all DOM transform drift)
  const map: any = (mapContainer as any)._leaflet_map;
  if (map && typeof map.latLngToContainerPoint === 'function') {
    const layersToDraw: any[] = [];
    const seen = new Set<any>();

    const collectLayer = (l: any) => {
      if (!l || seen.has(l)) return;
      if (typeof l.getLatLngs === 'function' || typeof l.getRadius === 'function') {
        seen.add(l);
        layersToDraw.push(l);
      } else if (typeof l.eachLayer === 'function' && !(l instanceof L.Polyline)) {
        l.eachLayer((child: any) => collectLayer(child));
      }
    };

    const drawnItems: any = (mapContainer as any)._drawn_items;
    if (drawnItems && typeof drawnItems.eachLayer === 'function') {
      drawnItems.eachLayer(collectLayer);
    }

    if (typeof map.eachLayer === 'function') {
      map.eachLayer((l: any) => {
        if (l instanceof L.Path && !seen.has(l)) {
          collectLayer(l);
        }
      });
    }

    for (const l of layersToDraw) {
      drawVectorLayerToCanvas(ctx, l, map);
    }
  }

  // 3. Draw Direction Arrows with exact vector coordinates (no DOM rotation offset)
  const arrows = getMapArrows(mapContainer);
  for (const arrow of arrows) {
    drawDirectionArrow(ctx, arrow.pos.x, arrow.pos.y, arrow.bearing, arrow.color, arrow.bidirectional);
  }

  // 4. Draw other non-arrow markers (e.g. search pin, waypoints) from marker pane
  const markerPane = mapContainer.querySelector('.leaflet-marker-pane');
  if (markerPane) {
    const markerDivs = Array.from(markerPane.querySelectorAll<HTMLElement>('.leaflet-marker-icon'))
      .filter((m) => !m.classList.contains('route-direction-arrow-icon'));

    for (const marker of markerDivs) {
      const mRect = marker.getBoundingClientRect();
      const x = mRect.left - rect.left;
      const y = mRect.top - rect.top;

      const markerSvg = marker.querySelector('svg');
      if (markerSvg) {
        try {
          const sClone = markerSvg.cloneNode(true) as SVGSVGElement;
          sClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
          sClone.setAttribute('width', `${mRect.width}`);
          sClone.setAttribute('height', `${mRect.height}`);

          const sStr = new XMLSerializer().serializeToString(sClone);
          const sBlob = new Blob([sStr], { type: 'image/svg+xml;charset=utf-8' });
          const sUrl = URL.createObjectURL(sBlob);

          await new Promise<void>((res) => {
            const mImg = new Image();
            const timeout = setTimeout(() => {
              URL.revokeObjectURL(sUrl);
              res();
            }, 1000);

            mImg.onload = () => {
              clearTimeout(timeout);
              try {
                ctx.drawImage(mImg, x, y, mRect.width, mRect.height);
              } catch {
                // Ignore
              }
              URL.revokeObjectURL(sUrl);
              res();
            };
            mImg.onerror = () => {
              clearTimeout(timeout);
              URL.revokeObjectURL(sUrl);
              res();
            };
            mImg.src = sUrl;
          });
        } catch {
          // Skip if individual marker icon fails
        }
      }
    }
  }

  // 5. Draw North Arrow / Compass badge in corner
  drawNorthArrow(ctx, width - 45, 45);

  // 6. Draw Official Cartographic Scale Bar in bottom-left corner
  drawScaleBar(ctx, mapContainer, height);

  return canvas;
}

/**
 * Draws an official cartographic scale bar directly on the map canvas
 * using exact geodesic distances from Leaflet coordinate system.
 */
function drawScaleBar(
  ctx: CanvasRenderingContext2D,
  mapContainer: HTMLElement,
  height: number
): void {
  const map: any = (mapContainer as any)._leaflet_map;
  if (!map || typeof map.getCenter !== 'function' || typeof map.distance !== 'function') return;

  const centerLatLng = map.getCenter();
  const centerPoint = map.latLngToContainerPoint(centerLatLng);
  const point100px = L.point(centerPoint.x + 100, centerPoint.y);
  const latLng100px = map.containerPointToLatLng(point100px);
  const metersIn100Px = map.distance(centerLatLng, latLng100px);

  if (!metersIn100Px || isNaN(metersIn100Px) || metersIn100Px <= 0) return;

  // Standard cartographic increments in meters
  const scaleIncrements = [
    10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000,
  ];

  // Target bar width ~90 to 130 pixels
  const metersPerPx = metersIn100Px / 100;
  const targetMeters = metersPerPx * 110;

  let chosenMeters = scaleIncrements[0];
  for (const inc of scaleIncrements) {
    if (inc <= targetMeters) {
      chosenMeters = inc;
    } else {
      break;
    }
  }

  const barWidth = Math.round(chosenMeters / metersPerPx);
  const label = chosenMeters >= 1000 ? `${chosenMeters / 1000} km` : `${chosenMeters} m`;

  // Draw in bottom-left corner with margin
  const x = 20;
  const y = height - 20;
  const barHeight = 4;
  const halfWidth = Math.round(barWidth / 2);

  ctx.save();

  // Subtle clean background box for legibility over tiles
  const boxWidth = barWidth + 24;
  const boxHeight = 22;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.fillRect(x - 6, y - 13, boxWidth, boxHeight);
  ctx.strokeStyle = '#051d18';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 6, y - 13, boxWidth, boxHeight);

  // Left segment: solid dark pine
  ctx.fillStyle = '#051d18';
  ctx.fillRect(x, y - barHeight, halfWidth, barHeight);

  // Right segment: white
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x + halfWidth, y - barHeight, halfWidth, barHeight);

  // Outer border
  ctx.strokeStyle = '#051d18';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y - barHeight, barWidth, barHeight);

  // Ticks at 0, 50%, 100%
  ctx.beginPath();
  ctx.moveTo(x, y - barHeight - 2);
  ctx.lineTo(x, y);
  ctx.moveTo(x + halfWidth, y - barHeight - 2);
  ctx.lineTo(x + halfWidth, y);
  ctx.moveTo(x + barWidth, y - barHeight - 2);
  ctx.lineTo(x + barWidth, y);
  ctx.strokeStyle = '#051d18';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Scale label
  ctx.font = 'bold 8px sans-serif';
  ctx.fillStyle = '#051d18';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(label, x + halfWidth, y - barHeight - 2);

  ctx.restore();
}

/**
 * Draws a subtle, professional North Arrow compass indicator on the canvas
 */
function drawNorthArrow(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#051d18';
  ctx.stroke();

  // North needle
  ctx.beginPath();
  ctx.moveTo(cx, cy - 13);
  ctx.lineTo(cx - 5, cy + 4);
  ctx.lineTo(cx, cy + 1);
  ctx.fillStyle = '#ef4444';
  ctx.fill();

  // South needle
  ctx.beginPath();
  ctx.moveTo(cx, cy + 13);
  ctx.lineTo(cx + 5, cy - 4);
  ctx.lineTo(cx, cy - 1);
  ctx.fillStyle = '#64748b';
  ctx.fill();

  // 'N' label
  ctx.font = 'bold 8px sans-serif';
  ctx.fillStyle = '#051d18';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('N', cx, cy - 14);
  ctx.restore();
}

/**
 * Exports the active map view with routes to a PDF file and triggers download
 */
export async function exportMapToPdf(
  mapContainer: HTMLElement,
  options: PdfExportOptions
): Promise<void> {
  const canvas = await renderMapToCanvas(mapContainer, { scale: 1.5 });
  const pdfBlob = await createMapPdfBlob(canvas, options);
  const cleanName = (options.title || 'mapa_trasy')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '');

  downloadBlob(pdfBlob, `${cleanName || 'mapa'}.pdf`);
}

/**
 * Exports the active map view with routes, directional arrows, and compass
 * directly as a high-resolution PNG image file and triggers download
 */
export async function exportMapToPng(
  mapContainer: HTMLElement,
  title: string,
  options?: { scale?: number }
): Promise<void> {
  const scale = options?.scale || 2; // High-resolution 2x canvas
  const canvas = await renderMapToCanvas(mapContainer, { scale });

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Canvas toBlob failed to produce PNG'));
      },
      'image/png'
    );
  });

  const cleanName = (title || 'mapa_trasy')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '');

  downloadBlob(blob, `${cleanName || 'mapa'}.png`);
}

/**
 * Exports the route vectors and directional arrows as a standalone SVG file
 */
export function exportMapToSvg(
  mapContainer: HTMLElement,
  title: string
): void {
  const map: any = (mapContainer as any)._leaflet_map;
  const rect = mapContainer.getBoundingClientRect();
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);

  let routesSvg = '';
  if (map && typeof map.latLngToContainerPoint === 'function') {
    const layersToDraw: any[] = [];
    const seen = new Set<any>();

    const collectLayer = (l: any) => {
      if (!l || seen.has(l)) return;
      if (typeof l.getLatLngs === 'function' || typeof l.getRadius === 'function') {
        seen.add(l);
        layersToDraw.push(l);
      } else if (typeof l.eachLayer === 'function' && !(l instanceof L.Polyline)) {
        l.eachLayer((child: any) => collectLayer(child));
      }
    };

    const drawnItems: any = (mapContainer as any)._drawn_items;
    if (drawnItems && typeof drawnItems.eachLayer === 'function') {
      drawnItems.eachLayer(collectLayer);
    }

    if (typeof map.eachLayer === 'function') {
      map.eachLayer((l: any) => {
        if (l instanceof L.Path && !seen.has(l)) {
          collectLayer(l);
        }
      });
    }

    for (const l of layersToDraw) {
      routesSvg += `    ${layerToSvgPath(l, map)}\n`;
    }
  }

  // Include directional arrows in the SVG export
  let arrowsSvg = '';
  const arrows = getMapArrows(mapContainer);
  for (const arrow of arrows) {
    if (arrow.bidirectional) {
      arrowsSvg += `
      <g transform="translate(${arrow.pos.x.toFixed(1)}, ${arrow.pos.y.toFixed(1)}) rotate(${arrow.bearing.toFixed(1)})">
        <path d="M 0 -11.5 L 7 -4.5 L 2 -5.5 L 2 5.5 L 7 4.5 L 0 11.5 L -7 4.5 L -2 5.5 L -2 -5.5 L -7 -4.5 Z" fill="#ffffff" stroke="#0f172a" stroke-width="1.8" stroke-linejoin="round" />
        <path d="M 0 -8.5 L 4 -4.5 L 0.8 -5.2 L 0.8 5.2 L 4 4.5 L 0 8.5 L -4 4.5 L -0.8 5.2 L -0.8 -5.2 L -4 -4.5 Z" fill="${arrow.color}" />
      </g>`;
    } else {
      arrowsSvg += `
      <g transform="translate(${arrow.pos.x.toFixed(1)}, ${arrow.pos.y.toFixed(1)}) rotate(${arrow.bearing.toFixed(1)})">
        <path d="M 0 -10 L 8.5 3.5 L 2.5 1 L 0 -2 L -2.5 1 L -8.5 3.5 Z" fill="#ffffff" stroke="#0f172a" stroke-width="1.8" stroke-linejoin="round" />
        <path d="M 0 -7 L 5.5 2 L 1.5 0.3 L 0 -1.5 L -1.5 0.3 L -5.5 2 Z" fill="${arrow.color}" />
      </g>`;
    }
  }

  const svgDoc = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <title>${title || 'CRP Route Map'}</title>
  <desc>Exported from CRP - Complex Route Planning App</desc>
  <rect width="${width}" height="${height}" fill="#051d18" />
  <g id="route-layers">
${routesSvg}  </g>
  <g id="route-arrows">
    ${arrowsSvg}
  </g>
</svg>`;

  const blob = new Blob([svgDoc], { type: 'image/svg+xml;charset=utf-8' });
  const cleanName = (title || 'mapa_trasy')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '');

  downloadBlob(blob, `${cleanName || 'trasa'}.svg`);
}
