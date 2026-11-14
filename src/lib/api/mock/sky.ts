// Modelo del cielo simulado. Lo usan las imágenes, los objetos, la predicción y el espectro,
// así que todo lo que se ve es coherente entre sí. Los movimientos propios son los reales: no se exageran.
import { formatDec, formatRA, separationArcsec, type SkyPoint } from '../../coords';
import { decimalYear, propagate } from '../../projection';
import type { Detector } from '../types';
import { gauss, hash, rng } from './rng';

export const DAY_MS = 86_400_000;
/** SPHEREx empezó su sondeo en mayo de 2025. */
export const SURVEY_START_MS = Date.UTC(2025, 4, 1);
export const PIXEL_ARCSEC = 6.2;
export const DATA_RELEASE = 'simulado-2026.11';

/** Rango de cada detector de SPHEREx (micras), según el contrato. */
export const DETECTOR_BANDS: Record<Detector, { center: number; from: number; to: number }> = {
  1: { center: 0.92, from: 0.75, to: 1.09 },
  2: { center: 1.36, from: 1.1, to: 1.62 },
  3: { center: 2.02, from: 1.63, to: 2.41 },
  4: { center: 3.12, from: 2.42, to: 3.82 },
  5: { center: 4.12, from: 3.83, to: 4.41 },
  6: { center: 4.71, from: 4.42, to: 5.0 },
};
export const DETECTORS: Detector[] = [1, 2, 3, 4, 5, 6];

export type SourceKind = 'star' | 'galaxy' | 'brown_dwarf' | 'variable' | 'asteroid';

export interface SkySource {
  id: string;
  name: string;
  kind: SourceKind;
  /** Posición de catálogo, en la época `epoch` (año decimal; por defecto 2000). */
  ra: number;
  dec: number;
  epoch?: number;
  mag: number; // magnitud de referencia (~2 µm)
  color: number; // >0 más rojo
  pm?: { ra: number; dec: number }; // mas/año (ra ya multiplicado por cos dec)
  parallax_mas?: number;
  variable?: { amp: number; period_d: number; phase: number };
  galaxy?: { size: number; axis: number; pa: number; z: number };
  catalog: 'simbad' | 'ned' | 'none';
  type_raw: string;
  /** Solo objetos del sistema solar simulados: activos entre t0 y t1, velocidad en ″/día. */
  asteroid?: { t0: number; t1: number; vra: number; vdec: number };
}

export interface Target extends SkySource {
  aliases: string[];
  defaultDetector: Detector;
  defaultFov: number;
}

// Posiciones de catálogo y movimientos propios aproximados de los objetos de prueba del reto.
export const TARGETS: Target[] = [
  {
    id: 'barnard', name: "Barnard's star", aliases: ['barnard', 'estrella de barnard', 'gj 699', 'v2500 oph'],
    kind: 'star', ra: 269.452075, dec: 4.693391, epoch: 2000, mag: 4.5, color: 0.25,
    pm: { ra: -802.8, dec: 10362.5 }, parallax_mas: 547.0,
    catalog: 'simbad', type_raw: 'PM*', defaultDetector: 3, defaultFov: 300,
  },
  {
    id: 'epsindib', name: 'Epsilon Indi B', aliases: ['eps ind b', 'eps indi b', 'epsilon indi ba', 'ε indi b', 'epsilon ind b'],
    kind: 'brown_dwarf', ra: 331.0438, dec: -56.7828, epoch: 2000, mag: 11.2, color: 1.4,
    pm: { ra: 3982, dec: -2470 }, parallax_mas: 276.0,
    catalog: 'simbad', type_raw: 'BD*', defaultDetector: 5, defaultFov: 420,
  },
  {
    id: 'wise0855', name: 'WISE 0855', aliases: ['wise0855', 'wise j0855', 'wise 0855-0714', 'wise j085510.83-071442.5'],
    kind: 'brown_dwarf', ra: 133.795129, dec: -7.245147, epoch: 2014.3, mag: 14.5, color: 2.2,
    pm: { ra: -8118, dec: 673 }, parallax_mas: 439.0,
    catalog: 'simbad', type_raw: 'BD*', defaultDetector: 6, defaultFov: 300,
  },
  {
    id: 'rwaur', name: 'RW Aur', aliases: ['rw aurigae', 'rw aur a'],
    kind: 'variable', ra: 76.95642, dec: 30.40142, epoch: 2000, mag: 7.0, color: 0.6,
    pm: { ra: 3.6, dec: -26.8 }, parallax_mas: 6.1,
    variable: { amp: 0.9, period_d: 37, phase: 0.2 }, catalog: 'simbad', type_raw: 'Or*',
    defaultDetector: 3, defaultFov: 300,
  },
  {
    id: 'rdra', name: 'R Dra', aliases: ['r draconis'],
    kind: 'variable', ra: 248.16733, dec: 66.75222, epoch: 2000, mag: 1.2, color: 0.5,
    pm: { ra: -7.5, dec: 11.0 }, parallax_mas: 1.5,
    variable: { amp: 1.6, period_d: 245, phase: 0.6 }, catalog: 'simbad', type_raw: 'Mi*',
    defaultDetector: 4, defaultFov: 600,
  },
];

