import { useState } from 'react';
import { Route, ChevronDown, ChevronUp } from 'lucide-react';
import type { RouteStats, RouteCategory } from '../../types/route';

interface RouteStatsPanelProps {
  stats: RouteStats;
  categories: RouteCategory[];
  activeCategory?: RouteCategory;
  onSelectCategory?: (category: RouteCategory) => void;
}

export function RouteStatsPanel({
  stats,
  categories,
  activeCategory,
  onSelectCategory,
}: RouteStatsPanelProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    return localStorage.getItem('crp_stats_panel_expanded') !== 'false';
  });

  const toggleExpanded = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      localStorage.setItem('crp_stats_panel_expanded', String(next));
      return next;
    });
  };

  // Build category stats map for easy lookup
  const statsMap = new Map<string, { distanceKm: number; count: number }>();
  if (stats.categoryStats) {
    for (const item of stats.categoryStats) {
      statsMap.set(item.categoryId, { distanceKm: item.distanceKm, count: item.count });
    }
  }

  // Filter categories that either have drawn features or are the active one
  const relevantCategories = categories.filter((cat) => {
    const record = statsMap.get(cat.id);
    return (record && (record.count > 0 || record.distanceKm > 0)) || cat.id === activeCategory?.id;
  });

  // If no category has drawn items yet, show active or top 3 categories
  const displayedCategories =
    relevantCategories.length > 0 ? relevantCategories : categories.slice(0, 3);

  if (!isExpanded) {
    return (
      <div className="stats-panel-minimized" onClick={toggleExpanded}>
        <button
          type="button"
          className="btn-stats-minimize-toggle"
          title="Kliknutím rozbalit přehled délek a tras"
          aria-label="Rozbalit přehled délek"
        >
          <Route size={14} className="stats-panel-icon" />
          <span className="stats-min-label">Délka:</span>
          <span className="stats-min-value">{stats.totalDistanceKm} km</span>
          <ChevronUp size={14} className="stats-arrow-icon" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="stats-panel-container"
      role="region"
      aria-label="Přehled délek a legendy tras"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Panel Header */}
      <div className="stats-panel-header" onClick={toggleExpanded} title="Kliknutím sbalit">
        <div className="stats-panel-title-wrap">
          <Route size={15} className="stats-panel-icon" />
          <span className="stats-panel-title">Přehled tras</span>
        </div>
        <div className="stats-panel-header-actions">
          <span className="stats-panel-total-badge">{stats.totalDistanceKm} km</span>
          <button
            type="button"
            className="btn-stats-toggle-icon"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpanded();
            }}
            title="Sbalit panel"
            aria-label="Sbalit panel"
          >
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      {/* Categories Breakdown List */}
      <div className="stats-panel-body">
        {stats.featureCount === 0 ? (
          <div className="stats-empty-msg">
            <span>Zatím nejsou nakresleny žádné trasy.</span>
          </div>
        ) : (
          <div className="stats-category-list">
            {displayedCategories.map((cat) => {
              const rec = statsMap.get(cat.id) || { distanceKm: 0, count: 0 };
              const isActive = cat.id === activeCategory?.id;

              return (
                <div
                  key={cat.id}
                  className={`stats-category-row ${isActive ? 'is-active' : ''} ${
                    onSelectCategory ? 'clickable' : ''
                  }`}
                  onClick={() => onSelectCategory?.(cat)}
                  title={
                    onSelectCategory
                      ? `${cat.name} — Kliknutím vybrat pro kreslení`
                      : cat.name
                  }
                >
                  <div className="stats-cat-left">
                    <span
                      className="stats-cat-swatch"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="stats-cat-name">{cat.name}</span>
                  </div>
                  <div className="stats-cat-right">
                    <span className="stats-cat-dist">{rec.distanceKm} km</span>
                    {rec.count > 0 && (
                      <span className="stats-cat-count">
                        ({rec.count})
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Summary Footer */}
        <div className="stats-panel-footer">
          <div className="stats-summary-meta">
            <span>Úseky: <strong>{stats.lineCount}</strong></span>
            <span className="stats-sep">•</span>
            <span>Body: <strong>{stats.markerCount}</strong></span>
            {stats.polygonCount > 0 && (
              <>
                <span className="stats-sep">•</span>
                <span>Zóny: <strong>{stats.polygonCount}</strong></span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

