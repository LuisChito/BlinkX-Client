/* Pestaña Espectro: brillo vs longitud de onda (o vs fecha) del punto medido, por detector. */
import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  ErrorBar,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity } from 'lucide-react';
import { MOLECULAR_PRESETS } from '../../data/spherexCatalog';
import type { MolecularLensId } from '../../types/spherex';
import type { Coord, Frame, Job, SpectrumPoint } from '../../../lib/skyApi';
import type { SpectrumResponse } from '../../hooks/useSkyContract';
import { summarizeRealDetectors } from '../../utils/backendMetrics';
import { Button, Chip, EmptyState, JobProgress, SectionHeader, Segmented, cx, fmtDate } from '../ui/primitives';
import { DETECTORS, detColor } from './detectors';

interface Props {
  spectrum: SpectrumResponse | null;
  loading: boolean;
  job: Job | null;
  point: Coord;
  isProbe: boolean;
  framesMeta: Frame[];
  lens: MolecularLensId;
  onChangeLens: (l: MolecularLensId) => void;
  onMeasure: () => void;
}

const AXIS = { fill: '#b9a8a3', fontSize: 11, fontFamily: 'JetBrains Mono Variable, monospace' };
const LENSES: Array<{ id: MolecularLensId; label: string }> = [
  { id: 'all', label: 'Todo' },
  { id: 'h2o', label: 'H₂O' },
  { id: 'ch4', label: 'CH₄' },
  { id: 'co2', label: 'CO₂' },
  { id: 'co', label: 'CO' },
  { id: 'nh3', label: 'NH₃' },
];

type Pt = SpectrumPoint & { t: number; dim: boolean };

function PointTip({ active, payload, unit }: { active?: boolean; payload?: Array<{ payload: Pt }>; unit: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bx-float rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-fg shadow-xl">
      <div style={{ color: detColor(p.detector) }}>D{p.detector} · {p.wavelength.toFixed(3)} µm</div>
      <div>{p.flux.toFixed(1)} ± {p.error.toFixed(1)} {unit}</div>
      <div className="text-muted">{p.date_obs.slice(0, 10)}</div>
      {p.flags.length > 0 && <div className="text-warn-fg">Banderas: {p.flags.join(', ')}</div>}
    </div>
  );
}

