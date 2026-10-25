import { Navigation, HardDriveDownload, FolderUp, Trash2, CheckCircle2 } from 'lucide-react';
import type { RouteStats } from '../../types/route';

interface NavbarProps {
  stats: RouteStats;
  onExport: () => void;
  onImportClick: () => void;
  onClearClick: () => void;
}

export function Navbar({ stats, onExport, onImportClick, onClearClick }: NavbarProps) {
  return (
    <header className="navbar" id="app-navbar">
      <div className="navbar-brand">
        <div className="brand-icon">
          <Navigation className="icon-pulse" size={22} />
        </div>
        <div className="brand-info">
          <h1 className="brand-title">RouteCraft</h1>
          <span className="brand-subtitle">Interactive Route Planner & Branching</span>
        </div>
      </div>

      <div className="navbar-center">
        <div className="stat-pill highlight">
          <span className="stat-label">Total Distance:</span>
          <span className="stat-value">{stats.totalDistanceKm} km</span>
        </div>
        <div className="stat-pill">
          <span className="stat-label">Segments:</span>
          <span className="stat-value">{stats.lineCount}</span>
        </div>
        <div className="storage-badge" title="Automatically persisted to browser localStorage in GeoJSON format">
          <CheckCircle2 size={14} className="badge-icon" />
          <span>Local Cache Active</span>
        </div>
      </div>

      <div className="navbar-actions">
        <button
          type="button"
          className="btn-action primary"
          onClick={onExport}
          title="Export route to GeoJSON file"
          id="btn-export-geojson"
        >
          <HardDriveDownload size={16} />
          <span>Export</span>
        </button>

        <button
          type="button"
          className="btn-action secondary"
          onClick={onImportClick}
          title="Import GeoJSON file"
          id="btn-import-geojson"
        >
          <FolderUp size={16} />
          <span>Import</span>
        </button>

        <button
          type="button"
          className="btn-action danger"
          onClick={onClearClick}
          title="Clear all features from map"
          id="btn-clear-map"
        >
          <Trash2 size={16} />
          <span>Clear</span>
        </button>
      </div>
    </header>
  );
}
