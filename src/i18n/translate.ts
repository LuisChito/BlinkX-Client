// AI-assisted development used for code development, debugging and documentation.
// Tool: ChatGPT, Claude
/* Traducción de la interfaz en el navegador. La fuente está en español; con idioma «en» se reemplazan los textos
   visibles (y title / aria-label / placeholder / alt) usando el diccionario EN. Un MutationObserver traduce también
   lo que React o los scripts pintan después. Cambiar de idioma guarda la preferencia y recarga la página. */
import { EN, EN_RULES } from './en';

export type Lang = 'en' | 'es';
const KEY = 'bx-lang';
const ATTRS = ['title', 'aria-label', 'placeholder', 'alt'] as const;
const SKIP = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA', 'NOSCRIPT', 'SVG']);

export function getLang(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'es' || v === 'en') return v;
  } catch { /* sin almacenamiento */ }
  return 'en'; // inglés por defecto
}

export function setLang(lang: Lang) {
  try { localStorage.setItem(KEY, lang); } catch { /* sin almacenamiento */ }
  location.reload();
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const exact = new Map<string, string>();
for (const [k, v] of Object.entries(EN)) exact.set(norm(k), v);

// Frases (≥ 6 letras) que también se reemplazan dentro de textos más largos, de la más larga a la más corta.
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const phraseKeys = [...exact.keys()].filter((k) => k.length >= 6).sort((a, b) => b.length - a.length);
const phraseRe = phraseKeys.length
  ? new RegExp(
      phraseKeys
        .map((k) => {
          // Límite de palabra solo donde la frase empieza / termina con letra o número.
          const pre = /^[\p{L}\p{N}]/u.test(k) ? '(?<![\\p{L}\\p{N}])' : '';
          const post = /[\p{L}\p{N}]$/u.test(k) ? '(?![\\p{L}\\p{N}])' : '';
          return pre + escape(k) + post;
        })
        .join('|'),
      'gu',
    )
  : null;

// Palabras sueltas frecuentes en textos con números ("8 de 240 exposiciones", "4 de 6", …).
const WORDS: Record<string, string> = { de: 'of', y: 'and', en: 'in', con: 'with', sin: 'without', por: 'per', hace: 'ago', días: 'days', día: 'day', fechas: 'dates', fecha: 'date', imágenes: 'images', objetos: 'objects', mediciones: 'measurements', canales: 'channels', campos: 'fields', notas: 'notes' };
const wordRe = new RegExp(`(?<![\\p{L}\\p{N}])(${Object.keys(WORDS).join('|')})(?![\\p{L}\\p{N}])`, 'gu');
const hasLetters = /\p{L}{2}/u;

export function translateString(s: string): string {
  const n = norm(s);
  if (!n || !hasLetters.test(n)) return s;
  const hit = exact.get(n);
  if (hit !== undefined) {
    const lead = s.match(/^\s*/)?.[0] ?? '';
    const trail = s.match(/\s*$/)?.[0] ?? '';
    return lead + hit + trail;
  }
  let changed = false;
  let out = s;
  for (const [re, rep] of EN_RULES) {
    const next = out.replace(re, rep);
    if (next !== out) { out = next; changed = true; }
  }
  if (!phraseRe) return out;
  out = out.replace(phraseRe, (m) => {
    const t = exact.get(norm(m));
    if (t === undefined) return m;
    changed = true;
    return t;
  });
  // Solo si ya se tradujo algo (o el texto es corto con números) se traducen las palabras sueltas.
  if (changed || /\d/.test(out)) out = out.replace(wordRe, (m) => WORDS[m] ?? m);
  return out;
}

const done = new WeakMap<Node, string>(); // texto que puso el traductor (para no retraducir)

function translateTextNode(t: Text) {
  const v = t.nodeValue ?? '';
  if (done.get(t) === v) return;
  const p = t.parentElement;
  if (p && (SKIP.has(p.tagName.toUpperCase()) || p.closest('[data-no-translate],code,pre,textarea'))) return;
  const tr = translateString(v);
  done.set(t, tr);
  if (tr !== v) t.nodeValue = tr;
}

function translateAttrs(el: Element) {
  if (el.closest('[data-no-translate]')) return;
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (!v) continue;
    const tr = translateString(v);
    if (tr !== v) el.setAttribute(a, tr);
  }
  if (el.tagName === 'META' && /description|og:title|og:description/.test(el.getAttribute('name') ?? el.getAttribute('property') ?? '')) {
    const c = el.getAttribute('content');
    if (c) el.setAttribute('content', translateString(c));
  }
}

function walk(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) return translateTextNode(root as Text);
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
  if (root.nodeType === Node.ELEMENT_NODE) {
    const el = root as Element;
    if (SKIP.has(el.tagName.toUpperCase())) return;
    translateAttrs(el);
  }
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let n = tw.nextNode();
  while (n) {
    if (n.nodeType === Node.TEXT_NODE) translateTextNode(n as Text);
    else translateAttrs(n as Element);
    n = tw.nextNode();
  }
}

let started = false;
export function startI18n() {
  if (started || typeof document === 'undefined') return;
  started = true;
  const lang = getLang();
  document.documentElement.lang = lang;
  if (lang === 'es') {
    document.documentElement.classList.remove('i18n-pending');
    return;
  }
  document.title = translateString(document.title);
  walk(document.documentElement);
  document.documentElement.classList.remove('i18n-pending');
  const obs = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData') translateTextNode(r.target as Text);
      else if (r.type === 'attributes') translateAttrs(r.target as Element);
      else r.addedNodes.forEach((n) => walk(n));
    }
  });
  obs.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
}
