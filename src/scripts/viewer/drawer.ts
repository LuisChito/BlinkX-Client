// Cajón lateral: un panel a la vez. Cada panel declara de qué depende, su HTML y cómo responde a acciones.
import { T } from '../../data/viewer';
import { $, $$ } from './dom';
import { capas } from './panels/capas';
import { comparar } from './panels/comparar';
import { datos } from './panels/datos';
import { imagen } from './panels/imagen';
import { tiempo } from './panels/tiempo';
import { store, type PanelId, type ViewerState } from './state';

export interface Panel {
  /** Firma de lo que el panel muestra: solo se repinta cuando cambia. */
  key(s: ViewerState): string;
  html(s: ViewerState): string;
  /** Clic en [data-act] o cambio en [data-change]. */
  on(action: string, el: HTMLElement, root: HTMLElement): void;
  /** Actualiza partes vivas (progreso) sin repintar. */
  tick?(s: ViewerState, root: HTMLElement): void;
}

const PANELS: Record<PanelId, Panel> = { tiempo, comparar, imagen, capas, datos };

let lastOpener: HTMLElement | null = null;

export function openPanel(id: PanelId | null): void {
  store.set({ panel: store.get().panel === id ? id : id });
}

export function togglePanel(id: PanelId): void {
  store.set({ panel: store.get().panel === id ? null : id });
}

export function closePanel(): void {
  if (store.get().panel === null) return;
  store.set({ panel: null });
  lastOpener?.focus();
}

export function mountDrawer(): void {
  const root = $('[data-viewer]');
  const drawer = $('[data-drawer]');
  const title = $('[data-drawer-title]');
  const body = $('[data-drawer-body]');
  const buttons = $$<HTMLButtonElement>('[data-panel-btn]');
  let shownPanel: PanelId | null = null;
  let shownKey = '';

  for (const b of buttons) {
    b.addEventListener('click', () => {
      lastOpener = b;
      togglePanel(b.dataset.panelBtn as PanelId);
    });
  }
  $('[data-drawer-close]').addEventListener('click', closePanel);
  // En móvil, tocar la cabecera alterna entre hoja baja y alta.
  $('.drawer-head', drawer).addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    drawer.classList.toggle('is-tall');
  });

  body.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    const id = store.get().panel;
    if (el && id) PANELS[id].on(el.dataset.act!, el, body);
  });
  body.addEventListener('change', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-change]');
    const id = store.get().panel;
    if (el && id) PANELS[id].on(el.dataset.change!, el, body);
  });
  body.addEventListener('submit', (e) => {
    e.preventDefault();
    const el = e.target as HTMLElement;
    const id = store.get().panel;
    if (el.dataset.submit && id) PANELS[id].on(el.dataset.submit, el, body);
  });

  function render(s: ViewerState): void {
    const id = s.panel;
    drawer.hidden = !id;
    root.classList.toggle('has-drawer', !!id);
    for (const b of buttons) b.setAttribute('aria-expanded', String(b.dataset.panelBtn === id));
    if (!id) {
      shownPanel = null;
      shownKey = '';
      return;
    }
    const panel = PANELS[id];
    const key = panel.key(s);
    if (id !== shownPanel || key !== shownKey) {
      // Conserva el foco al repintar: los controles llevan data-fid.
      const fid = (document.activeElement as HTMLElement | null)?.dataset?.fid;
      const scroll = id === shownPanel ? body.scrollTop : 0;
      title.textContent = T.panels[id];
      body.innerHTML = panel.html(s);
      body.scrollTop = scroll;
      if (fid && id === shownPanel) body.querySelector<HTMLElement>(`[data-fid="${fid}"]`)?.focus();
      shownPanel = id;
      shownKey = key;
    }
    panel.tick?.(s, body);
  }

  store.subscribe(render);
  render(store.get());
}
