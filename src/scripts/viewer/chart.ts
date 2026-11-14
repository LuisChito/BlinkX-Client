// Gráficas del panel Datos (SVG, sin librerías): espectro y curva de luz.
import { BANDS } from '../../data/bands';
import { T } from '../../data/viewer';
import type { Detector, SpectrumPoint } from '../../lib/api/types';
import { esc, fmtDate } from './dom';

export function scaleLinear(domain: [number, number], range: [number, number]): (v: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  if (d1 === d0) return () => (r0 + r1) / 2;
  return (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
}

/** Puntos de un detector ordenados por fecha: la curva de luz sale del mismo espectro. */
export function lightCurve(points: SpectrumPoint[], det: Detector): { t: number; flux: number; error: number | null }[] {
  return points
    .filter((p) => p.detector === det)
    .map((p) => ({ t: Date.parse(p.date_obs), flux: p.flux, error: p.error }))
    .sort((a, b) => a.t - b.t);
}

/** Marcas "redondas" (1, 2 o 5 × 10ⁿ) dentro de [min, max]. */
export function niceTicks(min: number, max: number, count: number): number[] {
  if (!(max > min)) return [min];
  const raw = (max - min) / Math.max(1, count);
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9 && out.length < 50; v += step) out.push(Math.round(v / step) * step);
  return out;
}

const W = 320;
const H = 170;
const M = { l: 44, r: 8, t: 8, b: 26 };

function fmtNum(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e4) return `${Math.round(v / 1e3)}k`;
  if (a >= 100) return String(Math.round(v));
  return String(Math.round(v * 10) / 10);
}

function frame(yTicks: number[], y: (v: number) => number, xLabels: { x: number; text: string }[], yTitle: string): string {
  const grid = yTicks.map((v) => `<line class="grid" x1="${M.l}" x2="${W - M.r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>
    <text x="${M.l - 5}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end">${fmtNum(v)}</text>`).join('');
  const xs = xLabels.map((l) => `<text x="${l.x.toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(l.text)}</text>`).join('');
  return `${grid}<line class="axis" x1="${M.l}" x2="${W - M.r}" y1="${H - M.b}" y2="${H - M.b}"/>${xs}
    <text x="4" y="${M.t + 4}" transform="rotate(-90 4 ${M.t + 4})" text-anchor="end">${esc(yTitle)}</text>`;
}

function extent(values: number[], pad = 0.08): [number, number] {
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const p = (hi - lo) * pad;
  return [lo - p, hi + p];
}

/** Espectro: brillo frente a longitud de onda, coloreado por detector, con barras de error. */
export function spectrumSvg(points: SpectrumPoint[]): string {
  const x = scaleLinear([0.75, 5], [M.l, W - M.r]);
  const [lo, hi] = extent(points.flatMap((p) => [p.flux - (p.error ?? 0), p.flux + (p.error ?? 0)]));
  const y = scaleLinear([lo, hi], [H - M.b, M.t]);
  const bands = BANDS.map((b) => `<rect x="${x(b.from).toFixed(1)}" y="${H - M.b + 1}" width="${(x(b.to) - x(b.from)).toFixed(1)}" height="4" fill="${b.color}"/>`).join('');
  const marks = points.map((p) => {
    const c = BANDS[p.detector - 1].color;
    const cx = x(p.wavelength).toFixed(1);
    const bar = p.error ? `<line class="err-bar" stroke="${c}" x1="${cx}" x2="${cx}" y1="${y(p.flux - p.error).toFixed(1)}" y2="${y(p.flux + p.error).toFixed(1)}"/>` : '';
    return `${bar}<circle cx="${cx}" cy="${y(p.flux).toFixed(1)}" r="2" fill="${c}"/>`;
  }).join('');
  const xl = [1, 2, 3, 4, 5].map((v) => ({ x: x(v), text: String(v) }));
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`${T.datos.spectrum}: ${points.length} puntos entre 0.75 y 5 µm`)}">
    ${frame(niceTicks(lo, hi, 4), y, xl, 'µJy')}${bands}${marks}</svg>`;
}

/** Curva de luz: brillo frente a fecha para un detector. */
export function lightCurveSvg(curve: { t: number; flux: number; error: number | null }[], color: string): string {
  const x = scaleLinear([curve[0].t, curve[curve.length - 1].t], [M.l + 6, W - M.r - 6]);
  const [lo, hi] = extent(curve.flatMap((p) => [p.flux - (p.error ?? 0), p.flux + (p.error ?? 0)]));
  const y = scaleLinear([lo, hi], [H - M.b, M.t]);
  const line = `<polyline class="line" points="${curve.map((p) => `${x(p.t).toFixed(1)},${y(p.flux).toFixed(1)}`).join(' ')}"/>`;
  const marks = curve.map((p) => {
    const cx = x(p.t).toFixed(1);
    const bar = p.error ? `<line class="err-bar" stroke="${color}" x1="${cx}" x2="${cx}" y1="${y(p.flux - p.error).toFixed(1)}" y2="${y(p.flux + p.error).toFixed(1)}"/>` : '';
    return `${bar}<circle cx="${cx}" cy="${y(p.flux).toFixed(1)}" r="2.2" fill="${color}"/>`;
  }).join('');
  const first = new Date(curve[0].t).toISOString();
  const last = new Date(curve[curve.length - 1].t).toISOString();
  const xl = curve.length > 1 && first.slice(0, 10) !== last.slice(0, 10)
    ? [{ x: M.l + 30, text: fmtDate(first) }, { x: W - M.r - 30, text: fmtDate(last) }]
    : [{ x: (M.l + W - M.r) / 2, text: fmtDate(first) }];
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`${T.datos.light}: ${curve.length} puntos`)}">
    ${frame(niceTicks(lo, hi, 4), y, xl, 'µJy')}${line}${marks}</svg>`;
}
