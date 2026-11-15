/* Panel izquierdo de notas: para anotar los cambios que se observan (algo se movió, cambió de brillo…).
   Se guardan en localStorage del navegador; cada nota recuerda la vista para poder volver a ella. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, MapPin, NotebookPen, Trash2, X } from 'lucide-react';
import type { ViewMode } from '../../types/spherex';
import { Button, Chip, Kbd, cx, fmtDateTime } from '../ui/primitives';

export interface NoteContext {
  title: string;
  ra: number;
  dec: number;
  fov: number;
  mode: ViewMode;
  frameDate?: string;
  detector?: number;
  bandUm?: number;
}

export interface Note {
  id: string;
  text: string;
  tags: string[];
  createdAt: string;
  ctx?: NoteContext;
}

const STORAGE_KEY = 'bx-notes-v1';
const TAGS = ['Se movió', 'Cambió de brillo', 'Objeto nuevo', 'Artefacto', 'Duda'];
const MODE_LABEL: Record<ViewMode, string> = { normal: 'Secuencia', blink: 'Parpadeo', diff: 'Resta', sum: 'Suma' };

export function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function saveNotes(notes: Note[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    return true;
  } catch {
    return false;
  }
}

function toMarkdown(notes: Note[]) {
  const lines = ['# Notas de Blink X', '', `Exportado: ${new Date().toLocaleString('es')}`, ''];
  for (const n of notes) {
    lines.push(`## ${new Date(n.createdAt).toLocaleString('es')}${n.ctx ? ` · ${n.ctx.title}` : ''}`);
    if (n.tags.length) lines.push(`**${n.tags.join(' · ')}**`);
    lines.push('', n.text, '');
    if (n.ctx) {
      lines.push(
        `- Coordenadas: RA ${n.ctx.ra.toFixed(5)}°, Dec ${n.ctx.dec.toFixed(5)}° · campo ${n.ctx.fov.toFixed(2)}°`,
        `- Modo: ${MODE_LABEL[n.ctx.mode]}${n.ctx.frameDate ? ` · imagen del ${fmtDateTime(n.ctx.frameDate)} UTC` : ''}${n.ctx.detector ? ` · D${n.ctx.detector}` : ''}`,
        '',
      );
    }
  }
  return lines.join('\n');
}

interface Props {
  /** Contexto de la vista actual (se adjunta a la nota). */
  current: NoteContext;
  onClose: () => void;
  onGoTo: (ctx: NoteContext) => void;
  onCountChange?: (n: number) => void;
}

