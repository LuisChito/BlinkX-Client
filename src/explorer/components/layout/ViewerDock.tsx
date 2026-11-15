/* Dock inferior del cielo: fuente de imagen, capas, ajustes de visualización, zoom y la línea de tiempo. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Crosshair,
  Layers,
  Minus,
  Pause,
  Play,
  Plus,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
} from 'lucide-react';
import type { CatalogOverlayState, ViewMode } from '../../types/spherex';
import type { Coord, SequenceResult } from '../../../lib/skyApi';
import type { Cmap, CoverageResponse, Scale, Stretch } from '../../hooks/useSkyContract';
import type { L2ViewMode } from '../SkyStage';
import { Chip, IconButton, Kbd, Segmented, cx, fmtDate, fmtDateTime } from '../ui/primitives';

// ---------------------------------------------------------------------------------------------------------------
function Popover({ label, icon, badge, children }: { label: string; icon: ReactNode; badge?: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', close);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        className={cx(
          'h-9 inline-flex items-center gap-1.5 rounded-lg px-2.5 text-[13px] cursor-pointer',
          open ? 'bg-white/[0.1] text-fg' : 'text-soft hover:text-fg hover:bg-white/[0.06]',
        )}
      >
        {icon}
        <span className="hidden sm:inline">{label}</span>
        {!!badge && <span className="min-w-4 h-4 px-1 rounded-full bg-ember text-ember-ink text-[10px] font-bold leading-4 text-center">{badge}</span>}
      </button>
      {open && (
        <div role="dialog" aria-label={label} className="absolute bottom-full left-0 mb-2 w-64 bx-float rounded-xl p-3 shadow-2xl z-30 animate-panel-enter space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}

function Toggle({ checked, onChange, label, hint, swatch }: { checked: boolean; onChange: () => void; label: string; hint?: string; swatch?: ReactNode }) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={onChange} className="mt-0.5 w-4 h-4 accent-[#ff8a5c] cursor-pointer" />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-[13px] text-fg">{swatch}{label}</span>
        {hint && <span className="block text-[11px] text-muted leading-snug">{hint}</span>}
      </span>
    </label>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] text-muted">{label}</span>
      {children}
    </label>
  );
}
const selectCls = 'w-full h-8 rounded-lg bg-raised border border-line px-2 text-[13px] text-fg cursor-pointer focus:border-ember/60 outline-none';

const SPEEDS = [
  { value: '900', label: '½×' },
  { value: '420', label: '1×' },
  { value: '200', label: '2×' },
  { value: '110', label: '4×' },
];

// ---------------------------------------------------------------------------------------------------------------
interface ViewerDockProps {
  // Imagen y capas
  l2View: L2ViewMode;
  isLoadingL2: boolean;
  onChangeL2View: (v: L2ViewMode) => void;
  overlays: CatalogOverlayState;
  showLabels: boolean;
  onToggleOverlay: (k: keyof CatalogOverlayState) => void;
  onToggleLabels: () => void;
  stretch: Stretch;
  cmap: Cmap;
  scale: Scale;
  onChangeStretch: (s: Stretch) => void;
  onChangeCmap: (c: Cmap) => void;
  onChangeScale: (s: Scale) => void;
  // Zoom
  fov: number;
  cursor: Coord | null;
  onZoom: (factor: number) => void;
  onSetFov: (fov: number) => void;
  onRecenter: () => void;
  // Tiempo
  mode: ViewMode;
  onChangeMode: (m: ViewMode) => void;
  frameIndex: number;
  blinkFrame: 1 | 2;
  isPlaying: boolean;
  speedMs: number;
  sequence: SequenceResult | null;
  coverage: CoverageResponse | null;
  isLoadingStack: boolean;
  onFrameIndexChange: (i: number) => void;
  onTogglePlay: () => void;
  onChangeSpeed: (ms: number) => void;
}

const FOVS = [0.08, 0.15, 0.25, 0.5, 1, 1.5];

export function ViewerDock(p: ViewerDockProps) {
  const frames = p.sequence?.frames ?? [];
  const max = Math.max(0, frames.length - 1);
  const shown = p.mode === 'blink' ? (p.blinkFrame === 1 ? 0 : max) : Math.min(max, Math.max(0, p.frameIndex));
  const frame = frames[shown] ?? null;
  const timeDisabled = p.l2View !== 'off';
  const layersOn = Number(p.overlays.gaiaDr3) + Number(p.overlays.allWise) + Number(p.showLabels);

  // ←/→ recorren exposiciones (si el foco no está en un campo de texto).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [role="application"], [role="dialog"]') || !frames.length) return;
      e.preventDefault();
      p.onFrameIndexChange(e.key === 'ArrowRight' ? (shown + 1) % frames.length : (shown - 1 + frames.length) % frames.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [frames.length, p, shown]);

  const weeks = p.coverage?.weeks ?? [];
  const maxWeek = Math.max(1, ...weeks.map((w) => w.count));
  const totalCov = weeks.reduce((s, w) => s + w.count, 0);

  return (
    <div className="bx-float rounded-2xl shadow-2xl">
      {/* Fila 1: imagen, capas, ajustes, cursor y zoom */}
      <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 border-b border-line">
        <Segmented
          label="Imagen"
          size="sm"
          value={p.l2View}
          onChange={p.onChangeL2View}
          options={[
            { value: 'off', label: 'Alineada', title: 'Recortes de todas las fechas alineados entre sí (para comparar)' },
            { value: 'raw', label: p.isLoadingL2 && p.l2View === 'off' ? 'L2…' : 'L2', title: 'Exposición original completa; clic = brillo del píxel' },
            { value: 'color', label: 'L2 color', title: 'Exposición original en falso color' },
          ]}
        />
        <Popover label="Capas" icon={<Layers className="w-4 h-4" aria-hidden="true" />} badge={layersOn}>
          <Toggle checked={p.showLabels} onChange={p.onToggleLabels} label="Nombres de objetos" hint="Hasta 12 objetos de SIMBAD cercanos al centro. Pasa el cursor sobre cualquier punto para ver su nombre." />
          <Toggle
            checked={p.overlays.gaiaDr3}
            onChange={() => p.onToggleOverlay('gaiaDr3')}
            label="Estrellas Gaia DR3"
            hint="Posiciones movidas a la fecha de la imagen."
            swatch={<i className="w-2.5 h-2.5 rounded-full border-2 border-data" aria-hidden="true" />}
          />
          <Toggle
            checked={p.overlays.allWise}
            onChange={() => p.onToggleOverlay('allWise')}
            label="Fuentes AllWISE"
            hint="Infrarrojo de WISE: útil para objetos fríos."
            swatch={<i className="w-2.5 h-2.5 border-2 border-[#9fe0ad]" aria-hidden="true" />}
          />
        </Popover>
        <Popover label="Ajustes" icon={<SlidersHorizontal className="w-4 h-4" aria-hidden="true" />}>
          <Field label="Contraste">
            <select className={selectCls} value={p.stretch} onChange={(e) => p.onChangeStretch(e.target.value as Stretch)}>
              <option value="asinh">asinh (recomendado)</option>
              <option value="log">Logarítmico</option>
              <option value="sqrt">Raíz cuadrada</option>
              <option value="linear">Lineal</option>
            </select>
          </Field>
          <Field label="Paleta de color">
            <select className={selectCls} value={p.cmap} onChange={(e) => p.onChangeCmap(e.target.value as Cmap)}>
              <option value="gray">Grises</option>
              <option value="inferno">Inferno</option>
              <option value="magma">Magma</option>
              <option value="viridis">Viridis</option>
            </select>
          </Field>
          <Field label="Escala de brillo">
            <Segmented
              label="Escala de brillo"
              size="sm"
              value={p.scale}
              onChange={p.onChangeScale}
              className="w-full [&>button]:flex-1"
              options={[
                { value: 'sequence', label: 'Común', title: 'Misma escala en todas las fechas (comparación justa)' },
                { value: 'frame', label: 'Por imagen', title: 'Cada imagen con su propia escala' },
              ]}
            />
          </Field>
        </Popover>

        <div className="flex-1" />

        <div className="hidden md:block font-mono text-[11px] text-muted px-2 tabular-nums" aria-live="off">
          {p.cursor ? `α ${p.cursor.ra.toFixed(4)}°  δ ${p.cursor.dec >= 0 ? '+' : ''}${p.cursor.dec.toFixed(4)}°` : 'Mueve el cursor sobre el cielo'}
        </div>

        <div className="flex items-center rounded-lg border border-line">
          <IconButton label="Alejar" onClick={() => p.onZoom(1.25)} className="h-8 w-8"><Minus className="w-4 h-4" /></IconButton>
          <select
            aria-label="Campo de visión"
            value={FOVS.find((f) => Math.abs(f - p.fov) < 0.005) ?? ''}
            onChange={(e) => p.onSetFov(Number(e.target.value))}
            className="h-8 bg-transparent text-[12px] font-mono text-fg px-1 cursor-pointer outline-none"
          >
            {!FOVS.some((f) => Math.abs(f - p.fov) < 0.005) && <option value="">{p.fov.toFixed(2)}°</option>}
            {FOVS.map((f) => <option key={f} value={f}>{f.toFixed(2)}°</option>)}
          </select>
          <IconButton label="Acercar" onClick={() => p.onZoom(0.8)} className="h-8 w-8"><Plus className="w-4 h-4" /></IconButton>
        </div>
        <IconButton label="Volver al objetivo" onClick={p.onRecenter} className="h-8 w-8"><Crosshair className="w-4 h-4" /></IconButton>
      </div>

      {/* Fila 2: línea de tiempo */}
      <div className={cx('flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2', timeDisabled && 'opacity-50 pointer-events-none')} aria-disabled={timeDisabled}>
        <div className="flex items-center gap-0.5">
          <IconButton label="Exposición anterior" disabled={!frames.length} onClick={() => p.onFrameIndexChange(shown > 0 ? shown - 1 : max)}>
            <SkipBack className="w-4 h-4" />
          </IconButton>
          <IconButton label={p.isPlaying ? 'Pausar' : 'Reproducir todas las fechas'} active={p.isPlaying} disabled={frames.length < 2} onClick={p.onTogglePlay}>
            {p.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </IconButton>
          <IconButton label="Exposición siguiente" disabled={!frames.length} onClick={() => p.onFrameIndexChange(max > 0 ? (shown + 1) % (max + 1) : 0)}>
            <SkipForward className="w-4 h-4" />
          </IconButton>
        </div>

        <Segmented
          label="Modo de comparación"
          size="sm"
          value={p.mode}
          onChange={p.onChangeMode}
          options={[
            { value: 'normal', label: 'Secuencia', title: 'Una fecha a la vez' },
            { value: 'blink', label: <>Parpadeo <span className="hidden lg:inline"><Kbd>Espacio</Kbd></span></>, title: 'Alterna la primera y la última fecha' },
            { value: 'diff', label: p.isLoadingStack && p.mode === 'diff' ? 'Resta…' : 'Resta', title: 'Última − primera: solo queda lo que cambió' },
            { value: 'sum', label: p.isLoadingStack && p.mode === 'sum' ? 'Suma…' : 'Suma', title: 'Apila varias fechas para ver lo débil' },
          ]}
        />

        <div className="min-w-0 flex-1 basis-[240px]">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="font-mono text-fg truncate">
              {(p.mode === 'diff' || p.mode === 'sum') && frames.length > 1
                ? `${p.mode === 'diff' ? 'Resta' : 'Suma'}: ${fmtDate(frames[0].date_obs)} ${p.mode === 'diff' ? '→' : '+'} ${fmtDate(frames[max].date_obs)}`
                : frame ? `${fmtDateTime(frame.date_obs)} UTC` : 'Sin exposiciones cargadas'}
            </span>
            {frame && p.mode !== 'diff' && p.mode !== 'sum' && (
              <span className="flex items-center gap-1.5 shrink-0">
                <Chip tone="data">D{frame.detector} · {frame.band_um.toFixed(2)} µm</Chip>
                {frame.flags.length > 0 && <Chip tone="warn" title={`Banderas de calidad: ${frame.flags.join(', ')}`}>{frame.flags.length} bandera{frame.flags.length > 1 ? 's' : ''}</Chip>}
                <span className="font-mono text-muted">{shown + 1}/{frames.length}</span>
              </span>
            )}
          </div>
          {weeks.length > 0 && (
            <div className="flex items-end gap-px h-3 mt-1" title={`${totalCov} exposiciones entre ${fmtDate(p.coverage?.first_date)} y ${fmtDate(p.coverage?.last_date)}`} aria-hidden="true">
              {weeks.slice(-60).map((w) => (
                <div key={w.week_start} className="flex-1 rounded-t-[1px] bg-ember/40" style={{ height: `${Math.max(15, (w.count / maxWeek) * 100)}%` }} />
              ))}
            </div>
          )}
          <input
            type="range"
            className="bx-range"
            min={0}
            max={max}
            value={shown}
            disabled={!frames.length}
            onChange={(e) => p.onFrameIndexChange(Number(e.target.value))}
            aria-label="Fecha de la exposición"
            aria-valuetext={frame ? fmtDateTime(frame.date_obs) : undefined}
          />
          <div className="flex justify-between text-[10px] font-mono text-faint -mt-0.5">
            <span>{fmtDate(p.coverage?.first_date ?? frames[0]?.date_obs)}</span>
            <span>{p.sequence ? `${frames.length} de ${p.sequence.total} exposiciones` : ''}</span>
            <span>{fmtDate(p.coverage?.last_date ?? frames[max]?.date_obs)}</span>
          </div>
        </div>

        <Segmented
          label="Velocidad"
          className="max-sm:hidden"
          size="sm"
          value={String(p.speedMs)}
          onChange={(v) => p.onChangeSpeed(Number(v))}
          options={SPEEDS.map((s) => ({ ...s, title: `Velocidad ${s.label}` }))}
        />
      </div>
    </div>
  );
}
