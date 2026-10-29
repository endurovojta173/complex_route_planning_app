import { useState } from 'react';
import { X, FileText, Image as ImageIcon, HardDriveDownload, Printer, Loader2, FileCode2 } from 'lucide-react';
import type { RouteCategory, RouteStats } from '../../types/route';
import { exportMapToPdf, exportMapToPng, exportMapToSvg } from '../../utils/mapExport';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeMapName: string;
  stats: RouteStats;
  categories: RouteCategory[];
  onExportGeoJson: () => void;
  onShowNotification: (msg: string) => void;
}

export function ExportModal({
  isOpen,
  onClose,
  activeMapName,
  stats,
  categories,
  onExportGeoJson,
  onShowNotification,
}: ExportModalProps) {
  const [docTitle, setDocTitle] = useState(activeMapName || 'Plán trasy');
  const [docSubtitle, setDocSubtitle] = useState('Koordinační plán pro PČR, Městskou policii a složky IZS');
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [includeStats, setIncludeStats] = useState(true);
  const [includeLegend, setIncludeLegend] = useState(true);
  const [includeSignOff, setIncludeSignOff] = useState(true);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingPng, setIsExportingPng] = useState(false);

  if (!isOpen) return null;

  const handlePdfExport = async () => {
    const mapContainer = document.querySelector('.leaflet-container') as HTMLElement | null;
    if (!mapContainer) {
      onShowNotification('Chyba: Mapový kontejner nebyl nalezen.');
      return;
    }

    try {
      setIsExportingPdf(true);
      await exportMapToPdf(mapContainer, {
        title: docTitle.trim() || activeMapName || 'Plán trasy',
        subtitle: docSubtitle.trim(),
        stats,
        categories,
        orientation,
        includeStats,
        includeLegend,
        includeSignOff,
      });
      onShowNotification(`PDF tisková mapa "${docTitle.trim() || activeMapName}" byla úspěšně stažena.`);
      onClose();
    } catch (err) {
      console.error('PDF export failed:', err);
      onShowNotification('Chyba při generování PDF mapy.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePngExport = async () => {
    const mapContainer = document.querySelector('.leaflet-container') as HTMLElement | null;
    if (!mapContainer) {
      onShowNotification('Chyba: Mapový kontejner nebyl nalezen.');
      return;
    }

    try {
      setIsExportingPng(true);
      await exportMapToPng(mapContainer, activeMapName || 'trasa', { scale: 2 });
      onShowNotification(`PNG obrázek mapy "${activeMapName}" byl úspěšně stažen.`);
      onClose();
    } catch (err) {
      console.error('PNG export failed:', err);
      onShowNotification('Chyba při generování PNG obrázku mapy.');
    } finally {
      setIsExportingPng(false);
    }
  };

  const handleSvgExport = () => {
    const mapContainer = document.querySelector('.leaflet-container') as HTMLElement | null;
    if (!mapContainer) {
      onShowNotification('Chyba: Mapový kontejner nebyl nalezen.');
      return;
    }

    try {
      exportMapToSvg(mapContainer, activeMapName || 'trasa');
      onShowNotification(`SVG vektorový soubor byl úspěšně stažen.`);
      onClose();
    } catch (err) {
      console.error('SVG export failed:', err);
      onShowNotification('Chyba při generování SVG souboru.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-container export-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h2 className="modal-title">Exportovat mapu a trasu</h2>
            <span className="modal-subtitle">Vyberte požadovaný formát exportu pro "{activeMapName}"</span>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            title="Zavřít"
            aria-label="Zavřít"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body export-modal-body">
          {/* Option 1: PDF Export */}
          <div className="export-card primary-export-card">
            <div className="export-card-header">
              <div className="export-card-icon-wrap pdf">
                <FileText size={22} />
              </div>
              <div className="export-card-info">
                <h3 className="export-card-title">PDF dokument (.pdf)</h3>
                <p className="export-card-desc">
                  Kompletní tisková mapa s aktuálním výřezem, trasou, měřítkem a statistikami.
                </p>
              </div>
            </div>

            <div className="export-options-grid">
              <div className="export-option-group">
                <label className="export-option-label" htmlFor="export-doc-title">
                  Název dokumentu / akce:
                </label>
                <input
                  id="export-doc-title"
                  type="text"
                  className="export-text-input"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="Např. Krojovaný průvod 2026 — Plán trasy"
                />
              </div>

              <div className="export-option-group">
                <label className="export-option-label" htmlFor="export-doc-subtitle">
                  Podtitul (pro IZS, Policii ČR, pořadatele):
                </label>
                <input
                  id="export-doc-subtitle"
                  type="text"
                  className="export-text-input"
                  value={docSubtitle}
                  onChange={(e) => setDocSubtitle(e.target.value)}
                  placeholder="Např. Koordinační plán pro PČR, Městskou policii a složky IZS"
                />
              </div>

              <div className="export-option-group">
                <label className="export-option-label">Orientace stránky:</label>
                <div className="orientation-toggle-group">
                  <button
                    type="button"
                    className={`orientation-btn ${orientation === 'landscape' ? 'active' : ''}`}
                    onClick={() => setOrientation('landscape')}
                  >
                    Na šířku (A4)
                  </button>
                  <button
                    type="button"
                    className={`orientation-btn ${orientation === 'portrait' ? 'active' : ''}`}
                    onClick={() => setOrientation('portrait')}
                  >
                    Na výšku (A4)
                  </button>
                </div>
              </div>

              <div className="export-checkboxes">
                <label className="export-checkbox-label">
                  <input
                    type="checkbox"
                    checked={includeStats}
                    onChange={(e) => setIncludeStats(e.target.checked)}
                  />
                  <span>Zahrnout statistiky trasy (celková délka, počty prvků)</span>
                </label>
                <label className="export-checkbox-label">
                  <input
                    type="checkbox"
                    checked={includeLegend}
                    onChange={(e) => setIncludeLegend(e.target.checked)}
                  />
                  <span>Zahrnout barevnou legendu tras s kilometry větví</span>
                </label>
                <label className="export-checkbox-label">
                  <input
                    type="checkbox"
                    checked={includeSignOff}
                    onChange={(e) => setIncludeSignOff(e.target.checked)}
                  />
                  <span>Zahrnout podpisové pole velitele opatření / IZS</span>
                </label>
              </div>
            </div>

            <button
              type="button"
              className="btn-action primary export-download-btn"
              onClick={handlePdfExport}
              disabled={isExportingPdf}
            >
              {isExportingPdf ? (
                <>
                  <Loader2 size={16} className="spinner-icon-inline" />
                  <span>Generuji PDF...</span>
                </>
              ) : (
                <>
                  <FileText size={16} />
                  <span>Stáhnout PDF mapu</span>
                </>
              )}
            </button>
          </div>

          {/* Secondary Grid: PNG, SVG & GeoJSON */}
          <div className="export-secondary-grid">
            {/* PNG Image Export */}
            <div className="export-card secondary-export-card">
              <div className="export-card-header compact">
                <div className="export-card-icon-wrap png">
                  <ImageIcon size={18} />
                </div>
                <div className="export-card-info">
                  <h4 className="export-card-title-sm">PNG obrázek</h4>
                  <p className="export-card-desc-sm">Obrázek mapy s trasou ve vysokém rozlišení.</p>
                </div>
              </div>
              <button
                type="button"
                className="btn-action secondary export-btn-sm"
                onClick={handlePngExport}
                disabled={isExportingPng}
              >
                {isExportingPng ? (
                  <>
                    <Loader2 size={13} className="spinner-icon-inline" />
                    <span>Ukládám...</span>
                  </>
                ) : (
                  <>
                    <ImageIcon size={14} />
                    <span>Stáhnout PNG (.png)</span>
                  </>
                )}
              </button>
            </div>

            {/* SVG Export */}
            <div className="export-card secondary-export-card">
              <div className="export-card-header compact">
                <div className="export-card-icon-wrap svg">
                  <FileCode2 size={18} />
                </div>
                <div className="export-card-info">
                  <h4 className="export-card-title-sm">SVG vektor</h4>
                  <p className="export-card-desc-sm">Čistá vektorová grafika tras pro grafické editory.</p>
                </div>
              </div>
              <button
                type="button"
                className="btn-action secondary export-btn-sm"
                onClick={handleSvgExport}
              >
                <FileCode2 size={14} />
                <span>Stáhnout SVG (.svg)</span>
              </button>
            </div>

            {/* GeoJSON Export */}
            <div className="export-card secondary-export-card">
              <div className="export-card-header compact">
                <div className="export-card-icon-wrap geojson">
                  <HardDriveDownload size={18} />
                </div>
                <div className="export-card-info">
                  <h4 className="export-card-title-sm">GeoJSON data</h4>
                  <p className="export-card-desc-sm">Data tras a bodů pro GIS a import do CRP.</p>
                </div>
              </div>
              <button
                type="button"
                className="btn-action secondary export-btn-sm"
                onClick={() => {
                  onExportGeoJson();
                  onClose();
                }}
              >
                <HardDriveDownload size={14} />
                <span>Stáhnout GeoJSON (.geojson)</span>
              </button>
            </div>
          </div>
        </div>

        <div className="modal-footer export-modal-footer">
          <button
            type="button"
            className="btn-action secondary print-btn"
            onClick={handlePrint}
            title="Otevřít systémový dialog tisku"
          >
            <Printer size={15} />
            <span>Rychlý tisk (Ctrl+P)</span>
          </button>
          <button
            type="button"
            className="btn-action secondary close-btn"
            onClick={onClose}
          >
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
}
