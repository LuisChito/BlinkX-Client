/* Estado de la actividad del backend sobre el cielo: trabajos en curso, datos parciales y errores. */
import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, Loader2, RotateCcw, X, XCircle } from 'lucide-react';
import type { Job } from '../../../lib/skyApi';
import { cx, summarizeWarnings } from '../ui/primitives';

const KIND: Record<string, string> = {
  sequence: 'Descargando imágenes',
  stack: 'Combinando fechas',
  spectrum: 'Midiendo espectro',
  composition: 'Analizando composición',
  predict: 'Calculando trayectoria',
  l2: 'Descargando imagen L2',
  cube: 'Descargando cubo de 102 canales',
  asteroid: 'Consultando JPL Horizons',
};

interface Props {
  job: Job | null;
  warnings: string[];
  error: string | null;
  onRetry: () => void;
}

/** "[upstream_timeout] IRSA no respondió" → "IRSA no respondió" */
const cleanError = (e: string) => e.replace(/^\[[a-z_]+\]\s*/i, '');

export function ActivityStatus({ job, warnings, error, onRetry }: Props) {
  const [openWarn, setOpenWarn] = useState(false);
  const [dismissedWarn, setDismissedWarn] = useState('');
  const [dismissedErr, setDismissedErr] = useState<string | null>(null);
  const warnKey = warnings.join('|');

  useEffect(() => setOpenWarn(false), [warnKey]);

  const showWarn = warnings.length > 0 && dismissedWarn !== warnKey;
  const showErr = !!error && dismissedErr !== error;
  if (!job && !showWarn && !showErr) return null;

  const pct = job ? Math.round(job.progress * 100) : 0;
  const { headline, detail } = summarizeWarnings(warnings);

  return (
    <div className="flex flex-col items-start gap-1.5 max-w-[min(360px,calc(100%-24px))]">
      {job && (
        <div className="bx-float rounded-xl px-3 py-2 w-[280px] max-w-full" role="status" aria-live="polite">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 text-fg font-medium truncate">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-ember shrink-0" aria-hidden="true" />
              {KIND[job.kind] ?? 'Procesando'}
            </span>
            <span className="font-mono text-muted shrink-0">{pct}%</span>
          </div>
          <div className="mt-1.5 h-1 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-ember transition-[width] duration-300" style={{ width: `${Math.max(3, pct)}%` }} />
          </div>
          <div className="mt-1 text-[11px] text-muted truncate">
            {job.queue_position > 0 ? `En cola (turno ${job.queue_position})` : job.stage}
          </div>
        </div>
      )}

      {showWarn && (
        <div className="bx-float rounded-xl text-xs text-warn-fg border-warn/35 max-w-full">
          <div className="flex items-center gap-1 pl-2.5 pr-1 py-1">
            <AlertTriangle className="w-3.5 h-3.5 text-warn shrink-0" aria-hidden="true" />
            <button
              type="button"
              onClick={() => setOpenWarn((o) => !o)}
              aria-expanded={openWarn}
              className="flex items-center gap-1 px-1 py-0.5 rounded hover:bg-white/[0.06] cursor-pointer min-w-0 text-left"
            >
              <span>Datos parciales: {headline}</span>
              <ChevronDown className={cx('w-3.5 h-3.5 shrink-0 transition-transform', openWarn && 'rotate-180')} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => setDismissedWarn(warnKey)} aria-label="Ocultar aviso" className="p-1 rounded text-warn-fg/70 hover:text-fg cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {openWarn && (
            <div className="px-3 pb-2.5 pt-0.5 space-y-1.5">
              <p className="text-soft leading-snug">
                Lo que ves es válido; solo faltan algunas exposiciones porque el archivo de la NASA no respondió. Puedes reintentar más tarde.
              </p>
              <ul className="max-h-28 overflow-y-auto space-y-0.5 font-mono text-[10px] text-faint">
                {detail.map((w) => <li key={w} className="truncate" title={w}>{w}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {showErr && (
        <div role="alert" className="bx-float rounded-xl border-err/40 flex items-center gap-2 pl-2.5 pr-1 py-1.5 text-xs text-err-fg max-w-full">
          <XCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 break-words">{cleanError(error!)}</span>
          <button type="button" onClick={onRetry} className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-err/20 hover:bg-err/30 font-semibold cursor-pointer">
            <RotateCcw className="w-3 h-3" aria-hidden="true" /> Reintentar
          </button>
          <button type="button" onClick={() => setDismissedErr(error)} aria-label="Ocultar error" className="p-1 rounded text-err-fg/70 hover:text-fg cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
