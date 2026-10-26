import { useState, useRef, useEffect } from 'react';
import type { RouteCategory } from '../../utils/routeColors';
import { Palette, Pencil, Check, X, Plus } from 'lucide-react';

interface RouteColorsBarProps {
  categories: RouteCategory[];
  activeCategoryIds: string[];
  activeCategory: RouteCategory;
  onSelectCategory: (category: RouteCategory) => void;
  onRenameCategory: (id: string, newName: string) => void;
  onAddCategory: (id: string) => void;
  onRemoveCategory: (id: string) => void;
}

export function RouteColorsBar({
  categories,
  activeCategoryIds,
  activeCategory,
  onSelectCategory,
  onRenameCategory,
  onAddCategory,
  onRemoveCategory,
}: RouteColorsBarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement | null>(null);

  // Close add dropdown when clicking outside
  useEffect(() => {
    if (!isAddMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setIsAddMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAddMenuOpen]);

  const handleStartEdit = (cat: RouteCategory) => {
    setEditingId(cat.id);
    setEditingName(cat.name);
  };

  const handleSaveEdit = (catId: string) => {
    onRenameCategory(catId, editingName);
    setEditingId(null);
  };

  // Only display categories that have been added to the bar
  const displayedCategories = categories.filter((c) => activeCategoryIds.includes(c.id));
  // Categories available to be added gradually
  const availableToAdd = categories.filter((c) => !activeCategoryIds.includes(c.id));

  return (
    <div className="route-colors-floating-bar" id="route-colors-palette">
      <div className="palette-label">
        <Palette size={13} className="palette-icon" />
        <span className="palette-title">Barva kreslení:</span>
      </div>

      <div className="palette-chips-list">
        {displayedCategories.map((cat) => {
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
            <div key={cat.id} className="palette-chip-wrapper">
              <button
                type="button"
                className={`palette-chip ${isActive ? 'active' : ''}`}
                onClick={() => onSelectCategory(cat)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  handleStartEdit(cat);
                }}
                title={`${cat.name} (${cat.description}) — kliknutím vybrat, dvojklikem přejmenovat`}
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
                {displayedCategories.length > 1 && (
                  <span
                    role="button"
                    className="chip-remove-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveCategory(cat.id);
                    }}
                    title={`Odebrat barvu ${cat.name} z lišty`}
                  >
                    <X size={10} />
                  </span>
                )}
              </button>
            </div>
          );
        })}

        {/* Add more colors button */}
        {availableToAdd.length > 0 && (
          <div className="palette-add-container" ref={addMenuRef}>
            <button
              type="button"
              className={`palette-add-btn ${isAddMenuOpen ? 'open' : ''}`}
              onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
              title="Přidat další barvu pro kreslení trasy"
            >
              <Plus size={12} />
              <span>Přidat barvu</span>
            </button>

            {isAddMenuOpen && (
              <div className="palette-add-dropdown">
                <div className="palette-add-dropdown-title">Vyberte barvu k přidání:</div>
                <div className="palette-add-dropdown-list">
                  {availableToAdd.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      className="palette-add-dropdown-item"
                      onClick={() => {
                        onAddCategory(cat.id);
                        onSelectCategory(cat);
                        setIsAddMenuOpen(false);
                      }}
                    >
                      <span className="chip-dot" style={{ backgroundColor: cat.color }} />
                      <span className="palette-add-item-name">{cat.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
