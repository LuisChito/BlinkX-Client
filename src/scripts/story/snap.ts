// AI-assisted development used for code development, debugging and documentation.
// Tool: ChatGPT, Claude
/* Desplazamiento por capítulos: cada gesto de rueda (o AvPág / RePág / Espacio) lleva al
   siguiente o al anterior capítulo, alineado arriba. Si un capítulo es más alto que la pantalla,
   primero se recorre por dentro hasta su final y luego se salta al siguiente. */
import type Lenis from 'lenis';

const EDGE = 4; // px de tolerancia para considerar que se llegó al borde de un capítulo
const SLACK = 0.3; // si lo que falta de un capítulo es menos de 30 % de la pantalla, se salta directo
const QUIET_MS = 180; // pausa en la rueda que separa un gesto del siguiente (inercia del trackpad)

export function mountSnap(lenis: Lenis): () => void {
  const sections = [...document.querySelectorAll<HTMLElement>('[data-chapter]')];
  if (!sections.length) return () => {};

  let busy = false; // hay un salto en curso
  let settling = false; // el salto terminó pero la inercia del gesto anterior sigue llegando
  let lastWheel = 0;

  const docTop = (el: HTMLElement) => el.getBoundingClientRect().top + lenis.scroll;
  const maxScroll = () => lenis.limit;

  /** Calcula a dónde ir desde la posición actual. */
  const targetFor = (dir: 1 | -1): number | null => {
    const y = lenis.scroll;
    const h = window.innerHeight;
    const tops = sections.map(docTop);
    const bottoms = sections.map((s, i) => tops[i] + s.offsetHeight);
    // Capítulo actual: el último cuyo inicio ya pasó por arriba de la pantalla.
    let i = tops.findLastIndex((t) => t <= y + EDGE);
    if (i < 0) i = 0;

    if (dir === 1) {
      // Fin de la historia: deja que el pie de página se alcance normalmente.
      if (i === sections.length - 1 && bottoms[i] <= y + h + EDGE) return y >= maxScroll() - EDGE ? null : maxScroll();
      const remaining = bottoms[i] - (y + h);
      if (remaining > h * SLACK) return Math.min(y + h * 0.85, bottoms[i] - h); // capítulo alto: avanza por dentro
      return i + 1 < sections.length ? tops[i + 1] : maxScroll();
    }

    if (y - tops[i] > h * SLACK) return Math.max(y - h * 0.85, tops[i]); // aún dentro del capítulo: sube por dentro
    if (y > tops[i] + EDGE) return tops[i]; // casi arriba del capítulo: vuelve a su inicio
    if (i === 0) return null;
    // Capítulo anterior: si es mucho más alto que la pantalla se llega a su final; si no, a su inicio.
    const overflow = sections[i - 1].offsetHeight - h;
    return overflow > h * SLACK ? bottoms[i - 1] - h : tops[i - 1];
  };

  const go = (dir: 1 | -1) => {
    const target = targetFor(dir);
    if (target == null || Math.abs(target - lenis.scroll) < 1) return;
    busy = true;
    lenis.scrollTo(target, {
      duration: 0.9,
      easing: (t: number) => 1 - Math.pow(1 - t, 4),
      lock: true,
      force: true,
      onComplete: () => { busy = false; settling = true; },
    });
  };

  // Lenis nos entrega cada evento de rueda; devolver false hace que Lenis lo ignore.
  lenis.options.virtualScroll = ({ deltaX, deltaY, event }) => {
    if (!(event instanceof WheelEvent)) return true; // táctil: desplazamiento nativo
    if (event.ctrlKey) return true; // zoom con Ctrl + rueda
    if (Math.abs(deltaX) > Math.abs(deltaY)) return true;
    if (event.cancelable) event.preventDefault();

    const now = performance.now();
    const gap = now - lastWheel;
    lastWheel = now;
    if (busy) return false;
    if (settling) {
      if (gap < QUIET_MS) return false; // sigue la inercia del gesto anterior
      settling = false;
    }
    if (Math.abs(deltaY) < 2) return false;
    go(deltaY > 0 ? 1 : -1);
    return false;
  };

  // Teclado: AvPág / RePág / Espacio (sin interferir con campos ni botones).
  const onKey = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const el = e.target as HTMLElement;
    if (el.closest('input, textarea, select, button, [contenteditable], [role="tab"]')) return;
    let dir: 1 | -1 | 0 = 0;
    if (e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) dir = 1;
    else if (e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) dir = -1;
    if (!dir) return;
    e.preventDefault();
    if (!busy) go(dir);
  };
  window.addEventListener('keydown', onKey);

  return () => {
    lenis.options.virtualScroll = undefined;
    window.removeEventListener('keydown', onKey);
  };
}