export function SpectrumTab({ spectrum, loading, job, point, isProbe, framesMeta, lens, onChangeLens, onMeasure }: Props) {
  const [view, setView] = useState<'spectrum' | 'time'>('spectrum');
  const [hideFlagged, setHideFlagged] = useState(false);
  const preset = MOLECULAR_PRESETS.find((p) => p.id === lens) ?? MOLECULAR_PRESETS[0];
  const unit = spectrum?.flux_unit === 'uJy' ? 'µJy' : spectrum?.flux_unit ?? 'µJy';
  const points = spectrum?.points ?? [];

  const series = useMemo(() => {
    const [lo, hi] = view === 'spectrum' ? preset.bandRangeUm : [0, 99];
    const pts: Pt[] = points
      .filter((p) => p.wavelength >= lo && p.wavelength <= hi)
      .filter((p) => !(hideFlagged && p.flags.length))
      .map((p) => ({ ...p, t: Date.parse(p.date_obs), dim: p.flags.length > 0 }));
    return DETECTORS.map((d) => ({ det: d.det, color: d.color, data: pts.filter((p) => p.detector === d.det) }));
  }, [points, view, preset.bandRangeUm, hideFlagged]);

  const stats = useMemo(() => summarizeRealDetectors(points, framesMeta), [points, framesMeta]);
  const flagged = points.filter((p) => p.flags.length).length;
  const maxMean = Math.max(1, ...stats.map((s) => Math.abs(s.meanFluxUJy ?? 0)));

  if (loading) {
    return (
      <div className="bx-card p-4">
        <JobProgress job={job} label="Midiendo espectro" note="Se descarga y mide cada exposición de SPHEREx en ese punto. La primera vez puede tardar varios minutos." />
      </div>
    );
  }

  if (!points.length) {
    return (
      <EmptyState
        icon={<Activity className="w-6 h-6" />}
        title={spectrum ? 'Sin mediciones en este punto' : 'Aún no hay espectro'}
        action={<Button variant="primary" onClick={onMeasure}>Medir {isProbe ? 'el punto' : 'el centro'}</Button>}
      >
        {spectrum
          ? 'SPHEREx no tiene exposiciones válidas aquí. Prueba con otra fuente.'
          : 'Haz clic en una fuente del cielo, o mide el centro del campo.'}
        <span className="block font-mono text-faint mt-1">{point.ra.toFixed(4)}°, {point.dec.toFixed(4)}°</span>
      </EmptyState>
    );
  }

  return (
    <>
      <section>
        <SectionHeader
          title={view === 'spectrum' ? 'Brillo por longitud de onda' : 'Brillo por fecha'}
          hint={`${points.length} mediciones · apertura ${spectrum?.aperture_arcsec}″ · ${unit}`}
          action={
            <Segmented
              label="Tipo de gráfica"
              size="sm"
              value={view}
              onChange={setView}
              options={[
                { value: 'spectrum', label: 'Espectro' },
                { value: 'time', label: 'Curva de luz' },
              ]}
            />
          }
        />
        <div className="bx-card p-2 pt-3">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="2 3" />
                {view === 'spectrum' && preset.highlightBands.map((b) => (
                  <ReferenceArea key={b.name} x1={b.x1} x2={b.x2} fill="rgba(111,211,255,0.08)" strokeOpacity={0} ifOverflow="hidden" />
                ))}
                {view === 'spectrum' ? (
                  <XAxis dataKey="wavelength" type="number" domain={preset.bandRangeUm} tick={AXIS} stroke="rgba(255,255,255,0.12)" tickFormatter={(v: number) => v.toFixed(1)} unit=" µm" />
                ) : (
                  <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tick={AXIS} stroke="rgba(255,255,255,0.12)" tickFormatter={(v: number) => new Date(v).toISOString().slice(2, 7)} />
                )}
                <YAxis dataKey="flux" type="number" tick={AXIS} stroke="rgba(255,255,255,0.12)" width={48} tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0))} />
                <Tooltip content={<PointTip unit={unit} />} cursor={{ stroke: 'rgba(255,255,255,0.2)' }} />
                {series.map((s) => (
                  <Scatter key={s.det} data={s.data} fill={s.color} isAnimationActive={false} shape={(props: { cx?: number; cy?: number; payload?: Pt }) => (
                    <circle cx={props.cx} cy={props.cy} r={2.6} fill={s.color} fillOpacity={props.payload?.dim ? 0.35 : 0.9} />
                  )}>
                    <ErrorBar dataKey="error" direction="y" stroke={s.color} strokeOpacity={0.3} width={0} />
                  </Scatter>
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 pt-1 text-[11px] text-muted">
            {DETECTORS.map((d) => (
              <span key={d.det} className="flex items-center gap-1"><i className="w-2 h-2 rounded-full" style={{ background: d.color }} aria-hidden="true" />D{d.det}</span>
            ))}
            {flagged > 0 && (
              <label className="ml-auto flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={hideFlagged} onChange={() => setHideFlagged((v) => !v)} className="accent-[#ff8a5c]" />
                Ocultar {flagged} con banderas
              </label>
            )}
          </div>
        </div>
        {view === 'spectrum' && (
          <div className="mt-2.5">
            <div className="text-[11px] text-muted mb-1.5">Resaltar bandas de una molécula</div>
            <div className="flex flex-wrap gap-1">
              {LENSES.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  aria-pressed={lens === l.id}
                  onClick={() => onChangeLens(l.id)}
                  className={cx(
                    'h-7 px-2.5 rounded-md text-xs border cursor-pointer transition-colors',
                    lens === l.id ? 'bg-data/15 border-data/50 text-data font-semibold' : 'border-line text-soft hover:text-fg hover:border-line-strong',
                  )}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section>
        <SectionHeader title="Por detector" hint={`Brillo medio en ${unit}`} />
        <ul className="space-y-1.5">
          {stats.map((s) => {
            const d = DETECTORS[s.detector - 1];
            return (
              <li key={s.detector} className="grid grid-cols-[2.25rem_1fr_auto] items-center gap-2" title={d.reveals}>
                <span className="font-mono text-xs font-semibold" style={{ color: d.color }}>D{s.detector}</span>
                <div className="min-w-0">
                  <div className="flex justify-between text-[11px] text-muted"><span className="truncate">{d.title}</span><span className="font-mono">{d.from.toFixed(2)}–{d.to.toFixed(2)} µm</span></div>
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden mt-0.5">
                    <div className="h-full rounded-full" style={{ width: `${s.meanFluxUJy == null ? 0 : Math.max(3, (Math.abs(s.meanFluxUJy) / maxMean) * 100)}%`, background: d.color }} />
                  </div>
                </div>
                <span className="font-mono text-xs text-fg text-right w-16">{s.meanFluxUJy == null ? '—' : s.meanFluxUJy.toFixed(0)}<span className="block text-[10px] text-faint">{s.pointCount} med.</span></span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-wrap gap-1.5">
        <Chip tone="neutral">{spectrum?.n_exposures ?? points.length} exposiciones</Chip>
        <Chip tone="neutral">{fmtDate(points.reduce((a, p) => (p.date_obs < a ? p.date_obs : a), points[0].date_obs))} → {fmtDate(points.reduce((a, p) => (p.date_obs > a ? p.date_obs : a), points[0].date_obs))}</Chip>
        {spectrum?.partial && <Chip tone="warn">Faltan algunas exposiciones</Chip>}
      </section>
    </>
  );
}
