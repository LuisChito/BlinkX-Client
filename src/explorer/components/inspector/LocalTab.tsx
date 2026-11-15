// AI-assisted development used for code development, debugging and documentation.
// Tool: ChatGPT, Claude
/* Pestaña «Locales»: campos procesados con el pipeline SPHEREx (public/local-data, scripts/import-pipeline.py).
   No depende de la API ni de IRSA: imágenes L2, cubo 3D, muestras de canales y espectro de 102 canales. */
import { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ExternalLink, HardDrive, Maximize2, Navigation, X } from 'lucide-react';
import { Button, Chip, KV, SectionHeader, Segmented, cx, fmtDate } from '../ui/primitives';

interface SpecRow { channel: number; wavelength_um: number | null; bandwidth_um: number | null; brightness: number | null; flags: number | null; nhits: number | null }
interface Img { src: string; size: [number, number] }
export interface LocalField {
  id: string;
  name: string;
  ra: number;
  dec: number;
  status?: string;
  l2: { file: string | null; url: string | null; count: number | null; shape: number[] | null; low: number | null; high: number | null; unit: string | null; note?: string | null };
  cube: { tile: string | null; url: string | null; shape: number[] | null; pixel: number[] | null; unit: string | null; channels: number[] | null };
  observations: { count: number; detectors: Record<string, number>; first: string | null; last: string | null; days: string[] } | null;
  images: Partial<Record<'l2_gray' | 'l2_rgb' | 'cube3d' | 'samples', Img>>;
  spectrum: SpecRow[];
  samples: SpecRow[];
}
interface LocalIndex { generated_at: string; explorer: string | null; fields: LocalField[] }

