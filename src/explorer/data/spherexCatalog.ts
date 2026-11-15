import type { MolecularLensId, TargetCatalogEntry } from '../types/spherex';

export interface MolecularPresetMeta {
  id: MolecularLensId;
  label: string;
  formula: string;
  bandRangeUm: [number, number];
  highlightBands: Array<{ x1: number; x2: number; color: string; name: string }>;
}

/**
 * Bandas físicas de absorción molecular en el infrarrojo cercano/medio (0.75–5.00 μm)
 * según las especificaciones científicas de la misión SPHEREx de la NASA.
 */
export const MOLECULAR_PRESETS: MolecularPresetMeta[] = [
  {
    id: 'all',
    label: 'ALL 102B',
    formula: '0.75–5.0 μm',
    bandRangeUm: [0.75, 5.0],
    highlightBands: [
      { x1: 1.35, x2: 1.48, color: 'rgba(56, 189, 248, 0.12)', name: 'H₂O 1.4' },
      { x1: 1.61, x2: 1.72, color: 'rgba(148, 163, 184, 0.12)', name: 'CH₄ 1.66' },
      { x1: 1.84, x2: 2.02, color: 'rgba(34, 211, 238, 0.14)', name: 'H₂O 1.9' },
      { x1: 3.22, x2: 3.44, color: 'rgba(16, 185, 129, 0.14)', name: 'CH₄ 3.3' },
      { x1: 4.18, x2: 4.35, color: 'rgba(245, 158, 11, 0.14)', name: 'CO₂ 4.26' },
    ],
  },
  {
    id: 'h2o',
    label: 'H₂O',
    formula: 'H₂O',
    bandRangeUm: [1.2, 3.2],
    highlightBands: [
      { x1: 1.35, x2: 1.48, color: 'rgba(34, 211, 238, 0.2)', name: 'H₂O 1.4 μm' },
      { x1: 1.84, x2: 2.02, color: 'rgba(34, 211, 238, 0.2)', name: 'H₂O 1.9 μm' },
      { x1: 2.65, x2: 3.05, color: 'rgba(34, 211, 238, 0.24)', name: 'H₂O Ice 2.8 μm' },
    ],
  },
  {
    id: 'ch4',
    label: 'CH₄',
    formula: 'CH₄',
    bandRangeUm: [1.5, 3.6],
    highlightBands: [
      { x1: 1.6, x2: 1.73, color: 'rgba(16, 185, 129, 0.2)', name: 'CH₄ 1.66 μm' },
      { x1: 2.16, x2: 2.34, color: 'rgba(16, 185, 129, 0.2)', name: 'CH₄ 2.25 μm' },
      { x1: 3.18, x2: 3.48, color: 'rgba(16, 185, 129, 0.24)', name: 'CH₄ ν₃ 3.32 μm' },
    ],
  },
  {
    id: 'co2',
    label: 'CO₂',
    formula: 'CO₂',
    bandRangeUm: [3.6, 5.0],
    highlightBands: [
      { x1: 4.16, x2: 4.36, color: 'rgba(245, 158, 11, 0.24)', name: 'CO₂ 4.26 μm' },
    ],
  },
  {
    id: 'co',
    label: 'CO',
    formula: 'CO',
    bandRangeUm: [4.0, 5.0],
    highlightBands: [
      { x1: 4.56, x2: 4.78, color: 'rgba(251, 146, 60, 0.24)', name: 'CO 4.67 μm' },
    ],
  },
  {
    id: 'nh3',
    label: 'NH₃',
    formula: 'NH₃',
    bandRangeUm: [1.3, 3.3],
    highlightBands: [
      { x1: 1.46, x2: 1.56, color: 'rgba(168, 85, 247, 0.22)', name: 'NH₃ 1.51 μm' },
      { x1: 2.9, x2: 3.06, color: 'rgba(168, 85, 247, 0.22)', name: 'NH₃ 2.98 μm' },
    ],
  },
];

/**
 * Marcadores iniciales de referencia astronómica (solo coordenadas base e identidad).
 * Todos los espectros, imágenes, épocas, flags y catálogos se obtienen en vivo desde el backend real.
 */
export const SPHEREX_TARGETS: TargetCatalogEntry[] = [
  {
    id: 'barnards-star',
    name: "Barnard's Star",
    designation: 'GJ 699 / HIP 87937',
    category: 'High Proper Motion Red Dwarf',
    isChallengeTarget: true,
    spectralType: 'M4.0V',
    raDeg: 269.4521,
    decDeg: 4.6934,
    defaultFov: 0.15,
  },
  {
    id: 'wise-0855',
    name: 'WISE 0855',
    designation: 'WISE J085510.83-071442.5',
    category: 'Coldest Known Brown Dwarf',
    isChallengeTarget: true,
    spectralType: 'Y4',
    raDeg: 133.79513,
    decDeg: -7.24515,
    defaultFov: 0.15,
  },
  {
    id: 'epsilon-indi-b',
    name: 'Epsilon Indi B',
    designation: 'ε Ind Ba/Bb Binary',
    category: 'T-Dwarf Binary System',
    isChallengeTarget: true,
    spectralType: 'T1.5 + T6',
    raDeg: 331.09575,
    decDeg: -56.80032,
    defaultFov: 0.15,
  },
  {
    id: 'rw-aurigae',
    name: 'RW Aurigae',
    designation: 'HD 240764 / Variable YSO',
    category: 'Dimming YSO + Circumstellar Disk',
    isChallengeTarget: true,
    spectralType: 'K0Ve',
    raDeg: 76.9565,
    decDeg: 30.4014,
    defaultFov: 0.15,
  },
  {
    id: 'r-draconis',
    name: 'R Draconis',
    designation: 'HD 149880 / NEP Mira Variable',
    category: 'Mira Pulsating Giant (NEP)',
    isChallengeTarget: true,
    spectralType: 'M5e-M9e',
    raDeg: 249.6021,
    decDeg: 66.7501,
    defaultFov: 0.15,
  },
];
