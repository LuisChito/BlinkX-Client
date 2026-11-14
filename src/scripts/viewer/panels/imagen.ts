// Panel Imagen: detector, campo de visión, contraste, color y escala de brillo.
import { BANDS, rangeLabel } from '../../../data/bands';
import { FOV_PRESETS, T } from '../../../data/viewer';
import type { Cmap, Detector, Scale, Stretch } from '../../../lib/api/types';
import { FOV_MAX, FOV_MIN } from '../../../lib/url';
import { esc } from '../dom';
import type { Panel } from '../drawer';
import { effectiveDetector, setView, store } from '../state';

function seg<V extends string>(name: string, labels: Record<V, string>, current: V): string {
  return `<div class="seg" role="group">${(Object.keys(labels) as V[])
    .map((v) => `<button class="btn" type="button" data-act="${name}" data-v="${v}" data-fid="${name}-${v}" aria-pressed="${v === current}">${esc(labels[v])}</button>`)
    .join('')}</div>`;
}

export const imagen: Panel = {
  key: (s) => JSON.stringify([effectiveDetector(s.view), s.view.fov, s.view.stretch, s.view.cmap, s.view.scale]),

  html(s) {
    const det = effectiveDetector(s.view);
    return `
      <section>
        <h3>${esc(T.imagen.detector)}</h3>
        <p class="help">${esc(T.imagen.detectorHelp)}</p>
        <div class="det-list">${BANDS.map((b) => `
          <button class="det-btn" type="button" data-act="det" data-v="${b.det}" data-fid="det-${b.det}" aria-pressed="${b.det === det}">
            <i style="background:${b.color}"></i><span>${b.det} · ${esc(b.title)}</span><small class="mono">${esc(rangeLabel(b))}</small>
          </button>`).join('')}
        </div>
      </section>
      <section>
        <h3>${esc(T.imagen.fov)}</h3>
        <p class="help">${esc(T.imagen.fovHelp)}</p>
        <div class="seg" role="group">${FOV_PRESETS.map((p) => `<button class="btn mono" type="button" data-act="fov" data-v="${p.value}" data-fid="fov-${p.value}" aria-pressed="${p.value === s.view.fov}">${esc(p.label)}</button>`).join('')}</div>
        <form class="row" data-submit="fov-custom" novalidate>
          <div class="stack"><label for="fov-n">${esc(T.imagen.fovCustom)}</label>
            <input id="fov-n" data-fid="fov-n" type="number" inputmode="numeric" min="${FOV_MIN}" max="${FOV_MAX}" step="10" value="${s.view.fov}"></div>
          <button class="btn" type="submit" data-fid="fov-apply">${esc(T.imagen.apply)}</button>
        </form>
      </section>
      <section><h3>${esc(T.imagen.scale)}</h3>${seg('scale', T.scale, s.view.scale)}<p class="help">${esc(T.scaleHelp[s.view.scale])}</p></section>
      <section><h3>${esc(T.imagen.stretch)}</h3>${seg('stretch', T.stretch, s.view.stretch)}</section>
      <section><h3>${esc(T.imagen.cmap)}</h3>${seg('cmap', T.cmap, s.view.cmap)}</section>`;
  },

  on(action, el, root) {
    const v = el.dataset.v ?? '';
    if (action === 'det') void setView({ det: Number(v) as Detector });
    else if (action === 'fov') void setView({ fov: Number(v) });
    else if (action === 'fov-custom') {
      const n = Number(root.querySelector<HTMLInputElement>('#fov-n')!.value);
      // Fuera de rango se recorta al límite más cercano en lugar de fallar.
      if (Number.isFinite(n)) void setView({ fov: Math.round(Math.max(FOV_MIN, Math.min(FOV_MAX, n))) });
      else store.set({ view: { ...store.get().view } });
    } else if (action === 'scale') void setView({ scale: v as Scale });
    else if (action === 'stretch') void setView({ stretch: v as Stretch });
    else if (action === 'cmap') void setView({ cmap: v as Cmap });
  },
};
