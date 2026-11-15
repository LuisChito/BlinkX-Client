// AI-assisted development used for code development, debugging and documentation.
// Tool: ChatGPT, Claude
/* Botón de GitHub (barra superior del visor): abre un menú con los dos repositorios del proyecto. */
import { useEffect, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { cx } from '../ui/primitives';
import { getLang, setLang, type Lang } from '../../../i18n/translate';

export const REPOS = [
  { label: 'Frontend · visor web', repo: 'LuisChito/BlinkX-Client', href: 'https://github.com/LuisChito/BlinkX-Client', detail: 'Astro + React: historia, visor SPHEREx, notas y respaldo' },
  { label: 'Backend · API de datos', repo: 'RafaPacheco2003/NasaSpace', href: 'https://github.com/RafaPacheco2003/NasaSpace', detail: 'FastAPI: IRSA/SPHEREx, catálogos, espectros y predicciones' },
];

export function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export function RepoMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        title="Código en GitHub"
        className={cx('h-9 inline-flex items-center gap-1.5 rounded-lg px-2 sm:px-2.5 text-[13px] cursor-pointer', open ? 'text-fg bg-white/[0.08]' : 'text-muted hover:text-fg hover:bg-white/[0.06]')}
      >
        <GithubMark className="w-[18px] h-[18px]" />
        <span className="hidden md:inline font-medium">GitHub</span>
      </button>
      {open && (
        <div role="menu" aria-label="Repositorios en GitHub" className="absolute right-0 top-full mt-2 z-50 w-[300px] max-w-[calc(100vw-24px)] rounded-xl border border-line bg-[#0d1117] shadow-2xl p-1.5 animate-panel-enter">
          <p className="px-2.5 pt-1.5 pb-1 text-[10px] font-mono uppercase tracking-wider text-faint">Código del proyecto</p>
          {REPOS.map((r) => (
            <a
              key={r.href}
              role="menuitem"
              href={r.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 hover:bg-white/[0.06] focus-visible:bg-white/[0.06]"
            >
              <GithubMark className="w-5 h-5 mt-0.5 shrink-0 text-fg" />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-fg">{r.label}</span>
                <span className="block text-[11px] font-mono text-data truncate">{r.repo}</span>
                <span className="block text-[11px] text-muted leading-snug">{r.detail}</span>
              </span>
              <ExternalLink className="w-3.5 h-3.5 mt-1 shrink-0 text-faint" aria-hidden="true" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/** Selector de idioma (EN / ES) junto al botón de GitHub. Cambiar recarga la página. */
export function LangSwitch() {
  const cur = getLang();
  return (
    <div role="group" aria-label="Idioma" className="inline-flex items-center gap-0.5 rounded-lg border border-line bg-white/[0.03] p-0.5">
      {(['en', 'es'] as Lang[]).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={l === cur}
          onClick={() => l !== cur && setLang(l)}
          className={cx('h-7 min-w-8 px-1.5 rounded-md font-mono text-[11px] font-semibold uppercase cursor-pointer', l === cur ? 'bg-white/[0.12] text-fg' : 'text-muted hover:text-fg')}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
