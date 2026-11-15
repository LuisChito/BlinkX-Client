/* Inspector acoplado a la derecha: Resumen · Espectro · Composición · Movimiento · Locales · Datos. */
import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Activity, Database, FlaskConical, HardDrive, Info, Orbit } from 'lucide-react';
import { cx } from '../ui/primitives';

export type InspectorTab = 'summary' | 'spectrum' | 'composition' | 'motion' | 'local' | 'data';

const TABS: Array<{ id: InspectorTab; label: string; icon: ReactNode }> = [
  { id: 'summary', label: 'Resumen', icon: <Info className="w-4 h-4" aria-hidden="true" /> },
  { id: 'spectrum', label: 'Espectro', icon: <Activity className="w-4 h-4" aria-hidden="true" /> },
  { id: 'composition', label: 'Composición', icon: <FlaskConical className="w-4 h-4" aria-hidden="true" /> },
  { id: 'motion', label: 'Movimiento', icon: <Orbit className="w-4 h-4" aria-hidden="true" /> },
  { id: 'local', label: 'Locales', icon: <HardDrive className="w-4 h-4" aria-hidden="true" /> },
  { id: 'data', label: 'Datos', icon: <Database className="w-4 h-4" aria-hidden="true" /> },
];

interface Props {
  tab: InspectorTab;
  onTab: (t: InspectorTab) => void;
  /** Indicadores (punto de actividad) por pestaña. */
  busy?: Partial<Record<InspectorTab, boolean>>;
  children: ReactNode;
}

export function Inspector({ tab, onTab, busy = {}, children }: Props) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onKey = (e: KeyboardEvent, i: number) => {
    const next = e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i - 1 + TABS.length) % TABS.length : -1;
    if (next < 0) return;
    e.preventDefault();
    onTab(TABS[next].id);
    refs.current[TABS[next].id]?.focus();
  };

  return (
    <aside aria-label="Datos del punto" className="h-full flex flex-col bx-panel border-y-0 border-r-0 min-w-0">
      <div role="tablist" aria-label="Secciones" className="grid grid-cols-6 shrink-0 border-b border-line px-1 pt-1.5">
        {TABS.map((t, i) => {
          const on = t.id === tab;
          return (
            <button
              key={t.id}
              ref={(el) => { refs.current[t.id] = el; }}
              id={`tab-${t.id}`}
              role="tab"
              type="button"
              aria-selected={on}
              aria-controls={`panel-${t.id}`}
              tabIndex={on ? 0 : -1}
              onClick={() => onTab(t.id)}
              onKeyDown={(e) => onKey(e, i)}
              className={cx(
                'relative flex flex-col items-center gap-0.5 pb-2 pt-1.5 text-[10.5px] font-medium rounded-t-lg cursor-pointer transition-colors min-w-0',
                on ? 'text-fg' : 'text-muted hover:text-fg hover:bg-white/[0.04]',
              )}
            >
              <span className={on ? 'text-ember' : ''}>{t.icon}</span>
              {t.label}
              {busy[t.id] && <span className="absolute top-1.5 right-[22%] w-1.5 h-1.5 rounded-full bg-ember animate-pulse" aria-label="calculando" />}
              {on && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-ember" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="flex-1 overflow-y-auto overscroll-contain p-3.5 space-y-4" tabIndex={0}>
        {children}
      </div>
    </aside>
  );
}
