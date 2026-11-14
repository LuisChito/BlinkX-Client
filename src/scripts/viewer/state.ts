// Estado del visor y las acciones que lo cambian. Sin DOM: los módulos de interfaz se suscriben.
import {
  api, ApiError, type CoverageResponse, type Detector, type Frame, type Job, type ObjectsResponse, type OverlayResponse,
  type PredictResult, type ResolveResponse, type SpectrumResponse, type StatusResponse,
} from '../../lib/api';
import { formatDec, formatRA, parseCoords, type SkyPoint } from '../../lib/coords';
import { isAbort, runJob } from '../../lib/jobs';
import { createStore } from '../../lib/store';
import { DEFAULT_STATE, type ViewMode, type ViewState } from '../../lib/url';
import { passGroups, passOf } from './timeline';

export type PanelId = 'tiempo' | 'comparar' | 'imagen' | 'capas' | 'datos';
export type LayerId = 'objects' | 'gaia' | 'wise' | 'prediction' | 'reticle';
export interface Target { ra: number; dec: number; label: string; catalog?: ResolveResponse }
export interface Async<T> { status: 'idle' | 'loading' | 'ready' | 'error'; data: T | null; job: Job | null; error: string | null }
const idle = <T>(): Async<T> => ({ status: 'idle', data: null, job: null, error: null });

export interface ViewerState {
  view: ViewState;
  target: Target | null;
  phase: 'idle' | 'resolving' | 'not-found' | 'loading' | 'ready' | 'empty' | 'error';
  error: string | null;
  job: Job | null;
  frames: Frame[];
  total: number;
  seq: { size_px: number; vmin: number | null; vmax: number | null } | null;
  loadingMore: boolean;
  idx: number;
  /** A = imagen de referencia reciente, B = imagen antigua. */
  ab: [number, number];
  blinkOn: boolean;
  playing: boolean;
  speed: 1 | 2 | 4;
  panel: PanelId | null;
  layers: Record<LayerId, boolean>;
  picked: SkyPoint | null;
  objects: ObjectsResponse | null;
  prediction: PredictResult | null;
  coverage: CoverageResponse | null;
  gaia: OverlayResponse | null;
  wise: OverlayResponse | null;
  still: Async<{ url: string; label: string }>;
  spectrum: Async<SpectrumResponse>;
  status: StatusResponse | null;
}

/** Tamaño de los PNG y frames por página. Las pruebas los reducen. */
export const config = { size: 512, limit: 60 };

const initial = (view: ViewState = { ...DEFAULT_STATE }): ViewerState => ({
  view, target: null, phase: 'idle', error: null, job: null,
  frames: [], total: 0, seq: null, loadingMore: false,
  idx: 0, ab: [0, 0], blinkOn: false, playing: false, speed: 2,
  panel: null, layers: { objects: false, gaia: false, wise: false, prediction: true, reticle: true },
  picked: null, objects: null, prediction: null, coverage: null, gaia: null, wise: null,
  still: idle(), spectrum: idle(), status: null,
});

export const store = createStore<ViewerState>(initial());

/** El contrato permite "todos los detectores"; el visor siempre muestra uno para que el video sea coherente. */
export function effectiveDetector(view: ViewState): Detector {
  return view.det ?? 3;
}

const today = () => new Date().toISOString().slice(0, 10);
const message = (e: unknown) => (e instanceof ApiError ? e.message : 'Algo salió mal. Vuelve a intentarlo.');

let regionToken = 0; // cambia con cada región o búsqueda: descarta respuestas viejas
let seqCtl: AbortController | null = null;
let stillCtl: AbortController | null = null;
let specCtl: AbortController | null = null;

function cancelAll(): void {
  seqCtl?.abort();
  stillCtl?.abort();
  specCtl?.abort();
}

export function resetState(view?: ViewState): void {
  cancelAll();
  regionToken += 1;
  store.set(initial(view));
}

function seqParams(s: ViewerState, offset: number) {
  const { view, target } = s;
  return {
    ra: target!.ra, dec: target!.dec, fov: view.fov, detector: effectiveDetector(view),
    date_from: view.from, date_to: view.to, size: config.size, stretch: view.stretch, cmap: view.cmap,
    scale: view.scale, limit: config.limit, offset,
  };
}

