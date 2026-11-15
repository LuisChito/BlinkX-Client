/* Barra superior: marca · objetivo actual · búsqueda · vista · estado del servidor · ayuda. */
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, CircleHelp, Loader2, PanelRight, Search, Telescope } from 'lucide-react';
import type { LayoutViewMode, TargetCatalogEntry } from '../../types/spherex';
import type { StatusResponse } from '../../hooks/useSkyContract';
import { Kbd, Segmented, cx } from '../ui/primitives';

interface TopBarProps {
  targets: TargetCatalogEntry[];
  selectedTargetId: string;
  title: string;
  subtitle: string;
  isResolving: boolean;
  layoutView: LayoutViewMode;
  apiStatus: StatusResponse | null;
  inspectorOpen: boolean;
  onSelectTarget: (t: TargetCatalogEntry) => void;
  onOpenSearch: () => void;
  onChangeLayoutView: (v: LayoutViewMode) => void;
  onToggleInspector: () => void;
  onOpenHelp: () => void;
}

const STATUS = {
  ok: { dot: 'bg-ok', label: 'Servidor en línea' },
  degraded: { dot: 'bg-warn', label: 'Servidor con fallos parciales' },
  down: { dot: 'bg-err', label: 'Servidor sin conexión' },
} as const;

export function TopBar({
  targets,
  selectedTargetId,
  title,
  subtitle,
  isResolving,
  layoutView,
  apiStatus,
  inspectorOpen,
  onSelectTarget,
  onOpenSearch,
  onChangeLayoutView,
  onToggleInspector,
  onOpenHelp,
}: TopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', close);
    };
  }, [menuOpen]);

  const st = apiStatus ? STATUS[(apiStatus.status as keyof typeof STATUS) ?? 'ok'] ?? STATUS.degraded : null;
  const failing = apiStatus?.sources
    ? Object.entries(apiStatus.sources as Record<string, { ok: boolean }>).filter(([, v]) => !v.ok).map(([k]) => k)
    : [];

  return (
    <header className="h-14 shrink-0 bx-panel border-x-0 border-t-0 flex items-center gap-2 sm:gap-3 px-2 sm:px-3">
      <a href="/" className="brand text-[15px] text-fg px-2 shrink-0" aria-label="Blink X, volver a la historia">
        <span>Blink X</span>
        <span className="blink-dot" aria-hidden="true" />
      </a>

      <div className="h-6 w-px bg-line hidden sm:block" aria-hidden="true" />

      {/* Objetivo actual + objetivos sugeridos */}
      <div ref={menuRef} className="relative min-w-0">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-white/[0.06] min-w-0 cursor-pointer"
        >
          {isResolving ? <Loader2 className="w-4 h-4 animate-spin text-ember shrink-0" aria-hidden="true" /> : <Telescope className="w-4 h-4 text-ember shrink-0" aria-hidden="true" />}
          <span className="min-w-0 text-left">
            <span className="block text-[14px] font-semibold text-fg truncate max-w-[42vw] sm:max-w-[260px]">{isResolving ? 'Buscando…' : title}</span>
            <span className="block text-[11px] text-muted truncate max-w-[42vw] sm:max-w-[260px]">{subtitle}</span>
          </span>
          <ChevronDown className={cx('w-4 h-4 text-muted shrink-0 transition-transform', menuOpen && 'rotate-180')} aria-hidden="true" />
        </button>
        {menuOpen && (
          <div role="menu" className="absolute left-0 top-full mt-2 w-80 bx-float rounded-xl p-1.5 shadow-2xl z-50 animate-panel-enter">
            <div className="bx-eyebrow px-2.5 py-1.5">Objetivos del reto</div>
            {targets.map((t) => (
              <button
                key={t.id}
                type="button"
                role="menuitemradio"
                aria-checked={t.id === selectedTargetId}
                onClick={() => {
                  onSelectTarget(t);
                  setMenuOpen(false);
                }}
                className={cx(
                  'w-full text-left rounded-lg px-2.5 py-2 flex items-center justify-between gap-3 cursor-pointer',
                  t.id === selectedTargetId ? 'bg-white/[0.08]' : 'hover:bg-white/[0.05]',
                )}
              >
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-fg truncate">{t.name}</span>
                  <span className="block text-[11px] text-muted truncate">{t.category}</span>
                </span>
                {t.id === selectedTargetId && <span className="w-2 h-2 rounded-full bg-ember shrink-0" aria-hidden="true" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Búsqueda */}
      <button
        type="button"
        onClick={onOpenSearch}
        className="ml-auto sm:ml-2 flex items-center gap-2 h-9 rounded-lg border border-line bg-white/[0.03] px-3 text-[13px] text-muted hover:text-fg hover:border-line-strong cursor-pointer sm:min-w-[220px] lg:min-w-[300px]"
      >
        <Search className="w-4 h-4 text-ember shrink-0" aria-hidden="true" />
        <span className="hidden sm:inline flex-1 text-left truncate">Buscar objeto o coordenadas…</span>
        <span className="hidden md:inline"><Kbd>Ctrl K</Kbd></span>
      </button>

      <div className="flex-1 hidden sm:block" />

      <div className="hidden md:block">
        <Segmented
          label="Vista"
          value={layoutView === 'split' ? 'split' : 'hud'}
          onChange={(v) => onChangeLayoutView(v)}
          options={[
            { value: 'hud', label: 'Cielo', title: 'Imagen del cielo con el inspector de datos' },
            { value: 'split', label: 'Detectores', title: 'Los 6 detectores y el cubo de 102 canales' },
          ]}
        />
      </div>

      {st && (
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-muted px-1" title={failing.length ? `Sin respuesta: ${failing.join(', ')}` : apiStatus?.data_release}>
          <span className={cx('w-2 h-2 rounded-full', st.dot)} aria-hidden="true" />
          <span>{st.label}</span>
        </div>
      )}

      <button
        type="button"
        onClick={onToggleInspector}
        aria-pressed={inspectorOpen}
        aria-label={inspectorOpen ? 'Ocultar panel de datos' : 'Mostrar panel de datos'}
        title={inspectorOpen ? 'Ocultar panel de datos' : 'Mostrar panel de datos'}
        className={cx('h-9 w-9 inline-flex items-center justify-center rounded-lg cursor-pointer', inspectorOpen ? 'text-fg bg-white/[0.08]' : 'text-muted hover:text-fg hover:bg-white/[0.06]')}
      >
        <PanelRight className="w-4 h-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onOpenHelp}
        aria-label="Ayuda"
        title="Ayuda"
        className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-muted hover:text-fg hover:bg-white/[0.06] cursor-pointer"
      >
        <CircleHelp className="w-4 h-4" aria-hidden="true" />
      </button>
    </header>
  );
}
