// Arranque del visor: lee la URL, monta los módulos y mantiene la URL al día.
import { T } from '../../data/viewer';
import { formatDec, formatRA } from '../../lib/coords';
import { readState, writeState } from '../../lib/url';
import { $ } from './dom';
import { closePanel, mountDrawer, openPanel } from './drawer';
import { mountGlobe } from './globe';
import { mountOverlay } from './overlay';
import { mountPlayer } from './player';
import { mountSearch } from './search';
import { mountShare } from './share';
import { mountShortcuts } from './shortcuts';
import { mountStage } from './stage';
import { openRegion, resetState, search, store } from './state';

const view = readState(location.search);
resetState(view);

const root = $('[data-viewer]');
root.classList.toggle('is-embed', view.embed);

mountSearch();
mountStage(openPanel);
mountOverlay();
mountPlayer(openPanel);
mountDrawer();
mountGlobe();
mountShare();
mountShortcuts(closePanel);

// Cada vista tiene su propio enlace. Con nombre se guarda el nombre (la posición se recalcula al abrir);
// sin nombre se guardan las coordenadas.
const extra = new URLSearchParams(location.search).get('mock');
store.subscribe((s, prev) => {
  if (s.view === prev.view && s.target === prev.target) return;
  const named = !!s.view.name;
  let qs = writeState({ ...s.view, ra: named ? undefined : s.target?.ra, dec: named ? undefined : s.target?.dec });
  if (extra) qs += `${qs ? '&' : '?'}mock=${encodeURIComponent(extra)}`;
  history.replaceState(null, '', `${location.pathname}${qs}`);
});

// Aviso discreto cuando alguna fuente externa no responde.
const banner = $('[data-banner]');
store.subscribe((s, prev) => {
  if (s.status === prev.status) return;
  const down = Object.entries(s.status?.sources ?? {}).filter(([, v]) => !v.ok).map(([k]) => k.toUpperCase());
  banner.hidden = down.length === 0;
  banner.textContent = down.length ? `${T.states.degraded} ${down.join(', ')}` : '';
});

if (view.name) {
  void search(view.name);
} else if (view.ra !== undefined && view.dec !== undefined) {
  void openRegion({ ra: view.ra, dec: view.dec, label: `${formatRA(view.ra)} ${formatDec(view.dec)}` });
}
