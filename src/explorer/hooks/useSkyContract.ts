// AI-assisted development used for code development, debugging and documentation.
// Tool: ChatGPT, Claude
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ApiError,
  type CompositionContextType,
  type CompositionResult,
  type Coord,
  type Frame,
  type Job,
  type SequenceResult,
  type SpectrumPoint,
  api,
  clearApiCache,
  isAbort,
  latest,
} from '../../lib/skyApi';
import type { ViewMode } from '../types/spherex';

export type Detector = 1 | 2 | 3 | 4 | 5 | 6;
export type Stretch = 'linear' | 'log' | 'sqrt' | 'asinh';
export type Cmap = 'gray' | 'viridis' | 'magma' | 'inferno';
export type Scale = 'sequence' | 'frame';

export interface StatusResponse {
  status: 'ok' | 'degraded' | 'down' | string;
  mode?: string;
  spherex_mode?: string;
  version?: string;
  data_release?: string;
  [k: string]: unknown;
}

export interface ResolveResponse {
  query: string;
  matched_name: string;
  ra: number;
  dec: number;
  source: string;
  epoch: number;
  pm: { ra: number; dec: number } | null;
  parallax_mas: number | null;
  current: { ra: number; dec: number; epoch: number };
}

export interface SkyObject {
  id: string;
  name: string;
  source: string;
  ra: number;
  dec: number;
  type: string;
  type_raw?: string;
  z?: number | null;
  distance_arcsec: number;
}

export interface ObjectsResponse {
  center: Coord;
  radius_arcsec: number;
  counts?: { simbad?: number; ned?: number };
  objects: SkyObject[];
  partial?: boolean;
  warnings?: string[];
}

export interface FramesResponse {
  center: Coord;
  fov_arcsec: number;
  total: number;
  limit: number;
  offset: number;
  frames: Frame[];
  partial?: boolean;
  warnings?: string[];
}

export interface CoverageResponse {
  weeks: Array<{ week_start: string; count: number }>;
  first_date?: string | null;
  last_date?: string | null;
}

export interface StackResult {
  op: 'mean' | 'median' | 'sum' | 'diff';
  n_frames: number;
  center: Coord;
  fov_arcsec: number;
  size_px: number;
  vmin: number;
  vmax: number;
  unit: string;
  png_url: string;
}

export interface SpectrumResponse {
  center: Coord;
  aperture_arcsec: number;
  wavelength_unit: string;
  flux_unit: string;
  n_exposures?: number;
  points: SpectrumPoint[];
  partial?: boolean;
  warnings?: string[];
}

export interface PredictResult {
  target: string;
  /** proper_motion (estrellas, enanas marrones) · ephemeris (asteroides/cometas, JPL Horizons) · static */
  method: 'proper_motion' | 'ephemeris' | 'static' | string;
  pm_mas_yr: { ra: number; dec: number } | null;
  parallax_mas?: number | null;
  catalog_epoch?: number | null;
  catalog_position?: Coord | null;
  positions: Array<{ date: string; ra: number; dec: number; sigma_arcsec: number }>;
  epoch_range?: [number, number];
  warnings?: string[];
}

export interface OverlaySource {
  id: string;
  ra: number;
  dec: number;
  mag: number | null;
  pm: { ra: number; dec: number } | null;
}

export interface OverlayResponse {
  catalog: 'gaia' | 'wise';
  center: Coord;
  fov_arcsec: number;
  epoch: number;
  sources: OverlaySource[];
  partial?: boolean;
  warnings?: string[];
}

export interface L2Result {
  frame: Frame;
  raw_png_url: string;
  color_png_url: string;
  pixel_url?: string;
  size_px?: number;
  [k: string]: unknown;
}

export interface L2PixelResult {
  frame_id: string;
  x: number;
  y: number;
  ra: number;
  dec: number;
  value?: number | null;
  flux?: number | null;
  unit?: string;
  wavelength_um?: number;
  detector?: number;
  flags?: string[];
  [k: string]: unknown;
}

export interface CubeChannelInfo {
  channel: number;
  wavelength_um: number;
  png_url: string;
}

export interface CubeResult {
  tile: { id: string; [k: string]: unknown };
  channels: CubeChannelInfo[];
  six_channels: CubeChannelInfo[];
  spectrum: Array<{ channel: number; wavelength_um: number; flux: number; error?: number | null }>;
  [k: string]: unknown;
}

export interface CubePixelResult {
  tile_id?: string;
  x: number;
  y: number;
  ra: number;
  dec: number;
  spectrum: Array<{ channel?: number; wavelength_um: number; flux: number; error?: number | null }>;
  [k: string]: unknown;
}

