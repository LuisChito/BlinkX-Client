import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Info, Sparkles } from 'lucide-react';
import { MOLECULAR_PRESETS } from '../data/spherexCatalog';
import type {
  FloatingModuleVisibility,
  LayoutViewMode,
  MolecularLensId,
  TargetCatalogEntry,
  ViewMode,
} from '../types/spherex';
import type { Coord, Frame, Job, SpectrumPoint } from '../../lib/skyApi';
import { summarizeRealDetectors } from '../utils/backendMetrics';
import type {
  CubePixelResult,
  L2PixelResult,
  ResolveResponse,
  SpectrumResponse,
} from '../hooks/useSkyContract';

interface SpectralTelemetryModuleProps {
  target: TargetCatalogEntry;
  contractSpectrum?: SpectrumResponse | null;
  probeCoord?: Coord | null;
  probeSpectrum?: SpectrumResponse | null;
  loadingProbeSpectrum?: boolean;
  spectrumJob?: Job | null;
  framesMeta?: Frame[];
  isLoadingSpectrum?: boolean;
  resolveInfo?: ResolveResponse | null;
  l2Pixel?: L2PixelResult | null;
  cubePixel?: CubePixelResult | null;
  lens: MolecularLensId;
  mode: ViewMode;
  layoutView: LayoutViewMode;
  visibility: FloatingModuleVisibility;
  shareUrl: string;
  onOpenSixDetectors?: () => void;
  onClearProbe?: () => void;
  onMeasureCenterSpectrum?: () => void;
  onChangeLens: (lens: MolecularLensId) => void;
  onToggleVisibility: (key: keyof FloatingModuleVisibility) => void;
  onExportReport: (format: 'md' | 'json') => void;
}

const COMPACT_MOLECULES: Array<{ id: MolecularLensId; label: string }> = [
  { id: 'h2o', label: 'H₂O' },
  { id: 'ch4', label: 'CH₄' },
  { id: 'co2', label: 'CO₂' },
  { id: 'nh3', label: 'NH₃' },
];

