// Atajos de teclado del visor. No actúan mientras se escribe en un campo.
import type { Detector } from '../../lib/api/types';
import { FOV_MAX, FOV_MIN } from '../../lib/url';
import { step, togglePlay } from './player';
import { setMode, setView, store } from './state';

const FOV_STEPS = [30, 60, 120, 300, 600, 900, 1800, 3600];

function typing(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

export function mountShortcuts(closePanel: () => void): void {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closePanel();
      return;
    }
    if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    const s = store.get();
    const has = s.phase === 'ready' && s.frames.length > 0;

    // Sobre un botón, la barra espaciadora lo activa: no la secuestramos.
    if (e.key === ' ' && (e.target as HTMLElement).tagName !== 'BUTTON') {
      e.preventDefault();
      togglePlay();
    } else if (e.key === 'ArrowRight' && has) {
      e.preventDefault();
      step(1);
    } else if (e.key === 'ArrowLeft' && has) {
      e.preventDefault();
      step(-1);
    } else if ((e.key === 'b' || e.key === 'B') && has) {
      void setMode(s.view.mode === 'blink' ? 'video' : 'blink');
    } else if ((e.key === 'd' || e.key === 'D') && has) {
      void setMode(s.view.mode === 'diff' ? 'video' : 'diff');
    } else if (/^[1-6]$/.test(e.key) && s.target) {
      void setView({ det: Number(e.key) as Detector });
    } else if ((e.key === '+' || e.key === '-') && s.target) {
      // "+" acerca (campo menor), "−" aleja (campo mayor)
      const i = FOV_STEPS.findIndex((v) => v >= s.view.fov);
      const cur = i < 0 ? FOV_STEPS.length - 1 : i;
      const nextFov = FOV_STEPS[Math.max(0, Math.min(FOV_STEPS.length - 1, cur + (e.key === '+' ? -1 : 1)))];
      if (nextFov !== s.view.fov) void setView({ fov: Math.max(FOV_MIN, Math.min(FOV_MAX, nextFov)) });
    }
  });
}
