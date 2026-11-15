import { useEffect } from 'react';
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import type { ViewMode } from '../types/spherex';
import type { CoverageResponse } from '../hooks/useSkyContract';
import type { SequenceResult as SkySequenceResult } from '../../lib/skyApi';

const BLINK_SPEEDS = [
  { ms: 900, label: '0.5×', title: 'Lento (0.9 s)' },
  { ms: 420, label: '1×', title: 'Normal (0.42 s)' },
  { ms: 200, label: '2×', title: 'Rápido (0.20 s)' },
  { ms: 110, label: '4×', title: 'Muy rápido (0.11 s)' },
] as const;

interface TimeTravelBlinkBarProps {
  frameIndex: number;
  blinkFrame: 1 | 2;
  blinkSpeedMs?: number;
  mode: ViewMode;
  isPlaying: boolean;
  coverage?: CoverageResponse | null;
  sequenceResult?: SkySequenceResult | null;
  onFrameIndexChange: (index: number) => void;
  onTogglePlay: () => void;
  onChangeBlinkSpeedMs?: (ms: number) => void;
  onToggleBlink: () => void;
  onToggleDiff: () => void;
  onToggleSum: () => void;
  onStepBlink: () => void;
}

export function TimeTravelBlinkBar({
  frameIndex,
  blinkFrame,
  blinkSpeedMs = 420,
  mode,
  isPlaying,
  coverage = null,
  sequenceResult = null,
  onFrameIndexChange,
  onTogglePlay,
  onChangeBlinkSpeedMs,
  onToggleBlink,
  onToggleDiff,
  onToggleSum,
  onStepBlink,
}: TimeTravelBlinkBarProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || document.querySelector('[role="dialog"]')) {
        return;
      }
      e.preventDefault();
      onStepBlink();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onStepBlink]);

  const seqFrames = sequenceResult?.frames ?? [];
  const maxIndex = Math.max(0, seqFrames.length - 1);
  const displayIndex =
    mode === 'blink'
      ? blinkFrame === 1
        ? 0
        : maxIndex
      : Math.min(maxIndex, Math.max(0, frameIndex));

  const activeFrame = seqFrames[displayIndex] ?? null;

  const firstDateLabel =
    coverage?.first_date?.slice(0, 10) ??
    seqFrames[0]?.date_obs?.slice(0, 10) ??
    '—';
  const lastDateLabel =
    coverage?.last_date?.slice(0, 10) ??
    seqFrames[seqFrames.length - 1]?.date_obs?.slice(0, 10) ??
    '—';

  return (
    <div className="w-full flex flex-col gap-1.5 pointer-events-none">
      <div className="hud-card rounded-xl px-3.5 py-2.5 flex flex-col gap-1.5 shadow-xl pointer-events-auto">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold text-slate-100 shrink-0">Time-Travel Blink</span>
            <span className="text-[10px] font-mono text-slate-300 truncate">
              {activeFrame
                ? `${activeFrame.date_obs.slice(0, 16).replace('T', ' ')} · D${activeFrame.detector} · ${activeFrame.band_um.toFixed(2)} μm (${displayIndex + 1}/${seqFrames.length}${sequenceResult && sequenceResult.total > seqFrames.length ? ` de ${sequenceResult.total}` : ''})`
                : 'Esperando frames de /api/sequence...'}
            </span>
            {activeFrame && activeFrame.flags.length > 0 && (
              <span className="text-[9px] font-mono text-amber-300 bg-amber-500/10 border border-amber-400/25 px-1.5 py-0.5 rounded">
                {activeFrame.flags.join(', ')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 font-mono text-xs flex-wrap">
            {onChangeBlinkSpeedMs && (
              <div
                className="flex items-center gap-1 rounded-xl bg-[#181A20] border border-white/15 p-1 text-xs"
                title="Velocidad de cambio en Blink y Reproducción"
              >
                {BLINK_SPEEDS.map((sp) => {
                  const active = blinkSpeedMs === sp.ms;
                  return (
                    <button
                      key={sp.ms}
                      type="button"
                      onClick={() => onChangeBlinkSpeedMs(sp.ms)}
                      title={sp.title}
                      className={`px-2 py-0.5 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
                        active
                          ? 'bg-[#ff8a5c] text-[#0c0a0b] shadow-[0_0_8px_rgba(255,138,92,0.5)]'
                          : 'text-slate-300 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {sp.label}
                    </button>
                  );
                })}
              </div>
            )}
            <button
              type="button"
              onClick={onToggleBlink}
              title="Alternar entre primera y última exposición real (Atajo: Barra Espaciadora)"
              className={`px-3 py-1 rounded-xl border transition-all active:scale-95 flex items-center gap-2 text-xs sm:text-sm font-semibold ${
                mode === 'blink'
                  ? 'bg-white text-[#0c0a0b] border-white shadow-[0_0_12px_rgba(255,255,255,0.45)]'
                  : 'bg-[#181A20] border-white/15 text-slate-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <span>Blink</span>
              <kbd
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                  mode === 'blink' ? 'bg-black/15 text-[#0c0a0b]' : 'bg-black/40 text-slate-300'
                }`}
              >
                Space
              </kbd>
            </button>
            <button
              type="button"
              onClick={onToggleDiff}
              title="Resta real en el backend (/api/stack op=diff)"
              className={`px-3 py-1 rounded-xl border transition-all active:scale-95 text-xs sm:text-sm font-semibold ${
                mode === 'diff'
                  ? 'bg-rose-500 text-white border-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.55)]'
                  : 'bg-[#181A20] border-white/15 text-slate-200 hover:text-white hover:bg-white/10'
              }`}
            >
              Resta (T₂ − T₁)
            </button>
            <button
              type="button"
              onClick={onToggleSum}
              title="Suma real en el backend (/api/stack op=sum)"
              className={`px-3 py-1 rounded-xl border transition-all active:scale-95 text-xs sm:text-sm font-semibold ${
                mode === 'sum'
                  ? 'bg-[#6fd3ff] text-[#0c0a0b] border-[#6fd3ff] shadow-[0_0_12px_rgba(111,211,255,0.55)]'
                  : 'bg-[#181A20] border-white/15 text-slate-200 hover:text-white hover:bg-white/10'
              }`}
            >
              Suma (T₁ + T₂)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2.5 pt-0.5">
          {/* Simplified 3-button Playback: Prev | Play/Pause | Next */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={seqFrames.length === 0}
              onClick={() => {
                const prev = displayIndex > 0 ? displayIndex - 1 : maxIndex;
                onFrameIndexChange(prev);
              }}
              className="w-7 h-7 rounded-full flex items-center justify-center border bg-[#181A20] border-white/15 text-slate-200 hover:text-white hover:bg-white/15 disabled:opacity-40 transition-all active:scale-95"
              title="Frame anterior"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={seqFrames.length < 2}
              onClick={onTogglePlay}
              className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all active:scale-95 disabled:opacity-40 ${
                isPlaying
                  ? 'bg-[#ff8a5c] border-[#ff8a5c] text-[#0c0a0b] shadow-[0_0_12px_rgba(255,138,92,0.55)]'
                  : 'bg-white/15 border-white/25 text-white hover:bg-white/25'
              }`}
              title={isPlaying ? 'Pausar secuencia' : 'Reproducir secuencia real'}
            >
              {isPlaying ? (
                <Pause className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5 ml-0.5" />
              )}
            </button>
            <button
              type="button"
              disabled={seqFrames.length === 0}
              onClick={() => {
                const next = maxIndex > 0 ? (displayIndex + 1) % (maxIndex + 1) : 0;
                onFrameIndexChange(next);
              }}
              className="w-7 h-7 rounded-full flex items-center justify-center border bg-[#181A20] border-white/15 text-slate-200 hover:text-white hover:bg-white/15 disabled:opacity-40 transition-all active:scale-95"
              title="Siguiente frame"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Progress Scrubber + /api/coverage weekly histogram */}
          <div className="flex-1 flex flex-col gap-0.5">
            {coverage && coverage.weeks.length > 0 && (
              <div
                className="flex items-end gap-[2px] h-3 px-0.5 mb-0.5"
                title={`Cobertura semanal (/api/coverage): ${coverage.weeks.reduce((s, w) => s + w.count, 0)} frames (${coverage.first_date ?? ''} → ${coverage.last_date ?? ''})`}
              >
                {(() => {
                  const maxC = Math.max(1, ...coverage.weeks.map((w) => w.count));
                  return coverage.weeks.slice(0, 36).map((w) => (
                    <div
                      key={w.week_start}
                      className="flex-1 rounded-t-[1px] bg-[#ff8a5c]/45 hover:bg-[#ff8a5c] transition-colors"
                      style={{ height: `${Math.max(18, Math.round((w.count / maxC) * 100))}%` }}
                      title={`${w.week_start}: ${w.count} frames`}
                    />
                  ));
                })()}
              </div>
            )}
            <input
              type="range"
              min={0}
              max={maxIndex}
              step={1}
              value={displayIndex}
              disabled={seqFrames.length === 0}
              onChange={(e) => onFrameIndexChange(Number(e.target.value))}
              aria-label="Time-Travel Blink Scrubber"
              className="w-full h-1 rounded-lg appearance-none cursor-pointer accent-white bg-slate-800 disabled:opacity-40"
            />
            <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 px-0.5">
              <span>{firstDateLabel}</span>
              <span>
                {sequenceResult
                  ? `${sequenceResult.frames.length}/${sequenceResult.total} frames (${sequenceResult.unit})`
                  : '—'}
              </span>
              <span>{lastDateLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
