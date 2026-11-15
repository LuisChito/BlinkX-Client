// AI-assisted development used for code development, debugging and documentation.
// Tool: ChatGPT, Claude
/* Composición química de un punto (/api/composition).
   - CompositionCard: tarjeta compacta para el Telemetry Drawer (botón, progreso, resumen).
   - CompositionModal: análisis completo (resumen, hielos, elementos, indicadores, espectro con bandas, 18 rasgos). */
import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  ComposedChart,
  ErrorBar,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, FlaskConical, Maximize2, RotateCcw, X } from 'lucide-react';
import type {
  CompositionContextType,
  CompositionFeature,
  CompositionResult,
  Coord,
  FeatureStatus,
  Job,
} from '../../lib/skyApi';

// ---------------------------------------------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------------------------------------------
const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };

/** 1.476e16 → "1.48 × 10¹⁶" */
export function sci(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  const exp = Math.floor(Math.log10(Math.abs(n)));
  const mant = n / 10 ** exp;
  return `${mant.toFixed(digits)} × 10${String(exp).split('').map((c) => SUP[c] ?? c).join('')}`;
}

/** "H2O" → "H₂O" */
const SUB: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
export const formula = (f: string) => f.replace(/\d/g, (d) => SUB[d] ?? d);

export const CONTEXT_OPTIONS: Array<{ id: CompositionContextType; label: string }> = [
  { id: 'auto', label: 'Automático (SIMBAD / espectro)' },
  { id: 'star', label: 'Estrella' },
  { id: 'brown_dwarf', label: 'Enana marrón' },
  { id: 'yso', label: 'Protoestrella (YSO)' },
  { id: 'cloud', label: 'Nube molecular' },
  { id: 'hii', label: 'Región H II' },
  { id: 'pn', label: 'Nebulosa planetaria' },
  { id: 'galaxy', label: 'Galaxia' },
  { id: 'solar_system', label: 'Asteroide / cometa' },
  { id: 'unknown', label: 'Desconocido' },
];

const SOURCE_LABEL: Record<string, string> = { simbad: 'SIMBAD', spectrum: 'deducido del espectro', user: 'elegido', none: 'sin dato' };

const STATUS_META: Record<FeatureStatus, { label: string; cls: string; band: string }> = {
  detected: { label: 'Detectado', cls: 'bg-[#52b79a]/20 text-[#7ee0c0] border-[#52b79a]/40', band: 'rgba(82,183,154,0.22)' },
  tentative: { label: 'Posible', cls: 'bg-amber-400/15 text-amber-200 border-amber-300/35', band: 'rgba(251,191,36,0.16)' },
  not_detected: { label: 'No detectado', cls: 'bg-white/[0.05] text-[#b9a8a3] border-white/10', band: 'rgba(255,255,255,0.05)' },
  attributed_to_other: { label: 'Descartado', cls: 'bg-[#a78bfa]/15 text-[#c9b8ff] border-[#a78bfa]/30', band: 'rgba(167,139,250,0.08)' },
  no_coverage: { label: 'Sin cobertura', cls: 'bg-white/[0.03] text-[#8a7d79] border-white/[0.06]', band: 'rgba(255,255,255,0.03)' },
  continuum_too_faint: { label: 'Continuo débil', cls: 'bg-white/[0.03] text-[#8a7d79] border-white/[0.06]', band: 'rgba(255,255,255,0.03)' },
};

const QUALITY_META: Record<string, { label: string; cls: string }> = {
  good: { label: 'Calidad buena', cls: 'text-[#7ee0c0] border-[#52b79a]/40 bg-[#52b79a]/10' },
  fair: { label: 'Calidad media', cls: 'text-amber-200 border-amber-300/35 bg-amber-400/10' },
  poor: { label: 'Calidad baja', cls: 'text-[#ff9b8a] border-[#ff6b5c]/40 bg-[#ff6b5c]/10' },
};

const sameCoord = (a: Coord | null, b: Coord | null) =>
  !!a && !!b && Math.abs(a.ra - b.ra) * 3600 < 1 && Math.abs(a.dec - b.dec) * 3600 < 1;

