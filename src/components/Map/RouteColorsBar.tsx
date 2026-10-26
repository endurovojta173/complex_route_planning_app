import { useState } from 'react';
import type { RouteCategory } from '../../utils/routeColors';
import { Palette, Pencil, Check, X } from 'lucide-react';

interface RouteColorsBarProps {
  categories: RouteCategory[];
  activeCategory: RouteCategory;
  onSelectCategory: (category: RouteCategory) => void;
  onRenameCategory: (id: string, newName: string) => void;
}

export function RouteColorsBar({
  categories,
  activeCategory,
  onSelectCategory,
  onRenameCategory,
}: RouteColorsBarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleStartEdit = (cat: RouteCategory) => {
    setEditingId(cat.id);
    setEditingName(cat.name);
  };

  const handleSaveEdit = (catId: string) => {
    onRenameCategory(catId, editingName);
    setEditingId(null);
  };

  return (
    <div className="route-colors-floating-bar" id="route-colors-palette">
      <div className="palette-label">
        <Palette size={13} className="palette-icon" />
        <span className="palette-title">Barva kreslení:</span>
      </div>

      <div className="palette-chips-list">
        {categories.map((cat) => {
          const isActive = cat.id === activeCategory.id;
          const isEditing = editingId === cat.id;

          if (isEditing) {
            return (
              <div
                key={cat.id}
                className="palette-chip editing"
                onClick={(e) => e.stopPropagation()}
              >
                <span
                  className="chip-dot"
                  style={{ backgroundColor: cat.color }}
                />
                <input
                  type="text"
                  className="chip-edit-input"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit(cat.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  autoFocus
                  maxLength={30}
                  placeholder={cat.baseColorName}
                />
                <button
                  type="button"
                  className="chip-action-btn confirm"
                  onClick={() => handleSaveEdit(cat.id)}
                  title="Uložit název (Enter)"
                >
                  <Check size={11} />
                </button>
                <button
                  type="button"
                  className="chip-action-btn cancel"
                  onClick={() => setEditingId(null)}
                  title="Zrušit (Esc)"
                >
                  <X size={11} />
                </button>
              </div>
            );
          }

          return (
            <button
              key={cat.id}
              type="button"
              className={`palette-chip ${isActive ? 'active' : ''}`}
              onClick={() => onSelectCategory(cat)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                handleStartEdit(cat);
              }}
              title={`${cat.name} (${cat.description}) — dvojklikem nebo tužkou přejmenovat`}
            >
              <span
                className="chip-dot"
                style={{ backgroundColor: cat.color }}
              />
              <span className="chip-name">{cat.shortName}</span>
              <span
                role="button"
                className="chip-edit-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartEdit(cat);
                }}
                title={`Přejmenovat barvu ${cat.name}`}
              >
                <Pencil size={10} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
