// Estado del visor en la URL: cada vista tiene su propio enlace.
import type { Cmap, Detector, Scale, Stretch } from './api/types';

export type ViewMode = 'video' | 'blink' | 'diff' | 'stack';

export interface ViewState {
  ra?: number;
  dec?: number;
  name?: string;
  fov: number;
  /** Sin valor = todos los detectores. */
  det?: Detector;
  from?: string;
  to?: string;
  mode: ViewMode;
  stretch: Stretch;
  cmap: Cmap;
  scale: Scale;
  embed: boolean;
}

export const FOV_MIN = 30;
export const FOV_MAX = 3600;

export const DEFAULT_STATE: ViewState = {
  fov: 300,
  mode: 'video',
  stretch: 'asinh',
  cmap: 'gray',
  scale: 'sequence',
  embed: false,
};

const MODES: ViewMode[] = ['video', 'blink', 'diff', 'stack'];
const STRETCHES: Stretch[] = ['linear', 'log', 'sqrt', 'asinh'];
const CMAPS: Cmap[] = ['gray', 'viridis', 'magma', 'inferno'];
const SCALES: Scale[] = ['sequence', 'frame'];

function num(v: string | null): number | undefined {
  if (v === null || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Fecha AAAA-MM-DD que existe en el calendario. */
export function isDate(v: string | null | undefined): v is string {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

function oneOf<T extends string>(v: string | null, list: readonly T[]): T | undefined {
  return v !== null && (list as readonly string[]).includes(v) ? (v as T) : undefined;
}

export function readState(search: string): ViewState {
  const q = new URLSearchParams(search);
  const s: ViewState = { ...DEFAULT_STATE };

  const name = q.get('name')?.trim();
  if (name) s.name = name;

  const ra = num(q.get('ra'));
  const dec = num(q.get('dec'));
  if (ra !== undefined && dec !== undefined && ra >= 0 && ra < 360 && dec >= -90 && dec <= 90) {
    s.ra = ra;
    s.dec = dec;
  }

  const fov = num(q.get('fov'));
  if (fov !== undefined) s.fov = Math.round(Math.min(FOV_MAX, Math.max(FOV_MIN, fov)));

  const det = num(q.get('det'));
  if (det !== undefined && Number.isInteger(det) && det >= 1 && det <= 6) s.det = det as Detector;

  const from = q.get('from');
  const to = q.get('to');
  const fromOk = isDate(from);
  const toOk = isDate(to);
  // Un rango al revés no significa nada: se descarta entero.
  if (!(fromOk && toOk && from > to)) {
    if (fromOk) s.from = from;
    if (toOk) s.to = to;
  }

  s.mode = oneOf(q.get('mode'), MODES) ?? DEFAULT_STATE.mode;
  s.stretch = oneOf(q.get('stretch'), STRETCHES) ?? DEFAULT_STATE.stretch;
  s.cmap = oneOf(q.get('cmap'), CMAPS) ?? DEFAULT_STATE.cmap;
  s.scale = oneOf(q.get('scale'), SCALES) ?? DEFAULT_STATE.scale;
  s.embed = q.get('embed') === '1';
  return s;
}

export function writeState(s: ViewState): string {
  const q = new URLSearchParams();
  if (s.name) q.set('name', s.name);
  if (s.ra !== undefined && s.dec !== undefined) {
    q.set('ra', String(Math.round(s.ra * 1e6) / 1e6));
    q.set('dec', String(Math.round(s.dec * 1e6) / 1e6));
  }
  if (s.fov !== DEFAULT_STATE.fov) q.set('fov', String(s.fov));
  if (s.det !== undefined) q.set('det', String(s.det));
  if (s.from) q.set('from', s.from);
  if (s.to) q.set('to', s.to);
  if (s.mode !== DEFAULT_STATE.mode) q.set('mode', s.mode);
  if (s.stretch !== DEFAULT_STATE.stretch) q.set('stretch', s.stretch);
  if (s.cmap !== DEFAULT_STATE.cmap) q.set('cmap', s.cmap);
  if (s.scale !== DEFAULT_STATE.scale) q.set('scale', s.scale);
  if (s.embed) q.set('embed', '1');
  const str = q.toString();
  return str ? `?${str}` : '';
}
