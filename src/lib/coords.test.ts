// AI-assisted development used for code development, debugging and documentation.
// Tool: ChatGPT, Claude
import { describe, expect, it } from 'vitest';
import { formatDec, formatRA, parseCoords, separationArcsec } from './coords';

describe('parseCoords', () => {
  it('lee grados decimales con espacio o coma', () => {
    expect(parseCoords('133.795129 -7.245147')).toEqual({ ra: 133.795129, dec: -7.245147 });
    expect(parseCoords('133.795129, -7.245147')).toEqual({ ra: 133.795129, dec: -7.245147 });
  });
  it('lee el formato del reto: 08h55m10.831s -7d14m42.53s', () => {
    const p = parseCoords('08h55m10.831s -7d14m42.53s')!;
    expect(p.ra).toBeCloseTo(133.795129, 5);
    expect(p.dec).toBeCloseTo(-7.245147, 5);
  });
  it('lee sexagesimal con dos puntos y conserva el signo', () => {
    expect(parseCoords('08:55:10.8 -07:14:42')!.dec).toBeLessThan(0);
  });
  it('conserva el signo cuando los grados son -00', () => {
    expect(parseCoords('10 00 00 -00 30 00')!.dec).toBeCloseTo(-0.5, 6);
  });
  it('rechaza valores fuera de rango', () => {
    expect(parseCoords('360 10')).toBeNull();
    expect(parseCoords('120 91')).toBeNull();
    expect(parseCoords('25 00 00 +10 00 00')).toBeNull();
  });
  it('rechaza texto que no es una coordenada', () => {
    expect(parseCoords('Barnard')).toBeNull();
    expect(parseCoords('')).toBeNull();
    expect(parseCoords('12')).toBeNull();
  });
});

describe('formato', () => {
  it('escribe RA en horas y Dec en grados', () => {
    expect(formatRA(133.795129)).toBe('08h55m10.83s');
    expect(formatDec(-7.245147)).toBe('−07°14′42.5″');
    expect(formatDec(4.6934)).toBe('+04°41′36.2″');
  });
});

describe('separationArcsec', () => {
  it('mide un grado de declinación como 3600″', () => {
    expect(separationArcsec({ ra: 10, dec: 0 }, { ra: 10, dec: 1 })).toBeCloseTo(3600, 3);
  });
  it('no da la vuelta al cielo al cruzar RA 0', () => {
    expect(separationArcsec({ ra: 359.999, dec: 0 }, { ra: 0.001, dec: 0 })).toBeCloseTo(7.2, 3);
  });
});
