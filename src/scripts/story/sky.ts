// AI-assisted development used for code development, debugging and documentation.
// Tool: ChatGPT, Claude
// Pinta los lienzos de cielo simulado de la portada con el mismo modelo que usa el visor.
import type { Detector } from '../../lib/api/types';
import { fieldSources, findTarget, fluxAt, positionAt } from '../../lib/api/mock/sky';
import { limits, simulate, toRGBA } from '../../lib/api/mock/synth';
import { skyToPixel } from '../../lib/projection';

export interface SkyScene {
  size: number;
  frames: ImageData[];
  /** Posición del objeto principal en cada fecha (px del lienzo). */
  mover: { x: number; y: number }[];
  /** Estrellas fijas más brillantes (px), para usarlas como candidatos en el mini reto. */
  stars: { x: number; y: number }[];
}

const scenes = new WeakMap<HTMLCanvasElement, SkyScene>();

function build(canvas: HTMLCanvasElement): SkyScene | null {
  const d = canvas.dataset;
  const target = findTarget(d.target ?? '');
  if (!target) return null;
  const size = Number(d.size ?? 256);
  const fov = Number(d.fov ?? 300);
  const det = Number(d.det ?? 3) as Detector;
  const times = [d.t, d.t2].filter((x): x is string => !!x).map((x) => Date.parse(x));
  if (!times.length) return null;

  const mid = positionAt(target, (times[0] + times[times.length - 1]) / 2)!;
  // Desplazamiento opcional (″) para que el objeto no quede justo en el centro.
  const center = {
    ra: mid.ra + Number(d.dx ?? 0) / 3600 / Math.cos((mid.dec * Math.PI) / 180),
    dec: mid.dec + Number(d.dy ?? 0) / 3600,
  };
  const raws = times.map((t) => simulate({ ra: center.ra, dec: center.dec, fov, det, t, size }));
  const lim = limits(raws);
  // Corte más bajo que en el visor: aquí importa que se vea el campo de estrellas, no medir brillos.
  const vmin = lim.vmin;
  const vmax = vmin + (lim.vmax - vmin) * Number(d.gain ?? 0.2);
  const frames = raws.map((r) => new ImageData(toRGBA(r, 'asinh', 'gray', vmin, vmax) as Uint8ClampedArray<ArrayBuffer>, size, size));
  const mover = times.map((t) => skyToPixel(positionAt(target, t)!, center, fov, size));
  const stars = fieldSources(center, fov)
    .filter((s) => s.id !== target.id && s.kind !== 'asteroid')
    .map((s) => ({ p: skyToPixel(positionAt(s, times[0])!, center, fov, size), f: fluxAt(s, det, times[0]) }))
    .filter(({ p }) => p.x > 24 && p.y > 24 && p.x < size - 24 && p.y < size - 24)
    .sort((a, b) => b.f - a.f)
    .slice(0, 12)
    .map(({ p }) => p);
  return { size, frames, mover, stars };
}

/** Devuelve la escena del lienzo, creándola la primera vez. */
export function sceneOf(canvas: HTMLCanvasElement): SkyScene | null {
  let s = scenes.get(canvas);
  if (!s) {
    const built = build(canvas);
    if (!built) return null;
    s = built;
    scenes.set(canvas, s);
    canvas.width = s.size;
    canvas.height = s.size;
  }
  return s;
}

export function showFrame(canvas: HTMLCanvasElement, i: number): void {
  const s = sceneOf(canvas);
  if (!s) return;
  const frame = s.frames[Math.min(i, s.frames.length - 1)];
  canvas.getContext('2d')?.putImageData(frame, 0, 0);
  canvas.dataset.shown = String(Math.min(i, s.frames.length - 1));
}

/** Pinta cada lienzo [data-sky] cuando está por entrar en pantalla (no antes: cuestan unos milisegundos). */
export function mountSkies(): void {
  const all = [...document.querySelectorAll<HTMLCanvasElement>('canvas[data-sky]')];
  if (!('IntersectionObserver' in window)) {
    all.forEach((c) => showFrame(c, 0));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const c = e.target as HTMLCanvasElement;
      io.unobserve(c);
      if (c.dataset.shown === undefined) showFrame(c, 0);
      c.classList.add('is-ready');
    }
  }, { rootMargin: '400px 0px' });
  all.forEach((c) => io.observe(c));
}
