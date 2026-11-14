// Arranque de la portada.
import { mountBlinks } from './blink';
import { mountMiniGame } from './minigame';
import { mountMotion } from './motion';
import { mountSkies } from './sky';

mountSkies();
mountBlinks();
mountMiniGame();
mountBands();
mountMotion();

/** Pestañas del capítulo "Qué significa cada color" (patrón de pestañas con flechas). */
function mountBands(): void {
  const root = document.querySelector<HTMLElement>('[data-bands]');
  if (!root) return;
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const select = (tab: HTMLButtonElement, focus = false) => {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(t.getAttribute('aria-controls')!);
      if (panel) panel.hidden = !on;
    }
    if (focus) tab.focus();
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (e) => {
      const map: Record<string, number> = { ArrowRight: (i + 1) % tabs.length, ArrowLeft: (i - 1 + tabs.length) % tabs.length, Home: 0, End: tabs.length - 1 };
      if (!(e.key in map)) return;
      e.preventDefault();
      select(tabs[map[e.key]], true);
    });
  });
}
