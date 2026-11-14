import { describe, expect, it } from 'vitest';
import type { SpectrumPoint } from '../../lib/api/types';
import { lightCurve, niceTicks, scaleLinear } from './chart';

const pt = (over: Partial<SpectrumPoint>): SpectrumPoint => ({
  wavelength: 2, flux: 100, error: 5, date_obs: '2025-05-01T00:00:00Z', detector: 3, frame_id: 'f', flags: [], ...over,
});

describe('scaleLinear', () => {
  it('lleva el dominio al rango', () => {
    const s = scaleLinear([0, 10], [0, 100]);
    expect(s(5)).toBe(50);
    expect(s(0)).toBe(0);
    expect(s(10)).toBe(100);
  });
  it('funciona con un rango invertido (ejes Y de SVG)', () => {
    expect(scaleLinear([0, 10], [100, 0])(2.5)).toBe(75);
  });
  it('devuelve el punto medio cuando el dominio no tiene ancho', () => {
    expect(scaleLinear([4, 4], [0, 100])(4)).toBe(50);
  });
});

describe('lightCurve', () => {
  const points = [
    pt({ detector: 3, date_obs: '2025-11-01T00:00:00Z', flux: 3 }),
    pt({ detector: 6, date_obs: '2025-06-01T00:00:00Z', flux: 9 }),
    pt({ detector: 3, date_obs: '2025-05-01T00:00:00Z', flux: 1 }),
    pt({ detector: 3, date_obs: '2025-08-01T00:00:00Z', flux: 2 }),
  ];
  it('se queda con el detector pedido y ordena por fecha', () => {
    expect(lightCurve(points, 3).map((p) => p.flux)).toEqual([1, 2, 3]);
  });
  it('devuelve una lista vacía sin puntos', () => {
    expect(lightCurve([], 3)).toEqual([]);
    expect(lightCurve(points, 1)).toEqual([]);
  });
});

describe('niceTicks', () => {
  it('propone marcas redondas dentro del intervalo', () => {
    const t = niceTicks(0, 97, 4);
    expect(t[0]).toBeGreaterThanOrEqual(0);
    expect(t[t.length - 1]).toBeLessThanOrEqual(97);
    expect(t.every((v) => Number.isInteger(v / 5))).toBe(true);
  });
  it('no entra en un bucle con un intervalo vacío', () => {
    expect(niceTicks(5, 5, 4)).toEqual([5]);
  });
});
