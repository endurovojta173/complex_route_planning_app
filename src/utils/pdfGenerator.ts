import type { RouteCategory, RouteStats } from '../types/route';

export interface PdfExportOptions {
  title: string;
  stats: RouteStats;
  categories: RouteCategory[];
  orientation: 'landscape' | 'portrait';
  includeStats: boolean;
  includeLegend: boolean;
  dateStr?: string;
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
 * header, statistics, and category legend.
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
  const margin = 28;
  const headerY = pageHeight - margin - 18;
  const subHeaderY = headerY - 14;

  let contentTop = subHeaderY - 18;

  // If stats included, reserve space for stats row
  if (options.includeStats) {
    contentTop -= 22;
  }

  // Reserve bottom space for legend / footer
  let contentBottom = margin + 14;
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
  streamCmds += `BT /F2 16 Tf 0.04 0.15 0.12 rg ${margin} ${headerY} Td (${toPdfAscii(options.title)}) Tj ET\n`;
  // Branding top right
  const brandingText = 'CRP - Complex Route Planning';
  streamCmds += `BT /F1 10 Tf 0.35 0.45 0.42 rg ${pageWidth - margin - 150} ${headerY} Td (${toPdfAscii(brandingText)}) Tj ET\n`;

  // Subtitle / Date
  const dateInfo = `Exportovano: ${dateStr}`;
  streamCmds += `BT /F1 9 Tf 0.4 0.5 0.47 rg ${margin} ${subHeaderY} Td (${toPdfAscii(dateInfo)}) Tj ET\n`;

  // Statistics bar
  if (options.includeStats) {
    const statsY = subHeaderY - 20;
    // Light subtle background box for stats
    streamCmds += `q 0.94 0.96 0.95 rg ${margin} ${statsY - 4} ${availWidth} 18 re f Q\n`;
    streamCmds += `q 0.82 0.88 0.85 RG 0.5 w ${margin} ${statsY - 4} ${availWidth} 18 re S Q\n`;

    const distText = `Vzdalenost: ${options.stats.totalDistanceKm} km`;
    const linesText = `Useky: ${options.stats.lineCount}`;
    const featuresText = `Celkem prvku: ${options.stats.featureCount}`;
    const statsSummary = `${distText}   |   ${linesText}   |   ${featuresText}`;

    streamCmds += `BT /F2 9 Tf 0.05 0.2 0.16 rg ${margin + 8} ${statsY + 1} Td (${toPdfAscii(statsSummary)}) Tj ET\n`;
  }

  // Border around map image
  streamCmds += `q 0.8 0.85 0.82 RG 1 w ${drawX - 1} ${drawY - 1} ${drawW + 2} ${drawH + 2} re S Q\n`;

  // Draw Map Image
  streamCmds += `q ${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${drawX.toFixed(2)} ${drawY.toFixed(2)} cm /MapImg Do Q\n`;

  // Legend bar at bottom
  if (options.includeLegend && options.categories.length > 0) {
    const legendY = margin + 14;
    streamCmds += `BT /F2 8 Tf 0.2 0.25 0.23 rg ${margin} ${legendY} Td (Kategorie tras:) Tj ET\n`;

    let legendX = margin + 70;
    for (const cat of options.categories.slice(0, 5)) {
      if (legendX > pageWidth - margin - 80) break;
      const catText = `* ${cat.name || cat.shortName}`;
      streamCmds += `BT /F1 8 Tf 0.3 0.35 0.33 rg ${legendX} ${legendY} Td (${toPdfAscii(catText)}) Tj ET\n`;
      legendX += 95;
    }
  }

  // Footer: copyright / credits
  const footerText = 'Vytvoreno v aplikaci CRP (endurovojta173)';
  streamCmds += `BT /F1 7 Tf 0.55 0.6 0.58 rg ${pageWidth - margin - 150} ${margin} Td (${toPdfAscii(footerText)}) Tj ET\n`;

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
