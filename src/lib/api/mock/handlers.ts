// AI-assisted development used for code development, debugging and documentation.
// Tool: ChatGPT, Claude
// Mocks de la API v0.3 dentro del navegador. Respetan el contrato: trabajos con 202 y progreso,
// png_url opacas, posición propagada, escala de brillo compartida, paginación y errores.
import { separationArcsec, type SkyPoint } from '../../coords';
import type { Started } from '../../jobs';
import { decimalYear } from '../../projection';
import {
  ApiError, type Api, type Cmap, type CoverageResponse, type Detector, type ErrorDetail, type Frame, type FrameFlag,
  type FrameMeta, type FramesParams, type Job, type ObjectType, type OverlaySource, type PredictResult, type Scale,
  type SequenceResult, type SkyObject, type SpectrumPoint, type SpectrumResponse, type StackResult, type Stretch,
} from '../types';
import { gauss, hash, rng } from './rng';
import {
  DATA_RELEASE, DAY_MS, DETECTORS, DETECTOR_BANDS, TARGETS, fieldSources, findTarget, fluxAt, positionAt, surveyPasses,
  type SkySource,
} from './sky';
import { combine, divergingLimit, limits, simulate, toRGBA } from './synth';

export type MockMode = 'normal' | 'slow' | 'fail' | 'partial' | 'empty';
const MODES: MockMode[] = ['normal', 'slow', 'fail', 'partial', 'empty'];

