import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { separationArcsec } from '../../lib/coords';
import { resetMocks, setMockMode } from '../../lib/api/mock/handlers';
import { config, effectiveDetector, loadMore, resetState, search, setView, store } from './state';

/** Avanza los temporizadores falsos hasta que la promesa termina. */
async function settle<T>(p: Promise<T>): Promise<T> {
  let done = false;
  const guarded = p.then(
    (v) => { done = true; return { ok: true as const, v }; },
    (e: unknown) => { done = true; return { ok: false as const, e }; },
  );
  for (let i = 0; i < 6000 && !done; i++) await vi.advanceTimersByTimeAsync(100);
  const r = await guarded;
  if (!r.ok) throw r.e;
  return r.v;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.UTC(2026, 10, 14));
  resetMocks();
  resetState();
  config.size = 64;
  config.limit = 6;
});
afterEach(() => {
  setMockMode(null);
  vi.useRealTimers();
});

describe('search', () => {
  it('centra la vista en la posición propagada, no en la de catálogo', async () => {
    await settle(search("Barnard's star"));
    const s = store.get();
    expect(s.phase).toBe('ready');
    expect(s.target!.label).toBe("Barnard's star");
    expect((s.target!.dec - s.target!.catalog!.dec) * 3600).toBeGreaterThan(250);
    expect(s.frames.length).toBe(6);
    expect(s.total).toBeGreaterThan(6);
  });

  it('acepta coordenadas sin consultar el resolvedor de nombres', async () => {
    await settle(search('08h55m10.831s -7d14m42.53s'));
    const s = store.get();
    expect(s.target!.ra).toBeCloseTo(133.795129, 5);
    expect(s.target!.catalog).toBeUndefined();
    expect(s.view.name).toBeUndefined();
    expect(s.phase).toBe('ready');
  });

  it('deja un mensaje claro cuando el nombre no existe', async () => {
    await settle(search('Estrella Falsa'));
    const s = store.get();
    expect(s.phase).toBe('not-found');
    expect(s.error).toBe('No encontramos "Estrella Falsa" en SIMBAD ni en NED.');
    expect(s.target).toBeNull();
  });

  it('descarta el resultado de una búsqueda anterior que seguía en curso', async () => {
    setMockMode('slow');
    const first = search("Barnard's star");
    await vi.advanceTimersByTimeAsync(2500); // ya resolvió el nombre y está descargando frames
    const second = search('WISE 0855');
    await settle(Promise.all([first, second]));
    const s = store.get();
    expect(s.target!.label).toBe('WISE 0855');
    expect(s.phase).toBe('ready');
    expect(s.frames.length).toBeGreaterThan(0);
    expect(s.frames.every((f) => separationArcsec(f.center, s.target!) < 1)).toBe(true);
  });

  it('marca la región como vacía cuando SPHEREx no tiene imágenes', async () => {
    setMockMode('empty');
    await settle(search('133.795129 -7.245147'));
    const s = store.get();
    expect(s.phase).toBe('empty');
    expect(s.frames).toEqual([]);
    expect(s.playing).toBe(false);
  });

  it('guarda el error cuando el trabajo falla', async () => {
    setMockMode('fail');
    await settle(search('133.795129 -7.245147'));
    expect(store.get().phase).toBe('error');
    expect(store.get().error).toMatch(/no respondió/);
  });
});

describe('vista', () => {
  it('usa el detector 3 cuando la URL no trae uno', () => {
    expect(effectiveDetector(store.get().view)).toBe(3);
    expect(effectiveDetector({ ...store.get().view, det: 6 })).toBe(6);
  });

  it('recarga la secuencia al cambiar de detector', async () => {
    await settle(search('WISE 0855'));
    await settle(setView({ det: 6 }));
    const s = store.get();
    expect(s.view.det).toBe(6);
    expect(s.frames.every((f) => f.detector === 6)).toBe(true);
  });

  it('carga más frames sin perder los anteriores', async () => {
    await settle(search('WISE 0855'));
    const first = store.get().frames.map((f) => f.id);
    await settle(loadMore());
    const all = store.get().frames.map((f) => f.id);
    expect(all.slice(0, first.length)).toEqual(first);
    expect(all.length).toBe(12);
    expect(new Set(all).size).toBe(12);
  });
});