export function findTarget(name: string): Target | undefined {
  const q = name.trim().toLowerCase().replace(/\s+/g, ' ');
  return TARGETS.find((t) => t.aliases.includes(q) || t.name.toLowerCase() === q || t.id === q);
}

/** Posición de una fuente en el instante t (ms). null si el objeto no existe en ese instante. */
export function positionAt(s: SkySource, t: number): SkyPoint | null {
  if (s.asteroid) {
    if (t < s.asteroid.t0 || t > s.asteroid.t1) return null;
    const days = (t - s.asteroid.t0) / DAY_MS;
    return {
      ra: s.ra + (s.asteroid.vra * days) / 3600 / Math.cos((s.dec * Math.PI) / 180),
      dec: s.dec + (s.asteroid.vdec * days) / 3600,
    };
  }
  return propagate({ ra: s.ra, dec: s.dec, epoch: s.epoch ?? 2000 }, s.pm ?? null, decimalYear(new Date(t)));
}

/** Brillo relativo de la fuente en un detector y un instante. */
export function fluxAt(s: SkySource, det: Detector, t: number): number {
  let mag = s.mag;
  if (s.variable) {
    const ph = ((t - SURVEY_START_MS) / DAY_MS / s.variable.period_d + s.variable.phase) * 2 * Math.PI;
    mag += s.variable.amp * Math.sin(ph);
  }
  let band: number;
  if (s.kind === 'brown_dwarf') {
    // Las enanas marrones más frías (color > 2) casi no emiten por debajo de 3 µm.
    const bd = s.color > 2 ? [0, 0.003, 0.02, 0.35, 3.5, 4.2] : [0.05, 0.2, 0.5, 0.9, 1.6, 1.8];
    band = bd[det - 1];
  } else if (s.kind === 'asteroid') {
    band = [1.4, 1.2, 1.0, 1.3, 2.2, 3.0][det - 1]; // luz reflejada + emisión térmica
  } else {
    band = Math.pow(10, 0.12 * s.color * (det - 3)) * [1.3, 1.2, 1, 0.75, 0.6, 0.55][det - 1];
  }
  return Math.pow(10, -0.4 * (mag - 16)) * band;
}

const TILE_DEG = 1 / 12; // 300″
const compact = (ra: number, dec: number, raDigits: number) =>
  `${formatRA(ra).replace(/[hms]/g, '').slice(0, raDigits)}${formatDec(dec).replace('−', '-').replace(/[°′″]/g, '').slice(0, 7)}`;

function tileSources(ix: number, iy: number): SkySource[] {
  const r = rng(hash('tile', ix, iy));
  const decC = (iy + 0.5) * TILE_DEG;
  const raW = TILE_DEG / Math.max(0.05, Math.cos((decC * Math.PI) / 180));
  const out: SkySource[] = [];
  const nStars = 28 + Math.floor(r() * 30);
  for (let i = 0; i < nStars; i++) {
    const ra = (((ix + r()) * raW) % 360 + 360) % 360;
    const dec = Math.max(-90, Math.min(90, (iy + r()) * TILE_DEG));
    const mag = 9 + Math.pow(r(), 0.45) * 10.5;
    out.push({
      id: `s${ix}_${iy}_${i}`,
      name: mag < 12.5 ? `TYC ${1000 + (hash(ix, iy, i) % 8000)}-${100 + ((i * 37) % 900)}-1` : `2MASS J${compact(ra, dec, 8)}`,
      kind: 'star', ra, dec, mag, color: gauss(r) * 0.35,
      pm: { ra: gauss(r) * 15, dec: gauss(r) * 15 },
      catalog: mag < 16.5 ? 'simbad' : 'none', type_raw: r() < 0.15 ? 'PM*' : '*',
    });
  }
  const nGal = r() < 0.6 ? 1 + Math.floor(r() * 3) : 0;
  for (let i = 0; i < nGal; i++) {
    const ra = (((ix + r()) * raW) % 360 + 360) % 360;
    const dec = Math.max(-90, Math.min(90, (iy + r()) * TILE_DEG));
    const z = Math.round((0.01 + r() * 0.25) * 10000) / 10000;
    out.push({
      id: `g${ix}_${iy}_${i}`, name: `WISEA J${compact(ra, dec, 9)}`,
      kind: 'galaxy', ra, dec, mag: 13 + r() * 4, color: 0.3,
      galaxy: { size: 8 + r() * 25, axis: 0.35 + r() * 0.6, pa: r() * Math.PI, z },
      catalog: 'ned', type_raw: r() < 0.7 ? 'G' : 'GPair',
    });
  }
  return out;
}

