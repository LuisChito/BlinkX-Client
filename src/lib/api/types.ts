// Tipos del contrato openapi.yaml v0.3. Los nombres y campos coinciden con los schemas.
import type { Started } from '../jobs';

export type Detector = 1 | 2 | 3 | 4 | 5 | 6;
export type Stretch = 'linear' | 'log' | 'sqrt' | 'asinh';
export type Cmap = 'gray' | 'viridis' | 'magma' | 'inferno';
export type Scale = 'sequence' | 'frame';
export type StackOp = 'mean' | 'median' | 'sum' | 'diff';
export type Catalog = 'gaia' | 'wise';
export type Source = 'simbad' | 'ned';
export type ObjectType = 'star' | 'galaxy' | 'other';
export type CacheStatus = 'hit' | 'miss';
/** Lista abierta: el frontend muestra tal cual cualquier valor que no conozca. */
export type FrameFlag = string;

export interface SkyPoint { ra: number; dec: number }
export interface ProperMotion { ra: number; dec: number }
export interface EpochPosition { ra: number; dec: number; epoch: number }

export interface ErrorDetail {
  code: 'bad_request' | 'not_found' | 'rate_limited' | 'upstream_error' | 'upstream_timeout';
  message: string;
}

export class ApiError extends Error {
  code: ErrorDetail['code'];
  status: number;
  constructor(status: number, code: ErrorDetail['code'], message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export interface ResolveResponse {
  query: string;
  matched_name: string;
  ra: number;
  dec: number;
  source: Source;
  epoch: number;
  pm: ProperMotion | null;
  parallax_mas: number | null;
  current: EpochPosition;
}

export interface SkyObject {
  id: string;
  name: string;
  source: Source;
  ra: number;
  dec: number;
  type: ObjectType;
  type_raw: string;
  z: number | null;
  distance_arcsec: number;
}

export interface ObjectsResponse {
  center: SkyPoint;
  radius_arcsec: number;
  counts: { simbad?: number; ned?: number };
  objects: SkyObject[];
  partial: boolean;
  warnings: string[];
  cache: CacheStatus;
}

export interface FrameMeta {
  id: string;
  date_obs: string;
  detector: Detector;
  band_um: number;
  center: SkyPoint;
  fov_arcsec: number;
  exposure_s: number | null;
  flags: FrameFlag[];
}

export interface Frame extends FrameMeta { png_url: string }

export interface FramesResponse {
  center: SkyPoint;
  fov_arcsec: number;
  total: number;
  limit: number;
  offset: number;
  frames: FrameMeta[];
  partial: boolean;
  warnings: string[];
  cache: CacheStatus;
}

export interface SequenceResult {
  center: SkyPoint;
  fov_arcsec: number;
  size_px: number;
  scale: Scale;
  vmin: number | null;
  vmax: number | null;
  unit: 'MJy/sr';
  total: number;
  limit: number;
  offset: number;
  frames: Frame[];
}

export interface StackResult {
  op: StackOp;
  n_frames: number;
  center: SkyPoint;
  fov_arcsec: number;
  size_px: number;
  vmin: number;
  vmax: number;
  unit: 'MJy/sr';
  png_url: string;
}

export interface PredictResult {
  target: string;
  method: 'proper_motion' | 'ephemeris';
  pm_mas_yr: ProperMotion | null;
  positions: { date: string; ra: number; dec: number; sigma_arcsec: number }[];
}

export interface SpectrumPoint {
  wavelength: number;
  flux: number;
  error: number | null;
  date_obs: string;
  detector: Detector;
  frame_id: string;
  flags: FrameFlag[];
}

export interface SpectrumResponse {
  center: SkyPoint;
  aperture_arcsec: number;
  wavelength_unit: 'um';
  flux_unit: 'uJy';
  points: SpectrumPoint[];
  partial: boolean;
  warnings: string[];
  cache: CacheStatus;
}

export interface OverlaySource { id: string; ra: number; dec: number; mag: number | null; pm: ProperMotion | null }

export interface OverlayResponse {
  catalog: Catalog;
  center: SkyPoint;
  fov_arcsec: number;
  epoch: number;
  sources: OverlaySource[];
  partial: boolean;
  warnings: string[];
  cache: CacheStatus;
}

export interface CoverageResponse {
  center: SkyPoint;
  first_date: string | null;
  last_date: string | null;
  weeks: { week_start: string; count: number }[];
}

export interface StatusResponse {
  status: 'ok' | 'degraded' | 'down';
  version: string;
  data_release: string;
  sources: Record<string, { ok: boolean; latency_ms?: number | null; last_error?: string | null }>;
}

export interface Job<T = unknown> {
  id: string;
  kind: 'sequence' | 'predict' | 'stack' | 'spectrum';
  status: 'queued' | 'running' | 'done' | 'failed';
  progress: number;
  eta_s: number | null;
  stage: string;
  queue_position: number;
  poll_after_ms: number;
  created_at: string;
  result: T | null;
  error: ErrorDetail | null;
}

export interface RegionParams {
  ra: number;
  dec: number;
  fov: number;
  detector?: Detector;
  date_from?: string;
  date_to?: string;
}
export type FramesParams = RegionParams & { limit?: number; offset?: number };
export type SequenceParams = RegionParams & { size?: number; stretch?: Stretch; cmap?: Cmap; scale?: Scale; limit?: number; offset?: number };
export interface StackParams { ra: number; dec: number; fov: number; size?: number; stretch?: Stretch; cmap?: Cmap; op: StackOp; a: string[]; b?: string[] }
export interface PredictParams { ra: number; dec: number; name?: string; date_from: string; date_to: string }
export interface SpectrumParams { ra: number; dec: number; aperture?: number; date_from?: string; date_to?: string }
export interface OverlayParams { ra: number; dec: number; fov: number; catalog: Catalog; at?: string }

export interface Api {
  resolve(p: { name: string; at?: string }): Promise<ResolveResponse>;
  objects(p: { ra: number; dec: number; radius?: number }): Promise<ObjectsResponse>;
  frames(p: FramesParams): Promise<FramesResponse>;
  sequence(p: SequenceParams): Promise<Started<SequenceResult>>;
  stack(p: StackParams): Promise<Started<StackResult>>;
  predict(p: PredictParams): Promise<Started<PredictResult>>;
  spectrum(p: SpectrumParams): Promise<Started<SpectrumResponse>>;
  overlay(p: OverlayParams): Promise<OverlayResponse>;
  coverage(p: { ra: number; dec: number; detector?: Detector }): Promise<CoverageResponse>;
  status(): Promise<StatusResponse>;
  job(id: string): Promise<Job>;
}
