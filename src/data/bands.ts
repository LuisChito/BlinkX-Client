// AI-assisted development used for code development, debugging and documentation.
// Tool: ChatGPT, Claude
// Qué revela cada detector de SPHEREx. Se usa en el capítulo "Qué significa cada color" y como leyenda del visor.
// Borrador: el equipo debe verificar estos textos con la documentación de SPHEREx.
import type { Detector } from '../lib/api/types';

export interface Band { det: Detector; from: number; to: number; color: string; title: string; reveals: string }

export const BANDS: Band[] = [
  { det: 1, from: 0.75, to: 1.09, color: '#4a2283', title: 'Rojo profundo', reveals: 'La luz de las estrellas frías y rojas.' },
  { det: 2, from: 1.1, to: 1.62, color: '#6d2071', title: 'Infrarrojo cercano', reveals: 'Donde más brillan la mayoría de las estrellas. Vapor de agua en enanas marrones.' },
  { det: 3, from: 1.63, to: 2.41, color: '#96285a', title: 'Atmósferas frías', reveals: 'Agua, metano y monóxido de carbono en atmósferas frías.' },
  { det: 4, from: 2.42, to: 3.82, color: '#c2402f', title: 'Hielo de agua', reveals: 'Hielo de agua (cerca de 3 µm) y moléculas orgánicas (cerca de 3.3 µm).' },
  { det: 5, from: 3.83, to: 4.41, color: '#d86f34', title: 'Hielo seco', reveals: 'Hielo de dióxido de carbono (cerca de 4.27 µm).' },
  { det: 6, from: 4.42, to: 5.0, color: '#e9a23b', title: 'Lo más frío', reveals: 'Hielo de monóxido de carbono (cerca de 4.67 µm). Donde más brillan las enanas marrones más frías.' },
];

export const bandOf = (det: Detector): Band => BANDS[det - 1];
export const rangeLabel = (b: Band): string => `${b.from.toFixed(2)}–${b.to.toFixed(2)} µm`;
