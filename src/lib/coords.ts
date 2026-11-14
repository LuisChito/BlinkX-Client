export interface SkyPoint {
  ra: number;
  dec: number;
}

const ALLOWED = /^[0-9.+\-−\s,:hmsd°'′″"]+$/i;

/**
 * Convierte texto en coordenadas (grados). Acepta:
 *  - decimal: "133.79514 -7.24515" o "133.79514, -7.24515"
 *  - sexagesimal: "08h55m10.831s -7d14m42.53s", "08 55 10.8 -07 14 42.5", "17:57:48.5 +04:41:36"
 * Devuelve null si no parece una coordenada o si está fuera de rango.
 */
export function parseCoords(input: string): SkyPoint | null {
  const text = input.trim().replace(/−/g, '-');
  if (!text || !ALLOWED.test(text)) return null;

  const tokens = text
    .replace(/[hmsd°'′″":,]/gi, ' ')
    .trim()
    .split(/\s+/);
  if (!tokens.every((t) => /^[+-]?\d+(\.\d+)?$/.test(t))) return null;

  let ra: number;
  let dec: number;
  if (tokens.length === 2) {
    ra = Number(tokens[0]);
    dec = Number(tokens[1]);
  } else if (tokens.length === 6) {
    const [h, m, s, d, dm, ds] = tokens.map(Number);
    if (m >= 60 || s >= 60 || dm >= 60 || ds >= 60 || h >= 24 || h < 0) return null;
    ra = (h + m / 60 + s / 3600) * 15;
    // El signo se lee del texto: "-00 30 00" es negativo aunque Number("-00") sea 0.
    const sign = tokens[3].startsWith('-') ? -1 : 1;
    dec = sign * (Math.abs(d) + dm / 60 + ds / 3600);
  } else {
    return null;
  }

  if (!Number.isFinite(ra) || !Number.isFinite(dec)) return null;
  if (ra < 0 || ra >= 360 || dec < -90 || dec > 90) return null;
  return { ra, dec };
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

export function formatRA(deg: number): string {
  const day = 24 * 360000; // centésimas de segundo en 24 h
  let totalCs = Math.round((deg / 15) * 3600 * 100);
  totalCs = ((totalCs % day) + day) % day;
  const h = Math.floor(totalCs / 360000);
  const m = Math.floor((totalCs % 360000) / 6000);
  const s = (totalCs % 6000) / 100;
  return `${pad(h)}h${pad(m)}m${s.toFixed(2).padStart(5, '0')}s`;
}

export function formatDec(deg: number): string {
  const sign = deg < 0 ? '−' : '+';
  const totalDs = Math.round(Math.abs(deg) * 3600 * 10); // décimas de segundo
  const d = Math.floor(totalDs / 36000);
  const m = Math.floor((totalDs % 36000) / 600);
  const s = (totalDs % 600) / 10;
  return `${sign}${pad(d)}°${pad(m)}′${s.toFixed(1).padStart(4, '0')}″`;
}

/** Diferencia de RA en grados, llevada al intervalo (−180, 180]. */
export function deltaRa(a: number, b: number): number {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/** Separación angular aproximada en segundos de arco (válida para campos pequeños). */
export function separationArcsec(a: SkyPoint, b: SkyPoint): number {
  const toRad = Math.PI / 180;
  const dRa = deltaRa(a.ra, b.ra) * Math.cos(((a.dec + b.dec) / 2) * toRad);
  const dDec = a.dec - b.dec;
  return Math.sqrt(dRa * dRa + dDec * dDec) * 3600;
}