/** Carga la secuencia de la región actual. Cancela la carga anterior. */
export async function loadSequence(): Promise<void> {
  const s = store.get();
  if (!s.target) return;
  seqCtl?.abort();
  stillCtl?.abort();
  const ctl = new AbortController();
  seqCtl = ctl;
  const token = regionToken;
  store.set({ phase: 'loading', error: null, job: null, playing: false, blinkOn: false, still: idle() });
  try {
    const p = seqParams(s, 0);
    const res = await runJob(() => api.sequence(p), api.job, {
      signal: ctl.signal,
      onProgress: (job) => { if (!ctl.signal.aborted) store.set({ job }); },
    });
    if (ctl.signal.aborted || token !== regionToken) return;
    const groups = passGroups(res.frames);
    const lastPassStart = groups.length > 1 ? groups[groups.length - 1][0] : Math.max(0, res.frames.length - 1);
    store.set({
      frames: res.frames, total: res.total, seq: { size_px: res.size_px, vmin: res.vmin, vmax: res.vmax },
      phase: res.frames.length ? 'ready' : 'empty', job: null, idx: 0, ab: [lastPassStart, 0],
    });
    const mode = store.get().view.mode;
    if (res.frames.length && (mode === 'diff' || mode === 'stack')) await loadStill();
  } catch (e) {
    if (isAbort(e) || ctl.signal.aborted || token !== regionToken) return;
    store.set({ phase: 'error', error: message(e), job: null, frames: [], total: 0 });
  }
}

/** Pide la siguiente página de frames y la añade al final. */
export async function loadMore(): Promise<void> {
  const s = store.get();
  if (!s.target || s.loadingMore || s.frames.length >= s.total) return;
  const ctl = seqCtl ?? new AbortController();
  seqCtl = ctl;
  const token = regionToken;
  store.set({ loadingMore: true });
  try {
    const p = seqParams(s, s.frames.length);
    const res = await runJob(() => api.sequence(p), api.job, { signal: ctl.signal });
    if (ctl.signal.aborted || token !== regionToken) return;
    const known = new Set(store.get().frames.map((f) => f.id));
    store.set({ frames: [...store.get().frames, ...res.frames.filter((f) => !known.has(f.id))], total: res.total, loadingMore: false });
  } catch (e) {
    if (token === regionToken) store.set({ loadingMore: false });
    if (!isAbort(e) && token === regionToken) store.set({ error: message(e) });
  }
}

/** Objetos de catálogo, predicción, cobertura y estado de las fuentes: nada de esto bloquea la imagen. */
function loadSide(): void {
  const s = store.get();
  if (!s.target) return;
  const { ra, dec, label, catalog } = s.target;
  const token = regionToken;
  const fresh = () => token === regionToken;
  const radius = Math.min(600, Math.round((s.view.fov / 2) * 1.15));

  api.objects({ ra, dec, radius }).then((objects) => { if (fresh()) store.set({ objects }); }).catch(() => { if (fresh()) store.set({ objects: null }); });
  api.coverage({ ra, dec, detector: effectiveDetector(s.view) }).then((coverage) => { if (fresh()) store.set({ coverage }); }).catch(() => undefined);
  if (!s.status) api.status().then((status) => store.set({ status })).catch(() => undefined);

  const ctl = new AbortController();
  const name = catalog ? label : undefined;
  runJob(() => api.predict({ ra, dec, name, date_from: s.view.from ?? '2025-05-01', date_to: s.view.to ?? today() }), api.job, { signal: ctl.signal })
    .then((prediction) => { if (fresh()) store.set({ prediction }); })
    .catch(() => undefined);

  for (const cat of ['gaia', 'wise'] as const) if (s.layers[cat]) loadOverlay(cat);
}

function loadOverlay(catalog: 'gaia' | 'wise'): void {
  const s = store.get();
  if (!s.target) return;
  const token = regionToken;
  const frame = s.frames[s.idx];
  const at = (frame?.date_obs ?? new Date().toISOString()).slice(0, 10);
  api.overlay({ ra: s.target.ra, dec: s.target.dec, fov: s.view.fov, catalog, at })
    .then((r) => { if (token === regionToken) store.set(catalog === 'gaia' ? { gaia: r } : { wise: r }); })
    .catch(() => undefined);
}

function clearRegion(): void {
  store.set({
    frames: [], total: 0, seq: null, idx: 0, ab: [0, 0], playing: false, blinkOn: false, picked: null,
    objects: null, prediction: null, coverage: null, gaia: null, wise: null, still: idle(), spectrum: idle(), job: null, error: null,
  });
}

/** Busca por nombre o por coordenadas y carga la región. */
export async function search(query: string): Promise<void> {
  const q = query.trim();
  if (!q) return;
  cancelAll();
  const token = ++regionToken;
  clearRegion();
  const base = { ...store.get().view, from: undefined, to: undefined };

  const coords = parseCoords(q);
  if (coords) {
    store.set({ view: { ...base, name: undefined }, target: { ...coords, label: `${formatRA(coords.ra)} ${formatDec(coords.dec)}` } });
  } else {
    store.set({ view: { ...base, name: q }, target: null, phase: 'resolving' });
    try {
      const r = await api.resolve({ name: q, at: today() });
      if (token !== regionToken) return;
      // La vista se centra en la posición propagada: una estrella rápida ya no está donde dice el catálogo.
      store.set({ target: { ra: r.current.ra, dec: r.current.dec, label: r.matched_name, catalog: r } });
    } catch (e) {
      if (token !== regionToken) return;
      const notFound = e instanceof ApiError && e.code === 'not_found';
      store.set({ phase: notFound ? 'not-found' : 'error', error: message(e) });
      return;
    }
  }
  loadSide();
  await loadSequence();
}

