// Lógica del mini reto "Encuentra el que se mueve" (sin DOM).

export function hitTest(click: { x: number; y: number }, mover: { x: number; y: number }, radiusPx: number): boolean {
  return Math.hypot(click.x - mover.x, click.y - mover.y) <= radiusPx;
}

export interface GameState { status: 'playing' | 'revealed' | 'won'; misses: number }
export const initialGame: GameState = { status: 'playing', misses: 0 };

/** Tras tres fallos se revela dónde está el objeto; el jugador aún puede hacer clic en él. */
export function gameReducer(state: GameState, event: 'hit' | 'miss' | 'reset'): GameState {
  if (event === 'reset') return initialGame;
  if (state.status === 'won') return state;
  if (event === 'hit') return { status: 'won', misses: state.misses };
  const misses = state.misses + 1;
  return { status: misses >= 3 ? 'revealed' : state.status, misses };
}
