/* Pestaña Resumen: qué estamos mirando, el punto medido, cifras clave y objetos cercanos. */
import { useMemo, useState } from 'react';
import { Activity, Check, Copy, Crosshair, FlaskConical, MapPin, Orbit } from 'lucide-react';
import type { Coord } from '../../../lib/skyApi';
import type { CoverageResponse, FramesResponse, ObjectsResponse, ResolveResponse } from '../../hooks/useSkyContract';
import { Button, Chip, Eyebrow, SectionHeader, Stat, cx, decToDms, fmtDate, fmtDec, fmtDeg, objectTypeLabel, raToHms } from '../ui/primitives';

interface Props {
  title: string;
  subtitle: string;
  center: Coord;
  resolveInfo: ResolveResponse | null;
  probe: Coord | null;
  objects: ObjectsResponse | null;
  frames: FramesResponse | null;
  coverage: CoverageResponse | null;
  loadingMeta: boolean;
  onProbe: (ra: number, dec: number) => void;
  onClearProbe: () => void;
  onGoSpectrum: () => void;
  onGoComposition: () => void;
}

function CopyCoords({ c }: { c: Coord }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(`${c.ra.toFixed(6)} ${c.dec.toFixed(6)}`);
        setDone(true);
        window.setTimeout(() => setDone(false), 1400);
      }}
      aria-label="Copiar coordenadas"
      title="Copiar coordenadas"
      className="p-1.5 rounded-md text-muted hover:text-fg hover:bg-white/[0.08] cursor-pointer"
    >
      {done ? <Check className="w-3.5 h-3.5 text-ok" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function Coords({ c }: { c: Coord }) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-xs">
      <span className="text-muted">α</span>
      <span className="text-fg">{fmtDeg(c.ra)} <span className="text-faint">· {raToHms(c.ra)}</span></span>
      <span className="text-muted">δ</span>
      <span className="text-fg">{fmtDec(c.dec)} <span className="text-faint">· {decToDms(c.dec)}</span></span>
    </div>
  );
}

