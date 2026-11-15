// AI-assisted development used for code development, debugging and documentation.
// Tool: ChatGPT, Claude
import { describe, expect, it } from 'vitest';
import { decimalYear, pixelToSky, propagate, skyToPixel } from './projection';

const c = { ra: 0.001, dec: 66.75 };

describe('skyToPixel', () => {
  it('pone el centro en el centro de la imagen', () => {
    expect(skyToPixel(c, c, 300, 512)).toEqual({ x: 256, y: 256 });
  });
  it('pone el norte arriba', () => {
    expect(skyToPixel({ ra: c.ra, dec: c.dec + 150 / 3600 }, c, 300, 512).y).toBeCloseTo(0, 6);
  });
  it('pone el este a la izquierda', () => {
    expect(skyToPixel({ ra: c.ra + 0.01, dec: c.dec }, c, 300, 512).x).toBeLessThan(256);
  });
  it('no manda al otro lado un objeto que cruza RA 0/360', () => {
    const p = skyToPixel({ ra: 359.999, dec: 66.75 }, c, 300, 512);
    expect(Math.abs(p.x - 256)).toBeLessThan(10);
    expect(p.x).toBeGreaterThan(256);
  });
  it('se invierte con pixelToSky', () => {
    const back = pixelToSky(100, 400, c, 300, 512);
    const again = skyToPixel(back, c, 300, 512);
    expect(again.x).toBeCloseTo(100, 4);
    expect(again.y).toBeCloseTo(400, 4);
    expect(back.ra).toBeGreaterThanOrEqual(0);
    expect(back.ra).toBeLessThan(360);
  });
});

describe('propagate', () => {
  it('mueve la estrella de Barnard unos 269″ al norte entre 2000 y 2026', () => {
    const now = propagate({ ra: 269.4521, dec: 4.6934, epoch: 2000 }, { ra: -802.8, dec: 10362.5 }, 2026);
    expect((now.dec - 4.6934) * 3600).toBeCloseTo(269.4, 0);
    expect(now.ra).toBeLessThan(269.4521);
  });
  it('deja la posición igual si no hay movimiento propio', () => {
    expect(propagate({ ra: 10, dec: 20, epoch: 2000 }, null, 2026)).toEqual({ ra: 10, dec: 20 });
  });
});

describe('decimalYear', () => {
  it('convierte fechas a año decimal', () => {
    expect(decimalYear(new Date(Date.UTC(2000, 0, 1)))).toBeCloseTo(2000, 3);
    expect(decimalYear(new Date(Date.UTC(2026, 6, 2)))).toBeCloseTo(2026.5, 2);
  });
});