export interface AsteroidPixel {
  x: number | null;
  y_top: number | null;
  inside_image: boolean;
  image_width?: number;
  image_height?: number;
}

export interface AsteroidPredictResult {
  asteroid_id: number;
  target: string;
  method: string;
  /** 500@-163182 = visto desde SPHEREx; 500@399 = geocentro */
  observer: string;
  current_observation: {
    mjd_utc: number;
    time: string;
    ra: number;
    dec: number;
    ephemeris_ra: number;
    ephemeris_dec: number;
    offset_arcsec: number;
    pixel?: AsteroidPixel;
  };
  predicted_ra_deg: number;
  predicted_dec_deg: number;
  sigma_arcsec: number;
  forecast_mjd_utc: number;
  forecast_time: string;
  horizon_days: number;
  motion?: { arcsec_per_hour: number; position_angle_deg: number };
  image_id?: string | null;
  pixel?: AsteroidPixel;
  track: Array<{ mjd_utc: number; time: string; ra: number; dec: number; sigma_arcsec: number; pixel?: AsteroidPixel }>;
  warnings?: string[];
  status?: string;
}

export interface AsteroidRequest {
  asteroid_id: number;
  current_observation: { mjd_utc: number; ra: number; dec: number };
  horizon_days: number;
  image_id?: string;
  view?: { ra: number; dec: number; fov: number; size: number };
}

export interface SkyContractParams {
  ra: number;
  dec: number;
  fovDeg: number;
  targetName?: string;
  mode: ViewMode;
  detector?: Detector;
  stretch: Stretch;
  cmap: Cmap;
  scale: Scale;
  showGaia: boolean;
  showWise: boolean;
}

export interface SkyContractState {
  status: StatusResponse | null;
  resolveInfo: ResolveResponse | null;
  objects: ObjectsResponse | null;
  frames: FramesResponse | null;
  coverage: CoverageResponse | null;
  sequence: SequenceResult | null;
  stack: StackResult | null;
  spectrum: SpectrumResponse | null;
  probeCoord: Coord | null;
  probeSpectrum: SpectrumResponse | null;
  /** Resultado de /api/composition y el punto al que corresponde. */
  composition: CompositionResult | null;
  compositionCoord: Coord | null;
  compositionJob: Job | null;
  loadingComposition: boolean;
  compositionError: string | null;
  predict: PredictResult | null;
  predictJob: Job | null;
  loadingPredict: boolean;
  predictError: string | null;
  asteroidError: string | null;
  gaiaOverlay: OverlayResponse | null;
  wiseOverlay: OverlayResponse | null;
  l2: L2Result | null;
  l2Pixel: L2PixelResult | null;
  cube: CubeResult | null;
  cubePixel: CubePixelResult | null;
  asteroid: AsteroidPredictResult | null;
  activeJob: Job | null;
  spectrumJob: Job | null;
  cubeJob: Job | null;
  loadingSequence: boolean;
  loadingSpectrum: boolean;
  loadingProbeSpectrum: boolean;
  loadingStack: boolean;
  loadingL2: boolean;
  loadingCube: boolean;
  loadingAsteroid: boolean;
  warnings: string[];
  error: string | null;
  resolveByName: (name: string, at?: string) => Promise<ResolveResponse>;
  probeSpectrumAt: (ra: number, dec: number, aperture?: number) => Promise<SpectrumResponse | null>;
  clearProbeSpectrum: () => void;
  analyzeComposition: (ra: number, dec: number, opts?: { aperture?: number; context?: CompositionContextType }) => Promise<CompositionResult | null>;
  cancelComposition: () => void;
  loadL2: (opts?: { date_from?: string; date_to?: string; detector?: Detector; frame_id?: string; size?: number }) => Promise<L2Result | null>;
  inspectL2Pixel: (frameId: string, x: number, y: number, size?: number) => Promise<L2PixelResult | null>;
  loadCube: (size?: number) => Promise<CubeResult | null>;
  inspectCubePixel: (tileId: string, x: number, y: number, size?: number) => Promise<CubePixelResult | null>;
  predictAsteroidFromCurrent: (body: AsteroidRequest) => Promise<AsteroidPredictResult | null>;
  /** /api/predict: posición del objeto en cada fecha con imagen (movimiento propio o efemérides). */
  predictMotion: (opts: { ra: number; dec: number; name?: string; date_from: string; date_to: string }) => Promise<PredictResult | null>;
  clearPredict: () => void;
  clearAsteroid: () => void;
  retry: () => void;
}

