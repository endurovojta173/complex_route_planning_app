import { createMapPdfBlob, type PdfExportOptions } from './pdfGenerator';

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
 * Captures the current Leaflet map viewport (tiles, vector overlay paths, markers)
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

  // 2. Draw Leaflet vector overlay SVG (polylines, polygons, arrows)
  const overlaySvg = mapContainer.querySelector<SVGSVGElement>('.leaflet-overlay-pane svg');
  if (overlaySvg) {
    try {
      const svgRect = overlaySvg.getBoundingClientRect();
      const svgX = svgRect.left - rect.left;
      const svgY = svgRect.top - rect.top;
      const svgW = svgRect.width;
      const svgH = svgRect.height;

      // Clone SVG and set explicit dimensions and xmlns attributes
      const clonedSvg = overlaySvg.cloneNode(true) as SVGSVGElement;
      clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clonedSvg.setAttribute('width', `${svgW}`);
      clonedSvg.setAttribute('height', `${svgH}`);

      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(clonedSvg);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);

      await new Promise<void>((resolve) => {
        const svgImg = new Image();
        const timeout = setTimeout(() => {
          URL.revokeObjectURL(svgUrl);
          resolve();
        }, 2000);

        svgImg.onload = () => {
          clearTimeout(timeout);
          try {
            ctx.drawImage(svgImg, svgX, svgY, svgW, svgH);
          } catch (e) {
            console.warn('drawImage failed:', e);
          }
          URL.revokeObjectURL(svgUrl);
          resolve();
        };
        svgImg.onerror = () => {
          clearTimeout(timeout);
          URL.revokeObjectURL(svgUrl);
          resolve();
        };
        svgImg.src = svgUrl;
      });
    } catch (err) {
      console.warn('Could not draw SVG overlay to canvas:', err);
    }
  }

  // 3. Draw Marker Icons & Direction Arrows from marker pane
  const markerPane = mapContainer.querySelector('.leaflet-marker-pane');
  if (markerPane) {
    const markerDivs = Array.from(markerPane.querySelectorAll<HTMLElement>('.leaflet-marker-icon'));
    for (const marker of markerDivs) {
      const mRect = marker.getBoundingClientRect();
      const x = mRect.left - rect.left;
      const y = mRect.top - rect.top;

      // If marker contains SVG
      const markerSvg = marker.querySelector('svg');
      if (markerSvg) {
        try {
          const sClone = markerSvg.cloneNode(true) as SVGSVGElement;
          sClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
          const sStr = new XMLSerializer().serializeToString(sClone);
          const sBlob = new Blob([sStr], { type: 'image/svg+xml;charset=utf-8' });
          const sUrl = URL.createObjectURL(sBlob);

          await new Promise<void>((res) => {
            const mImg = new Image();
            mImg.onload = () => {
              ctx.drawImage(mImg, x, y, mRect.width, mRect.height);
              URL.revokeObjectURL(sUrl);
              res();
            };
            mImg.onerror = () => {
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

  // 4. Draw North Arrow / Compass badge in corner
  drawNorthArrow(ctx, width - 45, 45);

  return canvas;
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
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '');

  downloadBlob(pdfBlob, `${cleanName || 'mapa'}.pdf`);
}

/**
 * Exports the route vectors as a standalone SVG file
 */
export function exportMapToSvg(
  mapContainer: HTMLElement,
  title: string
): void {
  const overlaySvg = mapContainer.querySelector<SVGSVGElement>('.leaflet-overlay-pane svg');
  const rect = mapContainer.getBoundingClientRect();
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);

  let innerSvgContent = '';
  if (overlaySvg) {
    innerSvgContent = overlaySvg.innerHTML;
  }

  const svgDoc = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <title>${title || 'CRP Route Map'}</title>
  <desc>Exported from CRP - Complex Route Planning App</desc>
  <rect width="${width}" height="${height}" fill="#051d18" />
  <g id="route-layers">
    ${innerSvgContent}
  </g>
</svg>`;

  const blob = new Blob([svgDoc], { type: 'image/svg+xml;charset=utf-8' });
  const cleanName = (title || 'mapa_trasy')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '');

  downloadBlob(blob, `${cleanName || 'trasa'}.svg`);
}
