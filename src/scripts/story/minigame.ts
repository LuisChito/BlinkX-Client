// AI-assisted development used for code development, debugging and documentation.
// Tool: ChatGPT, Claude
// Mini reto de la portada: encontrar el punto que salta entre dos imágenes.
import { UI } from '../../data/story';
import { gameReducer, hitTest, initialGame, type GameState } from './game';
import { sceneOf, showFrame } from './sky';

export function mountMiniGame(): void {
  const root = document.querySelector<HTMLElement>('[data-game]');
  if (!root) return;
  const canvas = root.querySelector<HTMLCanvasElement>('canvas[data-sky]')!;
  const layer = root.querySelector<HTMLElement>('[data-game-layer]')!;
  const status = root.querySelector<HTMLElement>('[data-game-status]')!;
  const win = root.querySelector<HTMLElement>('[data-game-win]')!;
  const again = root.querySelector<HTMLButtonElement>('[data-game-again]')!;
  let state: GameState = initialGame;
  let built = false;

  function build(): void {
    if (built) return;
    const scene = sceneOf(canvas);
    if (!scene) return;
    built = true;
    showFrame(canvas, 0);
    const pct = (v: number) => `${(v / scene.size) * 100}%`;
    // El objeto ocupa el punto medio entre sus dos posiciones; el botón cubre ambas.
    const mover = { x: (scene.mover[0].x + scene.mover[1].x) / 2, y: (scene.mover[0].y + scene.mover[1].y) / 2 };
    const spread = Math.hypot(scene.mover[0].x - scene.mover[1].x, scene.mover[0].y - scene.mover[1].y);
    const radius = Math.max(22, spread / 2 + 12);
    // Candidatos enfocables con teclado: el que se mueve y cinco estrellas fijas, en orden de lectura.
    const decoys = scene.stars.filter((s) => !hitTest(s, mover, radius * 2)).slice(0, 5);
    const all = [{ ...mover, hit: true }, ...decoys.map((d) => ({ ...d, hit: false }))].sort((a, b) => a.y - b.y || a.x - b.x);
    layer.innerHTML = all
      .map((c, i) => `<button type="button" class="game-spot${c.hit ? ' is-target' : ''}" data-hit="${c.hit}" style="left:${pct(c.x)};top:${pct(c.y)};--r:${pct(c.hit ? radius : 22)}" aria-label="${UI.game.candidate} ${i + 1}"></button>`)
      .join('');

    canvas.addEventListener('click', (e) => {
      const r = canvas.getBoundingClientRect();
      const p = { x: ((e.clientX - r.left) / r.width) * scene.size, y: ((e.clientY - r.top) / r.height) * scene.size };
      apply(hitTest(p, mover, radius) ? 'hit' : 'miss');
    });
  }

  function render(): void {
    root!.dataset.state = state.status;
    win.hidden = state.status !== 'won';
    status.textContent = state.status === 'won' ? '' : state.status === 'revealed' ? UI.game.reveal : state.misses ? UI.game.miss : UI.game.hint;
  }

  function apply(event: 'hit' | 'miss' | 'reset'): void {
    state = gameReducer(state, event);
    render();
    if (state.status === 'won') win.querySelector<HTMLElement>('a')?.focus({ preventScroll: true });
  }

  layer.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.game-spot');
    if (b) apply(b.dataset.hit === 'true' ? 'hit' : 'miss');
  });
  again.addEventListener('click', () => apply('reset'));

  new IntersectionObserver((entries, io) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    build();
  }, { rootMargin: '300px 0px' }).observe(root);
  render();
}