export function SpectralTelemetryModule({
  contractSpectrum = null,
  probeCoord = null,
  probeSpectrum = null,
  loadingProbeSpectrum = false,
  spectrumJob = null,
  framesMeta = [],
  isLoadingSpectrum = false,
  resolveInfo = null,
  l2Pixel = null,
  cubePixel = null,
  lens,
  mode,
  visibility,
  onOpenSixDetectors,
  onClearProbe,
  onMeasureCenterSpectrum,
  onChangeLens,
}: SpectralTelemetryModuleProps) {
  const [showDrawerInfo, setShowDrawerInfo] = useState(false);
  const [chartView, setChartView] = useState<'spectrum' | 'lightcurve'>('spectrum');

  const activePreset = useMemo(
    () => MOLECULAR_PRESETS.find((p) => p.id === lens) ?? MOLECULAR_PRESETS[0],
    [lens],
  );

  const activeSpectrum = probeSpectrum ?? contractSpectrum;
  const realPoints = activeSpectrum?.points ?? [];
  const effectiveLoadingSpectrum = probeCoord ? loadingProbeSpectrum : isLoadingSpectrum;

  const spectrumByWavelength = useMemo(() => {
    const [minUm, maxUm] = activePreset.bandRangeUm;
    return [...realPoints]
      .filter((pt) => pt.wavelength >= minUm && pt.wavelength <= maxUm)
      .sort((a, b) => a.wavelength - b.wavelength);
  }, [activePreset.bandRangeUm, realPoints]);

  const lightCurvePoints = useMemo(() => {
    return [...realPoints]
      .sort((a, b) => a.date_obs.localeCompare(b.date_obs))
      .map((pt, idx) => ({ ...pt, idx, dateShort: pt.date_obs.slice(0, 10) }));
  }, [realPoints]);

  const detectorStats = useMemo(
    () => summarizeRealDetectors(realPoints, framesMeta),
    [framesMeta, realPoints],
  );

  const allFlags = useMemo(() => {
    const set = new Set<string>();
    for (const p of realPoints) {
      for (const f of p.flags) set.add(f);
    }
    for (const fr of framesMeta) {
      for (const f of fr.flags) set.add(f);
    }
    return Array.from(set);
  }, [framesMeta, realPoints]);

  const curveColor = mode === 'diff' ? '#F43F5E' : '#ff8a5c';

  const anyVisible =
    visibility.spectra || visibility.aiInsights || visibility.metadata || visibility.shareUrl;
  if (!anyVisible) return null;

  return (
    <aside className="w-[335px] hud-card rounded-2xl shadow-2xl flex flex-col max-h-[calc(100vh-145px)] overflow-hidden animate-panel-enter select-none">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.07] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-medium text-[#f6f1ee] tracking-tight">
            Telemetry Drawer
          </span>
          <button
            type="button"
            onClick={() => setShowDrawerInfo((p) => !p)}
            title="Información del Telemetry Drawer"
            className="text-[#b9a8a3] hover:text-white transition-colors"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-[#b9a8a3]">
            {activeSpectrum ? `${activeSpectrum.flux_unit}` : 'LVF 1–6'}
          </span>
        </div>
      </div>

      {showDrawerInfo && (
        <div className="p-3 bg-[#15171C] border-b border-white/[0.07] text-[10px] text-[#C8CDD6] leading-relaxed font-sans shrink-0">
          <strong>Telemetry Drawer:</strong> Datos espectrales y fotométricos reales de{' '}
          <code>/api/spectrum</code> (0.75–5.00 μm) y flags de <code>/api/frames</code>.
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
        {/* Probe Spectrum Coordinate Badge */}
        {probeCoord && (
          <div className="hud-subcard rounded-xl p-3 border border-[#ff8a5c]/45 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs font-mono text-[#ff8a5c] font-bold">
                SONDA PUNTUAL (/api/spectrum)
              </div>
              <div className="text-xs font-mono text-[#f6f1ee] truncate mt-0.5">
                RA {probeCoord.ra.toFixed(5)}° · Dec {probeCoord.dec.toFixed(5)}°
              </div>
            </div>
            {onClearProbe && (
              <button
                type="button"
                onClick={onClearProbe}
                className="px-2.5 py-1 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-[11px] font-mono text-white shrink-0"
              >
                Volver al centro
              </button>
            )}
          </div>
        )}

        {/* L2 Pixel Inspection Badge */}
        {l2Pixel && (
          <div className="hud-subcard rounded-xl p-3 border border-[#ff8a5c]/40 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#ff8a5c] font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                L2 PIXEL ({Math.round(l2Pixel.x)}, {Math.round(l2Pixel.y)})
              </span>
              {l2Pixel.wavelength_um !== undefined && (
                <span className="text-[#b9a8a3]">{l2Pixel.wavelength_um.toFixed(2)} μm</span>
              )}
            </div>
            <div className="text-xs font-mono text-[#f6f1ee]">
              RA {l2Pixel.ra.toFixed(5)}° · Dec {l2Pixel.dec.toFixed(5)}°
            </div>
            <div className="text-sm font-mono text-[#6fd3ff] font-bold">
              Brillo: {(l2Pixel.value ?? l2Pixel.flux ?? 0).toFixed(3)} {l2Pixel.unit ?? 'MJy/sr'}
            </div>
          </div>
        )}

        {/* Cube Pixel Inspection Badge */}
        {cubePixel && (
          <div className="hud-subcard rounded-xl p-3 border border-[#6fd3ff]/40 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#6fd3ff] font-bold">
                CUBE PIXEL ({Math.round(cubePixel.x)}, {Math.round(cubePixel.y)})
              </span>
              <span className="text-[#b9a8a3]">{cubePixel.spectrum?.length ?? 0} ch</span>
            </div>
            <div className="text-xs font-mono text-[#f6f1ee]">
              RA {cubePixel.ra.toFixed(5)}° · Dec {cubePixel.dec.toFixed(5)}°
            </div>
          </div>
        )}

        {/* Resolved object info from /api/resolve */}
        {resolveInfo && (
          <div className="hud-subcard rounded-xl p-3 border border-[#6fd3ff]/35 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#6fd3ff] font-bold uppercase">
                /api/resolve · {resolveInfo.source}
              </span>
              <span className="text-[#b9a8a3]">Época {resolveInfo.epoch}</span>
            </div>
            <div className="text-sm font-semibold text-white truncate">
              {resolveInfo.matched_name}
            </div>
            <div className="text-xs font-mono text-[#b9a8a3]">
              Actual ({resolveInfo.current.epoch.toFixed(2)}): RA{' '}
              {resolveInfo.current.ra.toFixed(5)}° · Dec {resolveInfo.current.dec.toFixed(5)}°
            </div>
            {resolveInfo.pm && (
              <div className="text-xs font-mono text-[#ff8a5c]">
                PM: μα*={resolveInfo.pm.ra.toFixed(1)}, μδ={resolveInfo.pm.dec.toFixed(1)} mas/yr
                {resolveInfo.parallax_mas !== null
                  ? ` · π=${resolveInfo.parallax_mas.toFixed(1)} mas`
                  : ''}
              </div>
            )}
          </div>
        )}

        {/* 1. Spectral Analysis (Real /api/spectrum points) */}
        {visibility.spectra && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-[#f6f1ee]">Spectral Analysis</span>
              <div className="flex items-center gap-1.5">
                {realPoints.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setChartView((v) => (v === 'spectrum' ? 'lightcurve' : 'spectrum'))
                    }
                    className="px-2 py-0.5 rounded-md bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 text-[11px] font-mono text-[#6fd3ff]"
                    title="Alternar entre espectro (μm vs μJy) y curva de luz (fecha vs μJy)"
                  >
                    {chartView === 'spectrum' ? 'Curva Luz' : 'Espectro'}
                  </button>
                )}
                <span className="text-xs font-mono text-[#b9a8a3]">
                  {realPoints.length > 0
                    ? `${realPoints.length} exp · ${activeSpectrum?.flux_unit ?? 'uJy'}`
                    : 'Sin datos'}
                </span>
              </div>
            </div>

            <div className="hud-subcard rounded-xl p-3 space-y-2.5">
              {effectiveLoadingSpectrum ? (
                <div className="h-32 w-full rounded-lg bg-white/[0.04] animate-pulse flex flex-col items-center justify-center gap-1 px-3 text-center text-xs font-mono text-[#b9a8a3]">
                  <span className="text-[#ff8a5c] font-bold">
                    Calculando… {Math.round((spectrumJob?.progress ?? 0) * 100)}%
                  </span>
                  {spectrumJob?.stage && (
                    <span className="text-[11px] text-[#f6f1ee]/90">{spectrumJob.stage}</span>
                  )}
                  {(spectrumJob?.queue_position ?? 0) > 0 && (
                    <span className="text-[11px] text-[#b9a8a3]">
                      En cola (#{spectrumJob?.queue_position})
                    </span>
                  )}
                </div>
              ) : realPoints.length === 0 ? (
                <div className="h-32 w-full rounded-lg bg-white/[0.02] border border-white/[0.05] flex flex-col items-center justify-center gap-2 px-3 text-center text-xs font-mono text-[#b9a8a3]">
                  <span>Haz clic en una fuente del visor para medir su espectro.</span>
                  {onMeasureCenterSpectrum && (
                    <button
                      type="button"
                      onClick={onMeasureCenterSpectrum}
                      className="px-3 py-1.5 rounded-lg bg-[#ff8a5c]/20 hover:bg-[#ff8a5c]/30 border border-[#ff8a5c]/40 text-[#ff8a5c] text-xs font-mono font-medium transition-colors"
                    >
                      Medir espectro en centro
                    </button>
                  )}
                </div>
              ) : chartView === 'lightcurve' ? (
                <div className="h-32 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={lightCurvePoints}
                      margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
                    >
                      <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="2 2" />
                      <XAxis
                        dataKey="dateShort"
                        tick={{ fill: '#b9a8a3', fontSize: 9, fontFamily: 'JetBrains Mono' }}
                        stroke="rgba(255,255,255,0.1)"
                      />
                      <YAxis
                        tick={{ fill: '#b9a8a3', fontSize: 9, fontFamily: 'JetBrains Mono' }}
                        stroke="rgba(255,255,255,0.1)"
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const pt = payload[0].payload as SpectrumPoint;
                          return (
                            <div className="bg-[#181A20]/95 border border-white/15 px-2 py-1 rounded text-[10px] font-mono text-[#f6f1ee]">
                              <div>
                                {pt.date_obs.slice(0, 10)} · D{pt.detector} ·{' '}
                                {pt.wavelength.toFixed(2)} μm
                              </div>
                              <div className="text-[#ff8a5c]">
                                Flujo: {pt.flux.toFixed(1)} ± {(pt.error ?? 0).toFixed(1)}{' '}
                                {contractSpectrum?.flux_unit ?? 'μJy'}
                              </div>
                              {pt.flags.length > 0 && (
                                <div className="text-amber-300">Flags: {pt.flags.join(', ')}</div>
                              )}
                            </div>
                          );
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="flux"
                        stroke="#6fd3ff"
                        strokeWidth={1.6}
                        fill="#6fd3ff"
                        fillOpacity={0.18}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : spectrumByWavelength.length === 0 ? (
                <div className="h-32 w-full rounded-lg bg-white/[0.02] border border-white/[0.05] flex items-center justify-center px-3 text-center text-[10px] font-mono text-[#b9a8a3]">
                  Sin puntos en el rango {activePreset.bandRangeUm[0]}–{activePreset.bandRangeUm[1]}{' '}
                  μm.
                </div>
              ) : (
                <div className="h-32 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={spectrumByWavelength}
                      margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="drawerSpecGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={curveColor} stopOpacity={0.28} />
                          <stop offset="95%" stopColor={curveColor} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="2 2" />
                      <XAxis
                        dataKey="wavelength"
                        type="number"
                        domain={activePreset.bandRangeUm}
                        tick={{ fill: '#b9a8a3', fontSize: 9, fontFamily: 'JetBrains Mono' }}
                        tickFormatter={(v: number) => `${v.toFixed(1)}`}
                        stroke="rgba(255,255,255,0.1)"
                      />
                      <YAxis
                        tick={{ fill: '#b9a8a3', fontSize: 9, fontFamily: 'JetBrains Mono' }}
                        stroke="rgba(255,255,255,0.1)"
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const pt = payload[0].payload as SpectrumPoint;
                          return (
                            <div className="bg-[#181A20]/95 border border-white/15 px-2 py-1 rounded text-[10px] font-mono text-[#f6f1ee]">
                              <div>
                                {pt.wavelength.toFixed(2)} μm (D{pt.detector}) ·{' '}
                                {pt.date_obs.slice(0, 10)}
                              </div>
                              <div className="text-[#ff8a5c]">
                                Flujo: {pt.flux.toFixed(1)} ± {(pt.error ?? 0).toFixed(1)}{' '}
                                {contractSpectrum?.flux_unit ?? 'μJy'}
                              </div>
                              {pt.flags.length > 0 && (
                                <div className="text-amber-300">Flags: {pt.flags.join(', ')}</div>
                              )}
                            </div>
                          );
                        }}
                      />
                      {activePreset.highlightBands.map((b) => (
                        <ReferenceArea
                          key={b.name}
                          x1={b.x1}
                          x2={b.x2}
                          fill="rgba(82, 183, 154, 0.08)"
                          strokeOpacity={0}
                        />
                      ))}
                      <Area
                        type="monotone"
                        dataKey="flux"
                        stroke={curveColor}
                        strokeWidth={1.6}
                        fill="url(#drawerSpecGrad)"
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="text-center text-[10px] font-mono text-[#b9a8a3]">
                {chartView === 'lightcurve'
                  ? 'Fecha de observación (UTC) • Curva de Luz'
                  : 'Wavelength (μm) • 0.75 – 5.00'}
              </div>

              {/* Molecular Filter Pills */}
              <div className="flex items-center gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => onChangeLens('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all active:scale-95 ${
                    lens === 'all'
                      ? 'bg-white text-[#0c0a0b] shadow-[0_0_10px_rgba(255,255,255,0.4)]'
                      : 'bg-white/[0.06] text-[#b9a8a3] hover:text-white hover:bg-white/10 border border-white/10'
                  }`}
                >
                  ALL
                </button>
                {COMPACT_MOLECULES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onChangeLens(lens === m.id ? 'all' : m.id)}
                    className={`flex-1 py-1 rounded-lg text-xs font-mono font-bold transition-all active:scale-95 ${
                      lens === m.id
                        ? 'bg-[#ff8a5c] text-[#0c0a0b] shadow-[0_0_10px_rgba(255,138,92,0.5)]'
                        : 'bg-white/[0.06] text-[#b9a8a3] hover:text-white hover:bg-white/10 border border-white/10'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Compact 6 Detector Arrays Real Summary Strip */}
              <div className="pt-2 border-t border-white/[0.06] space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono text-[#b9a8a3] gap-2">
                  <span className="truncate">D1–D6 (media μJy):</span>
                  {onOpenSixDetectors && (
                    <button
                      type="button"
                      onClick={onOpenSixDetectors}
                      className="text-[#ff8a5c] hover:underline font-semibold shrink-0 whitespace-nowrap"
                    >
                      Expandir 6 LVF →
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-6 gap-1 text-xs font-mono">
                  {detectorStats.map((det) => (
                    <div
                      key={det.detector}
                      className="rounded-lg bg-[#181A20] border border-white/[0.06] py-1.5 text-center"
                      title={`D${det.detector}: ${det.pointCount} puntos${det.meanFluxUJy !== null ? ` · media ${det.meanFluxUJy.toFixed(1)} μJy` : ''}`}
                    >
                      <div className="text-[#b9a8a3] text-[10px]">D{det.detector}</div>
                      <div className="text-[#ff8a5c] font-bold text-xs mt-0.5">
                        {det.meanFluxUJy !== null ? det.meanFluxUJy.toFixed(0) : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. Metadata / Contamination Flags (Real /api/frames & /api/spectrum) */}
        {visibility.metadata && (
          <div className="space-y-2">
            <div className="text-sm font-semibold text-[#f6f1ee]">Metadata / Contamination Flags</div>

            <div className="hud-subcard rounded-xl p-3.5 space-y-2 font-mono text-xs">
              {effectiveLoadingSpectrum && !activeSpectrum ? (
                <div className="h-12 w-full rounded bg-white/[0.04] animate-pulse flex items-center justify-center text-xs text-[#b9a8a3]">
                  Cargando flags de /api/spectrum y /api/frames...
                </div>
              ) : activeSpectrum || framesMeta.length > 0 ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-[#b9a8a3]">Exposiciones (/api/spectrum):</span>
                    <span className="text-[#f6f1ee] font-semibold">
                      {activeSpectrum?.n_exposures ?? realPoints.length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#b9a8a3]">Frames (/api/frames):</span>
                    <span className="text-[#f6f1ee] font-semibold">{framesMeta.length}</span>
                  </div>
                  {activeSpectrum && (
                    <div className="flex justify-between">
                      <span className="text-[#b9a8a3]">Apertura:</span>
                      <span className="text-[#f6f1ee] font-semibold">{activeSpectrum.aperture_arcsec}&quot;</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-2">
                    <span className="text-[#b9a8a3] shrink-0">Flags detectadas:</span>
                    <span className="text-[#ff8a5c] font-semibold text-right truncate">
                      {allFlags.join(', ') || 'Ninguna'}
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-xs text-[#b9a8a3] text-center py-2">
                  Sin metadatos disponibles aún para esta posición.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
