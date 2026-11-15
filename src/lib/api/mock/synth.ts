// AI-assisted development used for code development, debugging and documentation.
// Tool: ChatGPT, Claude
// Imágenes simuladas: campo de estrellas + objetos que se mueven + variables + ruido
// + artefactos según las banderas del frame. Los valores hacen de "MJy/sr".
import { skyToPixel } from '../../projection';
import type { Cmap, Detector, FrameFlag, Stretch } from '../types';
import { gauss, hash, rng } from './rng';
import { PIXEL_ARCSEC, fieldSources, fluxAt, positionAt } from './sky';

export interface SimOptions {
  ra: number;
  dec: number;
  fov: number;
  det: Detector;
  t: number;
  size?: number;
  flags?: FrameFlag[];
}

function stamp(img: Float32Array, size: number, x: number, y: number, flux: number, sx: number, sy: number, pa: number): void {
  const cos = Math.cos(pa);
  const sin = Math.sin(pa);
  const norm = flux / (2 * Math.PI * sx * sy);
  // El radio crece con el brillo: así una estrella muy brillante no se corta en un cuadro.
  const k = Math.min(12, Math.max(3, Math.sqrt(2 * Math.log(Math.max(1, norm / 2e-5)))));
  const r = Math.ceil(k * Math.max(sx, sy));
  const x0 = Math.max(0, Math.floor(x - r));
  const x1 = Math.min(size - 1, Math.ceil(x + r));
  const y0 = Math.max(0, Math.floor(y - r));
  const y1 = Math.min(size - 1, Math.ceil(y + r));
  for (let j = y0; j <= y1; j++) {
    for (let i = x0; i <= x1; i++) {
      const dx = i + 0.5 - x;
      const dy = j + 0.5 - y;
      const u = dx * cos + dy * sin;
      const v = -dx * sin + dy * cos;
      img[j * size + i] += norm * Math.exp(-0.5 * ((u * u) / (sx * sx) + (v * v) / (sy * sy)));
    }
  }
}

export function simulate(o: SimOptions): Float32Array {
  const size = o.size ?? 512;
  const center = { ra: o.ra, dec: o.dec };
  const img = new Float32Array(size * size);
  const pxScale = o.fov / size; // ″/px
  const psf = Math.max(0.55, PIXEL_ARCSEC / 2.355 / pxScale);
  const flags = o.flags ?? [];
  const margin = psf * 12;

  for (const s of fieldSources(center, o.fov)) {
    const pos = positionAt(s, o.t);
    if (!pos) continue;
    const px = skyToPixel(pos, center, o.fov, size);
    if (px.x < -margin || px.y < -margin || px.x > size + margin || px.y > size + margin) continue;
    const f = fluxAt(s, o.det, o.t);
    if (f <= 0) continue;
    if (s.galaxy) {
      const g = s.galaxy.size / 2.355 / pxScale;
      stamp(img, size, px.x, px.y, f, Math.hypot(psf, g), Math.hypot(psf, g * s.galaxy.axis), s.galaxy.pa);
    } else {
      stamp(img, size, px.x, px.y, f, psf, psf, 0);
    }
  }

  const r = rng(hash('noise', Math.round(o.ra * 1e4), Math.round(o.dec * 1e4), o.fov, o.det, o.t, size));
  const bg = 0.0008 * (1 + 0.15 * o.det);
  let sigma = 0.00022 * (o.det >= 5 ? 1.6 : 1);
  if (flags.includes('low_snr')) sigma *= 3;
  const stray = flags.includes('stray_light');
  const ang = r() * Math.PI * 2;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let b = bg;
      if (stray) b += 0.004 * Math.max(0, ((i - size / 2) * Math.cos(ang) + (j - size / 2) * Math.sin(ang)) / size + 0.5);
      img[j * size + i] += b + gauss(r) * sigma;
    }
  }
  if (flags.includes('cosmic_ray')) {
    const n = 2 + Math.floor(r() * 4);
    for (let k = 0; k < n; k++) {
      let x = r() * size;
      let y = r() * size;
      const a = r() * Math.PI;
      const len = 2 + r() * 10;
      for (let s = 0; s < len; s++) {
        const idx = Math.floor(y) * size + Math.floor(x);
        if (idx >= 0 && idx < img.length) img[idx] += 0.02 + r() * 0.03;
        x += Math.cos(a);
        y += Math.sin(a);
      }
    }
  }
  if (flags.includes('edge')) {
    const w = Math.floor(size * 0.06);
    for (let j = 0; j < size; j++) for (let i = size - w; i < size; i++) img[j * size + i] = bg + gauss(r) * sigma * 0.3;
  }
  if (flags.includes('saturation')) {
    for (let i = 0; i < img.length; i++) if (img[i] > 0.05) img[i] = 0.05;
  }
  return img;
}

