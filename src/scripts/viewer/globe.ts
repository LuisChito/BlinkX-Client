// Mini esfera del cielo: marca en qué parte de la bóveda está la región (proyección ortográfica).
import { T } from '../../data/viewer';
import { formatDec, formatRA } from '../../lib/coords';
import { $ } from './dom';
import { store } from './state';

const RAD = Math.PI / 180;

export function mountGlobe(): void {
  const wrap = $('[data-globe-wrap]');
  const canvas = $<HTMLCanvasElement>('[data-globe]');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const css = getComputedStyle(document.documentElement);
  const line = css.getPropertyValue('--line-strong').trim() || 'rgba(255,255,255,.3)';
  const accent = css.getPropertyValue('--accent').trim() || '#ff8a5c';

  function draw(ra: number, dec: number): void {
    const size = canvas.width;
    const R = size / 2 - 6;
    const c = size / 2;
    // La esfera gira para que el punto quede de frente, un poco inclinado.
    const lon0 = ra * RAD;
    const lat0 = Math.max(-60, Math.min(60, dec)) * 0.6 * RAD;
    const project = (lonDeg: number, latDeg: number) => {
      const lon = lonDeg * RAD - lon0;
      const lat = latDeg * RAD;
      const x = Math.cos(lat) * Math.sin(lon);
      const y = Math.cos(lat0) * Math.sin(lat) - Math.sin(lat0) * Math.cos(lat) * Math.cos(lon);
      const z = Math.sin(lat0) * Math.sin(lat) + Math.cos(lat0) * Math.cos(lat) * Math.cos(lon);
      return { x: c - x * R, y: c - y * R, front: z >= 0 }; // este a la izquierda, como en el cielo
    };
    ctx!.clearRect(0, 0, size, size);
    ctx!.lineWidth = 1;
    ctx!.strokeStyle = line;
    ctx!.beginPath();
    ctx!.arc(c, c, R, 0, Math.PI * 2);
    ctx!.stroke();

    const path = (pts: { x: number; y: number; front: boolean }[]) => {
      ctx!.beginPath();
      let pen = false;
      for (const p of pts) {
        if (!p.front) {
          pen = false;
          continue;
        }
        if (pen) ctx!.lineTo(p.x, p.y);
        else ctx!.moveTo(p.x, p.y);
        pen = true;
      }
      ctx!.stroke();
    };
    ctx!.globalAlpha = 0.55;
    for (let lat = -60; lat <= 60; lat += 30) path(Array.from({ length: 73 }, (_, i) => project(i * 5, lat)));
    for (let lon = 0; lon < 360; lon += 30) path(Array.from({ length: 37 }, (_, i) => project(lon, -90 + i * 5)));
    ctx!.globalAlpha = 1;

    const p = project(ra, dec);
    ctx!.fillStyle = accent;
    ctx!.beginPath();
    ctx!.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx!.fill();
    ctx!.strokeStyle = accent;
    ctx!.beginPath();
    ctx!.arc(p.x, p.y, 11, 0, Math.PI * 2);
    ctx!.stroke();
  }

  const render = () => {
    const t = store.get().target;
    wrap.hidden = !t;
    if (!t) return;
    draw(t.ra, t.dec);
    canvas.setAttribute('aria-label', `${T.globe}: RA ${formatRA(t.ra)}, Dec ${formatDec(t.dec)}`);
  };
  store.subscribe((s, prev) => { if (s.target !== prev.target) render(); });
  render();
}
