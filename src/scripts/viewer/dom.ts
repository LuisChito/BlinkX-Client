// Ayudas mínimas de DOM para los módulos del visor.
export function $<T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`Falta el elemento ${sel}`);
  return el;
}

export function $$<T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T[] {
  return [...root.querySelectorAll<T>(sel)];
}

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Escapa texto que viene de la API o del usuario antes de meterlo en HTML. */
export function esc(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
}

const DATE = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const TIME = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
export const fmtDate = (iso: string): string => DATE.format(new Date(iso));
export const fmtDateTime = (iso: string): string => `${DATE.format(new Date(iso))} · ${TIME.format(new Date(iso))} UTC`;

export const reducedMotion = (): boolean =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Iconos usados por los scripts (los mismos trazos que Icon.astro). */
const ICONS: Record<string, string> = {
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4"/>',
  crosshair: '<circle cx="12" cy="12" r="6.5"/><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  compare: '<path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5"/>',
};
export function icon(name: keyof typeof ICONS, size = 20): string {
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;
}
