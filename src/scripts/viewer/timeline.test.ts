import { describe, expect, it } from 'vitest';
import type { Frame } from '../../lib/api/types';
import { frameIntervalMs, nextIndex, passGroups, passOf } from './timeline';

const frame = (date: string): Frame => ({
  id: date, date_obs: date, detector: 3, band_um: 2, center: { ra: 0, dec: 0 }, fov_arcsec: 300, exposure_s: 113.6, flags: [], png_url: 'blob:x',
});

describe('passGroups', () => {
  it('separa dos pasadas con seis meses de diferencia', () => {
    const frames = ['2025-05-01T00:00:00Z', '2025-05-02T00:00:00Z', '2025-11-01T00:00:00Z', '2025-11-03T00:00:00Z', '2025-11-04T00:00:00Z'].map(frame);
    expect(passGroups(frames)).toEqual([[0, 1], [2, 3, 4]]);
  });
  it('devuelve una lista vacía sin frames', () => {
    expect(passGroups([])).toEqual([]);
  });
});

describe('passOf', () => {
  it('dice a qué pasada pertenece un frame', () => {
    expect(passOf([[0, 1], [2, 3, 4]], 3)).toBe(1);
    expect(passOf([[0, 1]], 9)).toBe(-1);
  });
});

describe('nextIndex', () => {
  it('da la vuelta al llegar al final o al principio', () => {
    expect(nextIndex(42, 43, 1)).toBe(0);
    expect(nextIndex(0, 43, -1)).toBe(42);
    expect(nextIndex(10, 43, 1)).toBe(11);
  });
  it('no falla cuando no hay frames', () => {
    expect(nextIndex(0, 0, 1)).toBe(0);
    expect(nextIndex(5, 0, -1)).toBe(0);
  });
});

describe('frameIntervalMs', () => {
  it('va más rápido a mayor velocidad', () => {
    expect([frameIntervalMs(1), frameIntervalMs(2), frameIntervalMs(4)]).toEqual([600, 300, 150]);
  });
});
