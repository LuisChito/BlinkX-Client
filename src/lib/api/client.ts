// Cliente de la API real (contrato v0.3). Se activa con PUBLIC_USE_MOCKS=false.
import type { Started } from '../jobs';
import { ApiError, type Api, type ErrorDetail, type Job } from './types';

const BASE = String(import.meta.env?.PUBLIC_API_BASE ?? '').replace(/\/$/, '');

type Query = Record<string, string | number | string[] | undefined | null>;

function url(path: string, q: Query = {}): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    sp.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const qs = sp.toString();
  return `${BASE}${path}${qs ? `?${qs}` : ''}`;
}

async function request(path: string, q?: Query): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url(path, q), { headers: { Accept: 'application/json' } });
  } catch {
    throw new ApiError(0, 'upstream_error', 'No hay conexión con el servidor.');
  }
  if (!res.ok) {
    let body: { error?: ErrorDetail } | null = null;
    try {
      body = await res.json();
    } catch {
      /* respuesta sin cuerpo JSON */
    }
    throw new ApiError(res.status, body?.error?.code ?? 'upstream_error', body?.error?.message ?? `El servidor respondió con el error ${res.status}.`);
  }
  return res;
}

async function get<T>(path: string, q?: Query): Promise<T> {
  return (await request(path, q)).json() as Promise<T>;
}

/** Procesos lentos: 200 = resultado en caché, 202 = trabajo en curso. */
async function slow<T>(path: string, q: Query): Promise<Started<T>> {
  const res = await request(path, q);
  const body: unknown = await res.json();
  return res.status === 202 ? { kind: 'job', job: body as Job } : { kind: 'result', result: body as T };
}

/** Las rutas relativas que devuelve la API (png_url) se resuelven contra la base. */
export function absolute(u: string): string {
  return /^(https?:|data:|blob:)/.test(u) ? u : `${BASE}${u}`;
}

export const httpApi: Api = {
  resolve: (p) => get('/api/resolve', { ...p }),
  objects: (p) => get('/api/objects', { ...p }),
  frames: (p) => get('/api/frames', { ...p }),
  sequence: (p) => slow('/api/sequence', { ...p }),
  stack: (p) => slow('/api/stack', { ...p }),
  predict: (p) => slow('/api/predict', { ...p }),
  spectrum: (p) => slow('/api/spectrum', { ...p }),
  overlay: (p) => get('/api/overlay', { ...p }),
  coverage: (p) => get('/api/coverage', { ...p }),
  status: () => get('/api/status'),
  job: (id) => get(`/api/jobs/${encodeURIComponent(id)}`),
};
