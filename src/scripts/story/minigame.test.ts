// AI-assisted development used for code development, debugging and documentation.
// Tool: ChatGPT, Claude
import { describe, expect, it } from 'vitest';
import { gameReducer, hitTest, initialGame } from './game';

describe('hitTest', () => {
  it('acepta un clic dentro del radio', () => {
    expect(hitTest({ x: 120, y: 100 }, { x: 100, y: 100 }, 24)).toBe(true);
  });
  it('rechaza un clic fuera del radio', () => {
    expect(hitTest({ x: 130, y: 100 }, { x: 100, y: 100 }, 24)).toBe(false);
  });
});

describe('gameReducer', () => {
  it('gana al acertar', () => {
    expect(gameReducer(initialGame, 'hit')).toEqual({ status: 'won', misses: 0 });
  });
  it('cuenta los fallos y revela el punto al tercero', () => {
    let g = gameReducer(initialGame, 'miss');
    expect(g).toEqual({ status: 'playing', misses: 1 });
    g = gameReducer(g, 'miss');
    g = gameReducer(g, 'miss');
    expect(g).toEqual({ status: 'revealed', misses: 3 });
  });
  it('permite acertar después de la pista', () => {
    expect(gameReducer({ status: 'revealed', misses: 3 }, 'hit').status).toBe('won');
  });
  it('vuelve a empezar', () => {
    expect(gameReducer({ status: 'won', misses: 2 }, 'reset')).toEqual(initialGame);
  });
  it('ignora los clics cuando ya se ganó', () => {
    expect(gameReducer({ status: 'won', misses: 1 }, 'miss')).toEqual({ status: 'won', misses: 1 });
  });
});
