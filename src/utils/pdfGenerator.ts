import type { RouteCategory, RouteStats } from '../types/route';

export interface PdfExportOptions {
  title: string;
  subtitle?: string;
  stats: RouteStats;
  categories: RouteCategory[];
  orientation: 'landscape' | 'portrait';
  includeStats: boolean;
  includeLegend: boolean;
  includeSignOff?: boolean;
  dateStr?: string;
}

/**
 * Converts a hex color string to PDF RGB components (0.0 to 1.0)
 */
function hexToPdfRgb(hex: string): { r: number; g: number; b: number } {
  const clean = (hex || '#2ebd7f').replace('#', '').trim();
  let fullHex = clean;
  if (clean.length === 3) {
    fullHex = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(fullHex, 16);
  if (isNaN(num)) return { r: 0.18, g: 0.74, b: 0.5 };
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  return {
    r: Number(r.toFixed(3)),
    g: Number(g.toFixed(3)),
    b: Number(b.toFixed(3)),
  };
}

/**
 * Strips non-ASCII diacritics for PDF standard Type 1 Helvetica font
 * to avoid encoding issues while preserving Czech text readability.
 */
function toPdfAscii(text: unknown): string {
  if (text === null || text === undefined) return '';
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/[()\\]/g, '\\$&');
}

/**
 * Builds a valid, standard PDF 1.4 binary file with embedded JPEG map snapshot,
 * header, statistics, color legend swatches, and official IZS / Police sign-off.
 */
