import { describe, expect, it } from 'vitest';
import { DEFAULT_STATE, readState, writeState } from './url';

describe('readState', () => {
  it('usa valores por defecto con una URL vacía', () => {
    expect(readState('')).toEqual(DEFAULT_STATE);
  });
  it('recorta parámetros inválidos a valores seguros', () => {
    const s = readState('?fov=abc&det=9&mode=xyz&from=2026-05-01&to=2025-05-01&ra=400&dec=10&scale=zzz');
    expect(s.fov).toBe(300);
    expect(s.det).toBeUndefined();
    expect(s.mode).toBe('video');
    expect(s.from).toBeUndefined();
    expect(s.to).toBeUndefined();
    expect(s.ra).toBeUndefined();
    expect(s.dec).toBeUndefined();
    expect(s.scale).toBe('sequence');
  });
  it('limita el campo de visión a 30–3600', () => {
    expect(readState('?fov=99999').fov).toBe(3600);
    expect(readState('?fov=1').fov).toBe(30);
  });
  it('rechaza fechas que no existen', () => {
    expect(readState('?from=2026-13-45').from).toBeUndefined();
  });
});

describe('writeState', () => {
  it('omite los valores por defecto', () => {
    expect(writeState(DEFAULT_STATE)).toBe('');
  });
  it('va y vuelve sin perder nada', () => {
    const s = {
      ...DEFAULT_STATE, ra: 133.795129, dec: -7.245147, det: 6 as const, mode: 'blink' as const,
      scale: 'frame' as const, from: '2025-05-01', to: '2026-05-01', embed: true,
    };
    expect(readState(writeState(s))).toEqual(s);
  });
});
