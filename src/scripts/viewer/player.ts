// Barra inferior: reproducir, línea de tiempo, modos y atajos de imagen.
import { bandOf } from '../../data/bands';
import { T } from '../../data/viewer';
import type { ViewMode } from '../../lib/url';
import { $, $$, fmtDateTime } from './dom';
import { effectiveDetector, loadMore, loadStill, setMode, store, type ViewerState } from './state';
import { frameIntervalMs, nextIndex, passGroups, passOf } from './timeline';

const SPEEDS: (1 | 2 | 4)[] = [1, 2, 4];

/** Se puede reproducir en Video y en Parpadeo; Resta y Apilar son imágenes fijas. */
export const canPlay = (s: ViewerState): boolean =>
  s.phase === 'ready' && s.frames.length > 1 && (s.view.mode === 'video' || s.view.mode === 'blink');

export function togglePlay(): void {
  const s = store.get();
  if (!canPlay(s)) return;
  store.set({ playing: !s.playing });
}

export function step(dir: 1 | -1): void {
  const s = store.get();
  if (!s.frames.length) return;
  if (s.view.mode === 'blink') {
    store.set({ playing: false, blinkOn: !s.blinkOn });
    return;
  }
  store.set({ playing: false, idx: nextIndex(s.idx, s.frames.length, dir) });
  if (s.view.mode === 'stack') void loadStill();
}

function fovLabel(fov: number): string {
  return fov >= 60 && fov % 60 === 0 ? `${fov / 60}′` : `${fov}″`;
}

export function mountPlayer(openPanel: (id: 'imagen') => void): void {
  const play = $<HTMLButtonElement>('[data-play]');
  const icoPlay = $('[data-ico-play]');
  const icoPause = $('[data-ico-pause]');
  const prev = $<HTMLButtonElement>('[data-prev]');
  const next = $<HTMLButtonElement>('[data-next]');
  const speed = $<HTMLButtonElement>('[data-speed]');
  const range = $<HTMLInputElement>('[data-range]');
  const passes = $('[data-passes]');
  const count = $('[data-count]');
  const date = $('[data-date]');
  const more = $<HTMLButtonElement>('[data-more]');
  const modes = $$<HTMLButtonElement>('[data-mode]');
  const quickDet = $('[data-quick-det]');
  const quickFov = $('[data-quick-fov]');

  play.addEventListener('click', togglePlay);
  prev.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));
  speed.addEventListener('click', () => {
    const s = store.get();
    store.set({ speed: SPEEDS[(SPEEDS.indexOf(s.speed) + 1) % SPEEDS.length] });
  });
  range.addEventListener('input', () => {
    store.set({ playing: false, idx: Number(range.value) });
  });
  range.addEventListener('change', () => {
    if (store.get().view.mode === 'stack') void loadStill();
  });
  more.addEventListener('click', () => void loadMore());
  for (const b of modes) b.addEventListener('click', () => void setMode(b.dataset.mode as ViewMode));
  for (const b of $$('[data-quick]')) b.addEventListener('click', () => openPanel('imagen'));

  // Reloj de reproducción
  let timer: ReturnType<typeof setInterval> | null = null;
  let timerKey = '';
  function syncTimer(s: ViewerState): void {
    const on = s.playing && canPlay(s);
    const key = on ? `${s.view.mode}:${s.speed}` : '';
    if (key === timerKey) return;
    timerKey = key;
    if (timer) clearInterval(timer);
    timer = null;
    if (!on) return;
    const blink = s.view.mode === 'blink';
    timer = setInterval(() => {
      const cur = store.get();
      if (blink) store.set({ blinkOn: !cur.blinkOn });
      else store.set({ idx: nextIndex(cur.idx, cur.frames.length, 1) });
    }, blink ? frameIntervalMs(s.speed) * 1.5 : frameIntervalMs(s.speed));
  }
  // No gastar batería ni datos con la pestaña oculta.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) store.set({ playing: false });
  });

  let groups: number[][] = [];
  function render(s: ViewerState, prevState?: ViewerState): void {
    const n = s.frames.length;
    const has = s.phase === 'ready' && n > 0;
    const playable = canPlay(s);
    if (s.playing && !playable) {
      store.set({ playing: false });
      return;
    }

    play.disabled = !playable;
    play.setAttribute('aria-label', s.playing ? T.player.pause : T.player.play);
    icoPlay.hidden = s.playing;
    icoPause.hidden = !s.playing;
    prev.disabled = next.disabled = !has;
    speed.textContent = `${s.speed}×`;

    const scrub = has && s.view.mode !== 'blink' && s.view.mode !== 'diff';
    range.disabled = !scrub;
    range.max = String(Math.max(0, n - 1));
    range.value = String(Math.min(s.idx, Math.max(0, n - 1)));

    if (!prevState || s.frames !== prevState.frames) {
      groups = passGroups(s.frames);
      passes.innerHTML = groups.map((g) => `<i style="flex:${g.length}"></i>`).join('');
    }
    const current = passOf(groups, s.idx);
    [...passes.children].forEach((el, i) => el.classList.toggle('is-current', i === current));

    const f = s.frames[Math.min(s.idx, n - 1)];
    count.textContent = has ? `${s.idx + 1} / ${n}${s.total > n ? ` de ${s.total}` : ''}` : '— / —';
    if (has && f) {
      range.setAttribute('aria-valuetext', `Imagen ${s.idx + 1} de ${n}, ${fmtDateTime(f.date_obs)}`);
      date.textContent = `${fmtDateTime(f.date_obs)} · ${f.band_um.toFixed(2)} µm`;
    } else {
      date.textContent = '';
    }

    more.hidden = !(has && s.total > n);
    more.disabled = s.loadingMore;
    more.textContent = s.loadingMore ? T.player.loadingMore : `${T.player.more} (${n} de ${s.total})`;

    for (const b of modes) {
      b.setAttribute('aria-pressed', String(b.dataset.mode === s.view.mode));
      b.disabled = !has;
    }
    const det = effectiveDetector(s.view);
    quickDet.textContent = `Det ${det} · ${bandOf(det).from}–${bandOf(det).to} µm`;
    quickFov.textContent = fovLabel(s.view.fov);
    syncTimer(s);
  }

  store.subscribe(render);
  render(store.get());
}