// ---------------------------------------------------------------------------------------------------------------
// Piezas compartidas
// ---------------------------------------------------------------------------------------------------------------
function Progress({ job }: { job: Job | null }) {
  const pct = Math.round((job?.progress ?? 0) * 100);
  return (
    <div className="space-y-1.5" role="status" aria-live="polite">
      <div className="flex items-center justify-between text-[11px] font-mono">
        <span className="text-[#ff8a5c] font-bold">Analizando… {pct}%</span>
        {job?.eta_s ? <span className="text-[#b9a8a3]">≈ {job.eta_s >= 90 ? `${Math.round(job.eta_s / 60)} min` : `${job.eta_s} s`}</span> : null}
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full bg-[#ff8a5c] transition-[width] duration-500" style={{ width: `${Math.max(3, pct)}%` }} />
      </div>
      <div className="text-[11px] font-mono text-[#f6f1ee]/85 truncate">
        {(job?.queue_position ?? 0) > 0 ? `En cola (#${job?.queue_position})` : job?.stage || 'Preparando espectro…'}
      </div>
      <p className="text-[10px] text-[#b9a8a3] leading-snug">
        La primera vez descarga el espectro de IRSA (1–15 min). Si ya mediste el espectro aquí, tarda ~1 s.
      </p>
    </div>
  );
}

function ElementChips({ result }: { result: CompositionResult }) {
  if (!result.elements_supported.length) return <span className="text-[11px] text-[#b9a8a3]">Ningún elemento respaldado.</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {result.elements_supported.map((el) => (
        <span
          key={el.element}
          title={`${el.quantified ? 'Con cantidad en los hielos. ' : 'Solo presencia (sin cantidad). '}Evidencia: ${el.evidence.join('; ')}`}
          className={`min-w-[2rem] text-center px-2 py-0.5 rounded-md border text-xs font-mono font-bold ${
            el.quantified ? 'bg-[#6fd3ff]/15 border-[#6fd3ff]/45 text-[#a8e6ff]' : 'bg-white/[0.05] border-white/15 text-[#f6f1ee]'
          }`}
        >
          {el.element}
        </span>
      ))}
    </div>
  );
}

function IndicatorBars({ result, limit, columns = false }: { result: CompositionResult; limit?: number; columns?: boolean }) {
  const list = limit ? result.indicators.slice(0, limit) : result.indicators;
  const max = Math.max(1, ...result.indicators.map((i) => Math.abs(i.depth_percent)));
  if (!list.length) return <span className="text-[11px] text-[#b9a8a3]">No se detectaron bandas por encima de 3σ.</span>;
  return (
    <ul className={columns ? 'grid gap-x-6 gap-y-2.5 sm:grid-cols-2' : 'space-y-2'}>
      {list.map((ind) => {
        const emission = ind.depth_percent < 0;
        return (
          <li key={ind.id} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-[11px]">
              <span className="text-[#f6f1ee] truncate" title={ind.carriers.join('; ')}>{ind.name}</span>
              <span className="font-mono text-[#b9a8a3] shrink-0">
                {Math.abs(ind.depth_percent).toFixed(1)}% · {ind.significance_sigma.toFixed(1)}σ
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
              <div
                className={`h-full rounded-full ${emission ? 'bg-[#6fd3ff]' : 'bg-[#ff8a5c]'}`}
                style={{ width: `${(Math.abs(ind.depth_percent) / max) * 100}%` }}
              />
            </div>
            <div className="text-[10px] font-mono text-[#8a7d79]">{emission ? 'emisión' : 'absorción'} · {ind.carriers[0] ?? ''}</div>
          </li>
        );
      })}
    </ul>
  );
}

function QualityBadge({ level }: { level: string }) {
  const q = QUALITY_META[level] ?? QUALITY_META.fair;
  return <span className={`px-2 py-0.5 rounded-md border text-[10px] font-mono font-bold ${q.cls}`}>{q.label}</span>;
}

function ContextLine({ result }: { result: CompositionResult }) {
  return (
    <div className="text-[11px] text-[#b9a8a3]">
      Tipo de objeto: <b className="text-[#f6f1ee] font-semibold">{result.context.label}</b>{' '}
      ({SOURCE_LABEL[result.context.source] ?? result.context.source})
      {result.simbad_match && (
        <> · <span className="font-mono text-[#f6f1ee]">{result.simbad_match.name.replace(/\s+/g, ' ')}</span></>
      )}
    </div>
  );
}

