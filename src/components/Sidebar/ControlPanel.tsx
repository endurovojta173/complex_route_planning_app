import { useState } from 'react';
import { Activity, ChevronLeft, ChevronRight } from 'lucide-react';
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
            </div>
            <div className="stats-hero-value-wrap">
              <span className="stats-hero-num">{stats.totalDistanceKm}</span>
              <span className="stats-hero-unit">km</span>
            </div>
            <span className="stats-hero-sub">
              ≈ {(stats.totalDistanceKm * 0.621371).toFixed(2)} mi
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
