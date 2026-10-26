import { useState } from 'react';
import {
  Layers,
  Activity,
  ChevronLeft,
  ChevronRight,
  Route,
  MapPin,
  Pentagon,
} from 'lucide-react';
import type { RouteStats } from '../../types/route';

interface ControlPanelProps {
  stats: RouteStats;
}

export function ControlPanel({ stats }: ControlPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside className={`control-panel ${isCollapsed ? 'collapsed' : ''}`} id="control-sidebar">
      <button
        type="button"
        className="collapse-toggle-btn"
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? 'Rozbalit panel' : 'Sbalit panel'}
        aria-label="Přepnout postranní panel"
      >
        {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>

      <div className="panel-content">
        {/* Section: Route Analytics */}
        <div className="panel-section">
          <div className="section-title">
            <Activity size={16} className="title-icon" />
            <span>Statistika trasy</span>
          </div>

          <div className="stats-hero-card">
            <div className="stats-hero-top">
              <span className="stats-hero-label">Celková délka</span>
              <span className="stats-hero-badge">Aktivní trasa</span>
            </div>
            <div className="stats-hero-value-wrap">
              <span className="stats-hero-num">{stats.totalDistanceKm}</span>
              <span className="stats-hero-unit">km</span>
            </div>
            <span className="stats-hero-sub">
              ≈ {(stats.totalDistanceKm * 0.621371).toFixed(2)} mi
            </span>
          </div>

          <div className="stats-mini-grid">
            <div className="mini-stat-card">
              <div className="mini-stat-header">
                <Layers size={13} />
                <span>Celkem prvků</span>
              </div>
              <span className="mini-stat-num">{stats.featureCount}</span>
            </div>

            <div className="mini-stat-card">
              <div className="mini-stat-header">
                <Route size={13} />
                <span>Úseky</span>
              </div>
              <span className="mini-stat-num">{stats.lineCount}</span>
            </div>

            <div className="mini-stat-card">
              <div className="mini-stat-header">
                <Pentagon size={13} />
                <span>Polygony</span>
              </div>
              <span className="mini-stat-num">{stats.polygonCount}</span>
            </div>

            <div className="mini-stat-card">
              <div className="mini-stat-header">
                <MapPin size={13} />
                <span>Značky</span>
              </div>
              <span className="mini-stat-num">{stats.markerCount}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