function PoorWarning({ result }: { result: CompositionResult }) {
  if (result.quality.level !== 'poor') return null;
  return (
    <div className="flex gap-2 rounded-lg border border-[#ff6b5c]/40 bg-[#ff6b5c]/10 p-2 text-[11px] text-[#ffc2b8]">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      Datos insuficientes o saturados: los resultados no son concluyentes.
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Tarjeta compacta (Telemetry Drawer)
// ---------------------------------------------------------------------------------------------------------------
interface CardProps {
  /** Punto que se analizaría ahora (sonda clicada o centro). */
  targetCoord: Coord;
  isProbe: boolean;
  result: CompositionResult | null;
  resultCoord: Coord | null;
  job: Job | null;
  loading: boolean;
  error: string | null;
  onAnalyze: (context: CompositionContextType) => void;
  onOpenDetail: () => void;
}

export function CompositionCard({ targetCoord, isProbe, result, resultCoord, job, loading, error, onAnalyze, onOpenDetail }: CardProps) {
  const [context, setContext] = useState<CompositionContextType>('auto');
  const stale = !!result && !sameCoord(resultCoord, targetCoord);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-[#f6f1ee] flex items-center gap-1.5">
          <FlaskConical className="w-3.5 h-3.5 text-[#ff8a5c]" />
          Composición química
        </span>
        {result && !loading && (
          <button
            type="button"
            onClick={onOpenDetail}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 text-[11px] font-mono text-[#6fd3ff]"
          >
            <Maximize2 className="w-3 h-3" /> Detalle
          </button>
        )}
      </div>

      <div className="hud-subcard rounded-xl p-3 space-y-2.5">
        {loading ? (
          <Progress job={job} />
        ) : result && !stale ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <QualityBadge level={result.quality.level} />
              <span className="text-[10px] font-mono text-[#b9a8a3]">{result.n_exposures} exp · {result.aperture_arcsec}″</span>
            </div>
            <ContextLine result={result} />
            <PoorWarning result={result} />
            <p className="text-[11px] leading-relaxed text-[#e6d9d4] line-clamp-5">{result.summary}</p>
            <div className="space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-wider text-[#b9a8a3]">Elementos respaldados</div>
              <ElementChips result={result} />
            </div>
            <IndicatorBars result={result} limit={3} />
            <button
              type="button"
              onClick={onOpenDetail}
              className="w-full py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-mono text-[#f6f1ee]"
            >
              Ver análisis completo →
            </button>
          </>
        ) : (
          <>
            {error && (
              <div className="flex gap-2 rounded-lg border border-[#ff6b5c]/40 bg-[#ff6b5c]/10 p-2 text-[11px] text-[#ffc2b8]">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            {stale && <p className="text-[11px] text-amber-200/90">El análisis anterior era de otro punto.</p>}
            <p className="text-[11px] text-[#b9a8a3] leading-snug">
              Mide 18 bandas de hielos, moléculas, minerales e hidrógeno ionizado en{' '}
              {isProbe ? 'la sonda clicada' : 'el centro del visor'}:{' '}
              <span className="font-mono text-[#f6f1ee]">
                {targetCoord.ra.toFixed(4)}°, {targetCoord.dec.toFixed(4)}°
              </span>
            </p>
            <label className="block space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#b9a8a3]">Tipo de objeto</span>
              <select
                value={context}
                onChange={(e) => setContext(e.target.value as CompositionContextType)}
                className="w-full rounded-lg bg-[#181A20] border border-white/10 px-2 py-1.5 text-xs text-[#f6f1ee] focus:outline-none focus:border-[#ff8a5c]/60"
              >
                {CONTEXT_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => onAnalyze(context)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-[#ff8a5c]/20 hover:bg-[#ff8a5c]/30 border border-[#ff8a5c]/40 text-[#ff8a5c] text-xs font-mono font-semibold transition-colors"
            >
              {error ? <RotateCcw className="w-3.5 h-3.5" /> : <FlaskConical className="w-3.5 h-3.5" />}
              {error ? 'Reintentar' : 'Analizar composición'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Modal con el análisis completo
// ---------------------------------------------------------------------------------------------------------------
interface ModalProps {
  open: boolean;
  onClose: () => void;
  result: CompositionResult | null;
  job: Job | null;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
}

const FEATURE_ORDER: FeatureStatus[] = ['detected', 'tentative', 'attributed_to_other', 'not_detected', 'continuum_too_faint', 'no_coverage'];

function FeatureRow({ f }: { f: CompositionFeature }) {
  const meta = STATUS_META[f.status] ?? STATUS_META.not_detected;
  let value = '—';
  if (f.status === 'not_detected' && f.upper_limit_depth_percent != null) value = `< ${f.upper_limit_depth_percent.toFixed(1)}%`;
  else if (f.depth_percent != null) {
    value = `${Math.abs(f.depth_percent).toFixed(1)}%`;
    if (f.depth_error_percent != null) value += ` ± ${f.depth_error_percent.toFixed(1)}`;
  }
  return (
    <tr className="border-t border-white/[0.05] align-top">
      <td className="py-1.5 pr-2">
        <div className="text-[#f6f1ee]">{f.name}</div>
        {f.reason && <div className="text-[10px] text-[#8a7d79] mt-0.5">{f.reason}</div>}
        {!f.reason && f.carriers?.length ? <div className="text-[10px] text-[#8a7d79] mt-0.5">{f.carriers.join(' · ')}</div> : null}
      </td>
      <td className="py-1.5 pr-2 font-mono text-[#b9a8a3] whitespace-nowrap">
        {f.band_um ? `${f.band_um[0].toFixed(2)}–${f.band_um[1].toFixed(2)}` : f.center_um?.toFixed(2) ?? '—'}
      </td>
      <td className="py-1.5 pr-2 whitespace-nowrap">
        <span className={`px-1.5 py-0.5 rounded border text-[10px] font-mono ${meta.cls}`}>{meta.label}</span>
      </td>
      <td className="py-1.5 pr-2 font-mono text-right text-[#f6f1ee] whitespace-nowrap">
        {f.significance_sigma != null ? `${f.significance_sigma.toFixed(1)}σ` : '—'}
      </td>
      <td className="py-1.5 font-mono text-right text-[#f6f1ee] whitespace-nowrap">
        {value}
        {f.kind === 'emission' && f.depth_percent != null ? <span className="text-[#6fd3ff]"> em.</span> : null}
      </td>
    </tr>
  );
}

function SpectrumWithBands({ result }: { result: CompositionResult }) {
  const data = useMemo(
    () =>
      result.spectrum_binned
        .filter((p) => Number.isFinite(p.flux_uJy))
        .map((p) => ({ x: p.wavelength_um, y: p.flux_uJy, err: p.error_uJy })),
    [result.spectrum_binned],
  );
  const bands = result.features.filter((f) => f.band_um && f.status !== 'no_coverage');
  if (!data.length) return <div className="text-xs text-[#b9a8a3]">Sin espectro agrupado.</div>;
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 6, right: 8, left: 4, bottom: 4 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="2 2" />
          {bands.map((f) => (
            <ReferenceArea
              key={f.id}
              x1={f.band_um![0]}
              x2={f.band_um![1]}
              fill={(STATUS_META[f.status] ?? STATUS_META.not_detected).band}
              strokeOpacity={0}
              ifOverflow="hidden"
            />
          ))}
          <XAxis
            dataKey="x"
            type="number"
            domain={[0.7, 5.05]}
            ticks={[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]}
            tick={{ fill: '#b9a8a3', fontSize: 10, fontFamily: 'JetBrains Mono' }}
            stroke="rgba(255,255,255,0.12)"
            label={{ value: 'µm', position: 'insideBottomRight', offset: -2, fill: '#b9a8a3', fontSize: 10 }}
          />
          <YAxis
            tick={{ fill: '#b9a8a3', fontSize: 10, fontFamily: 'JetBrains Mono' }}
            stroke="rgba(255,255,255,0.12)"
            width={56}
            tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0))}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as { x: number; y: number; err: number };
              const inBand = result.features.filter((f) => f.band_um && p.x >= f.band_um[0] && p.x <= f.band_um[1]);
              return (
                <div className="bg-[#181A20]/95 border border-white/15 px-2 py-1 rounded text-[10px] font-mono text-[#f6f1ee] max-w-[16rem]">
                  <div>{p.x.toFixed(3)} µm</div>
                  <div className="text-[#ff8a5c]">{p.y.toFixed(1)} ± {p.err.toFixed(1)} µJy</div>
                  {inBand.map((f) => (
                    <div key={f.id} className="text-[#b9a8a3]">{f.name} · {(STATUS_META[f.status] ?? STATUS_META.not_detected).label}</div>
                  ))}
                </div>
              );
            }}
          />
          <Line dataKey="y" type="monotone" stroke="#ff8a5c" strokeWidth={1.4} dot={false} isAnimationActive={false} />
          <Scatter dataKey="y" fill="#ff8a5c" shape={() => null} isAnimationActive={false}>
            <ErrorBar dataKey="err" direction="y" stroke="rgba(255,138,92,0.35)" width={0} />
          </Scatter>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function Section({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <section className="hud-subcard rounded-xl p-3.5 space-y-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-[#f6f1ee]">{title}</h3>
        {hint && <span className="text-[10px] font-mono text-[#8a7d79]">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

export function CompositionModal({ open, onClose, result, job, loading, error, onRetry }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const features = useMemo(
    () => [...(result?.features ?? [])].sort((a, b) => FEATURE_ORDER.indexOf(a.status) - FEATURE_ORDER.indexOf(b.status)),
    [result?.features],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="comp-title">
      <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-default" onClick={onClose} />
      <div className="relative w-full max-w-5xl max-h-full overflow-hidden hud-card-elevated rounded-2xl border border-white/10 shadow-2xl flex flex-col animate-panel-enter select-text">
        <header className="px-4 sm:px-5 py-3 border-b border-white/[0.07] flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 id="comp-title" className="text-[15px] font-semibold text-[#f6f1ee] flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-[#ff8a5c]" /> Composición química
            </h2>
            {result && (
              <p className="text-[11px] font-mono text-[#b9a8a3] truncate">
                RA {result.center.ra.toFixed(5)}° · Dec {result.center.dec.toFixed(5)}° · apertura {result.aperture_arcsec}″ ·{' '}
                {result.n_exposures} exposiciones
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-[#b9a8a3] hover:text-white" aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
          {loading && !result ? (
            <div className="max-w-md mx-auto py-10"><Progress job={job} /></div>
          ) : error && !result ? (
            <div className="max-w-md mx-auto py-10 space-y-3 text-center">
              <p className="text-sm text-[#ffc2b8]">{error}</p>
              {onRetry && (
                <button type="button" onClick={onRetry} className="px-3 py-1.5 rounded-lg bg-[#ff8a5c]/20 border border-[#ff8a5c]/40 text-[#ff8a5c] text-xs font-mono">
                  Reintentar
                </button>
              )}
            </div>
          ) : result ? (
            <>
              {/* Resumen */}
              <section className="hud-subcard rounded-xl p-3.5 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <QualityBadge level={result.quality.level} />
                  {result.partial && (
                    <span className="px-2 py-0.5 rounded-md border border-amber-300/35 bg-amber-400/10 text-amber-200 text-[10px] font-mono">
                      Faltan algunas exposiciones
                    </span>
                  )}
                  {result.quality.median_snr_per_channel != null && (
                    <span className="text-[10px] font-mono text-[#b9a8a3]">
                      S/N mediana {result.quality.median_snr_per_channel.toFixed(1)} · {result.quality.channels ?? '—'} canales
                    </span>
                  )}
                </div>
                <ContextLine result={result} />
                <PoorWarning result={result} />
                <p className="text-[13px] leading-relaxed text-[#e6d9d4]">{result.summary}</p>
              </section>

              <div className="grid gap-3.5 lg:grid-cols-2">
                <Section title="Hielos" hint="moléculas / cm² en la línea de visión">
                  {result.ices.length ? (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-[10px] font-mono uppercase tracking-wider text-[#8a7d79] text-left">
                          <th className="pb-1 font-normal">Hielo</th>
                          <th className="pb-1 font-normal text-right">Columna</th>
                          <th className="pb-1 font-normal text-right">vs H₂O</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.ices.map((ice) => (
                          <tr key={ice.formula} className="border-t border-white/[0.05]">
                            <td className="py-1.5 text-[#f6f1ee]">
                              <b className="font-mono">{formula(ice.formula)}</b>{' '}
                              <span className="text-[#b9a8a3]">{ice.name.replace(/\s*\(.*\)\s*$/, '')}</span>
                            </td>
                            <td className="py-1.5 text-right font-mono text-[#f6f1ee]">{sci(ice['column_density_cm-2'])}</td>
                            <td className="py-1.5 text-right font-mono text-[#b9a8a3]">
                              {ice.relative_to_h2o_percent != null ? `${ice.relative_to_h2o_percent.toFixed(0)}%` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-[11px] text-[#b9a8a3]">No se cuantificó ningún hielo en este punto.</p>
                  )}

                  {result.elements_in_ices.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-[#b9a8a3]">Átomos en los hielos</div>
                      <div className="flex h-3 rounded-full overflow-hidden bg-white/[0.05]" aria-hidden="true">
                        {result.elements_in_ices.map((el, i) => (
                          <div
                            key={el.element}
                            style={{ width: `${el.fraction_percent}%`, background: ['#6fd3ff', '#ff8a5c', '#52b79a', '#c9b8ff', '#fbbf24'][i % 5] }}
                          />
                        ))}
                      </div>
                      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-mono">
                        {result.elements_in_ices.map((el, i) => (
                          <li key={el.element} className="flex items-center gap-1.5 text-[#f6f1ee]">
                            <i className="w-2 h-2 rounded-sm" style={{ background: ['#6fd3ff', '#ff8a5c', '#52b79a', '#c9b8ff', '#fbbf24'][i % 5] }} />
                            {el.element} {el.fraction_percent.toFixed(1)}%
                            <span className="text-[#8a7d79]">({sci(el['column_density_cm-2'], 1)})</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Section>

                <Section title="Elementos respaldados" hint="resaltado = con cantidad">
                  <ElementChips result={result} />
                  <ul className="space-y-1 text-[11px] text-[#b9a8a3]">
                    {result.elements_supported.map((el) => (
                      <li key={el.element}>
                        <b className="font-mono text-[#f6f1ee]">{el.element}</b>: {el.evidence.join(' · ')}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-[#8a7d79]">
                    SPHEREx no mide el % total de cada elemento; solo indica qué elementos respalda cada banda.
                  </p>
                </Section>
              </div>

              <Section title="Indicadores detectados" hint="profundidad de banda · significancia">
                <IndicatorBars result={result} columns />
                <p className="text-[10px] text-[#8a7d79]">
                  Profundidad = cuánto baja (absorción, naranja) o sube (emisión, azul) el espectro respecto al continuo. Es un
                  indicador relativo, no una masa.
                </p>
              </Section>

              <Section title="Espectro y bandas medidas" hint="0.75–5 µm · µJy">
                <SpectrumWithBands result={result} />
                <div className="flex flex-wrap gap-3 text-[10px] font-mono text-[#b9a8a3]">
                  {(['detected', 'tentative', 'not_detected', 'attributed_to_other'] as FeatureStatus[]).map((s) => (
                    <span key={s} className="flex items-center gap-1.5">
                      <i className="w-3 h-2.5 rounded-sm border border-white/10" style={{ background: STATUS_META[s].band }} />
                      {STATUS_META[s].label}
                    </span>
                  ))}
                </div>
              </Section>

              <Section title={`Las ${result.features.length} bandas analizadas`}>
                <div className="overflow-x-auto -mx-1 px-1">
                  <table className="w-full min-w-[560px] text-xs">
                    <thead>
                      <tr className="text-[10px] font-mono uppercase tracking-wider text-[#8a7d79] text-left">
                        <th className="pb-1 font-normal">Banda</th>
                        <th className="pb-1 font-normal normal-case">µm</th>
                        <th className="pb-1 font-normal">Estado</th>
                        <th className="pb-1 font-normal text-right normal-case">σ</th>
                        <th className="pb-1 font-normal text-right">Profundidad</th>
                      </tr>
                    </thead>
                    <tbody>{features.map((f) => <FeatureRow key={f.id} f={f} />)}</tbody>
                  </table>
                </div>
              </Section>

              {(result.warnings?.length || result.limitations?.length || result.method) && (
                <section className="space-y-1.5 text-[10px] leading-relaxed text-[#8a7d79] px-1">
                  {result.warnings?.map((w) => <p key={w}>⚠ {w}</p>)}
                  {result.limitations?.map((l) => <p key={l}>• {l}</p>)}
                  {result.method && <p>Método: {result.method}</p>}
                </section>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
