import { Navigation, HardDriveDownload, FolderUp, Trash2, FolderOpen } from 'lucide-react';
import type { RouteStats, SearchLocation } from '../../types/route';
import { SearchBar } from '../Search/SearchBar';

interface NavbarProps {
  stats: RouteStats;
  activeMapName: string;
  savedMapsCount: number;
  onOpenMapsModal: () => void;
  onExport: () => void;
  onImportClick: () => void;
  onClearClick: () => void;
  onSelectLocation: (location: SearchLocation) => void;
}

export function Navbar({
  stats,
  activeMapName,
  savedMapsCount,
  onOpenMapsModal,
  onExport,
  onImportClick,
  onClearClick,
  onSelectLocation,
}: NavbarProps) {
  return (
    <header className="navbar" id="app-navbar">
      <div className="navbar-brand">
        <div className="brand-icon">
          <Navigation size={18} />
        </div>
        <div className="brand-info">
          <span className="brand-title">RouteCraft</span>
          <span className="brand-subtitle">Route Planner</span>
        </div>
      </div>

      <div className="navbar-center">
        <SearchBar onSelectLocation={onSelectLocation} />

        <div className="navbar-metrics">
          <div className="metric-item">
            <span className="metric-label">Vzdálenost</span>
            <span className="metric-value">{stats.totalDistanceKm} km</span>
          </div>
          <div className="metric-divider" />
          <div className="metric-item">
            <span className="metric-label">Úseky</span>
            <span className="metric-value">{stats.lineCount}</span>
          </div>
        </div>

        <button
          type="button"
          className="storage-status clickable"
          onClick={onOpenMapsModal}
          title="Kliknutím otevřít správu uložených map"
        >
          <span className="status-dot" />
          <span className="status-map-name">{activeMapName}</span>
        </button>
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
          className="btn-action danger"
          onClick={onClearClick}
          title="Vymazat vše z mapy"
          id="btn-clear-map"
        >
          <Trash2 size={14} />
          <span>Smazat</span>
        </button>
      </div>
    </header>
  );
}
