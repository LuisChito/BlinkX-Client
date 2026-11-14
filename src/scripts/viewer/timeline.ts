// Funciones puras del reproductor: sin DOM, para poder probarlas y usarlas desde el estado.
import type { Frame } from '../../lib/api/types';

const DAY_MS = 86_400_000;

/** Agrupa los frames por pasada de SPHEREx: un salto de más de 30 días abre una pasada nueva. */
export function passGroups(frames: Frame[]): number[][] {
  const groups: number[][] = [];
  let last = -Infinity;
  frames.forEach((f, i) => {
    const t = Date.parse(f.date_obs);
    if (t - last > 30 * DAY_MS) groups.push([]);
    groups[groups.length - 1].push(i);
    last = t;
  });
  return groups;
}

/** Índice de la pasada que contiene el frame, o -1. */
export function passOf(groups: number[][], idx: number): number {
  return groups.findIndex((g) => g.includes(idx));
}

export function nextIndex(idx: number, total: number, dir: 1 | -1): number {
  if (total <= 0) return 0;
  return (((idx + dir) % total) + total) % total;
}

export function frameIntervalMs(speed: 1 | 2 | 4): number {
  return 600 / speed;
}
