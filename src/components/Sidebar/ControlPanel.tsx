import { useState } from 'react';
import {
  Layers,
  Activity,
  Info,
  ChevronLeft,
  ChevronRight,
  Route,
  MapPin,
  Pentagon,
} from 'lucide-react';
import type { RouteStats, TileProviderId } from '../../types/route';
import { TILE_PROVIDERS } from '../../utils/tileProviders';

interface ControlPanelProps {
  stats: RouteStats;
  currentTileId: TileProviderId;
  onTileSelect: (id: TileProviderId) => void;
  onOpenInfoModal?: () => void;
}

export function ControlPanel({
  stats,
  currentTileId,
  onTileSelect,
  onOpenInfoModal,
}: ControlPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside className={`control-panel ${isCollapsed ? 'collapsed' : ''}`} id="control-sidebar">
      <button
        type="button"
        className="collapse-toggle-btn"
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? 'Expand panel' : 'Collapse panel'}
        aria-label="Toggle sidebar"
      >
        {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>

      <div className="panel-content">
        {/* Section: Route Analytics */}
        <div className="panel-section">
          <div className="section-title">
            <Activity size={16} className="title-icon" />
            <span>Route Analytics</span>
          </div>
          <div className="stats-grid">
            <div className="stat-card accent">
              <span className="card-label">Distance</span>
              <span className="card-value">{stats.totalDistanceKm} <small>km</small></span>
              <span className="card-sub">({(stats.totalDistanceKm * 0.621371).toFixed(2)} mi)</span>
            </div>
            <div className="stat-card">
              <span className="card-label">Total Elements</span>
              <span className="card-value">{stats.featureCount}</span>
            </div>
            <div className="stat-card">
              <div className="card-header">
                <Route size={14} />
                <span className="card-label">Lines</span>
              </div>
              <span className="card-value">{stats.lineCount}</span>
            </div>
            <div className="stat-card">
              <div className="card-header">
                <Pentagon size={14} />
                <span className="card-label">Polygons</span>
              </div>
              <span className="card-value">{stats.polygonCount}</span>
            </div>
            <div className="stat-card">
              <div className="card-header">
                <MapPin size={14} />
                <span className="card-label">Waypoints</span>
              </div>
              <span className="card-value">{stats.markerCount}</span>
            </div>
          </div>
        </div>

        {/* Section: Basemap Selection */}
        <div className="panel-section">
          <div className="section-title">
            <Layers size={16} className="title-icon" />
            <span>Map Layers</span>
          </div>
          <div className="tiles-selector">
            {TILE_PROVIDERS.map((provider) => (
              <button
                key={provider.id}
                type="button"
                className={`tile-btn ${currentTileId === provider.id ? 'active' : ''}`}
                onClick={() => onTileSelect(provider.id)}
              >
                <span className="tile-indicator" />
                <span className="tile-name">{provider.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Section: Technology & Architecture Notice */}
        <button
          type="button"
          className="panel-footer-note clickable"
          onClick={onOpenInfoModal}
          title="Zobrazit podrobnosti o aplikaci a ukládání dat"
        >
          <Info size={14} />
          <span>Lokální ukládání GeoJSON &bull; Bez serverů</span>
        </button>
      </div>
    </aside>
  );
}
