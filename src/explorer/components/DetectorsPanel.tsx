// AI-assisted development used for code development, debugging and documentation.
// Tool: ChatGPT, Claude
/* Vista "Detectores": los 6 detectores de SPHEREx con sus mediciones y el cubo de 102 canales de la zona. */
import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Box, ChevronLeft, ChevronRight, Cpu, Download, Filter, Maximize2, Minimize2, X } from 'lucide-react';
import { abs, api, type Frame, type Job, type SpectrumPoint } from '../../lib/skyApi';
import type { CubeResult, Detector, SpectrumResponse } from '../hooks/useSkyContract';
import { Button, Chip, EmptyState, ErrorNote, IconButton, JobProgress, SectionHeader, Segmented, cx } from './ui/primitives';
import { DETECTORS, detColor } from './inspector/detectors';

interface Props {
  ra: number;
  dec: number;
  framesMeta: Frame[];
  spectrum: SpectrumResponse | null;
  loadingSpectrum: boolean;
  spectrumJob: Job | null;
  cube: CubeResult | null;
  loadingCube: boolean;
  cubeJob: Job | null;
  cubeError: string | null;
  detectorFilter?: Detector;
  isMaximized: boolean;
  onToggleMaximize: () => void;
  onClose: () => void;
  onChangeDetectorFilter: (d: Detector | undefined) => void;
  onLoadCube: () => void;
  onMeasureSpectrum: () => void;
}

const AXIS = { fill: '#b9a8a3', fontSize: 11, fontFamily: 'JetBrains Mono Variable, monospace' };
const channelInfo = (ch: number) => {
  const um = 0.75 + ((ch - 1) * 4.25) / 101;
  return { um, det: Math.min(6, Math.floor((ch - 1) / 17) + 1) };
};

async function download(url: string, filename: string) {
  try {
    const blob = await (await fetch(url)).blob();
    const href = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href, download: filename });
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
  } catch {
    window.open(url, '_blank', 'noopener');
  }
}

