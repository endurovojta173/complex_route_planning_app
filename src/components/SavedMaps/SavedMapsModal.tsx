import { useState } from 'react';
import {
  X,
  Plus,
  Copy,
  Trash2,
  HardDriveDownload,
  FolderOpen,
  Edit2,
  Check,
  Map,
} from 'lucide-react';
import type { SavedMapItem } from '../../types/route';
import { downloadGeoJsonFile } from '../../utils/geoJsonStorage';

interface SavedMapsModalProps {
  isOpen: boolean;
  onClose: () => void;
  maps: SavedMapItem[];
  activeMapId: string;
  onSelectMap: (map: SavedMapItem) => void;
  onCreateNewMap: (name?: string) => void;
  onDuplicateMap: (id: string) => void;
  onDeleteMap: (id: string) => void;
  onRenameMap: (id: string, newName: string) => void;
}

export function SavedMapsModal({
  isOpen,
  onClose,
  maps,
  activeMapId,
  onSelectMap,
  onCreateNewMap,
  onDuplicateMap,
  onDeleteMap,
  onRenameMap,
}: SavedMapsModalProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [newMapName, setNewMapName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  if (!isOpen) return null;

  const handleStartRename = (map: SavedMapItem) => {
    setEditingId(map.id);
    setEditingName(map.name);
  };

  const handleSaveRename = (id: string) => {
    if (editingName.trim()) {
      onRenameMap(id, editingName.trim());
    }
    setEditingId(null);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMapName.trim()) {
      onCreateNewMap(newMapName.trim());
      setNewMapName('');
      setIsCreating(false);
    } else {
      onCreateNewMap();
      setIsCreating(false);
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('cs-CZ', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            <Map size={18} className="modal-title-icon" />
            <h2 className="modal-title">Uložené mapy v mezipaměti</h2>
            <span className="modal-count-badge">{maps.length}</span>
          </div>

          <div className="modal-header-actions">
            <button
              type="button"
              className="btn-modal-action primary"
              onClick={() => setIsCreating(true)}
              title="Vytvořit novou prázdnou mapu"
            >
              <Plus size={14} />
              <span>Nová mapa</span>
            </button>

            <button
              type="button"
              className="btn-modal-close"
              onClick={onClose}
              title="Zavřít okno"
              aria-label="Zavřít"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Create new map form */}
        {isCreating && (
          <form className="create-map-form" onSubmit={handleCreateSubmit}>
            <input
              type="text"
              className="create-map-input"
              placeholder="Název nové mapy (např. Severní obchvat)..."
              value={newMapName}
              onChange={(e) => setNewMapName(e.target.value)}
              autoFocus
            />
            <button type="submit" className="btn-modal-action primary">
              Vytvořit
            </button>
            <button
              type="button"
              className="btn-modal-action secondary"
              onClick={() => setIsCreating(false)}
            >
              Zrušit
            </button>
          </form>
        )}

        {/* Maps List */}
        <div className="saved-maps-list">
          {maps.map((map) => {
            const isActive = map.id === activeMapId;
            const isEditing = editingId === map.id;

            return (
              <div
                key={map.id}
                className={`saved-map-card ${isActive ? 'active' : ''}`}
              >
                <div className="map-card-main">
                  {/* Title / Inline edit */}
                  <div className="map-card-title-row">
                    {isEditing ? (
                      <div className="inline-rename-wrap">
                        <input
                          type="text"
                          className="rename-input"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(map.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                        />
                        <button
                          type="button"
                          className="btn-icon-subtle confirm"
                          onClick={() => handleSaveRename(map.id)}
                          title="Uložit název"
                        >
                          <Check size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span
                          className="map-card-name"
                          onClick={() => onSelectMap(map)}
                          title="Kliknutím načíst na mapu"
                        >
                          {map.name}
                        </span>
                        <button
                          type="button"
                          className="btn-icon-subtle"
                          onClick={() => handleStartRename(map)}
                          title="Přejmenovat mapu"
                        >
                          <Edit2 size={12} />
                        </button>
                      </>
                    )}

                    {isActive && <span className="active-pill">Aktivní</span>}
                  </div>

                  {/* Metadata and Stats */}
                  <div className="map-card-meta">
                    <span className="meta-time">Upraveno: {formatDate(map.updatedAt)}</span>
                    <div className="meta-badges">
                      <span className="meta-badge">{map.stats.totalDistanceKm} km</span>
                      <span className="meta-badge">{map.stats.lineCount} úseků</span>
                      <span className="meta-badge">{map.stats.markerCount} bodů</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="map-card-actions">
                  {!isActive && (
                    <button
                      type="button"
                      className="btn-card-action load"
                      onClick={() => onSelectMap(map)}
                      title="Načíst tuto mapu"
                    >
                      <FolderOpen size={13} />
                      <span>Otevřít</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn-card-action icon-only"
                    onClick={() => onDuplicateMap(map.id)}
                    title="Vytvořit kopii"
                  >
                    <Copy size={13} />
                  </button>

                  <button
                    type="button"
                    className="btn-card-action icon-only"
                    onClick={() =>
                      downloadGeoJsonFile(map.geoJson, `${map.name.replace(/\s+/g, '_')}.geojson`)
                    }
                    title="Stáhnout jako GeoJSON"
                  >
                    <HardDriveDownload size={13} />
                  </button>

                  {maps.length > 1 && (
                    <button
                      type="button"
                      className="btn-card-action icon-only danger"
                      onClick={() => {
                        if (window.confirm(`Opravdu chcete smazat mapu "${map.name}"?`)) {
                          onDeleteMap(map.id);
                        }
                      }}
                      title="Smazat mapu"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <span className="footer-info">
            Všechny mapy jsou bezpečně uloženy v lokální paměti prohlížeče (localStorage).
          </span>
          <button type="button" className="btn-modal-action secondary" onClick={onClose}>
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
}
