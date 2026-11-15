// AI-assisted development used for code development, debugging and documentation.
// Tool: ChatGPT, Claude
import { describe, expect, it } from 'vitest';
import { skyToPixel } from '../../projection';
import { findTarget, positionAt } from './sky';
import { combine, limits, simulate, toRGBA } from './synth';

const t = Date.UTC(2026, 4, 1);
const barnard = findTarget("Barnard's star")!;
const center = positionAt(barnard, t)!;
const opts = { ra: center.ra + 20 / 3600, dec: center.dec - 30 / 3600, fov: 300, det: 3 as const, t, size: 128 };

function brightest(img: Float32Array, size: number): { x: number; y: number } {
  let best = 0;
  for (let i = 1; i < img.length; i++) if (img[i] > img[best]) best = i;
  return { x: (best % size) + 0.5, y: Math.floor(best / size) + 0.5 };
}

describe('simulate', () => {
  it('es determinista', () => {
    expect(Array.from(simulate(opts))).toEqual(Array.from(simulate(opts)));
  });

  it('dibuja la estrella de Barnard donde la proyección dice que está', () => {
    const img = simulate(opts);
    const expected = skyToPixel(center, { ra: opts.ra, dec: opts.dec }, opts.fov, opts.size);
    const got = brightest(img, opts.size);
    expect(Math.hypot(got.x - expected.x, got.y - expected.y)).toBeLessThan(3);
  });

  it('respeta el tamaño pedido', () => {
    expect(simulate({ ...opts, size: 64 }).length).toBe(64 * 64);
  });
});

describe('combine', () => {
  it('promedia, suma y resta imágenes', () => {
    const a = Float32Array.from([1, 2]);
    const b = Float32Array.from([3, 6]);
    expect(Array.from(combine([a, b], 'mean'))).toEqual([2, 4]);
    expect(Array.from(combine([a, b], 'sum'))).toEqual([4, 8]);
    expect(Array.from(combine([a, b, b], 'median'))).toEqual([3, 6]);
  });
});

describe('toRGBA', () => {
  it('pinta negro por debajo de vmin y blanco por encima de vmax en escala de grises', () => {
    const px = toRGBA(Float32Array.from([-5, 0, 10, 50]), 'linear', 'gray', 0, 10);
    expect(Array.from(px.slice(0, 4))).toEqual([0, 0, 0, 255]);
    expect(Array.from(px.slice(8, 12))).toEqual([255, 255, 255, 255]);
    expect(Array.from(px.slice(12, 16))).toEqual([255, 255, 255, 255]);
  });

  it('usa los mismos límites para dos imágenes: la más brillante se ve más brillante', () => {
    const dim = toRGBA(Float32Array.from([2]), 'linear', 'gray', 0, 10)[0];
    const bright = toRGBA(Float32Array.from([8]), 'linear', 'gray', 0, 10)[0];
    expect(bright).toBeGreaterThan(dim);
  });

  it('en una resta pinta lo positivo en ámbar y lo negativo en cian', () => {
    const px = toRGBA(Float32Array.from([10, -10]), 'linear', 'gray', -10, 10, true);
    expect(px[0]).toBeGreaterThan(px[2]); // ámbar: rojo > azul
    expect(px[6]).toBeGreaterThan(px[4]); // cian: azul > rojo
  });
});

describe('limits', () => {
  it('devuelve un intervalo que no es vacío aunque la imagen sea plana', () => {
    const { vmin, vmax } = limits([new Float32Array(100).fill(3)]);
    expect(vmax).toBeGreaterThan(vmin);
  });
});
