/* Piezas visuales compartidas del visor. Todo usa los tokens de index.css (@theme). */
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react';
import type { Job } from '../../../lib/skyApi';

export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

// ---------------------------------------------------------------------------------------------------------------
// Botones
// ---------------------------------------------------------------------------------------------------------------
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
const BTN: Record<BtnVariant, string> = {
  primary: 'bg-ember text-ember-ink font-semibold hover:brightness-110',
  secondary: 'bg-raised text-fg border border-line hover:border-line-strong hover:bg-hover',
  ghost: 'text-soft hover:text-fg hover:bg-white/[0.06]',
  danger: 'bg-err/15 text-err-fg border border-err/40 hover:bg-err/25',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg transition-colors duration-150 cursor-pointer',
        'disabled:opacity-45 disabled:cursor-not-allowed',
        size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3.5 text-[13px]',
        BTN[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function IconButton({
  label,
  active,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      {...rest}
      className={cx(
        'inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-150 cursor-pointer',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        active ? 'bg-ember text-ember-ink' : 'text-soft hover:text-fg hover:bg-white/[0.08]',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Control segmentado (radio accesible). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  size = 'md',
  className,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: ReactNode; title?: string; disabled?: boolean }>;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cx('inline-flex items-center gap-0.5 rounded-lg bg-white/[0.04] p-0.5 border border-line', className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.title}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cx(
              'rounded-md px-2.5 transition-colors duration-150 cursor-pointer whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed',
              size === 'sm' ? 'h-7 text-xs' : 'h-8 text-[13px]',
              on ? 'bg-fg text-ink font-semibold' : 'text-soft hover:text-fg hover:bg-white/[0.06]',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Texto y datos
// ---------------------------------------------------------------------------------------------------------------
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('bx-eyebrow', className)}>{children}</div>;
}

export function SectionHeader({ title, hint, action }: { title: ReactNode; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-2">
      <div className="min-w-0">
        <h3 className="text-[13px] font-semibold text-fg leading-tight">{title}</h3>
        {hint && <p className="text-xs text-muted mt-0.5">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value, hint, tone = 'fg' }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'fg' | 'ember' | 'data' }) {
  const color = tone === 'ember' ? 'text-ember' : tone === 'data' ? 'text-data' : 'text-fg';
  return (
    <div className="bx-card px-3 py-2.5 min-w-0">
      <div className="text-[11px] text-muted truncate">{label}</div>
      <div className={cx('font-mono text-[15px] font-semibold leading-tight mt-0.5 truncate', color)}>{value}</div>
      {hint && <div className="text-[11px] text-faint mt-0.5 truncate">{hint}</div>}
    </div>
  );
}

/** Fila clave → valor para tablas de metadatos. */
export function KV({ k, v, mono = true }: { k: ReactNode; v: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-line last:border-0">
      <dt className="text-xs text-muted shrink-0">{k}</dt>
      <dd className={cx('text-xs text-fg text-right min-w-0 break-words', mono && 'font-mono')}>{v}</dd>
    </div>
  );
}

type ChipTone = 'neutral' | 'ember' | 'data' | 'ok' | 'warn' | 'err';
const CHIP: Record<ChipTone, string> = {
  neutral: 'bg-white/[0.05] text-soft border-line',
  ember: 'bg-ember/15 text-ember border-ember/35',
  data: 'bg-data/12 text-data border-data/35',
  ok: 'bg-ok/15 text-ok-fg border-ok/40',
  warn: 'bg-warn/12 text-warn-fg border-warn/35',
  err: 'bg-err/12 text-err-fg border-err/40',
};
export function Chip({ tone = 'neutral', children, className, title }: { tone?: ChipTone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cx('inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-tight whitespace-nowrap', CHIP[tone], className)}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Estados
// ---------------------------------------------------------------------------------------------------------------
export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-2 rounded-xl border border-dashed border-line-strong px-4 py-6">
      {icon && <div className="text-muted">{icon}</div>}
      <p className="text-[13px] font-medium text-fg">{title}</p>
      {children && <p className="text-xs text-muted max-w-[32ch] leading-relaxed">{children}</p>}
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-err/40 bg-err/10 p-2.5 text-xs text-err-fg">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-px" aria-hidden="true" />
      <span className="flex-1 min-w-0">{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="shrink-0 inline-flex items-center gap-1 font-semibold hover:underline cursor-pointer">
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> Reintentar
        </button>
      )}
    </div>
  );
}

const fmtEta = (s: number | null | undefined) =>
  s == null ? null : s >= 90 ? `≈ ${Math.round(s / 60)} min` : `≈ ${Math.max(1, Math.round(s))} s`;

/** Progreso de un trabajo lento del backend (patrón 202 + job). */
export function JobProgress({ job, label = 'Calculando', note }: { job: Job | null; label?: string; note?: ReactNode }) {
  const pct = Math.round((job?.progress ?? 0) * 100);
  const queued = (job?.queue_position ?? 0) > 0;
  return (
    <div className="space-y-1.5" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-1.5 font-semibold text-ember">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          {label}… {pct}%
        </span>
        <span className="font-mono text-muted">{fmtEta(job?.eta_s)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
        <div className="h-full rounded-full bg-ember transition-[width] duration-500" style={{ width: `${Math.max(3, pct)}%` }} />
      </div>
      <div className="text-[11px] text-soft truncate">{queued ? `En cola (turno ${job?.queue_position})` : job?.stage || 'Preparando…'}</div>
      {note && <p className="text-[11px] text-faint leading-snug">{note}</p>}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line-strong bg-white/[0.06] px-1.5 py-px font-mono text-[10px] text-muted">{children}</kbd>;
}

// ---------------------------------------------------------------------------------------------------------------
// Formato
// ---------------------------------------------------------------------------------------------------------------
export const fmtDeg = (v: number, d = 5) => `${v.toFixed(d)}°`;
export const fmtDec = (v: number, d = 5) => `${v >= 0 ? '+' : ''}${v.toFixed(d)}°`;
export const fmtDate = (iso?: string | null) => (iso ? iso.slice(0, 10) : '—');
export const fmtDateTime = (iso?: string | null) => (iso ? iso.slice(0, 16).replace('T', ' ') : '—');

export function raToHms(ra: number) {
  const h = ra / 15;
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  const ss = ((h - hh) * 60 - mm) * 60;
  return `${String(hh).padStart(2, '0')}h ${String(mm).padStart(2, '0')}m ${ss.toFixed(1).padStart(4, '0')}s`;
}
export function decToDms(dec: number) {
  const s = dec < 0 ? '−' : '+';
  const a = Math.abs(dec);
  const d = Math.floor(a);
  const m = Math.floor((a - d) * 60);
  const sec = ((a - d) * 60 - m) * 60;
  return `${s}${String(d).padStart(2, '0')}° ${String(m).padStart(2, '0')}′ ${sec.toFixed(0).padStart(2, '0')}″`;
}

/** Convierte los avisos técnicos del backend ("sx-d4-…: spherex: HTTP 503") en un resumen legible. */
export function summarizeWarnings(warnings: string[]): { headline: string; detail: string[] } {
  const http = warnings.filter((w) => /HTTP\s*5\d\d|timeout|time out/i.test(w));
  const other = warnings.filter((w) => !http.includes(w));
  const parts: string[] = [];
  if (http.length) parts.push(`${http.length} exposición${http.length === 1 ? '' : 'es'} sin descargar`);
  if (other.length) parts.push(`${other.length} aviso${other.length === 1 ? '' : 's'} más`);
  return { headline: parts.join(' · ') || 'Datos parciales', detail: warnings };
}

// Tipos de objeto (SIMBAD/NED) en español. `type` viene normalizado (star | galaxy | other);
// `type_raw` es el código original de SIMBAD (AGN, SN*, X…) cuando existe.
const OTYPE: Record<string, string> = {
  '*': 'Estrella', 'PM*': 'Estrella de alto movimiento propio', 'BD*': 'Enana marrón', 'LM*': 'Estrella de baja masa',
  'V*': 'Estrella variable', 'EB*': 'Binaria eclipsante', '**': 'Estrella doble', 'YSO': 'Estrella joven', 'TT*': 'Estrella T Tauri',
  'Mi*': 'Variable tipo Mira', 'RG*': 'Gigante roja', 'WD*': 'Enana blanca', 'G': 'Galaxia', 'GiG': 'Galaxia en grupo',
  'GiP': 'Galaxia en par', 'IG': 'Galaxias en interacción', 'AGN': 'Núcleo galáctico activo', 'Sy1': 'Galaxia Seyfert 1',
  'Sy2': 'Galaxia Seyfert 2', 'SBG': 'Galaxia con brote estelar', 'QSO': 'Cuásar', 'SN*': 'Supernova', 'SNR': 'Remanente de supernova',
  'HII': 'Región H II', 'PN': 'Nebulosa planetaria', 'MoC': 'Nube molecular', 'X': 'Fuente de rayos X', 'IR': 'Fuente infrarroja',
  'Rad': 'Radiofuente', 'UV': 'Fuente ultravioleta', 'Cl*': 'Cúmulo estelar', 'GrG': 'Grupo de galaxias', 'ClG': 'Cúmulo de galaxias',
};
export function objectTypeLabel(type?: string | null, raw?: string | null): string {
  const r = raw?.trim();
  if (r && OTYPE[r]) return OTYPE[r];
  if (type === 'star') return 'Estrella';
  if (type === 'galaxy') return 'Galaxia';
  return r ? `Otro (${r})` : 'Otro objeto';
}
