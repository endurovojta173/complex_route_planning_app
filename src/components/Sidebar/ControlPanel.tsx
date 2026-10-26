import { useState } from 'react';
import {
  Layers,
  Activity,
  ChevronLeft,
  ChevronRight,
  Route,
  MapPin,
  Pentagon,
  Palette,
  Check,
  Pencil,
  X,
} from 'lucide-react';
import type { RouteStats, TileProviderId, RouteCategory } from '../../types/route';
import { TILE_PROVIDERS } from '../../utils/tileProviders';

interface ControlPanelProps {
  stats: RouteStats;
  currentTileId: TileProviderId;
  onTileSelect: (id: TileProviderId) => void;
  activeCategory: RouteCategory;
  onSelectCategory: (category: RouteCategory) => void;
  categories: RouteCategory[];
  onRenameCategory: (id: string, newName: string) => void;
}

export function ControlPanel({
  stats,
  currentTileId,
  onTileSelect,
  activeCategory,
  onSelectCategory,
  categories,
  onRenameCategory,
}: ControlPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');

  const handleStartRename = (cat: RouteCategory) => {
    setEditingCatId(cat.id);
    setEditingCatName(cat.name);
  };

  const handleSaveRename = (catId: string) => {
    onRenameCategory(catId, editingCatName);
    setEditingCatId(null);
  };

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

        {/* Section: Route Colors & Names */}
        <div className="panel-section">
          <div className="section-title">
            <Palette size={16} className="title-icon" />
            <span>Barvy a názvy tras</span>
          </div>
          <div className="categories-list">
            {categories.map((cat) => {
              const stat = stats.categoryStats?.find((s) => s.categoryId === cat.id);
              const isActive = cat.id === activeCategory.id;
              const hasDistance = Boolean(stat && stat.distanceKm > 0);
              const hasCount = Boolean(stat && stat.count > 0);
              const isEditing = editingCatId === cat.id;

              if (isEditing) {
                return (
                  <div
                    key={cat.id}
                    className="category-item-edit-box"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span
                      className="category-color-dot"
                      style={{ backgroundColor: cat.color }}
                    />
                    <input
                      type="text"
                      className="category-rename-input"
                      value={editingCatName}
                      onChange={(e) => setEditingCatName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename(cat.id);
                        if (e.key === 'Escape') setEditingCatId(null);
                      }}
                      autoFocus
                      maxLength={30}
                      placeholder={cat.baseColorName}
                    />
                    <button
                      type="button"
                      className="cat-edit-action-btn confirm"
                      onClick={() => handleSaveRename(cat.id)}
                      title="Uložit název (Enter)"
                    >
                      <Check size={13} />
                    </button>
                    <button
                      type="button"
                      className="cat-edit-action-btn cancel"
                      onClick={() => setEditingCatId(null)}
                      title="Zrušit (Esc)"
                    >
                      <X size={13} />
                    </button>
                  </div>
                );
              }

              return (
                <div
                  key={cat.id}
                  className={`category-item-btn ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectCategory(cat)}
                  title={`${cat.description} — kliknutím vybrat pro kreslení`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') onSelectCategory(cat);
                  }}
                >
                  <div className="category-item-main">
                    <span
                      className="category-color-dot"
                      style={{ backgroundColor: cat.color }}
                    />
                    <div className="category-text-col">
                      <div className="category-name-row">
                        <span className="category-name">{cat.name}</span>
                        {isActive && <Check size={12} className="category-active-check" />}
                        <button
                          type="button"
                          className="category-rename-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartRename(cat);
                          }}
                          title={`Přejmenovat barvu ${cat.name}`}
                        >
                          <Pencil size={11} />
                        </button>
                      </div>
                      <span className="category-desc">{cat.description}</span>
                    </div>
                  </div>

                  <div className="category-stats-col">
                    {hasDistance ? (
                      <span className="category-dist-badge" style={{ color: cat.color }}>
                        {stat!.distanceKm} km
                      </span>
                    ) : hasCount ? (
                      <span className="category-count-badge">
                        {stat!.count} {stat!.count === 1 ? 'prvek' : 'prvků'}
                      </span>
                    ) : (
                      <span className="category-empty-dash">-</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section: Basemap Selection */}
        <div className="panel-section">
          <div className="section-title">
            <Layers size={16} className="title-icon" />
            <span>Mapové podklady</span>
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
      </div>
    </aside>
  );
}