let indexPromise: Promise<LocalIndex | null> | null = null;
export function loadLocalIndex(): Promise<LocalIndex | null> {
  indexPromise ??= fetch('/local-data/index.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? (r.json() as Promise<LocalIndex>) : null))
    .catch(() => null);
  return indexPromise;
}

const AXIS = { fill: 'rgba(255,255,255,0.5)', fontSize: 10 };

function angDist(a: { ra: number; dec: number }, b: { ra: number; dec: number }) {
  let dra = Math.abs(a.ra - b.ra);
  if (dra > 180) dra = 360 - dra;
  return Math.hypot(dra * Math.cos((a.dec * Math.PI) / 180), a.dec - b.dec);
}

interface Props {
  center: { ra: number; dec: number };
  onGoTo: (ra: number, dec: number) => void;
}

export function LocalTab({ center, onGoTo }: Props) {
  const [index, setIndex] = useState<LocalIndex | null | undefined>(undefined);
  const [selId, setSelId] = useState<string | null>(null);
  const [l2Kind, setL2Kind] = useState<'l2_rgb' | 'l2_gray'>('l2_rgb');
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    let alive = true;
    loadLocalIndex().then((i) => alive && setIndex(i));
    return () => { alive = false; };
  }, []);

  // Por defecto: el campo más cercano a la vista actual.
  const fields = index?.fields ?? [];
  const nearest = useMemo(() => {
    let best: LocalField | null = null;
    let bd = Infinity;
    for (const f of fields) {
      const d = angDist(f, center);
      if (d < bd) { bd = d; best = f; }
    }
    return best && bd < 2 ? best : null;
  }, [center, fields]);
  const sel = fields.find((f) => f.id === selId) ?? nearest ?? fields[0] ?? null;

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setZoom(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoom]);

  if (index === undefined) return <p className="text-xs text-muted">Cargando datos locales…</p>;
  if (!index || !fields.length) {
    return (
      <section className="space-y-2">
        <SectionHeader title="Datos locales del pipeline" />
        <p className="text-xs text-muted leading-relaxed">
          No hay campos importados. Ejecuta <code className="font-mono text-soft">python scripts/import-pipeline.py</code> (lee{' '}
          <code className="font-mono text-soft">G:\SphereX\SphereX-pipeline\outputs</code>) y recarga la página.
        </p>
      </section>
    );
  }

  const spec = (sel?.spectrum ?? []).filter((r) => r.wavelength_um != null && r.brightness != null);
  const l2Img = sel?.images[l2Kind] ?? sel?.images.l2_rgb ?? sel?.images.l2_gray;

  return (
    <>
      <section>
        <SectionHeader
          title={<span className="flex items-center gap-1.5"><HardDrive className="w-4 h-4 text-data" aria-hidden="true" />Campos procesados</span>}
          hint={`Pipeline SPHEREx local · ${fields.length} campos. Disponibles sin internet.`}
        />
        <ul className="space-y-1.5">
          {fields.map((f) => {
            const on = f.id === sel?.id;
            return (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => setSelId(f.id)}
                  aria-pressed={on}
                  className={cx('w-full text-left rounded-lg border px-2.5 py-2 cursor-pointer transition-colors', on ? 'border-ember/50 bg-ember/10' : 'border-line hover:border-line-strong hover:bg-white/[0.03]')}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-fg truncate">{f.name}</span>
                    {nearest?.id === f.id && <Chip tone="data">aquí</Chip>}
                  </span>
                  <span className="block text-[11px] font-mono text-muted">
                    {f.ra.toFixed(4)}°, {f.dec >= 0 ? '+' : ''}{f.dec.toFixed(4)}° · {f.observations?.count ?? f.l2.count ?? 0} obs. L2
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {sel && (
        <>
          <div className="flex gap-2">
            <Button onClick={() => onGoTo(sel.ra, sel.dec)}>
              <Navigation className="w-4 h-4" aria-hidden="true" />
              Ir a este campo en el cielo
            </Button>
            {index.explorer && /M101/i.test(sel.name) && (
              <a href={index.explorer} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-line text-[13px] text-soft hover:text-fg hover:border-line-strong">
                <ExternalLink className="w-4 h-4" aria-hidden="true" />
                Explorador 102 canales
              </a>
            )}
          </div>

          {l2Img && (
            <section>
              <SectionHeader
                title="Imagen L2"
                hint={sel.l2.file ?? undefined}
                action={
                  sel.images.l2_rgb && sel.images.l2_gray ? (
                    <Segmented
                      size="sm"
                      value={l2Kind}
                      onChange={setL2Kind}
                      options={[{ value: 'l2_rgb', label: 'Color' }, { value: 'l2_gray', label: 'Gris' }]}
                      label="Tipo de imagen L2"
                    />
                  ) : undefined
                }
              />
              <ZoomableImg img={l2Img} alt={`Imagen L2 de ${sel.name}`} onZoom={setZoom} />
              <dl className="mt-1.5">
                {sel.l2.low != null && sel.l2.high != null && <KV k="Rango de brillo" v={`${sel.l2.low.toFixed(3)} – ${sel.l2.high.toFixed(3)} ${sel.l2.unit ?? ''}`} />}
                {sel.l2.shape && <KV k="Tamaño original" v={`${sel.l2.shape.join(' × ')} px`} />}
              </dl>
            </section>
          )}

          {spec.length > 0 && (
            <section>
              <SectionHeader title="Espectro (102 canales)" hint={`En la coordenada del campo · ${sel.cube.unit ?? 'MJy/sr'}`} />
              <div className="bx-card p-2 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={spec} margin={{ top: 6, right: 8, bottom: 2, left: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="2 3" />
                    <XAxis dataKey="wavelength_um" type="number" domain={['dataMin', 'dataMax']} tick={AXIS} stroke="rgba(255,255,255,0.12)" tickFormatter={(v: number) => v.toFixed(1)} unit=" µm" />
                    <YAxis dataKey="brightness" type="number" tick={AXIS} stroke="rgba(255,255,255,0.12)" width={40} tickFormatter={(v: number) => v.toFixed(1)} />
                    <Tooltip
                      contentStyle={{ background: '#11161f', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, fontSize: 11 }}
                      labelFormatter={(v) => `${Number(v).toFixed(3)} µm`}
                      formatter={(v) => [`${Number(v).toFixed(3)} MJy/sr`, 'Brillo']}
                    />
                    <Line type="monotone" dataKey="brightness" stroke="#ff8a5c" strokeWidth={1.6} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {(sel.images.samples || sel.images.cube3d) && (
            <section className="space-y-2">
              <SectionHeader title="Cubo all-sky" hint={sel.cube.tile ? `${sel.cube.tile} · píxel ${sel.cube.pixel?.join(', ')}` : undefined} />
              {sel.images.samples && <ZoomableImg img={sel.images.samples} alt="Canales 1, 20, 40, 60, 80 y 102" onZoom={setZoom} />}
              {sel.images.cube3d && <ZoomableImg img={sel.images.cube3d} alt="Cubo espectral 3D (eje Z: longitud de onda)" onZoom={setZoom} />}
              <p className="text-[11px] text-faint">En el cubo 3D el eje vertical es la longitud de onda, no la distancia.</p>
            </section>
          )}

          {sel.observations && (
            <section>
              <SectionHeader title="Observaciones L2" />
              <dl className="bx-card px-3 py-1">
                <KV k="Exposiciones" v={sel.observations.count} />
                <KV k="Desde" v={fmtDate(sel.observations.first)} />
                <KV k="Hasta" v={fmtDate(sel.observations.last)} />
                <KV k="Días con datos" v={sel.observations.days.length} />
              </dl>
              <div className="flex flex-wrap gap-1 mt-2">
                {Object.entries(sel.observations.detectors).map(([d, n]) => <Chip key={d}>{d} · {n}</Chip>)}
              </div>
            </section>
          )}
        </>
      )}

      {zoom && (
        <div role="dialog" aria-modal="true" aria-label={zoom.alt} className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4" onClick={() => setZoom(null)}>
          <img src={zoom.src} alt={zoom.alt} className="max-w-full max-h-full object-contain rounded-lg" />
          <button type="button" onClick={() => setZoom(null)} aria-label="Cerrar" className="absolute top-3 right-3 p-2 rounded-lg bg-white/10 text-fg hover:bg-white/20 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </>
  );
}

function ZoomableImg({ img, alt, onZoom }: { img: Img; alt: string; onZoom: (z: { src: string; alt: string }) => void }) {
  return (
    <button type="button" onClick={() => onZoom({ src: img.src, alt })} className="group relative block w-full overflow-hidden rounded-lg border border-line bg-black cursor-zoom-in" title="Ver en grande">
      <img src={img.src} alt={alt} width={img.size[0]} height={img.size[1]} loading="lazy" className="w-full h-auto" />
      <span className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/60 text-white/80 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true">
        <Maximize2 className="w-3.5 h-3.5" />
      </span>
    </button>
  );
}
