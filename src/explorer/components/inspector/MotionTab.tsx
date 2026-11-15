// AI-assisted development used for code development, debugging and documentation.
// Tool: ChatGPT, Claude
/* Pestaña Movimiento: predicciones de posición.
   1) /api/predict → dónde está el objeto en cada fecha con imagen (movimiento propio o efemérides).
   2) /api/asteroids/predict-from-current → el usuario marca un asteroide y JPL Horizons dice a dónde va. */
import { useEffect, useState } from 'react';
import { Crosshair, MousePointerClick, Orbit, Rocket, X } from 'lucide-react';
import type { Coord, Frame, Job } from '../../../lib/skyApi';
import type { AsteroidPredictResult, PredictResult } from '../../hooks/useSkyContract';
import { Button, Chip, ErrorNote, JobProgress, KV, SectionHeader, cx, fmtDate, fmtDateTime } from '../ui/primitives';

const METHOD: Record<string, string> = {
  proper_motion: 'Movimiento propio del catálogo',
  ephemeris: 'Efemérides de JPL Horizons',
  static: 'Objeto fijo (sin movimiento conocido)',
};

const HORIZONS = [
  { value: 0.25, label: '6 horas' },
  { value: 0.5, label: '12 horas' },
  { value: 1, label: '1 día' },
  { value: 3, label: '3 días' },
  { value: 7, label: '1 semana' },
  { value: 30, label: '30 días' },
];

/** Ángulo de posición (0° = norte, 90° = este) → dirección cardinal en español. */
function cardinal(pa: number) {
  const dirs = ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'];
  return dirs[Math.round((((pa % 360) + 360) % 360) / 45) % 8];
}

/** Separación aproximada en segundos de arco. */
function sepArcsec(a: Coord, b: Coord) {
  let dra = Math.abs(a.ra - b.ra);
  if (dra > 180) dra = 360 - dra;
  return Math.hypot(dra * Math.cos((a.dec * Math.PI) / 180), a.dec - b.dec) * 3600;
}

interface Props {
  point: Coord;
  suggestedName: string;
  dateFrom: string;
  dateTo: string;
  shownFrame: Frame | null;
  canPick: boolean;
  cantPickReason?: string;
  // /api/predict
  predict: PredictResult | null;
  predictNow: { date: string; ra: number; dec: number; sigma_arcsec: number } | null;
  loadingPredict: boolean;
  predictJob: Job | null;
  predictError: string | null;
  onPredict: (name: string) => void;
  onClearPredict: () => void;
  /** Centra el cielo en una coordenada (p. ej. la posición predicha). */
  onCenter: (c: Coord) => void;
  // asteroides
  asteroid: AsteroidPredictResult | null;
  loadingAsteroid: boolean;
  asteroidError: string | null;
  pickMode: boolean;
  asteroidId: string;
  horizonDays: number;
  onAsteroidId: (v: string) => void;
  onHorizonDays: (v: number) => void;
  onTogglePick: () => void;
  onClearAsteroid: () => void;
}

const inputCls = 'w-full h-9 rounded-lg bg-raised border border-line px-2.5 text-[13px] text-fg placeholder:text-faint focus:border-ember/60 outline-none';

