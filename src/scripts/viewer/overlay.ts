// Capa de anotaciones (SVG) sobre la imagen. Todo se coloca con la fórmula del contrato.
import { T } from '../../data/viewer';
import { skyToPixel } from '../../lib/projection';
import { $, esc } from './dom';
import { shown } from './stage';
import { store, type ViewerState } from './state';

export function overlaySvg(s: ViewerState): string {
  const t = s.target;
  const cur = shown(s);
  if (!t || !cur) return '';
  const S = s.seq?.size_px ?? 512;
  const fov = s.view.fov;
  const u = S / 512; // unidad visual: los trazos se ven igual con cualquier tamaño de PNG
  const px = (p: { ra: number; dec: number }) => skyToPixel(p, t, fov, S);
  const inside = (p: { x: number; y: number }, m = 0) => p.x >= -m && p.y >= -m && p.x <= S + m && p.y <= S + m;
  const n = (v: number) => v.toFixed(1);
  const out: string[] = [];

  if (s.layers.wise && s.wise) {
    for (const o of s.wise.sources) {
      const p = px(o);
      if (inside(p)) out.push(`<rect class="ov-wise" x="${n(p.x - 6 * u)}" y="${n(p.y - 6 * u)}" width="${n(12 * u)}" height="${n(12 * u)}"/>`);
    }
  }
  if (s.layers.gaia && s.gaia) {
    for (const o of s.gaia.sources) {
      const p = px(o);
      const r = 6 * u;
      if (inside(p)) out.push(`<path class="ov-gaia" d="M${n(p.x)} ${n(p.y - r)}L${n(p.x + r)} ${n(p.y)}L${n(p.x)} ${n(p.y + r)}L${n(p.x - r)} ${n(p.y)}Z"/>`);
    }
  }
  if (s.layers.objects && s.objects) {
    for (const o of s.objects.objects) {
      const p = px(o);
      if (!inside(p)) continue;
      const kind = T.objectType[o.type];
      out.push(`<g class="ov-obj${o.type === 'galaxy' ? ' is-galaxy' : ''}" tabindex="0" role="img" aria-label="${esc(`${o.name}, ${kind}, ${o.source.toUpperCase()}`)}">
        <circle cx="${n(p.x)}" cy="${n(p.y)}" r="${n(8 * u)}"/>
        <text x="${n(p.x + 12 * u)}" y="${n(p.y + 4 * u)}" font-size="${n(11 * u)}">${esc(o.name)}</text></g>`);
    }
  }
  if (s.layers.prediction && s.prediction?.positions.length) {
    const pts = s.prediction.positions.map((q) => ({ t: Date.parse(q.date), ...px(q) }));
    out.push(`<polyline class="ov-path" points="${pts.map((p) => `${n(p.x)},${n(p.y)}`).join(' ')}"/>`);
    const frame = s.frames[cur.frameIdx];
    if (frame) {
      const now = Date.parse(frame.date_obs);
      const near = pts.reduce((a, b) => (Math.abs(b.t - now) < Math.abs(a.t - now) ? b : a));
      if (inside(near, 20 * u)) {
        out.push(`<circle class="ov-now" cx="${n(near.x)}" cy="${n(near.y)}" r="${n(13 * u)}"/>
          <text class="ov-label is-accent" x="${n(near.x + 18 * u)}" y="${n(near.y - 10 * u)}" font-size="${n(11 * u)}">${esc(s.prediction.target)}</text>`);
      }
    }
  }
  if (s.picked) {
    const p = px(s.picked);
    if (inside(p)) out.push(`<circle class="ov-pick" cx="${n(p.x)}" cy="${n(p.y)}" r="${n(9 * u)}"/>`);
  }
  if (s.layers.reticle) {
    const c = S / 2;
    const a = 16 * u;
    const b = 30 * u;
    out.push(`<path class="ov-reticle" d="M${n(c - b)} ${c}H${n(c - a)}M${n(c + a)} ${c}H${n(c + b)}M${c} ${n(c - b)}V${n(c - a)}M${c} ${n(c + a)}V${n(c + b)}"/>`);
  }
  return out.join('');
}

export function mountOverlay(): void {
  const svg = $<SVGSVGElement>('[data-overlay]');
  let last = '';
  const render = (s: ViewerState) => {
    const S = s.seq?.size_px ?? 512;
    svg.setAttribute('viewBox', `0 0 ${S} ${S}`);
    const html = overlaySvg(s);
    if (html === last) return;
    last = html;
    svg.innerHTML = html;
  };
  store.subscribe(render);
  render(store.get());
}
