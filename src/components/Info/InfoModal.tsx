import {
  Info,
  X,
  ShieldCheck,
  HardDrive,
  User,
  ExternalLink,
  Layers,
  GitFork,
  Heart,
  FileJson,
} from 'lucide-react';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InfoModal({ isOpen, onClose }: InfoModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="info-modal-title">
      <div className="modal-container info-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            <Info size={18} className="modal-title-icon" />
            <h2 id="info-modal-title" className="modal-title">
              O aplikaci CRP — Complex Route Planning App
            </h2>
            <span className="modal-badge-pill">Lokální nástroj</span>
          </div>
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

        {/* Modal Content */}
        <div className="info-modal-body">
          {/* Section 1: Privacy & Local Cache */}
          <div className="info-card highlight-card">
            <div className="info-card-header">
              <div className="info-icon-badge security">
                <ShieldCheck size={18} />
              </div>
              <div>
                <h3 className="info-card-title">100% Lokální úložiště & Soukromí</h3>
                <span className="info-card-subtitle">Žádné servery, žádné databáze, žádné sledování</span>
              </div>
            </div>
            <div className="info-card-text">
              <p>
                Veškerá data o vašich trasách, polygonech, značkách a uložených mapách jsou uložena{' '}
                <strong>výhradně ve vaší lokální mezipaměti prohlížeče (<code>localStorage</code>)</strong>.
              </p>
              <ul className="info-features-list">
                <li>
                  <HardDrive size={14} className="list-icon" />
                  <span>Aplikace neodesílá žádné vaše zákresy na vzdálený server.</span>
                </li>
                <li>
                  <FileJson size={14} className="list-icon" />
                  <span>
                    Data jsou ukládána ve standardním formátu <strong>GeoJSON</strong> a můžete je kdykoliv exportovat do souboru pro zálohu či přenos do jiného zařízení.
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Section 2: Creator & Origin Story */}
          <div className="info-card">
            <div className="info-card-header">
              <div className="info-icon-badge author">
                <User size={18} />
              </div>
              <div>
                <h3 className="info-card-title">Kdo aplikaci vytvořil a proč</h3>
                <span className="info-card-subtitle">Příběh vzniku a účel projektu</span>
              </div>
            </div>
            <div className="info-card-text">
              <p>
                Aplikaci vytvořil <strong>Vojtěch Břenek</strong> (známý na GitHubu jako{' '}
                <a
                  href="https://github.com/endurovojta173"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="info-link"
                >
                  endurovojta173 <ExternalLink size={12} className="inline-icon" />
                </a>
                ).
              </p>
              <p className="story-paragraph">
                <strong>Proč tato aplikace vznikla:</strong> Hlavní motivací bylo vyřešit komplexní plánování tras a logistickou koordinaci pro naši{' '}
                <strong>místní tradiční folklorní slavnost</strong>.
              </p>
              <p className="story-paragraph">
                Při organizaci folklorních průvodů, krojovaných průvodců, logistického zázemí a zásobovacích bodů bylo potřeba připravit detailní mapové podklady s přesným větvením tras, objížďkami a shromažďovacími zónami. Komerční navigace a běžné mapy neumožňují snadné kreslení rozvětvených tras se zachycením k vrcholům bez vzniku mezer a bez nutnosti placených GIS licencí. Nástroj CRP (Complex Route Planning App) byl navržen tak, aby toto řešil jednoduše, přímo v prohlížeči a zcela zdarma.
              </p>
            </div>
          </div>

          {/* Section 3: Technical Highlights */}
          <div className="info-card">
            <div className="info-card-header">
              <div className="info-icon-badge tech">
                <GitFork size={18} />
              </div>
              <div>
                <h3 className="info-card-title">Technologické řešení & Funkce</h3>
                <span className="info-card-subtitle">Moderní webový stack</span>
              </div>
            </div>
            <div className="info-grid">
              <div className="info-grid-item">
                <Layers size={14} className="grid-icon" />
                <div>
                  <span className="grid-title">Větvení & Snapping</span>
                  <span className="grid-desc">Automatické přichytávání k vrcholům tras Geoman</span>
                </div>
              </div>
              <div className="info-grid-item">
                <HardDrive size={14} className="grid-icon" />
                <div>
                  <span className="grid-title">Správa více map</span>
                  <span className="grid-desc">Ukládání, duplikace a přepínání map v mezipaměti</span>
                </div>
              </div>
              <div className="info-grid-item">
                <FileJson size={14} className="grid-icon" />
                <div>
                  <span className="grid-title">GeoJSON Import & Export</span>
                  <span className="grid-desc">Standardizovaný otevřený formát pro GIS data</span>
                </div>
              </div>
              <div className="info-grid-item">
                <Heart size={14} className="grid-icon" />
                <div>
                  <span className="grid-title">Čistý běh v Dockeru</span>
                  <span className="grid-desc">Multi-stage Dockerfile a Nginx Alpine bez závislostí</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <div className="footer-info">
            <span>CRP — Complex Route Planning App &bull; Autor: Vojtěch Břenek (endurovojta173)</span>
          </div>
          <div className="info-modal-footer-actions">
            <a
              href="https://github.com/endurovojta173/complex_route_planning_app"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-modal-action secondary"
            >
              <ExternalLink size={13} />
              <span>GitHub Repozitář</span>
            </a>
            <button
              type="button"
              className="btn-modal-action primary"
              onClick={onClose}
            >
              Rozumím
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
