import { Navigation, HardDriveDownload, FolderUp, Trash2, FolderOpen, Info } from 'lucide-react';
import type { SearchLocation } from '../../types/route';
import { SearchBar } from '../Search/SearchBar';

interface NavbarProps {
  savedMapsCount: number;
  onOpenMapsModal: () => void;
  onOpenInfoModal: () => void;
  onExport: () => void;
  onImportClick: () => void;
  onClearClick: () => void;
  onSelectLocation: (location: SearchLocation) => void;
}

export function Navbar({
  savedMapsCount,
  onOpenMapsModal,
  onOpenInfoModal,
  onExport,
  onImportClick,
  onClearClick,
  onSelectLocation,
}: NavbarProps) {
  return (
    <header className="navbar" id="app-navbar">
      <div
        className="navbar-brand clickable"
        onClick={onOpenInfoModal}
        title="Kliknutím zobrazit informace o aplikaci"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onOpenInfoModal();
        }}
      >
        <Navigation size={20} className="brand-icon-simple" />
        <span className="brand-title">CRP</span>
      </div>

      <div className="navbar-center">
        <SearchBar onSelectLocation={onSelectLocation} />
      </div>

      <div className="navbar-actions">
        <button
          type="button"
          className="btn-action secondary maps-btn"
          onClick={onOpenMapsModal}
          title="Správa uložených map"
          id="btn-saved-maps"
        >
          <FolderOpen size={14} />
          <span>Mapy ({savedMapsCount})</span>
        </button>

        <button
          type="button"
          className="btn-action secondary"
          onClick={onImportClick}
          title="Importovat GeoJSON"
          id="btn-import-geojson"
        >
          <FolderUp size={14} />
          <span>Import</span>
        </button>

        <button
          type="button"
          className="btn-action primary"
          onClick={onExport}
          title="Exportovat trasu do GeoJSON"
          id="btn-export-geojson"
        >
          <HardDriveDownload size={14} />
          <span>Export</span>
        </button>

        <button
          type="button"
          className="btn-action secondary btn-icon-only info-btn"
          onClick={onOpenInfoModal}
          title="O aplikaci, autorovi a lokálním ukládání"
          aria-label="Informace o aplikaci"
          id="btn-info-modal"
        >
          <Info size={15} />
        </button>

        <button
          type="button"
          className="btn-action danger btn-icon-only"
          onClick={onClearClick}
          title="Vymazat vše z mapy"
          aria-label="Vymazat vše z mapy"
          id="btn-clear-map"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </header>
  );
}
