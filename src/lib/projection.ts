// AI-assisted development used for code development, debugging and documentation.
// Tool: ChatGPT, Claude
// Geometría de los PNG según el contrato v0.3: proyección tangente, norte arriba, este a la izquierda,
// centrados en el punto pedido, `size` × `size` píxeles que cubren `fov` segundos de arco por lado.
import { deltaRa, type SkyPoint } from './coords';

const RAD = Math.PI / 180;

export function skyToPixel(p: SkyPoint, center: SkyPoint, fov: number, size: number): { x: number; y: number } {
  const scale = size / fov; // px por ″
  return {
    x: size / 2 - deltaRa(p.ra, center.ra) * Math.cos(center.dec * RAD) * 3600 * scale,
    y: size / 2 - (p.dec - center.dec) * 3600 * scale,
  };
}

export function pixelToSky(x: number, y: number, center: SkyPoint, fov: number, size: number): SkyPoint {
  const scale = size / fov;
  const cos = Math.max(1e-6, Math.cos(center.dec * RAD));
  const ra = center.ra - (x - size / 2) / (3600 * scale * cos);
  return {
    ra: ((ra % 360) + 360) % 360,
    dec: center.dec - (y - size / 2) / (3600 * scale),
  };
}

export function decimalYear(d: Date): number {
  const y = d.getUTCFullYear();
  const start = Date.UTC(y, 0, 1);
  const end = Date.UTC(y + 1, 0, 1);
  return y + (d.getTime() - start) / (end - start);
}

/**
 * Lleva una posición de catálogo a otra época usando el movimiento propio
 * (pm.ra = μα·cos δ, pm.dec = μδ, ambos en mas/año).
 */
export function propagate(
  pos: SkyPoint & { epoch: number },
  pm: { ra: number; dec: number } | null,
  toEpoch: number,
): SkyPoint {
  if (!pm) return { ra: pos.ra, dec: pos.dec };
  const years = toEpoch - pos.epoch;
  const cos = Math.max(1e-6, Math.cos(pos.dec * RAD));
  const ra = pos.ra + (pm.ra * years) / 3.6e6 / cos;
  return {
    ra: ((ra % 360) + 360) % 360,
    dec: Math.max(-90, Math.min(90, pos.dec + (pm.dec * years) / 3.6e6)),
  };
}
