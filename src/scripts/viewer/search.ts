// Buscador: decide si el texto es un nombre o unas coordenadas, y nunca navega a un punto dudoso.
import { T } from '../../data/viewer';
import { parseCoords, type SkyPoint } from '../../lib/coords';
import { $ } from './dom';
import { search, store } from './state';

export type Query =
  | { kind: 'coords'; point: SkyPoint }
  | { kind: 'name'; name: string }
  | { kind: 'error'; message: string };

const COORD_CHARS = /^[0-9.+\-−\s,:hmsd°'′″"]+$/i;

export function classifyQuery(input: string): Query {
  const q = input.trim();
  if (!q) return { kind: 'error', message: T.search.empty };
  const point = parseCoords(q);
  if (point) return { kind: 'coords', point };
  // Solo tiene caracteres de coordenada pero no se pudo leer: es un error, no un nombre.
  if (COORD_CHARS.test(q)) return { kind: 'error', message: T.search.badCoords };
  return { kind: 'name', name: q };
}

export function mountSearch(): void {
  const form = $<HTMLFormElement>('[data-search]');
  const input = $<HTMLInputElement>('#q');
  const error = $('[data-search-error]');

  const showError = (msg: string | null) => {
    error.hidden = !msg;
    error.textContent = msg ?? '';
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = classifyQuery(input.value);
    if (q.kind === 'error') {
      showError(q.message);
      input.focus();
      return;
    }
    showError(null);
    input.blur();
    void search(input.value);
  });
  input.addEventListener('input', () => showError(null));

  // El campo refleja la región actual (por ejemplo, al abrir un enlace compartido).
  const sync = () => {
    const s = store.get();
    if (document.activeElement === input) return;
    input.value = s.view.name ?? (s.target && !s.target.catalog ? `${s.target.ra.toFixed(6)} ${s.target.dec.toFixed(6)}` : input.value);
  };
  store.subscribe((s, prev) => { if (s.target !== prev.target || s.view.name !== prev.view.name) sync(); });
  sync();
}