/** Abre una región dada por la URL (coordenadas ya conocidas). */
export async function openRegion(target: Target): Promise<void> {
  cancelAll();
  regionToken += 1;
  clearRegion();
  store.set({ target });
  loadSide();
  await loadSequence();
}

const RELOAD_KEYS: (keyof ViewState)[] = ['fov', 'det', 'from', 'to', 'stretch', 'cmap', 'scale'];

/** Cambia parámetros de la vista. Recarga la secuencia si el cambio afecta a las imágenes. */
export async function setView(patch: Partial<ViewState>): Promise<void> {
  const prev = store.get().view;
  const view = { ...prev, ...patch };
  store.set({ view });
  if (!store.get().target) return;
  if (!RELOAD_KEYS.some((k) => prev[k] !== view[k])) return;
  if (prev.fov !== view.fov || prev.det !== view.det || prev.from !== view.from || prev.to !== view.to) {
    store.set({ gaia: null, wise: null });
    loadSide();
  }
  await loadSequence();
}

/** Cambia de modo. Resta y Apilar piden una imagen calculada. */
export async function setMode(mode: ViewMode): Promise<void> {
  stillCtl?.abort();
  store.set({ view: { ...store.get().view, mode }, playing: false, blinkOn: false, still: idle() });
  if (mode === 'diff' || mode === 'stack') await loadStill();
}

export async function loadStill(): Promise<void> {
  const s = store.get();
  const { frames, view, target } = s;
  if (!target || !frames.length || (view.mode !== 'diff' && view.mode !== 'stack')) return;
  stillCtl?.abort();
  const ctl = new AbortController();
  stillCtl = ctl;
  const token = regionToken;

  let params: { op: 'diff' | 'mean'; a: string[]; b?: string[] };
  let label: string;
  if (view.mode === 'diff') {
    params = { op: 'diff', a: [frames[s.ab[0]].id], b: [frames[s.ab[1]].id] };
    label = 'Resta A − B';
  } else {
    const groups = passGroups(frames);
    const ids = (groups[passOf(groups, s.idx)] ?? [s.idx]).map((i) => frames[i].id).slice(0, 100);
    params = { op: 'mean', a: ids };
    label = `Pasada apilada · ${ids.length} ${ids.length === 1 ? 'imagen' : 'imágenes'}`;
  }
  store.set({ still: { status: 'loading', data: null, job: null, error: null } });
  try {
    const res = await runJob(
      () => api.stack({ ra: target.ra, dec: target.dec, fov: view.fov, size: config.size, stretch: view.stretch, cmap: view.cmap, ...params }),
      api.job,
      { signal: ctl.signal, onProgress: (job) => { if (!ctl.signal.aborted) store.set({ still: { status: 'loading', data: null, job, error: null } }); } },
    );
    if (ctl.signal.aborted || token !== regionToken) return;
    store.set({ still: { status: 'ready', data: { url: res.png_url, label }, job: null, error: null } });
  } catch (e) {
    if (isAbort(e) || ctl.signal.aborted || token !== regionToken) return;
    store.set({ still: { status: 'error', data: null, job: null, error: message(e) } });
  }
}

/** Elige un punto del cielo y pide su espectro. */
export async function pick(point: SkyPoint): Promise<void> {
  specCtl?.abort();
  const ctl = new AbortController();
  specCtl = ctl;
  const token = regionToken;
  const { view } = store.get();
  store.set({ picked: point, spectrum: { status: 'loading', data: null, job: null, error: null } });
  try {
    const data = await runJob(
      () => api.spectrum({ ra: point.ra, dec: point.dec, aperture: 6, date_from: view.from, date_to: view.to }),
      api.job,
      { signal: ctl.signal, onProgress: (job) => { if (!ctl.signal.aborted) store.set({ spectrum: { status: 'loading', data: null, job, error: null } }); } },
    );
    if (ctl.signal.aborted || token !== regionToken) return;
    store.set({ spectrum: { status: 'ready', data, job: null, error: null } });
  } catch (e) {
    if (isAbort(e) || ctl.signal.aborted || token !== regionToken) return;
    store.set({ spectrum: { status: 'error', data: null, job: null, error: message(e) } });
  }
}

export function setLayer(id: LayerId, on: boolean): void {
  const s = store.get();
  store.set({ layers: { ...s.layers, [id]: on } });
  if (on && (id === 'gaia' || id === 'wise') && !s[id]) loadOverlay(id);
}

/** Cancela la carga en curso (botón "Cancelar" de la tarjeta de progreso). */
export function cancelSequence(): void {
  seqCtl?.abort();
  const s = store.get();
  store.set({ phase: s.frames.length ? 'ready' : 'idle', job: null });
}