export function combine(frames: Float32Array[], op: 'mean' | 'median' | 'sum'): Float32Array {
  const n = frames[0].length;
  const out = new Float32Array(n);
  if (op === 'median') {
    const buf = new Float32Array(frames.length);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < frames.length; k++) buf[k] = frames[k][i];
      buf.sort();
      out[i] = buf[Math.floor(frames.length / 2)];
    }
    return out;
  }
  for (const f of frames) for (let i = 0; i < n; i++) out[i] += f[i];
  if (op === 'mean') for (let i = 0; i < n; i++) out[i] /= frames.length;
  return out;
}

function percentile(samples: number[], p: number): number {
  return samples[Math.min(samples.length - 1, Math.floor(p * samples.length))];
}

/** Límites de brillo (percentiles 1 % y 99.7 %) comunes a un grupo de imágenes. */
export function limits(images: Float32Array[]): { vmin: number; vmax: number } {
  const samples: number[] = [];
  for (const img of images) {
    const step = Math.max(1, Math.floor(img.length / 4000));
    for (let i = 0; i < img.length; i += step) samples.push(img[i]);
  }
  samples.sort((a, b) => a - b);
  const vmin = percentile(samples, 0.01);
  return { vmin, vmax: Math.max(vmin + 1e-9, percentile(samples, 0.997)) };
}

/** Límite simétrico para una resta: ±(percentil 99.8 % del valor absoluto). */
export function divergingLimit(img: Float32Array): number {
  const samples: number[] = [];
  const step = Math.max(1, Math.floor(img.length / 6000));
  for (let i = 0; i < img.length; i += step) samples.push(Math.abs(img[i]));
  samples.sort((a, b) => a - b);
  return Math.max(1e-9, percentile(samples, 0.998));
}

// ---------------- color ----------------

const CMAPS: Record<Exclude<Cmap, 'gray'>, [number, number, number][]> = {
  viridis: [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]],
  magma: [[0, 0, 4], [81, 18, 124], [183, 55, 121], [252, 137, 97], [252, 253, 191]],
  inferno: [[0, 0, 4], [87, 16, 110], [188, 55, 84], [249, 142, 9], [252, 255, 164]],
};

function ramp(stops: [number, number, number][], v: number): [number, number, number] {
  const x = Math.min(0.9999, Math.max(0, v)) * (stops.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = stops[i];
  const b = stops[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

function applyStretch(v: number, stretch: Stretch): number {
  switch (stretch) {
    case 'linear': return v;
    case 'sqrt': return Math.sqrt(v);
    case 'log': return Math.log10(1 + 1000 * v) / 3;
    default: return Math.asinh(12 * v) / Math.asinh(12);
  }
}

/**
 * Convierte datos a RGBA usando los límites dados.
 * En modo divergente (resta A − B, con vmin = −vmax): lo positivo se pinta ámbar y lo negativo, cian.
 */
export function toRGBA(data: Float32Array, stretch: Stretch, cmap: Cmap, vmin: number, vmax: number, diverging = false): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data.length * 4);
  if (diverging) {
    const m = Math.max(1e-12, Math.abs(vmax));
    for (let i = 0; i < data.length; i++) {
      const v = Math.max(-1, Math.min(1, data[i] / m));
      const s = applyStretch(Math.abs(v), stretch);
      const base = 18;
      const rgb = v >= 0 ? [base + s * 237, base + s * 160, base + s * 40] : [base + s * 40, base + s * 200, base + s * 237];
      out.set([rgb[0], rgb[1], rgb[2], 255], i * 4);
    }
    return out;
  }
  const span = Math.max(1e-12, vmax - vmin);
  for (let i = 0; i < data.length; i++) {
    const v = applyStretch(Math.max(0, Math.min(1, (data[i] - vmin) / span)), stretch);
    if (cmap === 'gray') {
      const g = v * 255;
      out.set([g, g, g, 255], i * 4);
    } else {
      const [r, g, b] = ramp(CMAPS[cmap], v);
      out.set([r, g, b, 255], i * 4);
    }
  }
  return out;
}