export function SummaryTab({
  title, subtitle, center, resolveInfo, probe, objects, frames, coverage, loadingMeta,
  onProbe, onClearProbe, onGoSpectrum, onGoComposition,
}: Props) {
  const nearby = useMemo(
    // SIMBAD primero a igual distancia (redondeada a 1″): nombres más legibles.
    () => [...(objects?.objects ?? [])]
      .sort((a, b) => Math.round(a.distance_arcsec) - Math.round(b.distance_arcsec) || (a.source.toLowerCase() === 'simbad' ? -1 : 1))
      .slice(0, 10),
    [objects],
  );
  const detectorsWithData = useMemo(() => new Set((frames?.frames ?? []).map((f) => f.detector)).size, [frames]);
  const pmTotal = resolveInfo?.pm ? Math.hypot(resolveInfo.pm.ra, resolveInfo.pm.dec) / 1000 : null;
  const objCount = objects ? (objects.counts?.simbad ?? 0) + (objects.counts?.ned ?? 0) || objects.objects.length : null;

  return (
    <>
      {/* Objetivo */}
      <section className="space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Eyebrow>Centro del campo</Eyebrow>
            <h2 className="text-lg font-semibold text-fg leading-tight mt-0.5 break-words">{title}</h2>
            <p className="text-xs text-muted">{subtitle}</p>
          </div>
          <CopyCoords c={center} />
        </div>
        <Coords c={center} />
        {pmTotal !== null && (
          <div className="flex flex-wrap gap-1.5">
            <Chip tone="ember" title="Movimiento propio total según el catálogo">
              <Orbit className="w-3 h-3" aria-hidden="true" /> Se mueve {pmTotal.toFixed(2)}″ por año
            </Chip>
            {resolveInfo?.parallax_mas != null && (
              <Chip tone="neutral" title="Paralaje">
                Distancia ≈ {(1000 / resolveInfo.parallax_mas * 3.2616).toFixed(1)} años luz
              </Chip>
            )}
          </div>
        )}
      </section>

      {/* Punto medido */}
      {probe ? (
        <section className="bx-card p-3 border-ember/40 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ember">
              <MapPin className="w-4 h-4" aria-hidden="true" /> Punto medido
            </span>
            <Button size="sm" variant="ghost" onClick={onClearProbe}>
              <Crosshair className="w-3.5 h-3.5" aria-hidden="true" /> Usar el centro
            </Button>
          </div>
          <Coords c={probe} />
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" onClick={onGoSpectrum}><Activity className="w-3.5 h-3.5" aria-hidden="true" /> Espectro</Button>
            <Button size="sm" variant="primary" onClick={onGoComposition}><FlaskConical className="w-3.5 h-3.5" aria-hidden="true" /> Composición</Button>
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-dashed border-line-strong p-3 text-xs text-muted leading-relaxed">
          <span className="text-fg font-medium">Haz clic en una fuente del cielo</span> para medir su espectro y analizar de qué está hecha. Si no eliges ninguna, se usa el centro.
          <div className="grid grid-cols-2 gap-2 mt-2.5">
            <Button size="sm" onClick={onGoSpectrum}><Activity className="w-3.5 h-3.5" aria-hidden="true" /> Espectro del centro</Button>
            <Button size="sm" onClick={onGoComposition}><FlaskConical className="w-3.5 h-3.5" aria-hidden="true" /> Composición</Button>
          </div>
        </section>
      )}

      {/* Cifras */}
      <section>
        <SectionHeader title="En esta zona del cielo" />
        <div className="grid grid-cols-2 gap-2">
          {loadingMeta && !frames ? (
            Array.from({ length: 4 }, (_, i) => <div key={i} className="h-[62px] rounded-xl bx-skeleton" />)
          ) : (
            <>
              <Stat label="Exposiciones SPHEREx" value={frames?.total?.toLocaleString('es') ?? '—'} tone="data" />
              <Stat label="Detectores con datos" value={frames ? `${detectorsWithData} de 6` : '—'} />
              <Stat label="Primera fecha" value={fmtDate(coverage?.first_date)} hint={coverage?.last_date ? `Última: ${fmtDate(coverage.last_date)}` : undefined} />
              <Stat label="Objetos catalogados" value={objCount ?? '—'} hint={objects?.counts ? `SIMBAD ${objects.counts.simbad ?? 0} · NED ${objects.counts.ned ?? 0}` : undefined} />
            </>
          )}
        </div>
      </section>

      {/* Objetos cercanos */}
      <section>
        <SectionHeader title="Objetos cercanos" hint="Ordenados por distancia al centro. Clic para medirlos." />
        {nearby.length === 0 ? (
          <p className="text-xs text-muted">{loadingMeta ? 'Consultando SIMBAD y NED…' : 'No hay objetos catalogados en este campo.'}</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line overflow-hidden">
            {nearby.map((o) => {
              const active = probe && Math.abs(probe.ra - o.ra) * 3600 < 1 && Math.abs(probe.dec - o.dec) * 3600 < 1;
              return (
                <li key={`${o.source}-${o.id}`}>
                  <button
                    type="button"
                    onClick={() => onProbe(o.ra, o.dec)}
                    className={cx('w-full text-left px-3 py-2 flex items-center gap-3 cursor-pointer transition-colors', active ? 'bg-ember/10' : 'hover:bg-white/[0.04]')}
                  >
                    <span className={cx('w-1.5 h-1.5 rounded-full shrink-0', o.source.toLowerCase() === 'simbad' ? 'bg-data' : 'bg-soft')} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] text-fg truncate">{o.name.replace(/\s+/g, ' ')}</span>
                      <span className="block text-[11px] text-muted truncate">{objectTypeLabel(o.type, o.type_raw)} · {o.source.toUpperCase()}</span>
                    </span>
                    <span className="font-mono text-[11px] text-faint shrink-0">{o.distance_arcsec.toFixed(1)}″</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
