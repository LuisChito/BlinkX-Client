import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, X, XCircle } from 'lucide-react';
import type { Job } from '../../lib/skyApi';

interface ContractJobBannerProps {
  job: Job | null;
  warnings: string[];
  error: string | null;
}

export function ContractJobBanner({ job, warnings, error }: ContractJobBannerProps) {
  const warningsKey = warnings.join('|');
  const [dismissedWarningsKey, setDismissedWarningsKey] = useState<string>('');
  const [dismissedError, setDismissedError] = useState<string | null>(null);

  useEffect(() => {
    if (!warningsKey) setDismissedWarningsKey('');
  }, [warningsKey]);

  useEffect(() => {
    if (!error) setDismissedError(null);
  }, [error]);

  const showWarnings = warnings.length > 0 && dismissedWarningsKey !== warningsKey;
  const showError = Boolean(error) && dismissedError !== error;

  if (!job && !showWarnings && !showError) return null;

  const pct = job ? Math.max(0, Math.min(100, Math.round(job.progress * 100))) : 0;

  return (
    <div className="fixed top-16 left-3 z-20 flex flex-col gap-1.5 max-w-sm pointer-events-none">
      {job && (
        <div className="hud-card-elevated rounded-xl px-3 py-2 border border-[#ff8a5c]/35 pointer-events-auto shadow-xl">
          <div className="flex items-center justify-between gap-3 text-[11px] font-mono">
            <span className="flex items-center gap-1.5 text-[#ff8a5c] font-semibold uppercase">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              202 Job · {job.kind}
            </span>
            <span className="text-[#f6f1ee]">
              {pct}%{job.eta_s !== null ? ` · ETA ${Math.ceil(job.eta_s)}s` : ''}
            </span>
          </div>
          <div className="mt-1.5 h-1 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-[#ff8a5c] transition-all duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-[#b9a8a3]">
            <span className="truncate">{job.stage || job.status}</span>
            <span>Cola #{job.queue_position}</span>
          </div>
        </div>
      )}

      {showWarnings && (
        <div className="hud-card-elevated rounded-xl px-3 py-2 border border-amber-400/35 pointer-events-auto text-[11px] font-mono text-amber-200 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5 flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-amber-300 font-semibold">
              Respuesta parcial (partial: true)
            </div>
            {warnings.map((w, i) => (
              <div key={i} className="text-[10px] text-[#f6f1ee]/85 leading-snug">
                {w}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setDismissedWarningsKey(warningsKey)}
            aria-label="Cerrar aviso"
            title="Cerrar aviso"
            className="text-amber-300/70 hover:text-white p-0.5 rounded transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {showError && (
        <div className="hud-card-elevated rounded-xl px-3 py-2 border border-rose-500/40 pointer-events-auto text-[11px] font-mono text-rose-200 flex items-center gap-2">
          <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span className="flex-1 min-w-0 break-words">{error}</span>
          <button
            type="button"
            onClick={() => setDismissedError(error)}
            aria-label="Cerrar error"
            title="Cerrar error"
            className="text-rose-300/70 hover:text-white p-0.5 rounded transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
