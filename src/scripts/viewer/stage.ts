// Escenario: la imagen actual, los mensajes de estado y el encabezado del objeto.
import { QUICK_TARGETS, T } from '../../data/viewer';
import { absolute } from '../../lib/api';
import { formatDec, formatRA } from '../../lib/coords';
import { pixelToSky } from '../../lib/projection';
import { $, esc, fmtDateTime, icon } from './dom';
import { jobCardHtml, updateJobCard } from './jobcard';
import { cancelSequence, loadSequence, loadStill, pick, search, setView, store, type ViewerState } from './state';

/** Qué se muestra ahora: un frame de la secuencia o una imagen calculada (resta / apilado). */
export function shown(s: ViewerState): { url: string; label: string | null; frameIdx: number } | null {
  if (!s.frames.length) return null;
  const { mode } = s.view;
  if ((mode === 'diff' || mode === 'stack') && s.still.status === 'ready' && s.still.data) {
    return { url: s.still.data.url, label: s.still.data.label, frameIdx: mode === 'diff' ? s.ab[0] : s.idx };
  }
  if (mode === 'blink') {
    const i = s.blinkOn ? s.ab[1] : s.ab[0];
    const f = s.frames[Math.min(i, s.frames.length - 1)];
    return { url: f.png_url, label: `${s.blinkOn ? 'B' : 'A'} · ${fmtDateTime(f.date_obs)}`, frameIdx: i };
  }
  const i = Math.min(mode === 'diff' ? s.ab[0] : s.idx, s.frames.length - 1);
  return { url: s.frames[i].png_url, label: null, frameIdx: i };
}

export function mountStage(openPanel: (id: 'datos') => void): void {
  const frame = $('[data-frame]');
  const img = $<HTMLImageElement>('[data-img]');
  const label = $('[data-stage-label]');
  const msg = $('[data-msg]');
  const head = $('[data-head]');
  let msgKey = '';

  // Clic en el cielo: elegir un punto y ver su espectro.
  img.addEventListener('click', (e) => {
    const s = store.get();
    if (!s.target || !s.seq) return;
    const r = img.getBoundingClientRect();
    const size = s.seq.size_px;
    const x = ((e.clientX - r.left) / r.width) * size;
    const y = ((e.clientY - r.top) / r.height) * size;
    void pick(pixelToSky(x, y, s.target, s.view.fov, size));
    openPanel('datos');
  });

  msg.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'cancel-job') cancelSequence();
    if (act === 'retry') void loadSequence();
    if (act === 'retry-still') void loadStill();
    if (act === 'retry-search') void search(store.get().view.name ?? '');
    if (act === 'quick') {
      const t = QUICK_TARGETS[Number(btn.dataset.i)];
      void setView({ det: t.det, fov: t.fov ?? 300 }).then(() => search(t.query));
    }
  });

  const preload = new Map<string, HTMLImageElement>();

  function renderImage(s: ViewerState): void {
    const cur = shown(s);
    frame.hidden = !cur;
    if (!cur) return;
    const url = absolute(cur.url);
    if (img.getAttribute('src') !== url) img.src = url;
    const f = s.frames[cur.frameIdx];
    img.alt = f ? `Imagen infrarroja de SPHEREx del ${fmtDateTime(f.date_obs)}, detector ${f.detector}` : '';
    label.hidden = !cur.label;
    label.textContent = cur.label ?? '';
  }

  function messageHtml(s: ViewerState): { key: string; html: string } {
    const still = s.still;
    switch (s.phase) {
      case 'idle':
        return {
          key: 'idle',
          html: `<div class="state">${icon('crosshair', 40)}<h2 class="display">${esc(T.states.idleTitle)}</h2><p>${esc(T.states.idleBody)}</p>
            <p>${esc(T.states.idleTry)}</p><div class="state-quick">${QUICK_TARGETS.map((t, i) => `<button class="btn" type="button" data-act="quick" data-i="${i}">${esc(t.label)}</button>`).join('')}</div></div>`,
        };
      case 'resolving':
        return { key: 'resolving', html: jobCardHtml(T.states.resolving, null) };
      case 'not-found':
        return {
          key: `nf:${s.error}`,
          html: `<div class="state" role="alert"><h2 class="display">${esc(s.error)}</h2><p>${esc(T.states.notFoundHint)}</p></div>`,
        };
      case 'loading':
        return { key: 'loading', html: jobCardHtml(T.states.loading, s.job, { cancel: true }) };
      case 'empty':
        return { key: 'empty', html: `<div class="state"><h2 class="display">${esc(T.states.emptyTitle)}</h2><p>${esc(T.states.emptyBody)}</p></div>` };
      case 'error':
        return {
          key: `err:${s.error}`,
          html: `<div class="state" role="alert"><h2 class="display">${esc(T.states.errorTitle)}</h2><p>${esc(s.error)}</p>
            <button class="btn btn-primary" type="button" data-act="${s.target ? 'retry' : 'retry-search'}">${icon('refresh', 18)}${esc(T.states.retry)}</button></div>`,
        };
      default:
        if (still.status === 'loading') return { key: 'still', html: jobCardHtml(T.modes[s.view.mode], still.job) };
        if (still.status === 'error') {
          return {
            key: `still-err:${still.error}`,
            html: `<div class="state glass" role="alert"><p>${esc(still.error)}</p><button class="btn" type="button" data-act="retry-still">${icon('refresh', 18)}${esc(T.states.retry)}</button></div>`,
          };
        }
        return { key: '', html: '' };
    }
  }

  function renderMessage(s: ViewerState): void {
    const { key, html } = messageHtml(s);
    if (key !== msgKey) {
      msgKey = key;
      msg.innerHTML = html;
    } else if (key === 'loading') updateJobCard(msg, s.job);
    else if (key === 'still') updateJobCard(msg, s.still.job);
  }

  function renderHead(s: ViewerState): void {
    const t = s.target;
    if (!t) {
      head.innerHTML = '';
      return;
    }
    const c = t.catalog;
    const speed = c?.pm ? Math.hypot(c.pm.ra, c.pm.dec) / 1000 : 0;
    const eyebrow = c ? `${c.source.toUpperCase()}${speed >= 0.05 ? ` · ${speed.toFixed(1)}${T.head.perYear}` : ''}` : T.head.region;
    const note = c && speed >= 0.05
      ? `<p class="note mono">${esc(T.head.propagated)} ${c.current.epoch.toFixed(2)} · ${esc(T.head.catalog)} ${c.epoch.toFixed(1)}</p>`
      : '';
    head.innerHTML = `<p class="eyebrow">${esc(eyebrow)}</p><h1 class="display">${esc(t.label)}</h1>
      <p class="coords mono"><span>RA ${esc(formatRA(t.ra))}</span><span>Dec ${esc(formatDec(t.dec))}</span></p>${note}`;
  }

  store.subscribe((s, prev) => {
    renderImage(s);
    renderMessage(s);
    if (s.target !== prev.target) renderHead(s);
    if (s.frames !== prev.frames) {
      // Precarga para que el video no parpadee al cambiar de imagen.
      for (const f of s.frames) {
        if (preload.has(f.id)) continue;
        const im = new Image();
        im.src = absolute(f.png_url);
        preload.set(f.id, im);
      }
    }
  });
  const s = store.get();
  renderImage(s);
  renderMessage(s);
  renderHead(s);
}
