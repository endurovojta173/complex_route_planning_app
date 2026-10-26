import { useState, useRef, useEffect } from 'react';
import type { RouteCategory } from '../../utils/routeColors';
import { Pencil, Check, X, Plus } from 'lucide-react';

interface RouteColorsBarProps {
  categories: RouteCategory[];
  activeCategoryIds: string[];
  activeCategory: RouteCategory;
  onSelectCategory: (category: RouteCategory) => void;
  onRenameCategory?: (id: string, newName: string) => void;
  onAddCategory?: (id: string) => void;
  onRemoveCategory?: (id: string) => void;
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
    onRenameCategory?.(catId, editingName);
    setEditingId(null);
  };

  const displayedCategories = categories.filter((c) => activeCategoryIds.includes(c.id));
  const availableToAdd = categories.filter((c) => !activeCategoryIds.includes(c.id));

  return (
    <>
      {displayedCategories.map((cat) => {
        const isActive = cat.id === activeCategory.id;
        const isEditing = editingId === cat.id;

        return (
          <div
            key={cat.id}
            className={`left-tool-item ${isEditing ? 'is-editing' : ''}`}
          >
            <button
              type="button"
              className={`left-tool-btn color-item-btn ${isActive ? 'is-active' : ''}`}
              onClick={() => onSelectCategory(cat)}
              title={`${cat.name} — Kliknutím vybrat pro kreslení`}
              aria-label={`Barva kreslení: ${cat.name}`}
            >
              <span
                className="color-tool-swatch"
                style={{ backgroundColor: cat.color }}
              />
            </button>

            {/* Flyout actions on hover: Name, Rename and Remove */}
            <div className="left-tool-tooltip color-flyout">
              {isEditing ? (
                <div className="color-inline-edit" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    className="color-name-input"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit(cat.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    autoFocus
                    maxLength={30}
                  />
                  <button
                    type="button"
                    className="color-flyout-action"
                    onClick={() => handleSaveEdit(cat.id)}
                    title="Uložit (Enter)"
                  >
                    <Check size={12} />
                  </button>
                  <button
                    type="button"
                    className="color-flyout-action"
                    onClick={() => setEditingId(null)}
                    title="Zrušit (Esc)"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <div className="color-flyout-info">
                  <span className="color-flyout-title">{cat.name}</span>
                  <div className="color-flyout-actions">
                    <button
                      type="button"
                      className="color-flyout-action"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(cat);
                      }}
                      title="Přejmenovat barvu"
                    >
                      <Pencil size={12} />
                    </button>
                    {displayedCategories.length > 1 && (
                      <button
                        type="button"
                        className="color-flyout-action danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveCategory?.(cat.id);
                        }}
                        title="Odebrat barvu ze sloupce"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Add more colors button */}
      {availableToAdd.length > 0 && (
        <div className="left-tool-item" ref={addMenuRef}>
          <button
            type="button"
            className={`left-tool-btn ${isAddMenuOpen ? 'is-active' : ''}`}
            onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
            title="Přidat další barvu kreslení"
            aria-label="Přidat další barvu"
          >
            <Plus size={17} />
          </button>

          {!isAddMenuOpen && (
            <div className="left-tool-tooltip">Přidat barvu</div>
          )}

          {isAddMenuOpen && (
            <div className="color-add-dropdown">
              <div className="color-add-dropdown-title">Přidat barvu tras:</div>
              <div className="color-add-dropdown-list">
                {availableToAdd.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className="color-add-dropdown-item"
                    onClick={() => {
                      onAddCategory?.(cat.id);
                      onSelectCategory(cat);
                      setIsAddMenuOpen(false);
                    }}
                  >
                    <span
                      className="color-tool-swatch small"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="color-dropdown-name">{cat.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