/** Fuentes de un cuadro de lado `fov` (″) alrededor del centro, incluidos los objetos del reto. */
export function fieldSources(center: SkyPoint, fov: number): SkySource[] {
  const half = (fov / 2 + 60) / 3600;
  const cosd = Math.max(0.05, Math.cos((center.dec * Math.PI) / 180));
  const iy0 = Math.floor((center.dec - half) / TILE_DEG);
  const iy1 = Math.floor((center.dec + half) / TILE_DEG);
  const out: SkySource[] = [];
  for (let iy = iy0; iy <= iy1; iy++) {
    const decC = (iy + 0.5) * TILE_DEG;
    const raW = TILE_DEG / Math.max(0.05, Math.cos((decC * Math.PI) / 180));
    const ix0 = Math.floor((center.ra - half / cosd) / raW);
    const ix1 = Math.floor((center.ra + half / cosd) / raW);
    for (let ix = ix0; ix <= ix1; ix++) {
      for (const s of tileSources(ix, iy)) {
        if (Math.abs(s.dec - center.dec) <= half && Math.abs(((s.ra - center.ra + 540) % 360) - 180) * cosd <= half) out.push(s);
      }
    }
  }
  // Los objetos del reto se buscan por su posición durante el sondeo, no por la de catálogo.
  for (const t of TARGETS) {
    const now = positionAt(t, SURVEY_START_MS + 270 * DAY_MS)!;
    if (separationArcsec(now, center) < fov) out.push(t);
  }
  out.push(...fieldAsteroids(center));
  return out;
}

/** Un objeto del sistema solar simulado por pasada en algunas regiones (para probar la detección). */
export function fieldAsteroids(center: SkyPoint): SkySource[] {
  const out: SkySource[] = [];
  for (const pass of surveyPasses(center, Number.MAX_SAFE_INTEGER)) {
    const r = rng(hash('ast', Math.round(center.ra * 10), Math.round(center.dec * 10), pass.index));
    if (r() > 0.55) continue;
    const speed = 25 + r() * 50; // ″/día
    const ang = r() * Math.PI * 2;
    const days = (pass.end - pass.start) / DAY_MS;
    const vra = Math.cos(ang) * speed;
    const vdec = Math.sin(ang) * speed;
    const cosd = Math.max(0.05, Math.cos((center.dec * Math.PI) / 180));
    out.push({
      id: `ast-${pass.index}`, name: `Objeto simulado en movimiento ${pass.index + 1}`,
      kind: 'asteroid',
      // empieza a un lado y cruza cerca del centro a mitad de la pasada
      ra: center.ra - (vra * days * 0.5) / 3600 / cosd + gauss(r) * 0.005,
      dec: center.dec - (vdec * days * 0.5) / 3600 + gauss(r) * 0.005,
      mag: 13.5 + r() * 2, color: 0, catalog: 'none', type_raw: 'mov',
      asteroid: { t0: pass.start, t1: pass.end, vra, vdec },
    });
  }
  return out;
}

export interface SurveyPass {
  index: number;
  start: number;
  end: number;
  visits: number[];
}

/** SPHEREx cubre todo el cielo cada ~6 meses. Las regiones cerca de los polos se visitan más. */
export function surveyPasses(center: SkyPoint, now = Date.now()): SurveyPass[] {
  const r = rng(hash('passes', Math.round(center.ra * 10), Math.round(center.dec * 10)));
  const offset = (center.ra / 360) * 182.6 * DAY_MS;
  const out: SurveyPass[] = [];
  for (let k = 0; k < 6; k++) {
    const start = SURVEY_START_MS + k * 182.6 * DAY_MS + offset;
    const n = 6 + Math.floor((Math.abs(center.dec) / 90) * 14) + Math.floor(r() * 4);
    const span = (2.5 + r() * 2) * DAY_MS;
    const visits: number[] = [];
    for (let i = 0; i < n; i++) {
      const t = Math.round(start + (i / n) * span + r() * 0.04 * DAY_MS);
      if (t < now) visits.push(t);
    }
    if (visits.length) out.push({ index: k, start, end: start + span, visits });
  }
  return out;
}
