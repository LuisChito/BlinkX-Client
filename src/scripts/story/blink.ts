// Parpadeo entre dos imágenes del mismo campo: la firma de Blink X.
import { UI } from '../../data/story';
import { showFrame } from './sky';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Alterna las dos imágenes de un lienzo. Solo corre mientras el lienzo está en pantalla.
 * Devuelve la función que lo detiene.
 */
export function startBlink(canvas: HTMLCanvasElement, opts: { intervalMs: number; onFlip?: (i: number) => void }): () => void {
  let i = Number(canvas.dataset.shown ?? 0);
  let timer: ReturnType<typeof setInterval> | null = null;
  let visible = false;
  let stopped = false;
  const flip = () => {
    i = i === 0 ? 1 : 0;
    showFrame(canvas, i);
    opts.onFlip?.(i);
  };
  const sync = () => {
    const run = visible && !stopped && !document.hidden;
    if (run && !timer) timer = setInterval(flip, opts.intervalMs);
    if (!run && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    sync();
  }, { threshold: 0.2 });
  io.observe(canvas);
  document.addEventListener('visibilitychange', sync);
  return () => {
    stopped = true;
    sync();
    io.disconnect();
    document.removeEventListener('visibilitychange', sync);
  };
}

/** Bloques [data-blink]: parpadeo automático más un botón para alternar a mano. */
export function mountBlinks(): void {
  for (const root of document.querySelectorAll<HTMLElement>('[data-blink]')) {
    const canvas = root.querySelector<HTMLCanvasElement>('canvas[data-sky]');
    if (!canvas) continue;
    const label = root.querySelector<HTMLElement>('[data-blink-label]');
    const toggle = root.querySelector<HTMLButtonElement>('[data-blink-toggle]');
    const auto = root.querySelector<HTMLInputElement>('[data-blink-auto]');
    const setLabel = (i: number) => {
      if (label) label.textContent = i === 0 ? UI.plates.a : UI.plates.b;
    };
    let stop: (() => void) | null = null;
    const run = (on: boolean) => {
      stop?.();
      stop = on ? startBlink(canvas, { intervalMs: Number(root.dataset.blink) || 700, onFlip: setLabel }) : null;
      if (auto) auto.checked = on;
    };
    toggle?.addEventListener('click', () => {
      run(false); // alternar a mano detiene el automático
      const next = Number(canvas.dataset.shown ?? 0) === 0 ? 1 : 0;
      showFrame(canvas, next);
      setLabel(next);
    });
    auto?.addEventListener('change', () => run(auto.checked));
    // Con "reducir movimiento" nada parpadea solo: queda el botón.
    run(!reduced());
  }
}
