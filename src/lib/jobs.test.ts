import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type Job } from './api/types';
import { isAbort, runJob, type Started } from './jobs';

const job = (over: Partial<Job>): Job => ({
  id: 'j1', kind: 'sequence', status: 'running', progress: 0.5, eta_s: 1, stage: 'Descargando', queue_position: 0,
  poll_after_ms: 500, created_at: '2026-11-14T10:00:00Z', result: null, error: null, ...over,
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('runJob', () => {
  it('devuelve el resultado directo cuando ya estaba en caché', async () => {
    const start = async (): Promise<Started<number>> => ({ kind: 'result', result: 7 });
    const getJob = vi.fn();
    await expect(runJob(start, getJob, { signal: new AbortController().signal })).resolves.toBe(7);
    expect(getJob).not.toHaveBeenCalled();
  });

  it('consulta el trabajo hasta que termina y avisa del progreso', async () => {
    const start = async (): Promise<Started<number>> => ({ kind: 'job', job: job({}) });
    const getJob = vi.fn()
      .mockResolvedValueOnce(job({ progress: 0.8 }))
      .mockResolvedValueOnce(job({ status: 'done', progress: 1, result: 42 }));
    const seen: number[] = [];
    const p = runJob(start, getJob, { signal: new AbortController().signal, onProgress: (j) => seen.push(j.progress) });
    await vi.advanceTimersByTimeAsync(1100);
    await expect(p).resolves.toBe(42);
    expect(seen).toEqual([0.5, 0.8, 1]);
  });

  it('rechaza con ApiError cuando el trabajo falla', async () => {
    const failed = job({ status: 'failed', error: { code: 'upstream_timeout', message: 'IRSA no respondió' } });
    const start = async (): Promise<Started<number>> => ({ kind: 'job', job: failed });
    const run = () => runJob(start, vi.fn(), { signal: new AbortController().signal });
    await expect(run()).rejects.toMatchObject({ code: 'upstream_timeout', message: 'IRSA no respondió' });
    await expect(run()).rejects.toBeInstanceOf(ApiError);
  });

  it('deja de consultar cuando se cancela a mitad del sondeo', async () => {
    const ctl = new AbortController();
    const start = async (): Promise<Started<number>> => ({ kind: 'job', job: job({}) });
    const getJob = vi.fn().mockResolvedValue(job({}));
    const caught = runJob(start, getJob, { signal: ctl.signal }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(600);
    const calls = getJob.mock.calls.length;
    expect(calls).toBeGreaterThan(0);
    ctl.abort();
    expect(isAbort(await caught)).toBe(true);
    await vi.advanceTimersByTimeAsync(5000);
    expect(getJob.mock.calls.length).toBe(calls);
  });
});