export function DetectorsPanel(p: Props) {
  const [tab, setTab] = useState<'detectors' | 'cube'>('detectors');
  const [det, setDet] = useState<Detector>(4);
  const [channel, setChannel] = useState(52);
  const [lightbox, setLightbox] = useState<{ title: string; url: string; file: string } | null>(null);

  // Al llegar un cubo, empezar en un canal representativo (algunos canales de una tesela pueden venir vacíos).
  const cubeId = p.cube?.tile.id;
  useEffect(() => {
    const six = p.cube?.six_channels;
    if (six?.length) setChannel(six[Math.min(3, six.length - 1)].channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cubeId]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setLightbox(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  const points = p.spectrum?.points ?? [];
  const summaries = useMemo(() => DETECTORS.map((d) => {
    const pts = points.filter((x) => x.detector === d.det);
    const mean = pts.length ? pts.reduce((s, x) => s + x.flux, 0) / pts.length : null;
    const snr = pts.filter((x) => x.error > 0).map((x) => Math.abs(x.flux) / x.error);
    return {
      ...d,
      pts,
      mean,
      snr: snr.length ? snr.reduce((a, b) => a + b, 0) / snr.length : null,
      frames: p.framesMeta.filter((f) => f.detector === d.det).length,
    };
  }), [points, p.framesMeta]);
  const active = summaries[det - 1];
  const activePts = useMemo(() => [...active.pts].sort((a, b) => a.wavelength - b.wavelength), [active]);
  const ch = channelInfo(channel);

  return (
    <section aria-label="Detectores y cubo" className="h-full flex flex-col bx-panel border-y-0 border-r-0 min-w-0">
      <header className="flex items-center gap-2 px-3 h-12 border-b border-line shrink-0">
        <Segmented
          label="Sección"
          size="sm"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'detectors', label: <span className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5" aria-hidden="true" />6 detectores</span> },
            { value: 'cube', label: <span className="flex items-center gap-1.5"><Box className="w-3.5 h-3.5" aria-hidden="true" />Cubo 102 canales</span> },
          ]}
        />
        <div className="flex-1" />
        <IconButton label={p.isMaximized ? 'Reducir panel' : 'Ampliar panel'} onClick={p.onToggleMaximize}>
          {p.isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </IconButton>
        <IconButton label="Volver al cielo" onClick={p.onClose}><X className="w-4 h-4" /></IconButton>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-5">
        {tab === 'detectors' ? (
          <>
            <div>
              <SectionHeader
                title="Cada detector ve un rango distinto del infrarrojo"
                hint={points.length ? `${points.length} mediciones del punto, brillo medio en µJy` : 'Mide un punto para ver cuánto brilla en cada detector.'}
              />
              <div className={cx('grid gap-2', p.isMaximized ? 'grid-cols-2 md:grid-cols-3 xl:grid-cols-6' : 'grid-cols-2 sm:grid-cols-3')}>
                {summaries.map((s) => {
                  const on = s.det === det;
                  return (
                    <button
                      key={s.det}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setDet(s.det)}
                      className={cx(
                        'text-left rounded-xl border p-2.5 transition-colors cursor-pointer',
                        on ? 'bg-hover border-line-strong' : 'bg-raised border-line hover:border-line-strong',
                      )}
                      style={on ? { boxShadow: `inset 0 2px 0 ${s.color}` } : undefined}
                    >
                      <div className="flex items-baseline justify-between gap-1">
                        <span className="font-mono text-sm font-bold" style={{ color: s.color }}>D{s.det}</span>
                        <span className="font-mono text-[10px] text-muted">{s.from.toFixed(2)}–{s.to.toFixed(2)} µm</span>
                      </div>
                      <div className="text-[12px] text-fg mt-1 truncate">{s.title}</div>
                      <div className="flex justify-between mt-1.5 font-mono text-[11px]">
                        <span className="text-soft">{s.mean == null ? '—' : `${s.mean.toFixed(0)} µJy`}</span>
                        <span className="text-faint">{s.frames} exp.</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bx-card p-3 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-[13px] font-semibold" style={{ color: active.color }}>D{active.det} · {active.title}</h3>
                  <p className="text-xs text-soft mt-0.5 max-w-prose">{active.reveals}</p>
                </div>
                <Button
                  size="sm"
                  variant={p.detectorFilter === active.det ? 'primary' : 'secondary'}
                  aria-pressed={p.detectorFilter === active.det}
                  onClick={() => p.onChangeDetectorFilter(p.detectorFilter === active.det ? undefined : active.det)}
                  title="Mostrar en el cielo solo las imágenes de este detector"
                >
                  <Filter className="w-3.5 h-3.5" aria-hidden="true" />
                  {p.detectorFilter === active.det ? 'Mostrando solo D' + active.det : 'Ver solo D' + active.det + ' en el cielo'}
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Chip>{active.frames} exposiciones en la zona</Chip>
                <Chip>{active.pts.length} mediciones del punto</Chip>
                {active.snr != null && <Chip tone="data">S/N medio {active.snr.toFixed(1)}</Chip>}
              </div>
              <div className="h-40">
                {p.loadingSpectrum ? (
                  <div className="h-full grid place-items-center"><div className="w-full max-w-xs"><JobProgress job={p.spectrumJob} label="Midiendo espectro" /></div></div>
                ) : activePts.length === 0 ? (
                  <div className="h-full grid place-items-center text-center text-xs text-muted gap-2">
                    <div>
                      <p>Sin mediciones de este detector en el punto.</p>
                      {!points.length && <Button size="sm" variant="primary" className="mt-2" onClick={p.onMeasureSpectrum}>Medir el centro</Button>}
                    </div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={activePts} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="detFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={active.color} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={active.color} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="2 3" />
                      <XAxis dataKey="wavelength" type="number" domain={[active.from, active.to]} tick={AXIS} stroke="rgba(255,255,255,0.12)" tickFormatter={(v: number) => v.toFixed(2)} unit=" µm" />
                      <YAxis tick={AXIS} stroke="rgba(255,255,255,0.12)" width={48} />
                      <Tooltip
                        content={({ active: a, payload }) => {
                          if (!a || !payload?.length) return null;
                          const pt = payload[0].payload as SpectrumPoint;
                          return (
                            <div className="bx-float rounded-lg px-2.5 py-1.5 text-[11px] font-mono">
                              <div style={{ color: detColor(pt.detector) }}>{pt.wavelength.toFixed(3)} µm</div>
                              <div>{pt.flux.toFixed(1)} ± {pt.error.toFixed(1)} µJy</div>
                              <div className="text-muted">{pt.date_obs.slice(0, 10)}</div>
                            </div>
                          );
                        }}
                      />
                      <Area type="monotone" dataKey="flux" stroke={active.color} strokeWidth={1.8} fill="url(#detFill)" isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <SectionHeader
              title="Cubo espectral de la zona"
              hint="El mismo trozo de cielo en 102 longitudes de onda, de 0.75 a 5 µm."
              action={p.cube && <Button size="sm" variant="ghost" onClick={p.onLoadCube}>Recargar</Button>}
            />
            {p.loadingCube && !p.cube ? (
              <div className="bx-card p-4">
                <JobProgress job={p.cubeJob} label="Descargando cubo" note="La primera vez se descargan ~320 MB del archivo de la NASA; después queda en caché." />
              </div>
            ) : !p.cube ? (
              p.cubeError ? (
                <ErrorNote message={p.cubeError} onRetry={p.onLoadCube} />
              ) : (
                <EmptyState icon={<Box className="w-6 h-6" />} title="Cubo sin cargar" action={<Button variant="primary" onClick={p.onLoadCube}>Cargar cubo</Button>}>
                  Descarga pesada (~320 MB la primera vez).
                </EmptyState>
              )
            ) : (
              <>
                <div className="bx-card p-3 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-mono text-[13px]">
                      <span className="text-fg font-semibold">Canal {channel}</span>
                      <span className="text-muted"> / 102 · </span>
                      <span style={{ color: detColor(ch.det) }}>{ch.um.toFixed(3)} µm · D{ch.det}</span>
                    </div>
                    <div className="flex gap-1">
                      <IconButton label="Ampliar canal" onClick={() => setLightbox({ title: `Canal ${channel} · ${ch.um.toFixed(3)} µm`, url: api.url.cubeChannel(p.cube!.tile.id, channel, 'gray_r', 1024), file: `SPHEREx_canal${channel}.png` })}>
                        <Maximize2 className="w-4 h-4" />
                      </IconButton>
                      <IconButton label="Descargar canal" onClick={() => void download(api.url.cubeChannel(p.cube!.tile.id, channel, 'gray_r', 1024), `SPHEREx_canal${channel}.png`)}>
                        <Download className="w-4 h-4" />
                      </IconButton>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <IconButton label="Canal anterior" disabled={channel <= 1} onClick={() => setChannel((c) => Math.max(1, c - 1))}><ChevronLeft className="w-4 h-4" /></IconButton>
                    <div className="flex-1">
                      <div className="h-1.5 rounded-full mb-0.5" style={{ background: `linear-gradient(90deg, ${DETECTORS.map((d) => d.color).join(',')})` }} aria-hidden="true" />
                      <input type="range" className="bx-range" min={1} max={102} value={channel} onChange={(e) => setChannel(Number(e.target.value))} aria-label="Canal del cubo" aria-valuetext={`${ch.um.toFixed(2)} micras`} />
                    </div>
                    <IconButton label="Canal siguiente" disabled={channel >= 102} onClick={() => setChannel((c) => Math.min(102, c + 1))}><ChevronRight className="w-4 h-4" /></IconButton>
                  </div>
                  <div className="relative rounded-lg overflow-hidden bg-black border border-line aspect-[16/9]" title="Las zonas negras no tienen datos en este canal">
                    <img src={api.url.cubeChannel(p.cube.tile.id, channel, 'gray_r', 512)} alt={`Canal ${channel} del cubo SPHEREx (${ch.um.toFixed(2)} µm)`} className="absolute inset-0 m-auto h-full w-auto max-w-full object-contain" style={{ imageRendering: 'pixelated' }} />
                  </div>
                </div>

                {p.cube.six_channels?.length > 0 && (
                  <div>
                    <SectionHeader title="Un canal por detector" hint="Clic para abrirlo arriba" />
                    <div className={cx('grid gap-2', p.isMaximized ? 'grid-cols-6' : 'grid-cols-3')}>
                      {p.cube.six_channels.map((c) => (
                        <button
                          key={c.channel}
                          type="button"
                          onClick={() => setChannel(c.channel)}
                          aria-pressed={c.channel === channel}
                          className={cx('rounded-lg border p-1 text-center cursor-pointer', c.channel === channel ? 'border-ember' : 'border-line hover:border-line-strong')}
                        >
                          <img src={c.png_url ? abs(c.png_url) : api.url.cubeChannel(p.cube!.tile.id, c.channel)} alt="" className="w-full aspect-square object-cover rounded bg-black" loading="lazy" />
                          <span className="block font-mono text-[11px] mt-1" style={{ color: detColor(channelInfo(c.channel).det) }}>{c.wavelength_um.toFixed(2)} µm</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className={cx('grid gap-3', p.isMaximized ? 'md:grid-cols-2' : '')}>
                  {[
                    { title: 'Espectro en el centro', url: api.url.cubeSamples(p.cube.tile.id, p.ra, p.dec), file: 'SPHEREx_cubo_espectro.png' },
                    { title: 'Vista 3D (cielo × longitud de onda)', url: api.url.cube3d(p.cube.tile.id), file: 'SPHEREx_cubo_3d.png' },
                  ].map((m) => (
                    <figure key={m.title} className="bx-card p-2.5 space-y-2">
                      <figcaption className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-medium text-fg">{m.title}</span>
                        <span className="flex gap-0.5">
                          <IconButton label={`Ampliar: ${m.title}`} className="h-8 w-8" onClick={() => setLightbox(m)}><Maximize2 className="w-3.5 h-3.5" /></IconButton>
                          <IconButton label={`Descargar: ${m.title}`} className="h-8 w-8" onClick={() => void download(m.url, m.file)}><Download className="w-3.5 h-3.5" /></IconButton>
                        </span>
                      </figcaption>
                      <img src={m.url} alt={m.title} className="w-full rounded bg-black object-contain aspect-video" loading="lazy" />
                    </figure>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={lightbox.title}>
          <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-black/85 cursor-default" onClick={() => setLightbox(null)} />
          <div className="relative w-full max-w-4xl bx-float rounded-2xl overflow-hidden animate-panel-enter">
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-line">
              <h3 className="text-[13px] font-semibold text-fg truncate">{lightbox.title}</h3>
              <div className="flex gap-1">
                <Button size="sm" variant="primary" onClick={() => void download(lightbox.url, lightbox.file)}><Download className="w-3.5 h-3.5" aria-hidden="true" /> PNG</Button>
                <IconButton label="Cerrar" onClick={() => setLightbox(null)}><X className="w-4 h-4" /></IconButton>
              </div>
            </div>
            <div className="bg-black p-3 grid place-items-center max-h-[78vh]">
              <img src={lightbox.url} alt={lightbox.title} className="max-w-full max-h-[72vh] object-contain" style={{ imageRendering: 'pixelated' }} />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