export function MotionTab(p: Props) {
  const [name, setName] = useState(p.suggestedName);
  useEffect(() => setName(p.suggestedName), [p.suggestedName]);

  const pr = p.predict;
  const pmTotal = pr?.pm_mas_yr ? Math.hypot(pr.pm_mas_yr.ra, pr.pm_mas_yr.dec) / 1000 : null;
  const pmPa = pr?.pm_mas_yr ? (Math.atan2(pr.pm_mas_yr.ra, pr.pm_mas_yr.dec) * 180) / Math.PI : null;
  const first = pr?.positions[0];
  const last = pr?.positions[pr.positions.length - 1];
  const shift = first && last ? sepArcsec(first, last) : null;

  const a = p.asteroid;
  const asteroidIdValid = /^\d+$/.test(p.asteroidId) && Number(p.asteroidId) > 0;

  return (
    <>
      {/* 1. Trayectoria a lo largo de las fechas */}
      <section className="space-y-2.5">
        <SectionHeader
          title={<span className="flex items-center gap-1.5"><Orbit className="w-4 h-4 text-data" aria-hidden="true" />¿Dónde está en cada fecha?</span>}
          hint="Calcula la posición del objeto en cada exposición de SPHEREx, para ver si lo que salta en el parpadeo es él."
        />
        <label className="block space-y-1">
          <span className="text-[11px] text-muted">Objeto (opcional)</span>
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Vacío = el objeto con movimiento más cercano"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-faint font-mono">{p.dateFrom} → {p.dateTo}</span>
          <Button variant="primary" size="sm" disabled={p.loadingPredict} onClick={() => p.onPredict(name.trim())}>
            {pr ? 'Recalcular' : 'Calcular trayectoria'}
          </Button>
        </div>

        {p.loadingPredict && (
          <div className="bx-card p-3">
            <JobProgress job={p.predictJob} label="Calculando posiciones" />
          </div>
        )}
        {p.predictError && !p.loadingPredict && <ErrorNote message={p.predictError} onRetry={() => p.onPredict(name.trim())} />}

        {pr && !p.loadingPredict && (
          <div className="bx-card p-3 space-y-2.5 border-data/40">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-fg truncate">{pr.target}</div>
                <div className="text-[11px] text-muted">{METHOD[pr.method] ?? pr.method}</div>
              </div>
              <button type="button" onClick={p.onClearPredict} aria-label="Quitar trayectoria del cielo" title="Quitar del cielo" className="p-1.5 rounded-md text-muted hover:text-fg hover:bg-white/[0.08] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {pmTotal !== null && pmPa !== null && <Chip tone="ember">{pmTotal.toFixed(2)}″/año hacia el {cardinal(pmPa)}</Chip>}
              {shift !== null && <Chip tone="data">Se desplaza {shift.toFixed(1)}″ en el periodo</Chip>}
              {pr.parallax_mas ? <Chip>≈ {((1000 / pr.parallax_mas) * 3.2616).toFixed(1)} años luz</Chip> : null}
            </div>
            <dl>
              <KV k="Fechas calculadas" v={`${pr.positions.length} (${fmtDate(first?.date)} → ${fmtDate(last?.date)})`} />
              {p.predictNow ? (
                <>
                  <KV k={`En la imagen visible (${fmtDate(p.predictNow.date)})`} v={`${p.predictNow.ra.toFixed(5)}°, ${p.predictNow.dec >= 0 ? '+' : ''}${p.predictNow.dec.toFixed(5)}°`} />
                  <KV k="Incertidumbre" v={`± ${p.predictNow.sigma_arcsec < 0.1 ? p.predictNow.sigma_arcsec.toExponential(1) : p.predictNow.sigma_arcsec.toFixed(2)}″`} />
                </>
              ) : (
                <KV k="Imagen visible" v="Sin posición para esa fecha" mono={false} />
              )}
            </dl>
            {p.predictNow && (
              <Button size="sm" className="w-full" onClick={() => p.onCenter(p.predictNow!)}>
                <Crosshair className="w-3.5 h-3.5" aria-hidden="true" /> Centrar en la predicción
              </Button>
            )}
            <p className="text-[11px] text-muted leading-snug">
              La línea azul punteada es su recorrido; el círculo marca dónde debería estar en la fecha que ves. Mueve la línea de tiempo para seguirlo.
            </p>
            {pr.warnings?.map((w) => <p key={w} className="text-[11px] text-warn-fg">⚠ {w}</p>)}
          </div>
        )}
      </section>

      <div className="h-px bg-line" aria-hidden="true" />

      {/* 2. Asteroide: marcar en la imagen y predecir */}
      <section className="space-y-2.5">
        <SectionHeader
          title={<span className="flex items-center gap-1.5"><Rocket className="w-4 h-4 text-ok" aria-hidden="true" />Seguir un asteroide</span>}
          hint="Indica su número MPC, márcalo en la imagen y JPL Horizons (visto desde SPHEREx) confirma que es él y predice a dónde va."
        />
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <label className="block space-y-1">
            <span className="text-[11px] text-muted">Número MPC</span>
            <input
              className={inputCls}
              inputMode="numeric"
              value={p.asteroidId}
              onChange={(e) => p.onAsteroidId(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="433 = Eros, 3000 = Leonardo"
              aria-invalid={!!p.asteroidId && !asteroidIdValid}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] text-muted">Predecir a</span>
            <select className={cx(inputCls, 'w-auto cursor-pointer')} value={p.horizonDays} onChange={(e) => p.onHorizonDays(Number(e.target.value))}>
              {HORIZONS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
            </select>
          </label>
        </div>
        <Button
          variant={p.pickMode ? 'secondary' : 'primary'}
          className="w-full"
          disabled={!asteroidIdValid || !p.canPick || p.loadingAsteroid}
          aria-pressed={p.pickMode}
          onClick={p.onTogglePick}
        >
          <MousePointerClick className="w-4 h-4" aria-hidden="true" />
          {p.loadingAsteroid ? 'Consultando JPL Horizons…' : p.pickMode ? 'Cancelar: no marcar' : 'Marcar el asteroide en la imagen'}
        </Button>
        {!p.canPick && p.cantPickReason && <p className="text-[11px] text-muted">{p.cantPickReason}</p>}
        {p.canPick && p.shownFrame && (
          <p className="text-[11px] text-faint">
            Se usará la imagen del {fmtDateTime(p.shownFrame.date_obs)} UTC. Muévete en la línea de tiempo hasta una fecha donde se vea el asteroide.
          </p>
        )}
        {p.asteroidError && !p.loadingAsteroid && <ErrorNote message={p.asteroidError} />}

        {a && !p.loadingAsteroid && (
          <div className="bx-card p-3 space-y-2.5 border-ok/40">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-fg truncate">{a.target}</div>
                <div className="text-[11px] text-muted">
                  {a.observer?.endsWith('-163182') ? 'Visto desde SPHEREx' : a.observer?.endsWith('@399') ? 'Visto desde el centro de la Tierra' : a.observer}
                </div>
              </div>
              <button type="button" onClick={p.onClearAsteroid} aria-label="Quitar asteroide del cielo" title="Quitar del cielo" className="p-1.5 rounded-md text-muted hover:text-fg hover:bg-white/[0.08] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Chip tone={a.current_observation.offset_arcsec <= 5 ? 'ok' : 'warn'}>
                Tu marca está a {a.current_observation.offset_arcsec.toFixed(2)}″ del asteroide
              </Chip>
              {a.motion && <Chip tone="ember">{a.motion.arcsec_per_hour.toFixed(1)}″/h hacia el {cardinal(a.motion.position_angle_deg)}</Chip>}
            </div>
            <dl>
              <KV k="Observado" v={fmtDateTime(a.current_observation.time)} />
              <KV k={`Dentro de ${HORIZONS.find((h) => h.value === a.horizon_days)?.label ?? `${a.horizon_days} d`}`} v={fmtDateTime(a.forecast_time)} />
              <KV k="Posición predicha" v={`${a.predicted_ra_deg.toFixed(5)}°, ${a.predicted_dec_deg >= 0 ? '+' : ''}${a.predicted_dec_deg.toFixed(5)}°`} />
              <KV k="Incertidumbre" v={`± ${a.sigma_arcsec < 0.1 ? a.sigma_arcsec.toExponential(1) : a.sigma_arcsec.toFixed(2)}″`} />
            </dl>
            <Button size="sm" className="w-full" onClick={() => p.onCenter({ ra: a.predicted_ra_deg, dec: a.predicted_dec_deg })}>
              <Crosshair className="w-3.5 h-3.5" aria-hidden="true" /> Centrar en la posición futura
            </Button>
            {a.pixel && !a.pixel.inside_image && (
              <p className="text-[11px] text-warn-fg">La posición predicha sale de la imagen: aleja el zoom para ver hacia dónde va.</p>
            )}
            <p className="text-[11px] text-muted leading-snug">En el cielo: círculo blanco = tu marca; línea verde = trayectoria; retículo verde = posición futura.</p>
            {a.warnings?.map((w) => <p key={w} className="text-[11px] text-warn-fg">⚠ {w}</p>)}
          </div>
        )}
      </section>
    </>
  );
}