let forced: MockMode | null = null;
/** Fuerza un modo de prueba. null vuelve al modo de la URL (?mock=) o a 'normal'. */
export function setMockMode(m: MockMode | null): void {
  forced = m;
}
export function mockMode(): MockMode {
  if (forced) return forced;
  if (typeof location !== 'undefined') {
    const m = new URLSearchParams(location.search).get('mock') as MockMode | null;
    if (m && MODES.includes(m)) return m;
  }
  return 'normal';
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const latency = () => wait(mockMode() === 'slow' ? 900 : 120);
const stepMs = () => (mockMode() === 'slow' ? 400 : 45);
const key4 = (n: number) => Math.round(n * 1e4) / 1e4;
const dayStart = (d: string) => Date.parse(`${d}T00:00:00Z`);
const dayEnd = (d: string) => Date.parse(`${d}T23:59:59.999Z`);
const iso = (t: number) => new Date(t).toISOString();

// ---------------- frames ----------------

interface Visit { t: number; det: Detector }

const FRAME_ID = /^sx-d([1-6])-(\d+)$/;
export const frameId = (det: Detector, t: number) => `sx-d${det}-${t}`;
export function parseFrameId(id: string): Visit | null {
  const m = FRAME_ID.exec(id);
  return m ? { det: Number(m[1]) as Detector, t: Number(m[2]) } : null;
}

/** Cada visita de SPHEREx a la región produce un frame por detector, con segundos de diferencia. */
function visitsFor(center: SkyPoint, p: { detector?: Detector; date_from?: string; date_to?: string }): Visit[] {
  if (mockMode() === 'empty') return [];
  const from = p.date_from ? dayStart(p.date_from) : -Infinity;
  const to = p.date_to ? dayEnd(p.date_to) : Infinity;
  const dets = p.detector ? [p.detector] : DETECTORS;
  const out: Visit[] = [];
  for (const pass of surveyPasses(center)) {
    for (const visit of pass.visits) {
      for (const det of dets) {
        const t = visit + det * 37_000;
        if (t >= from && t <= to) out.push({ t, det });
      }
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

function bandOf(v: Visit): number {
  const b = DETECTOR_BANDS[v.det];
  return Math.round((b.from + rng(hash('band', v.det, v.t))() * (b.to - b.from)) * 1000) / 1000;
}

export function frameFlags(center: SkyPoint, fov: number, v: Visit): FrameFlag[] {
  const flags: FrameFlag[] = [];
  const x = rng(hash('flags', key4(center.ra), key4(center.dec), v.det, v.t))();
  if (x < 0.04) flags.push('cosmic_ray');
  else if (x < 0.07) flags.push('stray_light');
  else if (x < 0.09) flags.push('low_snr');
  else if (x < 0.1) flags.push('edge');
  const bright = TARGETS.some((t) => t.mag < 3 && separationArcsec(positionAt(t, v.t)!, center) < fov / 2);
  if (bright) flags.push('saturation');
  return flags;
}

function frameMeta(center: SkyPoint, fov: number, v: Visit): FrameMeta {
  return {
    id: frameId(v.det, v.t), date_obs: iso(v.t), detector: v.det, band_um: bandOf(v),
    center, fov_arcsec: fov, exposure_s: 113.6, flags: frameFlags(center, fov, v),
  };
}

// ---------------- imágenes ----------------

const rawCache = new Map<string, Float32Array>();
function raw(center: SkyPoint, fov: number, size: number, v: Visit): Float32Array {
  const k = `${key4(center.ra)}|${key4(center.dec)}|${fov}|${size}|${v.det}|${v.t}`;
  let img = rawCache.get(k);
  if (!img) {
    img = simulate({ ra: center.ra, dec: center.dec, fov, det: v.det, t: v.t, size, flags: frameFlags(center, fov, v) });
    if (rawCache.size >= 300) rawCache.delete(rawCache.keys().next().value!);
    rawCache.set(k, img);
  }
  return img;
}

let pngCount = 0;
/**
 * En el navegador entrega el PNG como URL data: (codificación síncrona: toBlob y convertToBlob
 * dependen de tareas en segundo plano que el navegador frena cuando la pestaña no está al frente).
 * Sin canvas (pruebas), una URL simbólica.
 */
async function makePng(rgba: Uint8ClampedArray, size: number): Promise<string> {
  pngCount += 1;
  if (typeof document === 'undefined') return `blob:mock/${pngCount}`;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  c.getContext('2d')!.putImageData(new ImageData(rgba as Uint8ClampedArray<ArrayBuffer>, size, size), 0, 0);
  return c.toDataURL('image/png');
}

// ---------------- trabajos ----------------

const jobs = new Map<string, Job>();
const results = new Map<string, unknown>();
type Report = (done: number, total: number, stage: string) => void;

/** Vacía cachés y trabajos (solo para pruebas). */
export function resetMocks(): void {
  jobs.clear();
  results.clear();
  rawCache.clear();
  pngCount = 0;
}

function slow<T>(kind: Job['kind'], params: unknown, work: (report: Report) => Promise<T>): Started<T> {
  const mode = mockMode();
  const id = `${kind.slice(0, 3)}_${hash(kind, mode === 'empty' ? 'empty' : '', JSON.stringify(params)).toString(16).padStart(8, '0')}`;
  if (results.has(id)) return { kind: 'result', result: results.get(id) as T };

  let job = jobs.get(id);
  if (!job || job.status === 'failed') {
    const fresh: Job = {
      id, kind, status: 'queued', progress: 0, eta_s: null, stage: 'En cola', queue_position: 1,
      poll_after_ms: 200, created_at: iso(Date.now()), result: null, error: null,
    };
    job = fresh;
    jobs.set(id, fresh);
    const step = stepMs();
    const report: Report = (done, total, stage) => {
      fresh.progress = total ? Math.min(0.99, done / total) : 0.5;
      fresh.stage = stage;
      fresh.eta_s = Math.max(1, Math.ceil(((total - done) * step * 1.4) / 1000));
    };
    void (async () => {
      try {
        await wait(step * 2);
        fresh.status = 'running';
        fresh.queue_position = 0;
        fresh.stage = 'Consultando el archivo de SPHEREx';
        if (mode === 'fail') {
          await wait(step * 4);
          throw new ApiError(504, 'upstream_timeout', 'El archivo de SPHEREx no respondió a tiempo. Vuelve a intentarlo.');
        }
        const result = await work(report);
        results.set(id, result);
        Object.assign(fresh, { status: 'done', progress: 1, eta_s: 0, stage: 'Listo', result });
      } catch (e) {
        const err: ErrorDetail = e instanceof ApiError
          ? { code: e.code, message: e.message }
          : { code: 'upstream_error', message: 'El proceso falló por un error inesperado.' };
        Object.assign(fresh, { status: 'failed', error: err, eta_s: null, stage: 'Falló' });
      }
    })();
  }
  return { kind: 'job', job: { ...job } };
}

// ---------------- espectro ----------------

/** Brillo de una fuente a una longitud de onda, interpolando entre los centros de los detectores. */
function fluxAtUm(s: SkySource, um: number, t: number): number {
  const pts = DETECTORS.map((d) => ({ um: DETECTOR_BANDS[d].center, f: fluxAt(s, d, t) }));
  if (um <= pts[0].um) return pts[0].f;
  for (let i = 1; i < pts.length; i++) {
    if (um <= pts[i].um) {
      const k = (um - pts[i - 1].um) / (pts[i].um - pts[i - 1].um);
      return pts[i - 1].f + (pts[i].f - pts[i - 1].f) * k;
    }
  }
  return pts[pts.length - 1].f;
}

const OBJECT_TYPE: Record<SkySource['kind'], ObjectType> = {
  star: 'star', variable: 'star', galaxy: 'galaxy', brown_dwarf: 'other', asteroid: 'other',
};

// ---------------- API ----------------

export const mockApi: Api = {
  async resolve({ name, at }) {
    await latency();
    const t = findTarget(name);
    if (!t) throw new ApiError(404, 'not_found', `No encontramos "${name.trim()}" en SIMBAD ni en NED.`);
    const atMs = at ? dayStart(at) : Date.now();
    const now = positionAt(t, atMs)!;
    return {
      query: name, matched_name: t.name, ra: t.ra, dec: t.dec, source: 'simbad',
      epoch: t.epoch ?? 2000, pm: t.pm ?? null, parallax_mas: t.parallax_mas ?? null,
      current: { ra: now.ra, dec: now.dec, epoch: Math.round(decimalYear(new Date(atMs)) * 1000) / 1000 },
    };
  },

  // Búsqueda de cono sobre posiciones de catálogo, como haría SIMBAD/NED.
  async objects({ ra, dec, radius = 60 }) {
    await latency();
    const center = { ra, dec };
    const partial = mockMode() === 'partial';
    const objects: SkyObject[] = fieldSources(center, radius * 2)
      .filter((s) => s.catalog !== 'none' && !(partial && s.catalog === 'ned'))
      .map((s) => ({ s, d: separationArcsec(s, center) }))
      .filter((x) => x.d <= radius)
      .sort((a, b) => a.d - b.d)
      .slice(0, 200)
      .map(({ s, d }) => ({
        id: `${s.catalog}:${s.name}`, name: s.name, source: s.catalog as 'simbad' | 'ned', ra: s.ra, dec: s.dec,
        type: OBJECT_TYPE[s.kind], type_raw: s.type_raw, z: s.galaxy?.z ?? null, distance_arcsec: Math.round(d * 100) / 100,
      }));
    return {
      center, radius_arcsec: radius,
      counts: { simbad: objects.filter((o) => o.source === 'simbad').length, ned: objects.filter((o) => o.source === 'ned').length },
      objects, partial, warnings: partial ? ['NED no respondió a tiempo: solo se muestran objetos de SIMBAD.'] : [], cache: 'miss',
    };
  },

  async frames(p: FramesParams) {
    await latency();
    const center = { ra: p.ra, dec: p.dec };
    const limit = p.limit ?? 200;
    const offset = p.offset ?? 0;
    const all = visitsFor(center, p);
    return {
      center, fov_arcsec: p.fov, total: all.length, limit, offset,
      frames: all.slice(offset, offset + limit).map((v) => frameMeta(center, p.fov, v)),
      partial: false, warnings: [], cache: 'miss',
    };
  },

  async sequence(p) {
    const center = { ra: p.ra, dec: p.dec };
    const size = p.size ?? 512;
    const stretch: Stretch = p.stretch ?? 'asinh';
    const cmap: Cmap = p.cmap ?? 'gray';
    const scale: Scale = p.scale ?? 'sequence';
    const limit = p.limit ?? 60;
    const offset = p.offset ?? 0;
    const params = [key4(p.ra), key4(p.dec), p.fov, size, p.detector ?? 0, p.date_from ?? '', p.date_to ?? '', stretch, cmap, scale, limit, offset];
    return slow<SequenceResult>('sequence', params, async (report) => {
      const all = visitsFor(center, p);
      const page = all.slice(offset, offset + limit);
      const n = page.length;
      const raws: Float32Array[] = [];
      for (let i = 0; i < n; i++) {
        report(i, n * 2, `Descargando frames ${i + 1}/${n}`);
        raws.push(raw(center, p.fov, size, page[i]));
        // Pocos temporizadores: el navegador los frena a 1 s cuando la pestaña no está al frente.
        if (i % 4 === 3 || i === n - 1) await wait(stepMs() * 5.4);
      }
      const shared = scale === 'sequence' && n ? limits(raws) : null;
      const frames: Frame[] = [];
      for (let i = 0; i < n; i++) {
        report(n + i, n * 2, `Preparando frames ${i + 1}/${n}`);
        const l = shared ?? limits([raws[i]]);
        const png_url = await makePng(toRGBA(raws[i], stretch, cmap, l.vmin, l.vmax), size);
        frames.push({ ...frameMeta(center, p.fov, page[i]), png_url });
        if (i % 8 === 7) await wait(stepMs());
      }
      return {
        center, fov_arcsec: p.fov, size_px: size, scale, vmin: shared?.vmin ?? null, vmax: shared?.vmax ?? null,
        unit: 'MJy/sr', total: all.length, limit, offset, frames,
      };
    });
  },

  async stack(p) {
    const a = p.a.map(parseFrameId).filter((v): v is Visit => !!v);
    const b = (p.b ?? []).map(parseFrameId).filter((v): v is Visit => !!v);
    if (p.op === 'diff' && !p.b?.length) throw new ApiError(400, 'bad_request', 'Para restar hace falta la lista b.');
    if (!a.length || (p.op === 'diff' && !b.length)) throw new ApiError(404, 'not_found', 'No encontramos alguno de los frames pedidos.');
    const center = { ra: p.ra, dec: p.dec };
    const size = p.size ?? 512;
    const stretch: Stretch = p.stretch ?? 'asinh';
    const cmap: Cmap = p.cmap ?? 'gray';
    const params = [key4(p.ra), key4(p.dec), p.fov, size, stretch, cmap, p.op, p.a.join(','), (p.b ?? []).join(',')];
    return slow<StackResult>('stack', params, async (report) => {
      const all = [...a, ...b];
      const load = async (list: Visit[], from: number) => {
        const out: Float32Array[] = [];
        for (let i = 0; i < list.length; i++) {
          report(from + i, all.length + 1, `Descargando frames ${from + i + 1}/${all.length}`);
          out.push(raw(center, p.fov, size, list[i]));
          await wait(stepMs());
        }
        return out;
      };
      const A = await load(a, 0);
      const B = await load(b, a.length);
      report(all.length, all.length + 1, p.op === 'diff' ? 'Restando imágenes' : 'Apilando imágenes');
      let data: Float32Array;
      let vmin: number;
      let vmax: number;
      if (p.op === 'diff') {
        data = combine(A, 'mean');
        const sub = combine(B, 'mean');
        for (let i = 0; i < data.length; i++) data[i] -= sub[i];
        vmax = divergingLimit(data);
        vmin = -vmax;
      } else {
        data = combine(A, p.op);
        ({ vmin, vmax } = limits([data]));
      }
      const png_url = await makePng(toRGBA(data, stretch, cmap, vmin, vmax, p.op === 'diff'), size);
      return { op: p.op, n_frames: all.length, center, fov_arcsec: p.fov, size_px: size, vmin, vmax, unit: 'MJy/sr', png_url };
    });
  },

  async predict(p) {
    const center = { ra: p.ra, dec: p.dec };
    const params = [key4(p.ra), key4(p.dec), p.name ?? '', p.date_from, p.date_to];
    return slow<PredictResult>('predict', params, async (report) => {
      report(0, 2, 'Buscando el movimiento propio');
      await wait(stepMs() * 3);
      const mid = (dayStart(p.date_from) + dayEnd(p.date_to)) / 2;
      const moving = (s: SkySource) => !!s.pm && Math.hypot(s.pm.ra, s.pm.dec) > 200;
      const target: SkySource | undefined = (p.name ? findTarget(p.name) : undefined)
        ?? fieldSources(center, 600)
          .filter(moving)
          .map((s) => ({ s, d: separationArcsec(positionAt(s, mid)!, center) }))
          .sort((x, y) => x.d - y.d)[0]?.s;
      if (!target?.pm) return { target: p.name ?? '', method: 'proper_motion', pm_mas_yr: null, positions: [] };
      report(1, 2, 'Calculando posiciones');
      await wait(stepMs() * 3);
      const from = dayStart(p.date_from);
      const to = dayEnd(p.date_to);
      const times = surveyPasses(center).flatMap((x) => x.visits).filter((t) => t >= from && t <= to).slice(0, 300);
      const epoch = target.epoch ?? 2000;
      return {
        target: target.name, method: 'proper_motion', pm_mas_yr: target.pm,
        positions: times.map((t) => {
          const pos = positionAt(target, t)!;
          return { date: iso(t), ra: pos.ra, dec: pos.dec, sigma_arcsec: Math.round((0.05 + (decimalYear(new Date(t)) - epoch) * 0.004) * 1000) / 1000 };
        }),
      };
    });
  },

  async spectrum(p) {
    const center = { ra: p.ra, dec: p.dec };
    const aperture = p.aperture ?? 6;
    const params = [key4(p.ra), key4(p.dec), aperture, p.date_from ?? '', p.date_to ?? ''];
    return slow<SpectrumResponse>('spectrum', params, async (report) => {
      let visits = visitsFor(center, p);
      const MAX = 240;
      if (visits.length > MAX) {
        const stride = visits.length / MAX;
        visits = Array.from({ length: MAX }, (_, i) => visits[Math.floor(i * stride)]);
      }
      const sources = fieldSources(center, Math.max(120, aperture * 6));
      const width = Math.max(2.63, aperture / 1.5); // ancho efectivo: PSF de SPHEREx o la apertura
      const points: SpectrumPoint[] = [];
      for (let i = 0; i < visits.length; i++) {
        if (i % 20 === 0) {
          report(i, visits.length, `Midiendo exposiciones ${i + 1}/${visits.length}`);
          await wait(stepMs());
        }
        const v = visits[i];
        const um = bandOf(v);
        let flux = 0;
        for (const s of sources) {
          const pos = positionAt(s, v.t);
          if (!pos) continue;
          const d = separationArcsec(pos, center);
          if (d > width * 4) continue;
          flux += fluxAtUm(s, um, v.t) * Math.exp(-0.5 * (d / width) ** 2);
        }
        const r = rng(hash('spec', key4(p.ra), key4(p.dec), v.det, v.t));
        const uJy = flux * 250;
        const error = 6 + 0.03 * uJy;
        points.push({
          wavelength: um, flux: Math.round((uJy + gauss(r) * error) * 100) / 100, error: Math.round(error * 100) / 100,
          date_obs: iso(v.t), detector: v.det, frame_id: frameId(v.det, v.t), flags: frameFlags(center, 300, v),
        });
      }
      points.sort((x, y) => x.wavelength - y.wavelength);
      return { center, aperture_arcsec: aperture, wavelength_unit: 'um', flux_unit: 'uJy', points, partial: false, warnings: [], cache: 'miss' };
    });
  },

  async overlay({ ra, dec, fov, catalog, at }) {
    await latency();
    const center = { ra, dec };
    const atMs = at ? dayStart(at) : Date.now();
    const partial = mockMode() === 'partial' && catalog === 'wise';
    const half = fov / 2;
    const sources: OverlaySource[] = [];
    if (!partial) {
      for (const s of fieldSources(center, fov)) {
        if (s.kind === 'asteroid') continue;
        if (catalog === 'gaia' && (s.kind === 'galaxy' || s.kind === 'brown_dwarf' || s.mag > 17.5)) continue;
        if (catalog === 'wise' && s.mag > 16) continue;
        const pos = positionAt(s, atMs)!;
        const dDec = (pos.dec - dec) * 3600;
        const dRa = separationArcsec({ ra: pos.ra, dec }, { ra, dec });
        if (Math.abs(dDec) > half || dRa > half) continue;
        const mag = catalog === 'gaia' ? s.mag + 2.2 + s.color : s.mag - 0.3 * s.color;
        sources.push({
          id: `${catalog === 'gaia' ? 'Gaia DR3' : 'CatWISE'} ${hash(catalog, s.id)}`,
          ra: pos.ra, dec: pos.dec, mag: Math.round(mag * 100) / 100, pm: s.pm ?? null,
        });
      }
    }
    return {
      catalog, center, fov_arcsec: fov, epoch: Math.round(decimalYear(new Date(atMs)) * 1000) / 1000, sources,
      partial, warnings: partial ? ['WISE no respondió a tiempo.'] : [], cache: 'miss',
    };
  },

  async coverage({ ra, dec, detector }): Promise<CoverageResponse> {
    await latency();
    const center = { ra, dec };
    const visits = visitsFor(center, { detector });
    const weeks = new Map<string, number>();
    for (const v of visits) {
      const d = new Date(v.t);
      const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7)));
      const k = monday.toISOString().slice(0, 10);
      weeks.set(k, (weeks.get(k) ?? 0) + 1);
    }
    return {
      center,
      first_date: visits.length ? iso(visits[0].t).slice(0, 10) : null,
      last_date: visits.length ? iso(visits[visits.length - 1].t).slice(0, 10) : null,
      weeks: [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week_start, count]) => ({ week_start, count })),
    };
  },

  async status() {
    await latency();
    const partial = mockMode() === 'partial';
    return {
      status: partial ? 'degraded' : 'ok', version: '0.3.0-simulada', data_release: DATA_RELEASE,
      sources: {
        spherex: { ok: true, latency_ms: 180, last_error: null },
        simbad: { ok: true, latency_ms: 90, last_error: null },
        ned: partial ? { ok: false, latency_ms: null, last_error: 'Tiempo de espera agotado' } : { ok: true, latency_ms: 140, last_error: null },
        gaia: { ok: true, latency_ms: 210, last_error: null },
        wise: partial ? { ok: false, latency_ms: null, last_error: 'Tiempo de espera agotado' } : { ok: true, latency_ms: 160, last_error: null },
      },
    };
  },

  async job(id) {
    await wait(30);
    const job = jobs.get(id);
    if (!job) throw new ApiError(404, 'not_found', 'Ese trabajo ya no existe. Vuelve a lanzar la consulta.');
    return { ...job };
  },
};

export { DAY_MS };
