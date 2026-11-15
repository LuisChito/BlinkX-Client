import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Box,
  Check,
  Cpu,
  GripHorizontal,
  Loader2,
  Maximize2,
  Minimize2,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import type { TargetCatalogEntry, ViewMode } from '../types/spherex';
import { abs, api, type Frame, type Job, type SequenceResult, type SpectrumPoint } from '../../lib/skyApi';
import type {
  CubeResult,
  Detector,
  ResolveResponse,
  SpectrumResponse,
} from '../hooks/useSkyContract';

interface SixDetectorEpochPanelProps {
  target: TargetCatalogEntry;
  ra: number;
  dec: number;
  mode: ViewMode;
  framesMeta?: Frame[];
  sequenceResult?: SequenceResult | null;
  contractSpectrum?: SpectrumResponse | null;
  isLoadingSpectrum?: boolean;
  resolveInfo?: ResolveResponse | null;
  cubeResult?: CubeResult | null;
  loadingCube?: boolean;
  cubeJob?: Job | null;
  error?: string | null;
  detectorFilter?: Detector;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  onChangeDetectorFilter?: (d: Detector | undefined) => void;
  onLoadCube?: () => void;
  onMeasureSpectrum?: () => void;
  onChangeMode: (mode: ViewMode) => void;
  onCloseSplit: () => void;
}

const LVF_BANDS: Array<{
  detector: Detector;
  band: string;
  rangeUm: [number, number];
  molecules: string;
}> = [
  { detector: 1, band: 'LVF-1', rangeUm: [0.75, 1.11], molecules: 'Continuo Óptico-NIR / H₂O 0.94' },
  { detector: 2, band: 'LVF-2', rangeUm: [1.11, 1.64], molecules: 'H₂O 1.4 μm / J-band' },
  { detector: 3, band: 'LVF-3', rangeUm: [1.64, 2.42], molecules: 'CH₄ 1.66 μm / H₂O 1.9 μm' },
  { detector: 4, band: 'LVF-4', rangeUm: [2.42, 3.82], molecules: 'H₂O Hielo 3.0 / CH₄ 3.3 μm' },
  { detector: 5, band: 'LVF-5', rangeUm: [3.82, 4.42], molecules: 'CO₂ 4.26 μm / H₃⁺' },
  { detector: 6, band: 'LVF-6', rangeUm: [4.42, 5.00], molecules: 'CO 4.67 μm / NH₃ / Térmico' },
];

