// AI-assisted development used for code development, debugging and documentation.
// Tool: ChatGPT, Claude
/* Menú «⋯» de la barra superior en celular: agrupa lo que no cabe (notas, vista, ayuda, idioma, GitHub). */
import { useEffect, useRef, useState } from 'react';
import { CircleHelp, ExternalLink, Layers3, MoreVertical, NotebookPen, Telescope } from 'lucide-react';
import type { LayoutViewMode } from '../../types/spherex';
import { cx } from '../ui/primitives';
import { GithubMark, LangSwitch, REPOS } from './RepoMenu';

interface Props {
  notesOpen: boolean;
  notesCount: number;
  onToggleNotes: () => void;
  layoutView: LayoutViewMode;
  onChangeLayoutView: (v: LayoutViewMode) => void;
  onOpenHelp: () => void;
  status?: { dot: string; label: string } | null;
}

export function MobileMenu({ notesOpen, notesCount, onToggleNotes, layoutView, onChangeLayoutView, onOpenHelp, status }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const run = (fn: () => void) => () => { fn(); setOpen(false); };
  const item = 'w-full flex items-center gap-3 rounded-lg px-3 min-h-11 text-left text-[14px] text-fg hover:bg-white/[0.06] active:bg-white/[0.1] cursor-pointer';
  const isSplit = layoutView === 'split';

  return (
    <div ref={ref} className="relative md:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Más opciones"
        className={cx('relative h-10 w-10 inline-flex items-center justify-center rounded-lg cursor-pointer', open ? 'text-fg bg-white/[0.08]' : 'text-muted hover:text-fg')}
      >
        <MoreVertical className="w-5 h-5" aria-hidden="true" />
        {notesCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-ember" aria-hidden="true" />}
      </button>
      {open && (
        <div role="menu" aria-label="Más opciones" className="fixed right-2 top-[60px] z-50 w-[min(300px,calc(100vw-16px))] max-h-[calc(100dvh-72px)] overflow-y-auto bx-float rounded-xl p-1.5 shadow-2xl animate-panel-enter">
          <button type="button" role="menuitem" onClick={run(onToggleNotes)} className={item}>
            <NotebookPen className="w-4 h-4 text-ember shrink-0" aria-hidden="true" />
            <span className="flex-1">{notesOpen ? 'Ocultar notas' : 'Notas de observación'}</span>
            {notesCount > 0 && <span className="text-xs font-mono text-muted">{notesCount}</span>}
          </button>
          <button type="button" role="menuitem" onClick={run(() => onChangeLayoutView(isSplit ? 'hud' : 'split'))} className={item}>
            {isSplit ? <Telescope className="w-4 h-4 text-data shrink-0" aria-hidden="true" /> : <Layers3 className="w-4 h-4 text-data shrink-0" aria-hidden="true" />}
            <span className="flex-1">{isSplit ? 'Volver al cielo' : 'Detectores y cubo'}</span>
          </button>
          <button type="button" role="menuitem" onClick={run(onOpenHelp)} className={item}>
            <CircleHelp className="w-4 h-4 text-muted shrink-0" aria-hidden="true" />
            <span className="flex-1">Ayuda</span>
          </button>

          <div className="my-1.5 h-px bg-line" aria-hidden="true" />
          <div className="flex items-center justify-between gap-3 px-3 min-h-11">
            <span className="text-[13px] text-muted">Idioma</span>
            <LangSwitch />
          </div>
          {status && (
            <div className="flex items-center gap-2 px-3 min-h-9 text-xs text-muted">
              <span className={cx('w-2 h-2 rounded-full', status.dot)} aria-hidden="true" />
              {status.label}
            </div>
          )}

          <div className="my-1.5 h-px bg-line" aria-hidden="true" />
          <p className="px-3 pt-1 pb-0.5 text-[10px] font-mono uppercase tracking-wider text-faint">Código del proyecto</p>
          {REPOS.map((r) => (
            <a key={r.href} role="menuitem" href={r.href} target="_blank" rel="noopener noreferrer" className={cx(item, 'py-2')}>
              <GithubMark className="w-4 h-4 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium">{r.label}</span>
                <span className="block text-[11px] font-mono text-data truncate">{r.repo}</span>
              </span>
              <ExternalLink className="w-3.5 h-3.5 text-faint shrink-0" aria-hidden="true" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