const DEFAULT_DATE_FROM = '2025-05-01';
const DEFAULT_DATE_TO = '2026-06-01';
const STATUS_POLL_MS = 60_000;

export function useSkyContract(params: SkyContractParams): SkyContractState {
  const {
    ra,
    dec,
    fovDeg,
    targetName,
    mode,
    detector,
    stretch,
    cmap,
    scale,
    showGaia,
    showWise,
  } = params;

  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [resolveInfo, setResolveInfo] = useState<ResolveResponse | null>(null);
  const [objects, setObjects] = useState<ObjectsResponse | null>(null);
  const [frames, setFrames] = useState<FramesResponse | null>(null);
  const [coverage, setCoverage] = useState<CoverageResponse | null>(null);
  const [sequence, setSequence] = useState<SequenceResult | null>(null);
  const [stack, setStack] = useState<StackResult | null>(null);
  const [spectrum, setSpectrum] = useState<SpectrumResponse | null>(null);
  const [probeCoord, setProbeCoord] = useState<Coord | null>(null);
  const [probeSpectrum, setProbeSpectrum] = useState<SpectrumResponse | null>(null);
  const [composition, setComposition] = useState<CompositionResult | null>(null);
  const [compositionCoord, setCompositionCoord] = useState<Coord | null>(null);
  const [loadingComposition, setLoadingComposition] = useState(false);
  const [compositionError, setCompositionError] = useState<string | null>(null);
  const [predict, setPredict] = useState<PredictResult | null>(null);
  const [gaiaOverlay, setGaiaOverlay] = useState<OverlayResponse | null>(null);
  const [wiseOverlay, setWiseOverlay] = useState<OverlayResponse | null>(null);
  const [l2, setL2] = useState<L2Result | null>(null);
  const [l2Pixel, setL2Pixel] = useState<L2PixelResult | null>(null);
  const [cube, setCube] = useState<CubeResult | null>(null);
  const [cubePixel, setCubePixel] = useState<CubePixelResult | null>(null);
  const [asteroid, setAsteroid] = useState<AsteroidPredictResult | null>(null);
  const [loadingPredict, setLoadingPredict] = useState(false);
  const [predictError, setPredictError] = useState<string | null>(null);
  const [asteroidError, setAsteroidError] = useState<string | null>(null);

  const [jobsByKind, setJobsByKind] = useState<Record<string, Job>>({});
  const [loadingSequence, setLoadingSequence] = useState(false);
  const [loadingSpectrum, setLoadingSpectrum] = useState(false);
  const [loadingProbeSpectrum, setLoadingProbeSpectrum] = useState(false);
  const [loadingStack, setLoadingStack] = useState(false);
  const [loadingL2, setLoadingL2] = useState(false);
  const [loadingCube, setLoadingCube] = useState(false);
  const [loadingAsteroid, setLoadingAsteroid] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const updateJob = useCallback((kind: string, job: Job | null) => {
    setJobsByKind((prev) => {
      if (!job || job.status === 'done' || job.status === 'failed') {
        if (!(kind in prev)) return prev;
        const next = { ...prev };
        delete next[kind];
        return next;
      }
      return { ...prev, [kind]: job };
    });
  }, []);

  const activeJob = useMemo(() => {
    const active = Object.values(jobsByKind);
    if (active.length === 0) return null;
    return active.find((j) => j.status === 'running') ?? active[0];
  }, [jobsByKind]);

  const spectrumJob = jobsByKind.spectrum ?? null;
  const compositionJob = jobsByKind.composition ?? null;
  const predictJob = jobsByKind.predict ?? null;
  const cubeJob = jobsByKind.cube ?? null;

  const fovArcsec = Math.max(30, Math.min(3600, Math.round(fovDeg * 3600)));
  const fovArcsecRef = useRef(fovArcsec);
  fovArcsecRef.current = fovArcsec;

  // One `latest()` signal generator per panel so superseded requests abort cleanly
  const latestSeqRef = useRef<(() => AbortSignal) | null>(null);
  if (!latestSeqRef.current) latestSeqRef.current = latest();
  const latestSpecRef = useRef<(() => AbortSignal) | null>(null);
  if (!latestSpecRef.current) latestSpecRef.current = latest();
  const latestStackRef = useRef<(() => AbortSignal) | null>(null);
  if (!latestStackRef.current) latestStackRef.current = latest();
  const latestL2Ref = useRef<(() => AbortSignal) | null>(null);
  if (!latestL2Ref.current) latestL2Ref.current = latest();
  const latestCompRef = useRef<(() => AbortSignal) | null>(null);
  if (!latestCompRef.current) latestCompRef.current = latest();
  const latestCubeRef = useRef<(() => AbortSignal) | null>(null);
  if (!latestCubeRef.current) latestCubeRef.current = latest();
  const latestAsteroidRef = useRef<(() => AbortSignal) | null>(null);
  if (!latestAsteroidRef.current) latestAsteroidRef.current = latest();
  const latestPredictRef = useRef<(() => AbortSignal) | null>(null);
  if (!latestPredictRef.current) latestPredictRef.current = latest();

  // 1. System status on mount + every 60s
  useEffect(() => {
    let alive = true;
    const fetchStatus = () => {
      api
        .status()
        .then((res) => {
          if (alive) setStatus(res as StatusResponse);
        })
        .catch(() => {
          // Non-blocking status check
        });
    };
    fetchStatus();
    const id = window.setInterval(fetchStatus, STATUS_POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  const loadedSeqRef = useRef<{
    ra: number;
    dec: number;
    fovArcsec: number;
    detector?: Detector;
    stretch: Stretch;
    cmap: Cmap;
    scale: Scale;
  } | null>(null);

  const loadedMetaRef = useRef<{
    ra: number;
    dec: number;
    fovArcsec: number;
    detector?: Detector;
  } | null>(null);

  const cubeCacheRef = useRef<Map<string, CubeResult>>(new Map());
  const spectrumCacheRef = useRef<Map<string, SpectrumResponse>>(new Map());
  const cubeKey = `${ra.toFixed(1)},${dec.toFixed(1)}`;

  const [retryNonce, setRetryNonce] = useState(0);

  const retry = useCallback(() => {
    clearApiCache();
    loadedSeqRef.current = null;
    loadedMetaRef.current = null;
    setError(null);
    setWarnings([]);
    setRetryNonce((n) => n + 1);
  }, []);

  // 2. Fast metadata (objects, frames, coverage) + slow sequence (limit 12, size 512),
  //    decoupled from zoom (`fovDeg`) and small pans inside the loaded area, debounced 650ms.
  //    `spectrum` and `predict` are strictly on-demand (click/button), never auto-fired here.
  useEffect(() => {
    const prevSeq = loadedSeqRef.current;
    /** ¿La secuencia mostrada es de otra zona? Si la nueva falla, no se debe seguir mostrando la anterior. */
    let seqAreaChanged = true;
    if (prevSeq) {
      let dra = Math.abs(ra - prevSeq.ra);
      if (dra > 180) dra = 360 - dra;
      const ddec = Math.abs(dec - prevSeq.dec);
      const distArcsec = Math.hypot(
        dra * Math.cos((prevSeq.dec * Math.PI) / 180) * 3600,
        ddec * 3600,
      );
      const insideLoadedArea = distArcsec <= prevSeq.fovArcsec * 0.35;
      seqAreaChanged = !insideLoadedArea;
      const sameRenderParams =
        prevSeq.detector === detector &&
        prevSeq.stretch === stretch &&
        prevSeq.cmap === cmap &&
        prevSeq.scale === scale;
      if (insideLoadedArea && sameRenderParams) {
        return;
      }
    }

    const timer = window.setTimeout(() => {
      const signal = latestSeqRef.current!();
      const seqFov = Math.max(540, fovArcsecRef.current);

      setError(null);
      setWarnings([]);
      setLoadingSequence(true);
      setLoadingSpectrum(false);

      const prevMeta = loadedMetaRef.current;
      let metaDist = Infinity;
      if (prevMeta) {
        let mdra = Math.abs(ra - prevMeta.ra);
        if (mdra > 180) mdra = 360 - mdra;
        metaDist = Math.hypot(
          mdra * Math.cos((prevMeta.dec * Math.PI) / 180) * 3600,
          Math.abs(dec - prevMeta.dec) * 3600,
        );
      }
      const needMeta =
        !prevMeta ||
        metaDist > prevMeta.fovArcsec * 0.35 ||
        prevMeta.detector !== detector;

      if (needMeta) {
        const coordChanged = !prevMeta || metaDist > prevMeta.fovArcsec * 0.35;
        setSpectrum(null);
        setProbeCoord(null);
        setProbeSpectrum(null);
        latestCompRef.current!();
        setComposition(null);
        setCompositionCoord(null);
        setCompositionError(null);
        setLoadingComposition(false);
        updateJob('composition', null);
        // Las predicciones (/api/predict y asteroides) son del objeto, no del campo: se conservan al moverse.
        setL2(null);
        setL2Pixel(null);
        if (coordChanged) {
          setCube(cubeCacheRef.current.get(cubeKey) ?? null);
          setCubePixel(null);
        }
      }

      const mergeWarnings = (next?: string[]) => {
        if (!next || next.length === 0) return;
        setWarnings((prev) => Array.from(new Set([...prev, ...next])));
      };

      const handleErr = (e: unknown) => {
        if (isAbort(e) || signal.aborted) return;
        if (e instanceof ApiError) {
          setError(`[${e.code}] ${e.message}`);
        } else if (e instanceof Error) {
          setError(e.message);
        }
      };

      if (needMeta) {
        loadedMetaRef.current = { ra, dec, fovArcsec: seqFov, detector };

        // Fast metadata calls matched to exact sequence FoV (backend max radius = 600")
        api
          .objects({ ra, dec, radius: Math.min(600, Math.round(seqFov / 2)) })
          .then((res) => {
            if (signal.aborted) return;
            setObjects(res as ObjectsResponse);
            if (res?.partial) mergeWarnings(res.warnings);
          })
          .catch((e) => {
            // Zona nueva sin datos (p. ej. objetivo sin copia de seguridad): no dejar los de la zona anterior.
            if (!signal.aborted && !isAbort(e)) setObjects(null);
            handleErr(e);
          });

        api
          .frames({ ra, dec, fov: seqFov, detector, limit: 48, offset: 0 })
          .then((res) => {
            if (signal.aborted) return;
            setFrames(res as FramesResponse);
            if (res?.partial) mergeWarnings(res.warnings);
          })
          .catch((e) => {
            if (!signal.aborted && !isAbort(e)) setFrames(null);
            handleErr(e);
          });

        api
          .coverage({ ra, dec, detector })
          .then((res) => {
            if (signal.aborted) return;
            setCoverage(res as CoverageResponse);
          })
          .catch((e) => {
            if (!signal.aborted && !isAbort(e)) setCoverage(null);
            handleErr(e);
          });
      }

      // Slow Job: Sequence (TAN reprojected PNGs, cached 5min in skyApi.ts)
      // Use at least 540" (0.15°) so cutout is sharp (SPHEREx is 6.2"/px), and limit 12 for fast load.
      api
        .sequence(
          {
            ra,
            dec,
            fov: seqFov,
            size: 512,
            stretch,
            cmap,
            scale,
            detector,
            limit: 12,
            offset: 0,
          },
          (_p, _stage, job) => {
            if (!signal.aborted) {
              updateJob('sequence', job);
            }
          },
          signal,
        )
        .then((res) => {
          if (signal.aborted) return;
          loadedSeqRef.current = {
            ra: res.center?.ra ?? ra,
            dec: res.center?.dec ?? dec,
            fovArcsec: res.fov_arcsec ?? seqFov,
            detector,
            stretch,
            cmap,
            scale,
          };
          setSequence(res);
          setLoadingSequence(false);
          updateJob('sequence', null);
          if (res.partial) mergeWarnings(res.warnings);
        })
        .catch((e) => {
          if (!signal.aborted) {
            setLoadingSequence(false);
            updateJob('sequence', null);
            if (seqAreaChanged && !isAbort(e)) {
              loadedSeqRef.current = null;
              setSequence(null);
            }
          }
          handleErr(e);
        });
    }, 650);

    return () => {
      window.clearTimeout(timer);
    };
  }, [ra, dec, detector, stretch, cmap, scale, updateJob, retryNonce]);

  // 3. Overlays: Gaia DR3 & AllWISE with epoch propagation (matched to sequence FoV, decoupled from zoom)
  useEffect(() => {
    let alive = true;
    const seqFov = sequence?.fov_arcsec ?? Math.max(540, fovArcsecRef.current);
    const seqRa = sequence?.center?.ra ?? ra;
    const seqDec = sequence?.center?.dec ?? dec;
    if (showGaia) {
      api
        .overlay({ ra: seqRa, dec: seqDec, fov: seqFov, catalog: 'gaia', at: '2025-07-01' })
        .then((res) => {
          if (alive) setGaiaOverlay(res as OverlayResponse);
        })
        .catch(() => {});
    } else {
      setGaiaOverlay(null);
    }

    if (showWise) {
      api
        .overlay({ ra: seqRa, dec: seqDec, fov: seqFov, catalog: 'wise', at: '2025-07-01' })
        .then((res) => {
          if (alive) setWiseOverlay(res as OverlayResponse);
        })
        .catch(() => {});
    } else {
      setWiseOverlay(null);
    }

    return () => {
      alive = false;
    };
  }, [sequence?.center?.ra, sequence?.center?.dec, sequence?.fov_arcsec, showGaia, showWise]);

  // 4. Stack (diff / sum) when mode is diff or sum and sequence has >= 2 frames
  useEffect(() => {
    if (mode !== 'diff' && mode !== 'sum') {
      setStack(null);
      setLoadingStack(false);
      return;
    }
    const seqFrames = sequence?.frames ?? [];
    if (seqFrames.length < 2) return;

    const signal = latestStackRef.current!();
    const currentFov = fovArcsecRef.current;
    setLoadingStack(true);

    const aIds = mode === 'diff' ? [seqFrames[seqFrames.length - 1].id] : seqFrames.slice(0, 6).map((f) => f.id);
    const bIds = mode === 'diff' ? [seqFrames[0].id] : undefined;

    api
      .stack(
        {
          ra,
          dec,
          fov: currentFov,
          size: 512,
          stretch,
          cmap,
          op: mode === 'diff' ? 'diff' : 'sum',
          a: aIds,
          b: bIds,
        },
        (_p, _stage, job) => {
          if (!signal.aborted) {
            updateJob('stack', job);
          }
        },
        signal,
      )
      .then((res) => {
        if (signal.aborted) return;
        setStack(res as StackResult);
        setLoadingStack(false);
        updateJob('stack', null);
      })
      .catch((e) => {
        if (isAbort(e) || signal.aborted) return;
        setLoadingStack(false);
        updateJob('stack', null);
        if (e instanceof ApiError) {
          setError(`[${e.code}] ${e.message}`);
        }
      });
  }, [mode, sequence, ra, dec, stretch, cmap, updateJob]);

  const resolveByName = useCallback(async (name: string, at = '2025-07-01') => {
    const res = (await api.resolve(name, at)) as ResolveResponse;
    setResolveInfo(res);
    return res;
  }, []);

  const probeSpectrumAt = useCallback(
    async (probeRa: number, probeDec: number, aperture = 8) => {
      const specKey = `${Math.round(probeRa * 3600)},${Math.round(probeDec * 3600)},${aperture}`;
      const cached = spectrumCacheRef.current.get(specKey);
      setProbeCoord({ ra: probeRa, dec: probeDec });
      if (cached) {
        setProbeSpectrum(cached);
        setLoadingProbeSpectrum(false);
        return cached;
      }
      const signal = latestSpecRef.current!();
      setLoadingProbeSpectrum(true);
      setError(null);
      try {
        const res = (await api.spectrum(
          {
            ra: probeRa,
            dec: probeDec,
            aperture,
            date_from: DEFAULT_DATE_FROM,
            date_to: DEFAULT_DATE_TO,
          },
          (_p, _stage, job) => {
            if (!signal.aborted) updateJob('spectrum', job);
          },
          signal,
        )) as SpectrumResponse;
        if (!signal.aborted) {
          spectrumCacheRef.current.set(specKey, res);
          setProbeSpectrum(res);
        }
        return res;
      } catch (e) {
        if (isAbort(e) || signal.aborted) return null;
        if (e instanceof ApiError) setError(`[${e.code}] ${e.message}`);
        else if (e instanceof Error) setError(e.message);
        return null;
      } finally {
        if (!signal.aborted) {
          setLoadingProbeSpectrum(false);
          updateJob('spectrum', null);
        }
      }
    },
    [updateJob],
  );

  /** Análisis de composición bajo demanda (botón). Mismas fechas que la sonda: reutiliza su espectro en el backend. */
  const analyzeComposition = useCallback(
    async (cRa: number, cDec: number, opts?: { aperture?: number; context?: CompositionContextType }) => {
      const signal = latestCompRef.current!();
      setCompositionCoord({ ra: cRa, dec: cDec });
      setComposition(null);
      setCompositionError(null);
      setLoadingComposition(true);
      try {
        const res = await api.composition(
          {
            ra: cRa,
            dec: cDec,
            aperture: opts?.aperture ?? 8,
            date_from: DEFAULT_DATE_FROM,
            date_to: DEFAULT_DATE_TO,
            context: opts?.context && opts.context !== 'auto' ? opts.context : undefined,
          },
          (_p, _stage, job) => {
            if (!signal.aborted) updateJob('composition', job);
          },
          signal,
        );
        if (!signal.aborted) setComposition(res);
        return res;
      } catch (e) {
        if (isAbort(e) || signal.aborted) return null;
        if (e instanceof ApiError) {
          setCompositionError(
            e.status === 404 && e.code === 'not_found' && /ruta/i.test(e.message)
              ? 'El backend no tiene /api/composition: actualiza el contenedor a la versión nueva.'
              : e.message,
          );
        } else if (e instanceof Error) setCompositionError(e.message);
        return null;
      } finally {
        if (!signal.aborted) {
          setLoadingComposition(false);
          updateJob('composition', null);
        }
      }
    },
    [updateJob],
  );

  const cancelComposition = useCallback(() => {
    latestCompRef.current!();
    setLoadingComposition(false);
    setComposition(null);
    setCompositionCoord(null);
    setCompositionError(null);
    updateJob('composition', null);
  }, [updateJob]);

  const clearProbeSpectrum = useCallback(() => {
    setProbeCoord(null);
    setProbeSpectrum(null);
    setLoadingProbeSpectrum(false);
  }, []);

  const loadL2 = useCallback(
    async (opts?: { date_from?: string; date_to?: string; detector?: Detector; frame_id?: string; size?: number }) => {
      const signal = latestL2Ref.current!();
      setLoadingL2(true);
      setError(null);
      try {
        const res = (await api.l2(
          {
            ra,
            dec,
            detector: opts?.detector ?? detector,
            date_from: opts?.date_from,
            date_to: opts?.date_to,
            frame_id: opts?.frame_id,
            size: opts?.size ?? 1024,
          },
          (_p, _stage, job) => {
            if (!signal.aborted) updateJob('l2', job);
          },
          signal,
        )) as L2Result;
        if (!signal.aborted) {
          setL2(res);
          setL2Pixel(null);
        }
        return res;
      } catch (e) {
        if (isAbort(e) || signal.aborted) return null;
        if (e instanceof ApiError) setError(`[${e.code}] ${e.message}`);
        else if (e instanceof Error) setError(e.message);
        return null;
      } finally {
        if (!signal.aborted) {
          setLoadingL2(false);
          updateJob('l2', null);
        }
      }
    },
    [ra, dec, detector, updateJob],
  );

  const inspectL2Pixel = useCallback(async (frameId: string, x: number, y: number, size = 1024) => {
    try {
      const res = (await api.l2Pixel(frameId, x, y, size)) as L2PixelResult;
      setL2Pixel(res);
      return res;
    } catch (e) {
      if (e instanceof ApiError) setError(`[${e.code}] ${e.message}`);
      else if (e instanceof Error) setError(e.message);
      return null;
    }
  }, []);

  const loadCube = useCallback(
    async (size = 256) => {
      const cached = cubeCacheRef.current.get(cubeKey);
      if (cached) {
        setCube(cached);
        setCubePixel(null);
        return cached;
      }
      const signal = latestCubeRef.current!();
      setLoadingCube(true);
      setError(null);
      try {
        const res = (await api.cube(
          { ra, dec, size },
          (_p, _stage, job) => {
            if (!signal.aborted) updateJob('cube', job);
          },
          signal,
        )) as CubeResult;
        if (!signal.aborted) {
          cubeCacheRef.current.set(cubeKey, res);
          setCube(res);
          setCubePixel(null);
        }
        return res;
      } catch (e) {
        if (isAbort(e) || signal.aborted) return null;
        if (e instanceof ApiError) setError(`[${e.code}] ${e.message}`);
        else if (e instanceof Error) setError(e.message);
        return null;
      } finally {
        if (!signal.aborted) {
          setLoadingCube(false);
          updateJob('cube', null);
        }
      }
    },
    [cubeKey, dec, ra, updateJob],
  );

  const inspectCubePixel = useCallback(async (tileId: string, x: number, y: number, size?: number) => {
    try {
      const res = (await api.cubePixel(tileId, x, y, size)) as CubePixelResult;
      setCubePixel(res);
      return res;
    } catch (e) {
      if (e instanceof ApiError) setError(`[${e.code}] ${e.message}`);
      else if (e instanceof Error) setError(e.message);
      return null;
    }
  }, []);

  const predictAsteroidFromCurrent = useCallback(
    async (body: AsteroidRequest) => {
      const signal = latestAsteroidRef.current!();
      setLoadingAsteroid(true);
      setAsteroidError(null);
      try {
        const run = (b: AsteroidRequest) =>
          api.asteroidFromCurrent(b, (_p, _stage, job) => {
            if (!signal.aborted) updateJob('asteroid', job);
          }) as Promise<AsteroidPredictResult>;
        let res: AsteroidPredictResult;
        try {
          res = await run(body);
        } catch (e) {
          // `image_id` es opcional (§6): con él el backend consulta IRSA. Si solo falla IRSA, un único reintento
          // sin él conserva la predicción de Horizons (sin comprobar la huella de la imagen).
          const upstream = e instanceof ApiError && (e.code === 'upstream_error' || e.code === 'upstream_timeout');
          if (!upstream || !body.image_id || signal.aborted) throw e;
          const { image_id: _omit, ...rest } = body;
          res = await run(rest);
          res = { ...res, warnings: [...(res.warnings ?? []), 'IRSA no respondió: no se comprobó la huella de la imagen, solo la geometría de la vista.'] };
        }
        if (!signal.aborted) setAsteroid(res);
        return res;
      } catch (e) {
        if (isAbort(e) || signal.aborted) return null;
        setAsteroid(null);
        // Mensajes recomendados por el contrato (docs/API_FRONTEND.md §6).
        if (e instanceof ApiError) {
          setAsteroidError(
            e.code === 'identity_mismatch'
              ? 'Ese punto no coincide con el asteroide indicado. Revisa el número o haz clic sobre el punto que se mueve.'
              : e.code === 'not_found'
                ? 'No existe un asteroide con ese número.'
                : e.code === 'upstream_error' || e.code === 'upstream_timeout'
                  ? 'JPL Horizons no respondió; inténtalo de nuevo.'
                  : e.message,
          );
        } else if (e instanceof Error) setAsteroidError(e.message);
        return null;
      } finally {
        if (!signal.aborted) {
          setLoadingAsteroid(false);
          updateJob('asteroid', null);
        }
      }
    },
    [updateJob],
  );

  const predictMotion = useCallback(
    async (opts: { ra: number; dec: number; name?: string; date_from: string; date_to: string }) => {
      const signal = latestPredictRef.current!();
      setLoadingPredict(true);
      setPredictError(null);
      try {
        const res = (await api.predict(
          { ra: opts.ra, dec: opts.dec, name: opts.name || undefined, date_from: opts.date_from, date_to: opts.date_to },
          (_p, _stage, job) => {
            if (!signal.aborted) updateJob('predict', job);
          },
          signal,
        )) as PredictResult;
        if (!signal.aborted) setPredict(res);
        return res;
      } catch (e) {
        if (isAbort(e) || signal.aborted) return null;
        setPredict(null);
        if (e instanceof ApiError) {
          setPredictError(e.code === 'not_found' ? 'No se encontró un objeto con movimiento conocido cerca de este punto.' : e.message);
        } else if (e instanceof Error) setPredictError(e.message);
        return null;
      } finally {
        if (!signal.aborted) {
          setLoadingPredict(false);
          updateJob('predict', null);
        }
      }
    },
    [updateJob],
  );

  const clearPredict = useCallback(() => {
    latestPredictRef.current!();
    setPredict(null);
    setPredictError(null);
    setLoadingPredict(false);
    updateJob('predict', null);
  }, [updateJob]);

  const clearAsteroid = useCallback(() => {
    latestAsteroidRef.current!();
    setAsteroid(null);
    setAsteroidError(null);
    setLoadingAsteroid(false);
    updateJob('asteroid', null);
  }, [updateJob]);

  useEffect(() => {
    if (targetName === undefined) {
      setResolveInfo(null);
    }
  }, [targetName]);

  return {
    status,
    resolveInfo,
    objects,
    frames,
    coverage,
    sequence,
    stack,
    spectrum,
    probeCoord,
    probeSpectrum,
    composition,
    compositionCoord,
    compositionJob,
    loadingComposition,
    compositionError,
    predict,
    predictJob,
    loadingPredict,
    predictError,
    asteroidError,
    gaiaOverlay,
    wiseOverlay,
    l2,
    l2Pixel,
    cube,
    cubePixel,
    asteroid,
    activeJob,
    spectrumJob,
    cubeJob,
    loadingSequence,
    loadingSpectrum,
    loadingProbeSpectrum,
    loadingStack,
    loadingL2,
    loadingCube,
    loadingAsteroid,
    warnings,
    error,
    resolveByName,
    probeSpectrumAt,
    clearProbeSpectrum,
    analyzeComposition,
    cancelComposition,
    loadL2,
    inspectL2Pixel,
    loadCube,
    inspectCubePixel,
    predictAsteroidFromCurrent,
    predictMotion,
    clearPredict,
    clearAsteroid,
    retry,
  };
}