export function NotesPanel({ current, onClose, onGoTo, onCountChange }: Props) {
  const [notes, setNotes] = useState<Note[]>(loadNotes);
  const [text, setText] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [attach, setAttach] = useState(true);
  const [onlyHere, setOnlyHere] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setStorageError(!saveNotes(notes));
    onCountChange?.(notes.length);
  }, [notes, onCountChange]);

  // Sincroniza si se editan las notas en otra pestaña.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && setNotes(loadNotes());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const shown = useMemo(
    () => (onlyHere ? notes.filter((n) => n.ctx && Math.abs(n.ctx.ra - current.ra) < n.ctx.fov && Math.abs(n.ctx.dec - current.dec) < n.ctx.fov) : notes),
    [current.dec, current.ra, notes, onlyHere],
  );

  const add = () => {
    const t = text.trim();
    if (!t) {
      textRef.current?.focus();
      return;
    }
    const note: Note = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      text: t,
      tags,
      createdAt: new Date().toISOString(),
      ctx: attach ? current : undefined,
    };
    setNotes((ns) => [note, ...ns]);
    setText('');
    setTags([]);
  };

  const exportMd = () => {
    const blob = new Blob([toMarkdown(notes)], { type: 'text/markdown;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href, download: `notas-blinkx-${new Date().toISOString().slice(0, 10)}.md` });
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
  };

  return (
    <aside aria-label="Notas" className="h-full flex flex-col bx-panel border-y-0 border-l-0 min-w-0">
      <header className="h-12 shrink-0 flex items-center gap-2 px-3 border-b border-line">
        <NotebookPen className="w-4 h-4 text-ember" aria-hidden="true" />
        <h2 className="text-[13px] font-semibold text-fg">Notas</h2>
        <span className="text-xs text-muted">{notes.length}</span>
        <div className="flex-1" />
        <button type="button" onClick={exportMd} disabled={!notes.length} aria-label="Exportar notas (.md)" title="Exportar notas (.md)" className="p-1.5 rounded-md text-muted hover:text-fg hover:bg-white/[0.08] disabled:opacity-40 cursor-pointer">
          <Download className="w-4 h-4" />
        </button>
        <button type="button" onClick={onClose} aria-label="Cerrar notas" title="Cerrar notas" className="p-1.5 rounded-md text-muted hover:text-fg hover:bg-white/[0.08] cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </header>

      {/* Nueva nota */}
      <div className="shrink-0 p-3 space-y-2 border-b border-line">
        <label htmlFor="note-text" className="text-xs text-muted">¿Qué cambio observas?</label>
        <textarea
          id="note-text"
          ref={textRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              add();
            }
            e.stopPropagation(); // que Espacio/flechas no controlen el visor mientras se escribe
          }}
          rows={3}
          placeholder="Ej.: el punto de arriba a la izquierda salta entre la primera y la última fecha."
          className="w-full resize-y min-h-[72px] rounded-lg bg-raised border border-line px-2.5 py-2 text-[13px] text-fg placeholder:text-faint focus:border-ember/60 outline-none"
        />
        <div className="flex flex-wrap gap-1" role="group" aria-label="Etiquetas">
          {TAGS.map((t) => {
            const on = tags.includes(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => setTags((ts) => (on ? ts.filter((x) => x !== t) : [...ts, t]))}
                className={cx('h-7 px-2 rounded-md text-[11px] border cursor-pointer transition-colors', on ? 'bg-ember/15 border-ember/50 text-ember font-semibold' : 'border-line text-soft hover:text-fg hover:border-line-strong')}
              >
                {t}
              </button>
            );
          })}
        </div>
        <label className="flex items-start gap-2 text-[11px] text-muted cursor-pointer">
          <input type="checkbox" checked={attach} onChange={() => setAttach((a) => !a)} className="mt-0.5 accent-[#ff8a5c]" />
          <span>
            Guardar con la vista actual: <span className="text-soft">{current.title}</span>
            {current.frameDate && <> · {fmtDateTime(current.frameDate)}</>} · {MODE_LABEL[current.mode]}
          </span>
        </label>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-faint flex items-center gap-1"><Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd> guarda</span>
          <Button variant="primary" size="sm" onClick={add} disabled={!text.trim()}>Guardar nota</Button>
        </div>
        {storageError && <p role="alert" className="text-[11px] text-err-fg">No se pudo guardar en este navegador (almacenamiento bloqueado o lleno). Exporta tus notas.</p>}
      </div>

      {/* Lista */}
      <div className="shrink-0 flex items-center justify-between px-3 pt-2.5 pb-1">
        <label className="flex items-center gap-1.5 text-[11px] text-muted cursor-pointer">
          <input type="checkbox" checked={onlyHere} onChange={() => setOnlyHere((v) => !v)} className="accent-[#ff8a5c]" />
          Solo de esta zona
        </label>
        {notes.length > 0 && (
          confirmClear ? (
            <span className="flex items-center gap-1.5 text-[11px]">
              <span className="text-err-fg">¿Borrar todas?</span>
              <button type="button" onClick={() => { setNotes([]); setConfirmClear(false); }} className="font-semibold text-err-fg hover:underline cursor-pointer">Sí</button>
              <button type="button" onClick={() => setConfirmClear(false)} className="text-muted hover:text-fg cursor-pointer">No</button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmClear(true)} className="text-[11px] text-muted hover:text-err-fg cursor-pointer">Borrar todas</button>
          )
        )}
      </div>
      <ol className="flex-1 overflow-y-auto overscroll-contain px-3 pb-3 space-y-2">
        {shown.length === 0 ? (
          <li className="text-xs text-muted text-center py-6 leading-relaxed">
            {notes.length ? 'No hay notas de esta zona.' : 'Aún no hay notas. Anota aquí lo que veas cambiar entre fechas.'}
          </li>
        ) : (
          shown.map((n) => (
            <li key={n.id} className="bx-card p-2.5 space-y-1.5 animate-panel-enter">
              <div className="flex items-start justify-between gap-2">
                <time dateTime={n.createdAt} className="text-[10px] font-mono text-faint">{new Date(n.createdAt).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}</time>
                {confirmDelete === n.id ? (
                  <span className="flex items-center gap-1.5 text-[11px]">
                    <button type="button" onClick={() => setNotes((ns) => ns.filter((x) => x.id !== n.id))} className="font-semibold text-err-fg hover:underline cursor-pointer">Borrar</button>
                    <button type="button" onClick={() => setConfirmDelete(null)} className="text-muted hover:text-fg cursor-pointer">Cancelar</button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirmDelete(n.id)} aria-label="Borrar nota" title="Borrar nota" className="p-1 -m-1 rounded text-faint hover:text-err-fg cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {n.tags.length > 0 && <div className="flex flex-wrap gap-1">{n.tags.map((t) => <Chip key={t} tone="ember">{t}</Chip>)}</div>}
              <p className="text-[13px] text-fg whitespace-pre-wrap break-words leading-snug">{n.text}</p>
              {n.ctx && (
                <button
                  type="button"
                  onClick={() => onGoTo(n.ctx!)}
                  title="Volver a esta vista"
                  className="w-full flex items-center gap-1.5 rounded-md px-1.5 py-1 -mx-0.5 text-left text-[11px] text-muted hover:text-fg hover:bg-white/[0.05] cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5 text-data shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    {n.ctx.title} · {MODE_LABEL[n.ctx.mode]}{n.ctx.frameDate ? ` · ${n.ctx.frameDate.slice(0, 10)}` : ''}
                  </span>
                </button>
              )}
            </li>
          ))
        )}
      </ol>
    </aside>
  );
}
