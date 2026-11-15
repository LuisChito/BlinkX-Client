// Detectores de SPHEREx para el visor: rangos y textos compartidos con la historia (src/data/bands.ts)
// y una rampa de color clara (violeta → ámbar) legible sobre fondo negro.
import { BANDS } from '../../../data/bands';

export const DET_COLORS = ['#a98bff', '#d77fe0', '#ff7ea8', '#ff8a5c', '#ffae5c', '#ffd36b'] as const;

export const DETECTORS = BANDS.map((b, i) => ({
  det: b.det as 1 | 2 | 3 | 4 | 5 | 6,
  from: b.from,
  to: b.to,
  title: b.title,
  reveals: b.reveals,
  color: DET_COLORS[i],
}));

export const detColor = (det: number) => DET_COLORS[Math.max(0, Math.min(5, det - 1))];
