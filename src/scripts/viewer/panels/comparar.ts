// Panel Comparar: elegir las imágenes A y B y el modo de comparación.
import { T } from '../../../data/viewer';
import type { ViewMode } from '../../../lib/url';
import { esc, fmtDateTime, icon } from '../dom';
import type { Panel } from '../drawer';
import { loadStill, setMode, store, type ViewerState } from '../state';
import { passGroups } from '../timeline';

function options(s: ViewerState, selected: number): string {
  return passGroups(s.frames)
    .map((g, gi) => `<optgroup label="${esc(`${T.comparar.pass} ${gi + 1}`)}">${g
      .map((i) => `<option value="${i}" ${i === selected ? 'selected' : ''}>${esc(fmtDateTime(s.frames[i].date_obs))}</option>`)
      .join('')}</optgroup>`)
    .join('');
}

const MODES: ViewMode[] = ['blink', 'diff', 'stack'];

export const comparar: Panel = {
  key: (s) => JSON.stringify([s.frames.length, s.frames[0]?.id, s.ab, s.view.mode, s.phase]),

  html(s) {
    if (!s.frames.length) return `<p class="help">${esc(T.comparar.needFrames)}</p>`;
    return `
      <section>
        <p class="help">${esc(T.comparar.intro)}</p>
        <div class="stack"><label for="cmp-a">${esc(T.comparar.a)}</label><select id="cmp-a" data-fid="a" data-change="a">${options(s, s.ab[0])}</select></div>
        <div class="stack"><label for="cmp-b">${esc(T.comparar.b)}</label><select id="cmp-b" data-fid="b" data-change="b">${options(s, s.ab[1])}</select></div>
        <button class="btn" type="button" data-act="swap" data-fid="swap">${icon('compare', 18)}${esc(T.comparar.swap)}</button>
      </section>
      <section>
        <h3>${esc(T.player.mode)}</h3>
        <div class="stack">${MODES.map((m) => `
          <button class="det-btn" style="grid-template-columns:1fr" type="button" data-act="mode" data-mode="${m}" data-fid="m-${m}" aria-pressed="${s.view.mode === m}">
            <span><b>${esc(T.modes[m])}</b><br><small style="justify-self:start">${esc(T.modeHelp[m])}</small></span>
          </button>`).join('')}
        </div>
      </section>`;
  },

  on(action, el) {
    const s = store.get();
    if (action === 'a' || action === 'b') {
      const v = Number((el as HTMLSelectElement).value);
      store.set({ ab: action === 'a' ? [v, s.ab[1]] : [s.ab[0], v] });
      if (s.view.mode === 'diff') void loadStill();
    } else if (action === 'swap') {
      store.set({ ab: [s.ab[1], s.ab[0]] });
      if (s.view.mode === 'diff') void loadStill();
    } else if (action === 'mode') {
      const m = el.dataset.mode as ViewMode;
      void setMode(s.view.mode === m ? 'video' : m);
    }
  },
};