export function SixDetectorEpochPanel({
  target,
  ra,
  dec,
  mode,
  framesMeta = [],
  sequenceResult = null,
  contractSpectrum = null,
  isLoadingSpectrum = false,
  resolveInfo = null,
  cubeResult = null,
  loadingCube = false,
  cubeJob = null,
  error = null,
  detectorFilter,
  isMaximized = false,
  onToggleMaximize,
  onChangeDetectorFilter,
  onLoadCube,
  onMeasureSpectrum,
  onChangeMode,
  onCloseSplit,
}: SixDetectorEpochPanelProps) {
  const [selectedDetector, setSelectedDetector] = useState<Detector>(4);

  const realPoints = contractSpectrum?.points ?? [];

  const detectorSummaries = useMemo(() => {
    const maxMean = Math.max(
      1,
      ...LVF_BANDS.map((b) => {
        const pts = realPoints.filter((p) => p.detector === b.detector);
        return pts.length > 0 ? Math.abs(pts.reduce((s, p) => s + p.flux, 0) / pts.length) : 0;
      }),
    );

    return LVF_BANDS.map((b) => {
      const pts = realPoints.filter((p) => p.detector === b.detector);
      const framesForDet = framesMeta.filter((f) => f.detector === b.detector);
      const sumFlux = pts.reduce((s, p) => s + p.flux, 0);
      const meanFlux = pts.length > 0 ? sumFlux / pts.length : 0;
      const snrVals = pts
        .filter((p) => p.error && p.error > 0)
        .map((p) => Math.abs(p.flux) / p.error);
      const meanSnr =
        snrVals.length > 0 ? snrVals.reduce((a, c) => a + c, 0) / snrVals.length : null;
      const barPct =
        pts.length > 0 ? Math.min(100, Math.max(12, Math.round((Math.abs(meanFlux) / maxMean) * 100))) : 6;

      return {
        ...b,
        pointsCount: pts.length,
        framesCount: framesForDet.length,
        sumFlux,
        meanFlux,
        meanSnr,
        barPct,
      };
    });
  }, [framesMeta, realPoints]);

  const activeSummary = useMemo(
    () => detectorSummaries.find((d) => d.detector === selectedDetector) ?? detectorSummaries[0],
    [detectorSummaries, selectedDetector],
  );

  const activeDetectorPoints = useMemo(
    () =>
      [...realPoints]
        .filter((p) => p.detector === selectedDetector)
        .sort((a, b) => a.wavelength - b.wavelength),
    [realPoints, selectedDetector],
  );

  const firstFrame = sequenceResult?.frames[0] ?? framesMeta[0] ?? null;
  const lastFrame =
    sequenceResult?.frames[Math.max(0, (sequenceResult?.frames.length ?? 1) - 1)] ??
    framesMeta[Math.max(0, framesMeta.length - 1)] ??
    null;

  const displayName = resolveInfo?.matched_name ?? target.name;

  return (
    <section
      aria-label="6 Detectores LVF y Comparador Multi-Época"
      className="w-full h-full hud-card-elevated rounded-2xl shadow-2xl text-[#f6f1ee] flex flex-col overflow-hidden select-none border border-white/[0.10]"
    >
      {/* DRAG / DRAWER HEADER PILL */}
      <div className="px-4 pt-2 pb-1 border-b border-white/[0.05] flex items-center justify-between text-[9px] font-mono text-[#b9a8a3] uppercase tracking-widest bg-[#171112]/80">
        <span className="flex items-center gap-1.5">
          <GripHorizontal className="w-3 h-3 text-[#ff8a5c]" />
          <span>::: 6 Detectores LVF · Sky Cube · Comparador Multi-Época</span>
        </span>
        <span className="text-[#ff8a5c] font-semibold">{displayName}</span>
      </div>

      {/* SUB-BARRA DE TELEMETRÍA */}
      <div className="px-4 py-2 bg-[#171112]/90 backdrop-blur-md border-b border-white/[0.07] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 text-xs font-mono min-w-0">
          <span className="flex items-center gap-1.5 text-white font-semibold shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#ff8a5c]" />
            <span>{displayName}</span>
          </span>
          <span className="text-[#686B75] hidden sm:inline">•</span>
          <span className="text-[#ff8a5c] text-[11px] truncate hidden sm:inline">
            {realPoints.length} pts /api/spectrum
          </span>
          <span className="text-[#686B75] hidden md:inline">•</span>
          <span className="text-[#f6f1ee] text-[11px] truncate hidden md:inline">
            {framesMeta.length} frames /api/frames
          </span>
        </div>

        {/* Acciones de ventana */}
        <div className="flex items-center gap-1.5 shrink-0">
          {onToggleMaximize && (
            <button
              type="button"
              onClick={onToggleMaximize}
              className="px-2.5 py-1 rounded-lg bg-[#261d1f] hover:bg-[#2B2D33] text-xs font-mono text-[#C8CDD6] hover:text-white transition-all flex items-center gap-1.5 border border-white/[0.08]"
              title={isMaximized ? 'Volver a vista dividida' : 'Expandir a pantalla completa'}
            >
              {isMaximized ? (
                <Minimize2 className="w-3.5 h-3.5 text-[#6fd3ff]" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5 text-[#ff8a5c]" />
              )}
              <span>{isMaximized ? 'Dividida' : 'Completa'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onCloseSplit}
            className="px-2 py-1 rounded-lg bg-[#261d1f] hover:bg-[#2B2D33] text-xs font-mono text-[#C8CDD6] hover:text-white transition-all flex items-center gap-1 border border-white/[0.08]"
            title="Cerrar panel y volver al Visor Celeste"
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cerrar</span>
          </button>
        </div>
      </div>

      {/* CONTENIDO FLUIDO Y ORGANIZADO */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* PARTE 1: SELECTOR DE LOS 6 DETECTORES LVF (0.75-5.00 μm) */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-1.5">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#ff8a5c]" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-white">
                1. Detectores LVF-1..6 (Datos reales /api/frames &amp; /api/spectrum)
              </h2>
            </div>
            <div className="text-[11px] font-mono text-[#b9a8a3]">
              Unidad: <span className="text-[#ff8a5c] font-semibold">{contractSpectrum?.flux_unit ?? 'uJy'}</span>
            </div>
          </div>

          <div
            className={`grid gap-2.5 ${
              isMaximized
                ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
                : 'grid-cols-2 sm:grid-cols-3'
            }`}
          >
            {detectorSummaries.map((det) => {
              const isSelected = det.detector === selectedDetector;
              return (
                <button
                  key={det.band}
                  type="button"
                  onClick={() => setSelectedDetector(det.detector)}
                  className={`text-left p-3 rounded-xl transition-all flex flex-col justify-between border ${
                    isSelected
                      ? 'bg-[#1F2026] border-[#ff8a5c]/60 shadow-lg'
                      : 'bg-[#140f10] border-white/[0.06] hover:border-white/[0.14] hover:bg-[#1A1B20]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 border-b border-white/[0.04] pb-1">
                    <span className="text-xs font-mono font-bold text-white tracking-wide shrink-0">
                      {det.band}
                    </span>
                    <span className="text-[10px] font-mono text-[#ff8a5c] font-semibold">
                      {det.rangeUm[0].toFixed(2)}–{det.rangeUm[1].toFixed(2)} μm
                    </span>
                  </div>

                  {/* Barra de intensidad */}
                  <div className="w-full h-1.5 rounded-full bg-[#0D0E11] overflow-hidden my-2 border border-white/[0.04]">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${det.barPct}%`,
                        background: isSelected
                          ? 'linear-gradient(90deg, #ff8a5c, #6fd3ff)'
                          : '#ff8a5c',
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-[#C8CDD6]">
                    <span>{det.pointsCount > 0 ? `μ ${det.meanFlux.toFixed(1)}` : 'Sin pts'}</span>
                    <span className="text-[#6fd3ff] font-medium">
                      {det.framesCount} fr
                    </span>
                  </div>
                  <div className="text-[9px] text-[#b9a8a3] truncate mt-1">{det.molecules}</div>
                </button>
              );
            })}
          </div>

          {/* Telemetría y curva del detector activo */}
          <div className="bg-[#171112]/80 rounded-xl p-3.5 border border-white/[0.06] space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold">{activeSummary.band}:</span>
                <span className="text-[#C8CDD6]">
                  {activeSummary.rangeUm[0]}–{activeSummary.rangeUm[1]} μm
                </span>
                <span className="text-[#b9a8a3]">• {activeSummary.pointsCount} pts</span>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                {onChangeDetectorFilter && (
                  <button
                    type="button"
                    onClick={() =>
                      onChangeDetectorFilter(
                        detectorFilter === activeSummary.detector
                          ? undefined
                          : activeSummary.detector,
                      )
                    }
                    className={`px-2 py-0.5 rounded border text-[10px] font-mono transition-colors ${
                      detectorFilter === activeSummary.detector
                        ? 'bg-[#6fd3ff]/25 border-[#6fd3ff]/50 text-white'
                        : 'bg-white/[0.04] border-white/10 text-[#b9a8a3] hover:text-white'
                    }`}
                  >
                    {detectorFilter === activeSummary.detector
                      ? `Filtrando D${detectorFilter}`
                      : `Filtrar D${activeSummary.detector}`}
                  </button>
                )}
                <span className="text-[#b9a8a3]">Frames: {activeSummary.framesCount}</span>
                {activeSummary.meanSnr !== null && (
                  <span className="text-[#ff8a5c] font-semibold">
                    SNR medio: {activeSummary.meanSnr.toFixed(1)}
                  </span>
                )}
              </div>
            </div>

            <div className="h-28 w-full pt-1">
              {isLoadingSpectrum ? (
                <div className="h-full w-full rounded-lg bg-white/[0.04] animate-pulse flex items-center justify-center text-[10px] font-mono text-[#b9a8a3]">
                  Cargando puntos espectrales de /api/spectrum...
                </div>
              ) : activeDetectorPoints.length === 0 ? (
                <div className="h-full w-full rounded-lg bg-white/[0.02] border border-white/[0.04] flex flex-col items-center justify-center gap-2 text-[10px] font-mono text-[#b9a8a3]">
                  <span>Sin mediciones de /api/spectrum en {activeSummary.band}.</span>
                  {realPoints.length === 0 && onMeasureSpectrum && (
                    <button
                      type="button"
                      onClick={onMeasureSpectrum}
                      className="px-2.5 py-1 rounded-md bg-[#ff8a5c]/20 hover:bg-[#ff8a5c]/30 border border-[#ff8a5c]/40 text-[#ff8a5c] text-[10px] font-mono transition-colors"
                    >
                      Medir espectro aquí (/api/spectrum)
                    </button>
                  )}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={activeDetectorPoints}
                    margin={{ top: 4, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="activeDetGradNeutral" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ff8a5c" stopOpacity={0.32} />
                        <stop offset="95%" stopColor="#ff8a5c" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="wavelength"
                      tick={{ fill: '#b9a8a3', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                      tickFormatter={(v: number) => `${v.toFixed(2)}μm`}
                      stroke="rgba(255,255,255,0.08)"
                    />
                    <YAxis
                      tick={{ fill: '#b9a8a3', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                      stroke="rgba(255,255,255,0.08)"
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const pt = payload[0].payload as SpectrumPoint;
                        return (
                          <div className="bg-[#191A20] border border-white/15 px-3 py-2 rounded-lg text-xs font-mono text-white shadow-2xl">
                            <div className="text-[#ff8a5c] font-semibold">
                              {pt.wavelength.toFixed(3)} μm (D{pt.detector})
                            </div>
                            <div className="text-[#C8CDD6] mt-0.5">
                              Flujo: {pt.flux.toFixed(2)} ± {(pt.error ?? 0).toFixed(2)}{' '}
                              {contractSpectrum?.flux_unit ?? 'uJy'}
                            </div>
                            <div className="text-[#b9a8a3] text-[10px]">
                              {pt.date_obs.slice(0, 19).replace('T', ' ')}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="flux"
                      stroke={mode === 'diff' ? '#F43F5E' : mode === 'sum' ? '#6fd3ff' : '#ff8a5c'}
                      strokeWidth={2}
                      fill="url(#activeDetGradNeutral)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* PARTE 2: SKY CUBE (/api/cube — 6 CANALES Y VISTA 3D) */}
        <div className="space-y-2.5 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-1.5">
            <div className="flex items-center gap-2">
              <Box className="w-4 h-4 text-[#ff8a5c]" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-white">
                2. Sky Cube 102 Canales (/api/cube)
              </h2>
            </div>
            {onLoadCube && (
              <button
                type="button"
                disabled={loadingCube}
                onClick={onLoadCube}
                className="px-2.5 py-1 rounded-lg bg-[#ff8a5c]/20 hover:bg-[#ff8a5c]/30 border border-[#ff8a5c]/45 text-[10px] font-mono text-white flex items-center gap-1.5 disabled:opacity-50"
              >
                {loadingCube ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>
                      {cubeJob
                        ? `Descargando ${Math.round((cubeJob.progress ?? 0) * 100)}%`
                        : 'Descargando cubo...'}
                    </span>
                  </>
                ) : cubeResult ? (
                  <span>Recargar Cubo</span>
                ) : (
                  <span>Cargar Cubo 6 Canales + 3D</span>
                )}
              </button>
            )}
          </div>

          {loadingCube && !cubeResult && (
            <div className="rounded-xl bg-[#140f10] border border-[#ff8a5c]/30 p-3 text-[11px] font-mono text-[#b9a8a3] space-y-1">
              <div className="text-[#ff8a5c] font-semibold">
                Procesando /api/cube… {Math.round((cubeJob?.progress ?? 0) * 100)}%
              </div>
              {cubeJob?.stage && <div className="text-[#f6f1ee]">{cubeJob.stage}</div>}
              {(cubeJob?.queue_position ?? 0) > 0 && (
                <div>En cola (#{cubeJob?.queue_position})</div>
              )}
            </div>
          )}

          {error && !loadingCube && !cubeResult && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-400/30 p-3 text-[11px] font-mono text-rose-200 flex items-center justify-between gap-2">
              <span className="truncate">{error}</span>
              {onLoadCube && (
                <button
                  type="button"
                  onClick={onLoadCube}
                  className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-white shrink-0"
                >
                  Reintentar
                </button>
              )}
            </div>
          )}

          {cubeResult ? (
            <div className="space-y-3">
              {cubeResult.six_channels && cubeResult.six_channels.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {cubeResult.six_channels.map((ch) => (
                    <div
                      key={ch.channel}
                      className="rounded-lg bg-[#140f10] border border-white/[0.08] overflow-hidden p-1 text-center"
                    >
                      <img
                        src={
                          ch.png_url
                            ? abs(ch.png_url)
                            : api.url.cubeChannel(cubeResult.tile.id, ch.channel)
                        }
                        alt={`Canal ${ch.channel}`}
                        className="w-full aspect-square object-cover rounded bg-black"
                      />
                      <div className="text-[9px] font-mono text-[#C8CDD6] mt-1">
                        Ch {ch.channel} · {ch.wavelength_um.toFixed(2)}μm
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="rounded-xl bg-[#140f10] border border-white/[0.08] p-2">
                  <div className="text-[10px] font-mono text-[#b9a8a3] mb-1">
                    Espectro en ({ra.toFixed(3)}°, {dec.toFixed(3)}°)
                  </div>
                  <img
                    src={api.url.cubeSamples(cubeResult.tile.id, ra, dec)}
                    alt="Cube Samples"
                    className="w-full rounded bg-black object-contain"
                  />
                </div>
                <div className="rounded-xl bg-[#140f10] border border-white/[0.08] p-2">
                  <div className="text-[10px] font-mono text-[#b9a8a3] mb-1">
                    Proyección 3D del Cubo (RA × Dec × λ)
                  </div>
                  <img
                    src={api.url.cube3d(cubeResult.tile.id)}
                    alt="Cube 3D"
                    className="w-full rounded bg-black object-contain"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-[#140f10] border border-white/[0.06] p-3 text-[11px] font-mono text-[#b9a8a3]">
              Pulsa &quot;Cargar Cubo 6 Canales + 3D&quot; para descargar la tesela real de{' '}
              <code>/api/cube</code> (102 canales, ~320 MB en la primera carga).
            </div>
          )}
        </div>

        {/* PARTE 3: COMPARADOR TEMPORAL REAL */}
        <div className="space-y-2.5 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-1.5">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#6fd3ff]" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-white">
                3. Comparador Temporal Multi-Época (/api/sequence &amp; /api/stack)
              </h2>
            </div>
            {resolveInfo?.pm && (
              <div className="text-[11px] font-mono text-[#b9a8a3]">
                PM: <strong className="text-white">μα* {resolveInfo.pm.ra.toFixed(1)}, μδ {resolveInfo.pm.dec.toFixed(1)} mas/yr</strong>
              </div>
            )}
          </div>

          <div
            className={`grid gap-2.5 ${
              isMaximized ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2'
            }`}
          >
            <button
              type="button"
              onClick={() => onChangeMode('normal')}
              className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                mode === 'normal'
                  ? 'bg-[#1F2026] border-[#ff8a5c]/60 shadow-lg'
                  : 'bg-[#140f10] border-white/[0.06] hover:border-white/[0.14] hover:bg-[#1A1B20]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-white">
                  Frame Inicial
                </span>
                {mode === 'normal' && <Check className="w-3.5 h-3.5 text-[#ff8a5c]" />}
              </div>
              <div className="text-[10px] font-mono text-[#b9a8a3]">
                {firstFrame ? firstFrame.date_obs.slice(0, 10) : 'Sin frames'}
              </div>
            </button>

            <button
              type="button"
              onClick={() => onChangeMode('blink')}
              className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                mode === 'blink'
                  ? 'bg-[#1F2026] border-[#ff8a5c]/60 shadow-lg'
                  : 'bg-[#140f10] border-white/[0.06] hover:border-white/[0.14] hover:bg-[#1A1B20]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-white">Blink Alternado</span>
                {mode === 'blink' && <Check className="w-3.5 h-3.5 text-[#ff8a5c]" />}
              </div>
              <div className="text-[10px] font-mono text-[#b9a8a3]">
                {firstFrame && lastFrame
                  ? `${firstFrame.date_obs.slice(0, 10)} ↔ ${lastFrame.date_obs.slice(0, 10)}`
                  : 'Requiere ≥ 2 frames'}
              </div>
            </button>

            <button
              type="button"
              onClick={() => onChangeMode('diff')}
              className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                mode === 'diff'
                  ? 'bg-[#1F2026] border-rose-500/60 shadow-lg'
                  : 'bg-[#140f10] border-white/[0.06] hover:border-white/[0.14] hover:bg-[#1A1B20]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-white">Resta (T₂ − T₁)</span>
                {mode === 'diff' && <Check className="w-3.5 h-3.5 text-rose-400" />}
              </div>
              <div className="text-[10px] text-[#b9a8a3]">
                /api/stack?op=diff entre último y primer frame.
              </div>
            </button>

            <button
              type="button"
              onClick={() => onChangeMode('sum')}
              className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                mode === 'sum'
                  ? 'bg-[#1F2026] border-[#6fd3ff]/60 shadow-lg'
                  : 'bg-[#140f10] border-white/[0.06] hover:border-white/[0.14] hover:bg-[#1A1B20]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-white">Suma (T₁ + T₂)</span>
                {mode === 'sum' && <Check className="w-3.5 h-3.5 text-[#6fd3ff]" />}
              </div>
              <div className="text-[10px] text-[#b9a8a3]">
                /api/stack?op=sum co-adición real de frames.
              </div>
            </button>
          </div>

          <div className="pt-2 flex items-center justify-between text-[11px] font-mono text-[#b9a8a3] border-t border-white/[0.04]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#ff8a5c] shrink-0" />
              <span>
                Modo activo: <strong className="text-white uppercase">{mode}</strong>
              </span>
            </div>
            <span className="text-[#ff8a5c]">Sincronizado con Visor</span>
          </div>
        </div>
      </div>
    </section>
  );
}