export async function createMapPdfBlob(
  canvas: HTMLCanvasElement,
  options: PdfExportOptions
): Promise<Blob> {
  const isLandscape = options.orientation === 'landscape';
  // Standard A4 dimensions in points (72 pt per inch)
  const pageWidth = isLandscape ? 841.89 : 595.28;
  const pageHeight = isLandscape ? 595.28 : 841.89;

  // Convert canvas to JPEG blob
  const jpegBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Canvas toBlob failed'));
      },
      'image/jpeg',
      0.92
    );
  });

  const jpegArrayBuffer = await jpegBlob.arrayBuffer();
  const jpegBytes = new Uint8Array(jpegArrayBuffer);
  const imgPixelWidth = canvas.width;
  const imgPixelHeight = canvas.height;

  // Layout geometry (points)
  const margin = 24;
  const headerY = pageHeight - margin - 16;
  const subHeaderY = headerY - 14;

  let contentTop = subHeaderY - 16;

  // If stats included, reserve space for stats bar
  if (options.includeStats) {
    contentTop -= 22;
  }

  // Reserve bottom space for legend / sign-off footer
  let contentBottom = margin + 14;
  if (options.includeSignOff) {
    contentBottom += 16;
  }
  if (options.includeLegend && options.categories.length > 0) {
    contentBottom += 28;
  }

  const availWidth = pageWidth - margin * 2;
  const availHeight = contentTop - contentBottom;

  // Fit image into available rect while maintaining aspect ratio
  const imgAspect = imgPixelWidth / imgPixelHeight;
  const rectAspect = availWidth / availHeight;

  let drawW = availWidth;
  let drawH = availHeight;
  let drawX = margin;
  let drawY = contentBottom;

  if (imgAspect > rectAspect) {
    drawW = availWidth;
    drawH = availWidth / imgAspect;
    drawY = contentBottom + (availHeight - drawH) / 2;
  } else {
    drawH = availHeight;
    drawW = availHeight * imgAspect;
    drawX = margin + (availWidth - drawW) / 2;
  }

  // Date string
  const dateStr = options.dateStr || new Date().toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Build PDF content stream
  let streamCmds = '';

  // Background page fill: clean white paper
  streamCmds += `q 1 1 1 rg 0 0 ${pageWidth} ${pageHeight} re f Q\n`;

  // Header Bar: dark green header text & branding
  // Title
  streamCmds += `BT /F2 15 Tf 0.04 0.15 0.12 rg ${margin} ${headerY} Td (${toPdfAscii(options.title)}) Tj ET\n`;

  // Branding & metadata top right
  const brandingText = 'CRP - Complex Route Planning';
  streamCmds += `BT /F2 9 Tf 0.25 0.35 0.32 rg ${pageWidth - margin - 160} ${headerY + 2} Td (${toPdfAscii(brandingText)}) Tj ET\n`;
  streamCmds += `BT /F1 7.5 Tf 0.45 0.55 0.52 rg ${pageWidth - margin - 160} ${headerY - 9} Td (${toPdfAscii(`WGS84 • Vystup pro IZS a PCR`)}) Tj ET\n`;

  // Subtitle / Date
  const subtitleText = options.subtitle || `Plan trasy a koordinace logistiky • Datum: ${dateStr}`;
  streamCmds += `BT /F1 8.5 Tf 0.35 0.45 0.42 rg ${margin} ${subHeaderY} Td (${toPdfAscii(subtitleText)}) Tj ET\n`;

  // Statistics bar
  if (options.includeStats) {
    const statsY = subHeaderY - 18;
    // Light subtle background box for stats
    streamCmds += `q 0.94 0.96 0.95 rg ${margin} ${statsY - 4} ${availWidth} 18 re f Q\n`;
    streamCmds += `q 0.82 0.88 0.85 RG 0.5 w ${margin} ${statsY - 4} ${availWidth} 18 re S Q\n`;

    const distText = `Celkova delka: ${options.stats.totalDistanceKm} km`;
    const linesText = `Useky tras: ${options.stats.lineCount}`;
    const markersText = `Body / stanoviste: ${options.stats.markerCount}`;
    const polygonsText = options.stats.polygonCount > 0 ? `Zony: ${options.stats.polygonCount}` : '';
    const statsSummary = [distText, linesText, markersText, polygonsText].filter(Boolean).join('   |   ');

    streamCmds += `BT /F2 8.5 Tf 0.05 0.2 0.16 rg ${margin + 8} ${statsY + 1} Td (${toPdfAscii(statsSummary)}) Tj ET\n`;
  }

  // Border around map image
  streamCmds += `q 0.8 0.85 0.82 RG 1 w ${drawX - 1} ${drawY - 1} ${drawW + 2} ${drawH + 2} re S Q\n`;

  // Draw Map Image
  streamCmds += `q ${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${drawX.toFixed(2)} ${drawY.toFixed(2)} cm /MapImg Do Q\n`;

  // Category stats map lookup
  const statsMap = new Map<string, { distanceKm: number; count: number }>();
  if (options.stats.categoryStats) {
    for (const cs of options.stats.categoryStats) {
      statsMap.set(cs.categoryId, { distanceKm: cs.distanceKm, count: cs.count });
    }
  }

  // Legend bar at bottom with real colored swatches
  let currentBottomY = margin + 14;

  if (options.includeSignOff) {
    const signOffY = margin + 14;
    // Sign-off line for Police / Emergency Commander
    streamCmds += `BT /F1 7.5 Tf 0.45 0.55 0.52 rg ${margin} ${signOffY} Td (${toPdfAscii('Urceno pro rizeni provozu a koordinaci slozek IZS.')}) Tj ET\n`;
    const signLineText = 'Podpis velitele bezp. opatreni: ........................................';
    streamCmds += `BT /F2 7.5 Tf 0.25 0.35 0.32 rg ${pageWidth - margin - 230} ${signOffY} Td (${toPdfAscii(signLineText)}) Tj ET\n`;
    currentBottomY += 16;
  }

  if (options.includeLegend && options.categories.length > 0) {
    const legendY = currentBottomY;
    streamCmds += `BT /F2 8 Tf 0.1 0.2 0.18 rg ${margin} ${legendY} Td (LEGENDA TRAS:) Tj ET\n`;

    let legendX = margin + 78;
    // Show categories
    for (const cat of options.categories.slice(0, 6)) {
      if (legendX > pageWidth - margin - 90) break;
      const rgb = hexToPdfRgb(cat.color);
      const catStat = statsMap.get(cat.id);

      // Draw colored vector rectangle swatch
      streamCmds += `q ${rgb.r} ${rgb.g} ${rgb.b} rg ${legendX} ${legendY - 1} 10 7 re f Q\n`;
      streamCmds += `q 0.1 0.2 0.18 RG 0.5 w ${legendX} ${legendY - 1} 10 7 re S Q\n`;

      const distPart = catStat && catStat.distanceKm > 0 ? ` (${catStat.distanceKm} km)` : '';
      const catLabel = `${cat.name}${distPart}`;

      streamCmds += `BT /F1 7.5 Tf 0.2 0.3 0.28 rg ${legendX + 13} ${legendY} Td (${toPdfAscii(catLabel)}) Tj ET\n`;

      // Advance X based on label length
      const itemWidth = Math.max(90, Math.min(130, catLabel.length * 5.5 + 24));
      legendX += itemWidth;
    }
  }

  // Footer: copyright / credits
  const footerText = 'CRP - Complex Route Planning App (endurovojta173)';
  streamCmds += `BT /F1 7 Tf 0.55 0.6 0.58 rg ${pageWidth - margin - 170} ${margin - 2} Td (${toPdfAscii(footerText)}) Tj ET\n`;

  const textEncoder = new TextEncoder();
  const streamBytes = textEncoder.encode(streamCmds);

  // Construct PDF Objects with exact byte offsets for xref
  const parts: Uint8Array[] = [];
  const offsets: number[] = [0]; // obj 0 is free

  let currentOffset = 0;
  function writeChunk(str: string) {
    const chunk = textEncoder.encode(str);
    parts.push(chunk);
    currentOffset += chunk.length;
  }

  function writeBytes(bytes: Uint8Array) {
    parts.push(bytes);
    currentOffset += bytes.length;
  }

  // Header
  writeChunk('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  // Object 1: Catalog
  offsets.push(currentOffset);
  writeChunk('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // Object 2: Pages
  offsets.push(currentOffset);
  writeChunk('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  // Object 3: Page
  offsets.push(currentOffset);
  writeChunk(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] ` +
    `/Resources << /Font << /F1 4 0 R /F2 5 0 R >> /XObject << /MapImg 6 0 R >> >> ` +
    `/Contents 7 0 R >>\nendobj\n`
  );

  // Object 4: Font F1 (Helvetica)
  offsets.push(currentOffset);
  writeChunk('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n');

  // Object 5: Font F2 (Helvetica-Bold)
  offsets.push(currentOffset);
  writeChunk('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n');

  // Object 6: Image XObject (JPEG)
  offsets.push(currentOffset);
  writeChunk(
    `6 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgPixelWidth} /Height ${imgPixelHeight} ` +
    `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`
  );
  writeBytes(jpegBytes);
  writeChunk('\nendstream\nendobj\n');

  // Object 7: Content Stream
  offsets.push(currentOffset);
  writeChunk(`7 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`);
  writeBytes(streamBytes);
  writeChunk('\nendstream\nendobj\n');

  // Cross-reference table (xref)
  const xrefOffset = currentOffset;
  writeChunk(`xref\n0 8\n0000000000 65535 f \n`);
  for (let i = 1; i <= 7; i++) {
    const offStr = String(offsets[i]).padStart(10, '0');
    writeChunk(`${offStr} 00000 n \n`);
  }

  // Trailer
  writeChunk(
    `trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  );

  return new Blob(parts as unknown as BlobPart[], { type: 'application/pdf' });
}
