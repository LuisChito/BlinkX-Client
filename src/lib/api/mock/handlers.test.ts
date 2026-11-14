import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { separationArcsec } from '../../coords';
import { runJob, type Started } from '../../jobs';
import { ApiError } from '../types';
import { mockApi, resetMocks, setMockMode } from './handlers';

const WISE = { ra: 133.795129, dec: -7.245147 };
const seqParams = { ...WISE, fov: 300, size: 64, detector: 6 as const, limit: 5 };

/** Avanza los temporizadores falsos hasta que la promesa termina. */
async function settle<T>(p: Promise<T>): Promise<T> {
  let done = false;
  const guarded = p.then(
    (v) => { done = true; return { ok: true as const, v }; },
    (e: unknown) => { done = true; return { ok: false as const, e }; },
  );
  for (let i = 0; i < 4000 && !done; i++) await vi.advanceTimersByTimeAsync(100);
  const r = await guarded;
  if (!r.ok) throw r.e;
  return r.v;
}

const run = <T>(start: () => Promise<Started<T>>) => settle(runJob(start, mockApi.job, { signal: new AbortController().signal }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.UTC(2026, 10, 14));
  resetMocks();
});
afterEach(() => {
  setMockMode(null);
  vi.useRealTimers();
});

describe('resolve', () => {
  it('devuelve la posición de catálogo y la propagada a la fecha pedida', async () => {
    const r = await settle(mockApi.resolve({ name: "Barnard's star", at: '2026-11-14' }));
    expect(r.epoch).toBe(2000);
    expect(r.pm).not.toBeNull();
    expect(r.source).toBe('simbad');
    expect((r.current.dec - r.dec) * 3600).toBeGreaterThan(250); // la vista debe centrarse en current
    expect(r.current.epoch).toBeCloseTo(2026.87, 1);
  });

  it('rechaza un nombre desconocido con not_found y un mensaje legible', async () => {
    const e = await settle(mockApi.resolve({ name: 'Estrella Falsa' })).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect(e).toMatchObject({ code: 'not_found', status: 404, message: 'No encontramos "Estrella Falsa" en SIMBAD ni en NED.' });
  });
});

describe('sequence', () => {
  it('responde con un trabajo la primera vez y con el resultado en caché la segunda', async () => {
    expect((await mockApi.sequence(seqParams)).kind).toBe('job');
    await run(() => mockApi.sequence(seqParams));
    expect((await mockApi.sequence(seqParams)).kind).toBe('result');
  });

  it('devuelve el mismo trabajo para la misma consulta', async () => {
    const a = await mockApi.sequence(seqParams);
    const b = await mockApi.sequence(seqParams);
    expect(a.kind === 'job' && b.kind === 'job' && a.job.id === b.job.id).toBe(true);
  });

  it('pagina, comparte la escala de brillo y entrega png_url opacas', async () => {
    const seq = await run(() => mockApi.sequence(seqParams));
    expect(seq.frames).toHaveLength(5);
    expect(seq.total).toBeGreaterThan(5);
    expect(seq.limit).toBe(5);
    expect(seq.size_px).toBe(64);
    expect(seq.scale).toBe('sequence');
    expect(seq.vmin!).toBeLessThan(seq.vmax!);
    expect(seq.unit).toBe('MJy/sr');
    expect(seq.frames.every((f) => f.detector === 6 && f.png_url.length > 0)).toBe(true);
    const dates = seq.frames.map((f) => f.date_obs);
    expect([...dates].sort()).toEqual(dates);
  });

  it('con scale=frame no devuelve límites compartidos', async () => {
    const seq = await run(() => mockApi.sequence({ ...seqParams, scale: 'frame' }));
    expect(seq.vmin).toBeNull();
    expect(seq.vmax).toBeNull();
  });

  it('la segunda página trae frames distintos', async () => {
    const p1 = await run(() => mockApi.sequence(seqParams));
    const p2 = await run(() => mockApi.sequence({ ...seqParams, offset: 5 }));
    expect(p2.frames[0].id).not.toBe(p1.frames[0].id);
    expect(p2.offset).toBe(5);
  });

  it('informa del progreso con una etapa legible', async () => {
    const stages: string[] = [];
    await settle(runJob(() => mockApi.sequence(seqParams), mockApi.job, { signal: new AbortController().signal, onProgress: (j) => stages.push(j.stage) }));
    expect(stages.some((s) => /frames \d+\/\d+/.test(s))).toBe(true);
  });
});

