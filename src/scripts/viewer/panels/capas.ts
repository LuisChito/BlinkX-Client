// Panel Capas: qué se dibuja encima de la imagen.
import { T } from '../../../data/viewer';
import { esc } from '../dom';
import type { Panel } from '../drawer';
import { setLayer, store, type LayerId, type ViewerState } from '../state';

interface Row { id: LayerId; label: string; help: string; swatch: string; color: string }

const ROWS: Row[] = [
  { id: 'objects', label: T.capas.objects, help: T.capas.objectsHelp, swatch: 'is-circle', color: 'var(--fg)' },
  { id: 'gaia', label: T.capas.gaia, help: T.capas.gaiaHelp, swatch: 'is-diamond', color: 'var(--gaia)' },
  { id: 'wise', label: T.capas.wise, help: T.capas.wiseHelp, swatch: '', color: 'var(--wise)' },
  { id: 'prediction', label: T.capas.prediction, help: T.capas.predictionHelp, swatch: 'is-circle', color: 'var(--accent)' },
  { id: 'reticle', label: T.capas.reticle, help: T.capas.reticleHelp, swatch: 'is-circle', color: 'var(--accent)' },
];

function count(s: ViewerState, id: LayerId): string {
  if (!s.layers[id] || !s.target) return '';
  const n = id === 'objects' ? s.objects?.objects.length
    : id === 'gaia' ? s.gaia?.sources.length
      : id === 'wise' ? s.wise?.sources.length
        : id === 'prediction' ? s.prediction?.positions.length
          : -1;
  if (n === -1) return '';
  if (n === undefined) return ` · ${T.capas.loading}`;
  return n === 0 ? ` · ${T.capas.empty}` : ` · ${n}`;
}

export const capas: Panel = {
  key: (s) => JSON.stringify([s.layers, s.objects?.objects.length, s.gaia?.sources.length, s.wise?.sources.length, s.prediction?.positions.length,
    s.objects?.warnings, s.gaia?.warnings, s.wise?.warnings, !!s.target]),

  html(s) {
    const warnings = [...(s.objects?.warnings ?? []), ...(s.layers.gaia ? s.gaia?.warnings ?? [] : []), ...(s.layers.wise ? s.wise?.warnings ?? [] : [])];
    return `
      <section>${ROWS.map((r) => `
        <label class="check">
          <input type="checkbox" data-change="layer" data-v="${r.id}" data-fid="layer-${r.id}" ${s.layers[r.id] ? 'checked' : ''}>
          <span><i class="swatch ${r.swatch}" style="color:${r.color}"></i>${esc(r.label)}<span class="mono muted">${esc(count(s, r.id))}</span></span>
          <small>${esc(r.help)}</small>
        </label>`).join('')}
      </section>
      ${warnings.length ? `<section>${warnings.map((w) => `<p class="warn" role="status">${esc(w)}</p>`).join('')}</section>` : ''}`;
  },

  on(action, el) {
    if (action === 'layer') setLayer(el.dataset.v as LayerId, (el as HTMLInputElement).checked);
    void store;
  },
};
