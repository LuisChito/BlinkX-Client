// Procesos lentos del contrato: 200 con el resultado (caché) o 202 con un trabajo que se consulta.
import { ApiError, type Job } from './api/types';

export type Started<T> = { kind: 'result'; result: T } | { kind: 'job'; job: Job };

function abortError(): DOMException {
  return new DOMException('Operación cancelada', 'AbortError');
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(abortError());
    const onAbort = () => {
      clearTimeout(t);
      reject(abortError());
    };
    const t = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Arranca un proceso lento y espera su resultado.
 * Llama a onProgress con cada estado del trabajo, incluido el final.
 * Rechaza con ApiError si el trabajo falla y con AbortError si se cancela.
 */
export async function runJob<T>(
  start: () => Promise<Started<T>>,
  getJob: (id: string) => Promise<Job>,
  opts: { signal: AbortSignal; onProgress?: (j: Job) => void },
): Promise<T> {
  const { signal, onProgress } = opts;
  const first = await start();
  if (signal.aborted) throw abortError();
  if (first.kind === 'result') return first.result;

  let job = first.job;
  for (;;) {
    onProgress?.(job);
    if (job.status === 'done') return job.result as T;
    if (job.status === 'failed') {
      const e = job.error ?? { code: 'upstream_error' as const, message: 'El proceso falló.' };
      throw new ApiError(502, e.code, e.message);
    }
    await sleep(Math.max(100, job.poll_after_ms), signal);
    job = await getJob(job.id);
    if (signal.aborted) throw abortError();
  }
}

export function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError';
}