describe('frames', () => {
  it('filtra por fechas y cuenta el total', async () => {
    const all = await settle(mockApi.frames({ ...WISE, fov: 300 }));
    const some = await settle(mockApi.frames({ ...WISE, fov: 300, date_from: '2026-01-01' }));
    expect(some.total).toBeLessThan(all.total);
    expect(some.frames.every((f) => f.date_obs >= '2026-01-01')).toBe(true);
    expect(all.frames.length).toBeLessThanOrEqual(all.limit);
  });
});

describe('spectrum', () => {
  it('llega por trabajo, con un punto por exposición ordenado por longitud de onda', async () => {
    const sp = await run(() => mockApi.spectrum({ ...WISE }));
    expect(sp.points.length).toBeGreaterThan(20);
    expect(sp.points.every((q) => q.date_obs && q.frame_id && q.detector >= 1 && q.detector <= 6)).toBe(true);
    expect([...sp.points].sort((a, b) => a.wavelength - b.wavelength)).toEqual(sp.points);
    expect(sp.wavelength_unit).toBe('um');
    expect(sp.flux_unit).toBe('uJy');
  });
});

describe('stack', () => {
  it('resta dos frames con escala simétrica', async () => {
    const seq = await run(() => mockApi.sequence(seqParams));
    const st = await run(() => mockApi.stack({ ...WISE, fov: 300, size: 64, op: 'diff', a: [seq.frames[4].id], b: [seq.frames[0].id] }));
    expect(st.op).toBe('diff');
    expect(st.n_frames).toBe(2);
    expect(st.vmin).toBeCloseTo(-st.vmax, 12);
    expect(st.png_url.length).toBeGreaterThan(0);
  });

  it('rechaza una resta sin lista b', async () => {
    await expect(mockApi.stack({ ...WISE, fov: 300, op: 'diff', a: ['sx-d6-1'] })).rejects.toMatchObject({ code: 'bad_request' });
  });
});

describe('predict y overlay', () => {
  it('predice la posición del objeto con movimiento propio en cada fecha', async () => {
    const pr = await run(() => mockApi.predict({ ...WISE, name: 'WISE 0855', date_from: '2025-05-01', date_to: '2026-11-14' }));
    expect(pr.method).toBe('proper_motion');
    expect(pr.pm_mas_yr).toEqual({ ra: -8118, dec: 673 });
    expect(pr.positions.length).toBeGreaterThan(2);
    const first = pr.positions[0];
    const last = pr.positions[pr.positions.length - 1];
    expect(separationArcsec(first, last)).toBeGreaterThan(5);
  });

  it('propaga las fuentes de Gaia a la fecha pedida', async () => {
    const ov = await settle(mockApi.overlay({ ...WISE, fov: 300, catalog: 'gaia', at: '2026-05-01' }));
    expect(ov.epoch).toBeCloseTo(2026.33, 1);
    expect(ov.sources.length).toBeGreaterThan(3);
    expect(ov.sources.every((s) => 'pm' in s)).toBe(true);
  });
});

describe('modos de prueba', () => {
  it('empty: la región no tiene imágenes y nada falla', async () => {
    setMockMode('empty');
    expect((await settle(mockApi.frames({ ...WISE, fov: 300 }))).total).toBe(0);
    const seq = await run(() => mockApi.sequence(seqParams));
    expect(seq.frames).toEqual([]);
    expect(seq.total).toBe(0);
    expect((await settle(mockApi.coverage(WISE))).first_date).toBeNull();
  });

  it('fail: el trabajo termina en error', async () => {
    setMockMode('fail');
    await expect(run(() => mockApi.sequence(seqParams))).rejects.toBeInstanceOf(ApiError);
  });

  it('partial: avisa de la fuente que falló', async () => {
    setMockMode('partial');
    const o = await settle(mockApi.objects({ ...WISE, radius: 150 }));
    expect(o.partial).toBe(true);
    expect(o.warnings.length).toBeGreaterThan(0);
    expect((await settle(mockApi.status())).status).toBe('degraded');
  });
});

describe('job', () => {
  it('responde not_found para un trabajo que no existe', async () => {
    await expect(settle(mockApi.job('nada'))).rejects.toMatchObject({ code: 'not_found' });
  });
});
