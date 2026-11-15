import { useState } from 'react';
import {
  ChevronDown,
  Columns2,
  Info,
  Layers,
  Loader2,
  Search,
  X,
} from 'lucide-react';
import type { LayoutViewMode, TargetCatalogEntry } from '../types/spherex';
import type { ResolveResponse, StatusResponse } from '../hooks/useSkyContract';

const FOV_PRESETS = [
  { value: 0.08, label: '0.08°' },
  { value: 0.15, label: '0.15°' },
  { value: 0.5, label: '0.50°' },
  { value: 1.5, label: '1.50°' },
] as const;

interface TopTelemetryBarProps {
  targets: TargetCatalogEntry[];
  selectedTarget: TargetCatalogEntry;
  ra: number;
  dec: number;
  layoutView: LayoutViewMode;
  fov: number;
  onSelectTarget: (target: TargetCatalogEntry) => void;
  onChangeLayoutView: (view: LayoutViewMode) => void;
  onChangeFov: (fov: number) => void;
  onOpenCmdK: () => void;
  apiStatus?: StatusResponse | null;
  resolveInfo?: ResolveResponse | null;
  isResolving?: boolean;
}

export function TopTelemetryBar({
  targets,
  selectedTarget,
  ra,
  dec,
  layoutView,
  fov,
  onSelectTarget,
  onChangeLayoutView,
  onChangeFov,
  onOpenCmdK,
  apiStatus = null,
  resolveInfo = null,
  isResolving = false,
}: TopTelemetryBarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  return (
    <>
      <header className="w-full h-14 z-40 pointer-events-none px-3 pt-2 flex flex-col select-none">
        <div className="flex items-center justify-between gap-2 pointer-events-auto flex-nowrap w-full">
          {/* LEFT: BLINK X Brand Dropdown + Selected Target Pill + Telemetry Readout */}
          <div className="flex items-center gap-2.5 relative shrink-0">
            {/* BLINK X Brand Capsule Dropdown Trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen((p) => !p)}
                aria-expanded={dropdownOpen}
                className="hud-card-pill px-3.5 py-1.5 rounded-2xl flex items-center gap-2 text-white hover:bg-white/[0.08] transition-all shadow-sm"
                title="Blink X · Selector de objetivos astronómicos"
              >
                <span className="brand text-base tracking-wider text-white">
                  <span>BLINK X</span>
                  <span className="blink-dot" aria-hidden="true" />
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-[#b9a8a3] transition-transform duration-200 ml-0.5 ${
                    dropdownOpen ? 'rotate-180 text-white' : ''
                  }`}
                />
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div className="absolute left-0 mt-2 w-80 hud-card-elevated rounded-2xl p-2 shadow-2xl z-50 animate-panel-enter">
                  <div className="px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-[#b9a8a3] border-b border-white/[0.06] mb-1">
                    Objetivos SPHEREx (NASA Challenge)
                  </div>
                  <div className="space-y-1 max-h-80 overflow-y-auto">
                    {targets.map((t) => {
                      const active = t.id === selectedTarget.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            onSelectTarget(t);
                            setDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2.5 rounded-xl flex items-center justify-between transition-colors ${
                            active
                              ? 'bg-white/[0.11] text-white border border-white/[0.14]'
                              : 'text-[#C8CDD6] hover:bg-white/[0.06] hover:text-white border border-transparent'
                          }`}
                        >
                          <div>
                            <div className="text-sm font-semibold text-white">{t.name}</div>
                            <div className="text-xs font-mono text-[#b9a8a3]">
                              {t.category} • RA {t.raDeg.toFixed(4)}°
                            </div>
                          </div>
                          {active && (
                            <span className="w-2 h-2 rounded-full bg-[#ff8a5c] shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Active Target Pill */}
            <button
              type="button"
              onClick={() => setDropdownOpen((p) => !p)}
              className="hud-card-pill px-4 py-2 rounded-2xl flex items-center gap-2 text-sm font-semibold text-white shadow-sm hover:bg-white/[0.08] transition-colors"
            >
              {isResolving && <Loader2 className="w-4 h-4 animate-spin text-[#ff8a5c] shrink-0" />}
              <span>
                {isResolving
                  ? 'Buscando...'
                  : (resolveInfo?.matched_name ?? selectedTarget.name)}
              </span>
            </button>

            {/* Coordinate Readout Badge */}
            <div className="hidden 2xl:flex items-center gap-2.5 hud-card-pill px-3 py-1.5 rounded-xl text-xs font-mono text-[#C8CDD6] shadow-sm">
              <span>
                RA <strong className="text-white">{ra.toFixed(5)}°</strong>
              </span>
              <span className="text-[#525866]">|</span>
              <span>
                Dec{' '}
                <strong className="text-white">
                  {dec >= 0 ? '+' : ''}
                  {dec.toFixed(5)}°
                </strong>
              </span>
              {resolveInfo?.pm && (
                <>
                  <span className="text-[#525866]">|</span>
                  <span>
                    μ{' '}
                    <strong className="text-[#ff8a5c] font-semibold">
                      {(Math.hypot(resolveInfo.pm.ra, resolveInfo.pm.dec) / 1000).toFixed(2)}&quot;/yr
                    </strong>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* CENTER: Capsule Search Bar + Interactive FoV Selector */}
          <div className="flex items-center gap-2 flex-1 max-w-md mx-2 min-w-[200px]">
            <button
              type="button"
              onClick={onOpenCmdK}
              className="flex-1 min-w-[150px] hud-card-pill hover:bg-white/[0.08] hover:border-[#ff8a5c]/40 rounded-full px-3.5 py-2 flex items-center justify-between text-xs sm:text-sm font-mono text-[#C8CDD6] transition-all shadow-sm"
            >
              <div className="flex items-center gap-2 truncate">
                <Search className="w-4 h-4 text-[#ff8a5c] shrink-0" />
                <span className="text-[#f6f1ee] font-medium tracking-tight truncate">
                  Buscar objeto / RA, Dec...
                </span>
              </div>
              <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded-md bg-white/[0.08] border border-white/10 text-[10px] text-[#b9a8a3] font-mono shrink-0 ml-1">
                ⌘K
              </span>
            </button>

            {/* Interactive Field of View (FoV) Selector */}
            <div
              className="hud-card-pill rounded-2xl p-1 flex items-center gap-1 text-xs font-mono shrink-0"
              title="Selector de Campo de Visión (FoV): Campos mayores permiten rastrear fuentes más rápidas a costa de transferencia de datos"
            >
              <span className="px-2 text-[#b9a8a3] hidden sm:inline">FoV:</span>
              {FOV_PRESETS.map((preset) => {
                const isActive = Math.abs(fov - preset.value) < 0.025;
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => onChangeFov(preset.value)}
                    title={
                      preset.value < 0.15
                        ? 'Zoom digital (recomendado ≥ 0.15° para detalle nativo SPHEREx 6.2″/px)'
                        : `Campo de visión ${preset.label}`
                    }
                    className={`px-3 py-1 rounded-xl transition-all active:scale-95 text-xs font-mono ${
                      isActive
                        ? 'bg-[#6fd3ff] text-[#0c0a0b] font-bold shadow-[0_0_12px_rgba(111,211,255,0.5)]'
                        : 'text-[#b9a8a3] hover:text-white hover:bg-white/10 border border-transparent'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT: Clear 3-View Switcher (Visor & Espectro | 6 Detectores / Épocas) + API Status + Help */}
          <div className="flex items-center gap-2 shrink-0">
            {apiStatus && (
              <div
                className="hidden xl:flex items-center gap-1.5 hud-card-pill px-3 py-1.5 rounded-full text-xs font-mono text-[#b9a8a3]"
                title={`SpaceX Sky API ${apiStatus.version} (${apiStatus.data_release})`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    apiStatus.status === 'ok'
                      ? 'bg-emerald-400'
                      : apiStatus.status === 'degraded'
                        ? 'bg-amber-400'
                        : 'bg-rose-500'
                  }`}
                />
                <span className="text-[#f6f1ee]">
                  {apiStatus.spherex_mode || apiStatus.mode
                    ? `API ${apiStatus.spherex_mode ?? apiStatus.mode}`
                    : 'API Live'}
                </span>
                <span className="text-[#b9a8a3]/80">{apiStatus.data_release ?? ''}</span>
              </div>
            )}
            <div className="hud-card-pill rounded-2xl p-1 flex items-center text-xs font-mono">
              <button
                type="button"
                onClick={() => onChangeLayoutView('hud')}
                title="Vista 1: Visor Celeste & Espectro de 102 Bandas"
                className={`px-3.5 py-1.5 rounded-xl flex items-center gap-2 transition-all active:scale-95 ${
                  layoutView === 'hud'
                    ? 'bg-[#ff8a5c] text-[#0c0a0b] font-bold shadow-[0_0_12px_rgba(255,138,92,0.45)]'
                    : 'text-[#b9a8a3] hover:text-white hover:bg-white/10'
                }`}
              >
                <Layers className={`w-4 h-4 ${layoutView === 'hud' ? 'text-[#0c0a0b]' : 'text-[#ff8a5c]'}`} />
                <span>Visor &amp; Espectro</span>
              </button>

              <button
                type="button"
                onClick={() => onChangeLayoutView('split')}
                title="Vista 2: Suma por separado de los 6 conjuntos de detectores LVF + Comparador Multi-Época"
                className={`px-3.5 py-1.5 rounded-xl flex items-center gap-2 transition-all active:scale-95 ${
                  layoutView === 'split'
                    ? 'bg-[#6fd3ff] text-[#0c0a0b] font-bold shadow-[0_0_12px_rgba(111,211,255,0.45)]'
                    : 'text-[#b9a8a3] hover:text-white hover:bg-white/10'
                }`}
              >
                <Columns2 className={`w-4 h-4 ${layoutView === 'split' ? 'text-[#0c0a0b]' : 'text-[#6fd3ff]'}`} />
                <span>6 Detectores / Épocas</span>
              </button>
            </div>

            {/* Help / Info Button */}
            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              title="Guía de módulos y arquitectura científica"
              className="hud-card-pill p-2 rounded-2xl text-[#C8CDD6] hover:text-white transition-colors"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Help Modal */}
      {showHelpModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto"
          onClick={() => setShowHelpModal(false)}
        >
          <div
            className="w-full max-w-2xl hud-card-elevated rounded-2xl p-6 shadow-2xl space-y-4 animate-panel-enter"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h2 className="text-base font-bold text-white">
                  Guía de Módulos — HexTech // SPHEREx Explorer
                </h2>
                <p className="text-xs text-[#b9a8a3] font-mono">
                  Inspección Espectral 102 Bandas • 6 Detectores LVF • Visor Aladin Lite CDS • Expediente MPC
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#C8CDD6]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl hud-subcard space-y-1">
                <div className="font-semibold text-white font-mono">
                  1. Visor &amp; Espectro (Aladin Lite + Espectros al Vuelo)
                </div>
                <p className="text-[#C8CDD6] leading-relaxed">
                  Muestra el cielo infrarrojo real (AllWISE / 2MASS / DSS2), superpone catálogos{' '}
                  <code className="text-white">Gaia DR3</code> y <code className="text-white">WISE</code>,
                  y genera espectros de 102 bandas sobre la marcha al hacer clic en cualquier fuente.
                </p>
              </div>

              <div className="p-3.5 rounded-xl hud-subcard space-y-1">
                <div className="font-semibold text-[#6fd3ff] font-mono">
                  2. 6 Detectores / Épocas (Suma SNR + T₁/T₂)
                </div>
                <p className="text-[#C8CDD6] leading-relaxed">
                  Suma por separado cada uno de los 6 conjuntos de detectores (<code className="text-white">LVF-1</code> a{' '}
                  <code className="text-white">LVF-6</code>) para elevar la relación señal-ruido (×4.12) y compara{' '}
                  <code className="text-white">Resta (T₂ − T₁)</code> y <code className="text-white">Suma (T₁ + T₂)</code>.
                </p>
              </div>

              <div className="p-3.5 rounded-xl hud-subcard space-y-1">
                <div className="font-semibold text-[#ff8a5c] font-mono">
                  3. Expediente MPC (Bitácora &amp; Exportación)
                </div>
                <p className="text-[#C8CDD6] leading-relaxed">
                  Reúne la tabla de detecciones WCS, recta de ajuste de movimiento (arcsec/año y arcsec/hora),
                  cruce con Gaia DR3 / AllWISE / MPC y exportación en <strong>ADES-PSV</strong>, CSV, JSON y PDF.
                </p>
              </div>

              <div className="p-3.5 rounded-xl hud-subcard space-y-1">
                <div className="font-semibold text-white font-mono">
                  4. Selector de FoV &amp; URL Embebible
                </div>
                <p className="text-[#C8CDD6] leading-relaxed">
                  Elige entre <code className="text-white">0.08°</code>, <code className="text-white">0.15°</code>,{' '}
                  <code className="text-white">0.50°</code> y <code className="text-white">1.50°</code>, e incrusta
                  cualquier coordenada compartiendo la URL sincronizada.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
