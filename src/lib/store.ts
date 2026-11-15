// AI-assisted development used for code development, debugging and documentation.
// Tool: ChatGPT, Claude
// Almacén de estado mínimo: un objeto, cambios parciales y suscriptores.
export interface Store<S extends object> {
  get(): S;
  set(patch: Partial<S>): void;
  subscribe(fn: (s: S, prev: S) => void): () => void;
}

export function createStore<S extends object>(initial: S): Store<S> {
  let state = initial;
  const subs = new Set<(s: S, prev: S) => void>();
  return {
    get: () => state,
    set(patch) {
      const keys = Object.keys(patch) as (keyof S)[];
      if (keys.every((k) => Object.is(state[k], patch[k]))) return;
      const prev = state;
      state = { ...state, ...patch };
      for (const fn of [...subs]) fn(state, prev);
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}
