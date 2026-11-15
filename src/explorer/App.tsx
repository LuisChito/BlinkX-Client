import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrowserRouter, useSearchParams } from 'react-router-dom';
import { SPHEREX_TARGETS } from './data/spherexCatalog';
import type {
  CatalogOverlayState,
  ExplorerUrlState,
  LayoutViewMode,
  MolecularLensId,
  TargetCatalogEntry,
  ViewMode,
} from './types/spherex';
import { clampDec, normalizeRa, parseExplorerUrlParams, serializeExplorerUrlParams } from './utils/urlState';
import { SkyStage, type L2ViewMode } from './components/SkyStage';
import { TopBar } from './components/layout/TopBar';
import { ViewerDock } from './components/layout/ViewerDock';
import { ActivityStatus } from './components/layout/ActivityStatus';
import { HelpDialog } from './components/layout/HelpDialog';
import { SystemBanner } from './components/layout/SystemBanner';
import { NotesPanel, loadNotes, type NoteContext } from './components/notes/NotesPanel';
import { useBackupInfo } from './hooks/useBackupInfo';
import { Inspector, type InspectorTab } from './components/inspector/Inspector';
import { LocalTab } from './components/inspector/LocalTab';
import { SummaryTab } from './components/inspector/SummaryTab';
import { SpectrumTab } from './components/inspector/SpectrumTab';
import { DataTab } from './components/inspector/DataTab';
import { MotionTab } from './components/inspector/MotionTab';
import { DetectorsPanel } from './components/DetectorsPanel';
import { CommandSearchModal } from './components/CommandSearchModal';
import { CompositionCard, CompositionModal } from './components/CompositionPanel';
import { type Cmap, type Detector, type Scale, type Stretch, useSkyContract } from './hooks/useSkyContract';
import { ApiError, isoToMjd, type Coord } from '../lib/skyApi';
import { objectTypeLabel } from './components/ui/primitives';

const MODE_LABEL: Record<ViewMode, string> = {
  normal: 'Una fecha a la vez',
  blink: 'Parpadeo entre la primera y la última fecha',
  diff: 'Resta: última − primera fecha',
  sum: 'Suma de varias fechas',
};

/** Distancia angular aproximada en grados (suficiente para campos pequeños). */
function sep(a: Coord, b: Coord) {
  let dra = Math.abs(a.ra - b.ra);
  if (dra > 180) dra = 360 - dra;
  return Math.hypot(dra * Math.cos((a.dec * Math.PI) / 180), a.dec - b.dec);
}

const isWide = () => typeof window === 'undefined' || window.matchMedia('(min-width: 1024px)').matches;

export function SpherexExplorerShell() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlState = useMemo(() => parseExplorerUrlParams(searchParams), [searchParams]);
  const center = useMemo(() => ({ ra: urlState.ra, dec: urlState.dec }), [urlState.ra, urlState.dec]);
  const selectedTarget = useMemo(
    () => SPHEREX_TARGETS.find((t) => t.id === urlState.target) ?? SPHEREX_TARGETS[0],
    [urlState.target],
  );
  const isSplit = urlState.view === 'split';

  // Visualización
  const [detectorFilter, setDetectorFilter] = useState<Detector | undefined>(undefined);
  const [stretch, setStretch] = useState<Stretch>('asinh');
  const [cmap, setCmap] = useState<Cmap>('gray');
  const [scale, setScale] = useState<Scale>('sequence');
  const [overlays, setOverlays] = useState<CatalogOverlayState>({ gaiaDr3: false, allWise: false });
  const [showLabels, setShowLabels] = useState(true);
  const [l2View, setL2View] = useState<L2ViewMode>('off');
  const [cursor, setCursor] = useState<Coord | null>(null);

  // Tiempo
  const [frameIndex, setFrameIndex] = useState(0);
  const [blinkFrame, setBlinkFrame] = useState<1 | 2>(1);
  const [speedMs, setSpeedMs] = useState(420);
  const [isPlaying, setIsPlaying] = useState(false);

  // Paneles
  const [inspectorOpen, setInspectorOpen] = useState(isWide);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('summary');
  const [detectorsMax, setDetectorsMax] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(() => {
    try { return localStorage.getItem('bx-notes-open') === '1'; } catch { return false; }
  });
  const [notesCount, setNotesCount] = useState(() => (typeof window === 'undefined' ? 0 : loadNotes().length));
  /** Al volver a una nota: fecha de la imagen que hay que mostrar cuando llegue la secuencia. */
  const [pendingFrameDate, setPendingFrameDate] = useState<string | null>(null);
  const backupInfo = useBackupInfo();
  useEffect(() => {
    try { localStorage.setItem('bx-notes-open', notesOpen ? '1' : '0'); } catch { /* sin almacenamiento */ }
  }, [notesOpen]);
  const [compositionOpen, setCompositionOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [activeTargetName, setActiveTargetName] = useState<string | undefined>(selectedTarget.name);
  const [isResolving, setIsResolving] = useState(false);

  // Predicciones (pestaña Movimiento)
  const [pickMode, setPickMode] = useState(false);
  const [asteroidId, setAsteroidId] = useState('');
  const [horizonDays, setHorizonDays] = useState(0.5);

  const sky = useSkyContract({
    ra: urlState.ra,
    dec: urlState.dec,
    fovDeg: urlState.fov,
    targetName: activeTargetName,
    mode: urlState.mode,
    detector: detectorFilter,
    stretch,
    cmap,
    scale,
    showGaia: overlays.gaiaDr3,
    showWise: overlays.allWise,
  });

  // «Copia de seguridad»: al cambiar entre datos guardados y en vivo se recarga la vista actual.
  const backup = useMemo(
    () => ({ ...backupInfo, setOnly: (on: boolean) => { backupInfo.setOnly(on); sky.retry(); } }),
    [backupInfo, sky.retry],
  );

  const frames = sky.sequence?.frames ?? [];
  useEffect(() => {
    if (pendingFrameDate && sky.sequence) {
      const i = sky.sequence.frames.findIndex((f) => f.date_obs === pendingFrameDate);
      setFrameIndex(Math.max(0, i));
      setPendingFrameDate(null);
    } else setFrameIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sky.sequence]);
  useEffect(() => { if (!sky.l2) setL2View('off'); }, [sky.l2]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  const updateUrlState = useCallback(
    (patch: Partial<ExplorerUrlState>) => {
      const next: ExplorerUrlState = { ...urlState, ...patch };
      next.ra = normalizeRa(next.ra);
      next.dec = clampDec(next.dec);
      next.fov = Math.max(0.04, Math.min(8, next.fov));
      setSearchParams(serializeExplorerUrlParams(next), { replace: true });
    },
    [setSearchParams, urlState],
  );

  useEffect(() => {
    if (!searchParams.has('target') && !searchParams.has('ra')) {
      setSearchParams(serializeExplorerUrlParams(urlState), { replace: true });
    }
  }, [searchParams, setSearchParams, urlState]);

  const shareUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/ver?${serializeExplorerUrlParams(urlState).toString()}`;
  }, [urlState]);

  // Atajos globales: Ctrl/⌘+K busca; Espacio hace parpadeo.
  const setMode = useCallback(
    (mode: ViewMode) => {
      setIsPlaying(false);
      setL2View('off');
      updateUrlState({ mode });
    },
    [updateUrlState],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (e.key === 'Escape') setPickMode(false);
      if (e.code !== 'Space') return;
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, button, [role="dialog"], [role="tab"]')) return;
      e.preventDefault();
      if (urlState.mode !== 'blink') setMode('blink');
      setBlinkFrame((f) => (f === 1 ? 2 : 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setMode, urlState.mode]);

  // Parpadeo y reproducción
  useEffect(() => {
    if (urlState.mode !== 'blink') return;
    const t = window.setInterval(() => setBlinkFrame((f) => (f === 1 ? 2 : 1)), speedMs);
    return () => window.clearInterval(t);
  }, [speedMs, urlState.mode]);
  useEffect(() => {
    if (!isPlaying || frames.length <= 1) return;
    const t = window.setInterval(() => setFrameIndex((i) => (i + 1) % frames.length), Math.round(speedMs * 1.4));
    return () => window.clearInterval(t);
  }, [speedMs, isPlaying, frames.length]);

  // El cubo se pide al abrir "Detectores" (no antes: es una descarga pesada).
  useEffect(() => {
    if (isSplit && !sky.cube && !sky.loadingCube && !sky.error) void sky.loadCube();
  }, [isSplit, sky.cube, sky.loadingCube, sky.error, sky.loadCube]);

  // Navegación -------------------------------------------------------------------------------------------------
  const resetTime = () => {
    setIsPlaying(false);
    setFrameIndex(0);
  };

  const handleSelectTarget = useCallback(
    async (target: TargetCatalogEntry) => {
      resetTime();
      setActiveTargetName(target.name);
      setIsResolving(true);
      try {
        const res = await sky.resolveByName(target.name, '2025-07-01');
        setActiveTargetName(res.matched_name);
        updateUrlState({ target: target.id, ra: res.current.ra, dec: res.current.dec, fov: target.defaultFov });
      } catch {
        updateUrlState({ target: target.id, ra: target.raDeg, dec: target.decDeg, fov: target.defaultFov });
      } finally {
        setIsResolving(false);
      }
    },
    [sky, updateUrlState],
  );

  const handleJump = useCallback(
    (ra: number, dec: number) => {
      resetTime();
      setActiveTargetName(undefined);
      updateUrlState({ ra, dec });
    },
    [updateUrlState],
  );

  const handleResolveName = useCallback(
    async (name: string) => {
      setIsResolving(true);
      try {
        const res = await sky.resolveByName(name, '2025-07-01');
        resetTime();
        setActiveTargetName(res.matched_name);
        updateUrlState({ ra: res.current.ra, dec: res.current.dec });
        setToast(`${res.matched_name} encontrado en ${res.source.toUpperCase()}`);
      } catch (e) {
        setToast(e instanceof ApiError ? e.message : 'No se encontró ese objeto.');
      } finally {
        setIsResolving(false);
      }
    },
    [sky, updateUrlState],
  );

  const handleViewport = useCallback(
    (next: { ra?: number; dec?: number; fov?: number }) =>
      updateUrlState({ ra: next.ra ?? urlState.ra, dec: next.dec ?? urlState.dec, fov: next.fov ?? urlState.fov }),
    [updateUrlState, urlState.dec, urlState.fov, urlState.ra],
  );


  const handleL2 = useCallback(
    async (v: L2ViewMode) => {
      setL2View(v);
      if (v !== 'off') {
        setIsPlaying(false);
        if (!sky.l2) await sky.loadL2();
      }
    },
    [sky],
  );

  const handleCmdAction = useCallback(
    (action: 'blink' | 'diff' | 'sum' | 'split' | 'motion' | 'selection') => {
      if (action === 'blink' || action === 'diff' || action === 'sum') setMode(urlState.mode === action ? 'normal' : action);
      if (action === 'split') updateUrlState({ view: isSplit ? 'hud' : 'split' });
    },
    [isSplit, setMode, updateUrlState, urlState.mode],
  );

  // Qué estamos mirando ------------------------------------------------------------------------------------------
  const { title, subtitle } = useMemo(() => {
    const radius = Math.max(0.05, urlState.fov);
    const near = [...(sky.objects?.objects ?? [])].filter((o) => o.distance_arcsec < 30).sort((a, b) => a.distance_arcsec - b.distance_arcsec);
    // SIMBAD da nombres y tipos más legibles ("NGC 7714 · galaxia") que NED.
    const nearest = near.find((o) => o.source.toLowerCase() === 'simbad') ?? near[0];
    const typeHint = nearest ? objectTypeLabel(nearest.type, nearest.type_raw) : undefined;
    if (sky.resolveInfo && sep(sky.resolveInfo.current, center) < radius) {
      return { title: sky.resolveInfo.matched_name.replace(/\s+/g, ' '), subtitle: typeHint ?? selectedTarget.category };
    }
    if (sep({ ra: selectedTarget.raDeg, dec: selectedTarget.decDeg }, center) < radius) {
      return { title: selectedTarget.name, subtitle: selectedTarget.category };
    }
    if (nearest && nearest.distance_arcsec < 30) {
      return { title: nearest.name.replace(/\s+/g, ' '), subtitle: objectTypeLabel(nearest.type, nearest.type_raw) };
    }
    return { title: 'Campo sin nombre', subtitle: `${urlState.ra.toFixed(3)}°, ${urlState.dec >= 0 ? '+' : ''}${urlState.dec.toFixed(3)}°` };
  }, [center, selectedTarget, sky.objects, sky.resolveInfo, urlState.dec, urlState.fov, urlState.ra]);

  const shownFrame = useMemo(() => {
    if (!frames.length) return null;
    const i = urlState.mode === 'blink' ? (blinkFrame === 1 ? 0 : frames.length - 1) : Math.min(frames.length - 1, frameIndex);
    return frames[i];
  }, [blinkFrame, frameIndex, frames, urlState.mode]);

  const measurePoint = sky.probeCoord ?? center;

  // Contexto que se adjunta a cada nota (para poder volver a esa vista).
  const noteContext: NoteContext = useMemo(
    () => ({
      title,
      ra: urlState.ra,
      dec: urlState.dec,
      fov: urlState.fov,
      mode: urlState.mode,
      frameDate: urlState.mode === 'diff' || urlState.mode === 'sum' ? undefined : shownFrame?.date_obs,
      detector: shownFrame?.detector,
      bandUm: shownFrame?.band_um,
    }),
    [shownFrame, title, urlState.dec, urlState.fov, urlState.mode, urlState.ra],
  );

  // Rango de fechas para /api/predict: el de las imágenes disponibles en la zona.
  const predictFrom = (sky.coverage?.first_date ?? '2025-05-01').slice(0, 10);
  const predictTo = (sky.coverage?.last_date ?? '2026-06-01').slice(0, 10);

  // Posición predicha para la fecha de la imagen visible (la más cercana en el tiempo).
  const predictNow = useMemo(() => {
    const pos = sky.predict?.positions;
    if (!pos?.length || !shownFrame || l2View !== 'off' || urlState.mode === 'diff' || urlState.mode === 'sum') return null;
    const t = Date.parse(shownFrame.date_obs);
    let best = pos[0];
    for (const q of pos) if (Math.abs(Date.parse(q.date) - t) < Math.abs(Date.parse(best.date) - t)) best = q;
    return Math.abs(Date.parse(best.date) - t) < 2 * 86400000 ? best : null;
  }, [l2View, shownFrame, sky.predict, urlState.mode]);

  // Para marcar un asteroide hace falta una sola exposición alineada a la vista (no L2, resta ni suma).
  const pickBlocker =
    l2View !== 'off' ? 'Vuelve a la imagen «Alineada» para marcar el asteroide.'
    : urlState.mode === 'diff' || urlState.mode === 'sum' ? 'Cambia a «Secuencia» o «Parpadeo»: se marca sobre una sola fecha.'
    : !shownFrame || !sky.sequence ? 'Espera a que carguen las imágenes.'
    : undefined;
  useEffect(() => { if (pickBlocker) setPickMode(false); }, [pickBlocker]);

  const handleProbe = useCallback(
    (ra: number, dec: number) => {
      setInspectorOpen(true);
      if (pickMode && shownFrame && sky.sequence && /^\d+$/.test(asteroidId)) {
        setPickMode(false);
        setInspectorTab('motion');
        void sky.predictAsteroidFromCurrent({
          asteroid_id: Number(asteroidId),
          current_observation: { mjd_utc: isoToMjd(shownFrame.date_obs), ra, dec },
          horizon_days: horizonDays,
          image_id: shownFrame.id,
          view: {
            ra: sky.sequence.center.ra,
            dec: sky.sequence.center.dec,
            fov: sky.sequence.fov_arcsec,
            size: sky.sequence.size_px,
          },
        });
        return;
      }
      void sky.probeSpectrumAt(ra, dec);
      setInspectorTab('spectrum');
    },
    [asteroidId, horizonDays, pickMode, shownFrame, sky],
  );
  const stageLoading = sky.loadingSequence || sky.loadingStack || (l2View !== 'off' && sky.loadingL2);
  const stageLoadingLabel = l2View !== 'off' && sky.loadingL2
    ? 'Descargando la exposición L2 completa…'
    : sky.loadingStack ? 'Combinando fechas…' : 'Cargando imágenes de SPHEREx…';

  return (
    <div className="h-screen w-screen flex flex-col bg-ink text-fg overflow-hidden">
      <TopBar
        targets={SPHEREX_TARGETS}
        selectedTargetId={selectedTarget.id}
        title={title}
        subtitle={subtitle}
        isResolving={isResolving}
        layoutView={urlState.view}
        apiStatus={sky.status}
        inspectorOpen={!isSplit && inspectorOpen}
        onSelectTarget={handleSelectTarget}
        onOpenSearch={() => setSearchOpen(true)}
        onChangeLayoutView={(view: LayoutViewMode) => updateUrlState({ view })}
        onToggleInspector={() => (isSplit ? updateUrlState({ view: 'hud' }) : setInspectorOpen((o) => !o))}
        onOpenHelp={() => setHelpOpen(true)}
        notesOpen={notesOpen}
        notesCount={notesCount}
        onToggleNotes={() => setNotesOpen((o) => !o)}
        backupOn={backup.only}
        backupAvailable={backup.available}
        backupCenters={backup.sequenceCenters}
        backupL2Centers={backup.l2Centers}
        onToggleBackup={backup.setOnly}
      />
      <SystemBanner status={sky.status} backup={backup} />

      <div className="relative flex-1 min-h-0 flex">
        {/* Notas (izquierda) */}
        {notesOpen && (
          <div className="w-[300px] xl:w-[320px] shrink-0 max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:z-30 max-lg:w-[min(320px,100%)] max-lg:shadow-2xl animate-panel-enter">
            <NotesPanel
              current={noteContext}
              onClose={() => setNotesOpen(false)}
              onCountChange={setNotesCount}
              onGoTo={(ctx) => {
                setL2View('off');
                setIsPlaying(false);
                if (ctx.frameDate) {
                  const i = frames.findIndex((f) => f.date_obs === ctx.frameDate);
                  if (i >= 0 && Math.abs(ctx.ra - urlState.ra) < 1e-4 && Math.abs(ctx.dec - urlState.dec) < 1e-4) setFrameIndex(i);
                  else setPendingFrameDate(ctx.frameDate);
                }
                updateUrlState({ ra: ctx.ra, dec: ctx.dec, fov: ctx.fov, mode: ctx.mode });
              }}
            />
          </div>
        )}

        {/* Cielo */}
        <main className={isSplit && detectorsMax ? 'hidden' : 'relative flex-1 min-w-0'} aria-label="Cielo">
          <SkyStage
            ra={urlState.ra}
            dec={urlState.dec}
            fov={urlState.fov}
            frameIndex={frameIndex}
            blinkFrame={blinkFrame}
            mode={urlState.mode}
            l2View={l2View}
            catalogOverlays={overlays}
            showLabels={showLabels}
            sequenceResult={sky.sequence}
            stackResult={sky.stack}
            gaiaOverlay={sky.gaiaOverlay}
            wiseOverlay={sky.wiseOverlay}
            objectsResult={sky.objects}
            predictResult={sky.predict}
            l2Result={sky.l2}
            l2Pixel={sky.l2Pixel}
            asteroidResult={sky.asteroid}
            isLoading={stageLoading}
            loadingLabel={stageLoadingLabel}
            probeCoord={sky.probeCoord}
            predictNow={predictNow}
            pickMode={pickMode}
            altText={`Imagen infrarroja de SPHEREx: ${title}`}
            onViewportChange={handleViewport}
            onInspectL2Pixel={sky.inspectL2Pixel}
            onProbe={handleProbe}
            onCursorMove={setCursor}
          />

          <div className="absolute top-3 left-3 z-20">
            <ActivityStatus job={sky.activeJob} warnings={sky.warnings} error={sky.error} onRetry={sky.retry} />
          </div>

          {l2View !== 'off' && sky.l2Pixel && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bx-float rounded-full px-3 py-1.5 text-xs font-mono text-fg pointer-events-none">
              Píxel ({Math.round(sky.l2Pixel.x)}, {Math.round(sky.l2Pixel.y)}) ·{' '}
              <b className="text-data">{(sky.l2Pixel.value ?? sky.l2Pixel.flux ?? 0).toFixed(2)} {sky.l2Pixel.unit ?? 'MJy/sr'}</b>
            </div>
          )}

          {toast && (
            <div role="status" className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bx-float rounded-full px-4 py-1.5 text-xs text-fg animate-panel-enter pointer-events-none">
              {toast}
            </div>
          )}

          <div className="absolute bottom-3 inset-x-3 z-20">
            <ViewerDock
              l2View={l2View}
              isLoadingL2={sky.loadingL2}
              onChangeL2View={(v) => void handleL2(v)}
              overlays={overlays}
              showLabels={showLabels}
              onToggleOverlay={(k) => setOverlays((o) => ({ ...o, [k]: !o[k] }))}
              onToggleLabels={() => setShowLabels((v) => !v)}
              stretch={stretch}
              cmap={cmap}
              scale={scale}
              onChangeStretch={setStretch}
              onChangeCmap={setCmap}
              onChangeScale={setScale}
              fov={urlState.fov}
              cursor={cursor}
              onZoom={(f) => handleViewport({ fov: Number(Math.max(0.05, Math.min(4, urlState.fov * f)).toFixed(3)) })}
              onSetFov={(fov) => handleViewport({ fov })}
              onRecenter={() =>
                handleViewport({
                  ra: sky.resolveInfo?.current.ra ?? selectedTarget.raDeg,
                  dec: sky.resolveInfo?.current.dec ?? selectedTarget.decDeg,
                  fov: selectedTarget.defaultFov,
                })
              }
              mode={urlState.mode}
              onChangeMode={setMode}
              frameIndex={frameIndex}
              blinkFrame={blinkFrame}
              isPlaying={isPlaying}
              speedMs={speedMs}
              sequence={sky.sequence}
              coverage={sky.coverage}
              isLoadingStack={sky.loadingStack}
              onFrameIndexChange={(i) => {
                setIsPlaying(false);
                if (urlState.mode !== 'normal') setMode('normal');
                setFrameIndex(i);
              }}
              onTogglePlay={() => {
                if (urlState.mode !== 'normal') setMode('normal');
                setIsPlaying((v) => !v);
              }}
              onChangeSpeed={setSpeedMs}
            />
          </div>
        </main>

        {/* Panel derecho */}
        {isSplit ? (
          <div className={detectorsMax ? 'flex-1 min-w-0' : 'w-full md:w-[560px] xl:w-[620px] shrink-0 max-md:absolute max-md:inset-0 max-md:z-30'}>
            <DetectorsPanel
              ra={urlState.ra}
              dec={urlState.dec}
              framesMeta={sky.frames?.frames ?? []}
              spectrum={sky.probeSpectrum ?? sky.spectrum}
              loadingSpectrum={sky.loadingSpectrum || sky.loadingProbeSpectrum}
              spectrumJob={sky.spectrumJob}
              cube={sky.cube}
              loadingCube={sky.loadingCube}
              cubeJob={sky.cubeJob}
              cubeError={!sky.loadingCube && !sky.cube ? sky.error : null}
              detectorFilter={detectorFilter}
              isMaximized={detectorsMax}
              onToggleMaximize={() => setDetectorsMax((m) => !m)}
              onClose={() => {
                setDetectorsMax(false);
                updateUrlState({ view: 'hud' });
              }}
              onChangeDetectorFilter={setDetectorFilter}
              onLoadCube={() => void sky.loadCube()}
              onMeasureSpectrum={() => void sky.probeSpectrumAt(urlState.ra, urlState.dec)}
            />
          </div>
        ) : (
          inspectorOpen && (
            <div className="w-[380px] xl:w-[400px] shrink-0 max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-30 max-lg:w-[min(400px,100%)] max-lg:shadow-2xl animate-panel-enter">
              <Inspector
                tab={inspectorTab}
                onTab={setInspectorTab}
                busy={{
                  spectrum: sky.loadingProbeSpectrum || sky.loadingSpectrum,
                  composition: sky.loadingComposition,
                  motion: sky.loadingPredict || sky.loadingAsteroid,
                }}
              >
                {inspectorTab === 'summary' && (
                  <SummaryTab
                    title={title}
                    subtitle={subtitle}
                    center={center}
                    resolveInfo={sky.resolveInfo && sep(sky.resolveInfo.current, center) < Math.max(0.05, urlState.fov) ? sky.resolveInfo : null}
                    probe={sky.probeCoord}
                    objects={sky.objects}
                    frames={sky.frames}
                    coverage={sky.coverage}
                    loadingMeta={sky.loadingSequence}
                    onProbe={handleProbe}
                    onClearProbe={sky.clearProbeSpectrum}
                    onGoSpectrum={() => {
                      if (!sky.probeSpectrum && !sky.loadingProbeSpectrum) void sky.probeSpectrumAt(measurePoint.ra, measurePoint.dec);
                      setInspectorTab('spectrum');
                    }}
                    onGoComposition={() => setInspectorTab('composition')}
                  />
                )}
                {inspectorTab === 'spectrum' && (
                  <SpectrumTab
                    spectrum={sky.probeSpectrum ?? sky.spectrum}
                    loading={sky.probeCoord ? sky.loadingProbeSpectrum : sky.loadingSpectrum || sky.loadingProbeSpectrum}
                    job={sky.spectrumJob}
                    point={measurePoint}
                    isProbe={!!sky.probeCoord}
                    framesMeta={sky.frames?.frames ?? []}
                    lens={urlState.lens}
                    onChangeLens={(lens: MolecularLensId) => updateUrlState({ lens })}
                    onMeasure={() => void sky.probeSpectrumAt(measurePoint.ra, measurePoint.dec)}
                  />
                )}
                {inspectorTab === 'composition' && (
                  <CompositionCard
                    targetCoord={measurePoint}
                    isProbe={!!sky.probeCoord}
                    result={sky.composition}
                    resultCoord={sky.compositionCoord}
                    job={sky.compositionJob}
                    loading={sky.loadingComposition}
                    error={sky.compositionError}
                    onAnalyze={(context) => void sky.analyzeComposition(measurePoint.ra, measurePoint.dec, { context })}
                    onOpenDetail={() => setCompositionOpen(true)}
                  />
                )}
                {inspectorTab === 'motion' && (
                  <MotionTab
                    point={measurePoint}
                    suggestedName={title === 'Campo sin nombre' ? '' : title}
                    dateFrom={predictFrom}
                    dateTo={predictTo}
                    shownFrame={shownFrame}
                    canPick={!pickBlocker}
                    cantPickReason={pickBlocker}
                    predict={sky.predict}
                    predictNow={predictNow}
                    loadingPredict={sky.loadingPredict}
                    predictJob={sky.predictJob}
                    predictError={sky.predictError}
                    onPredict={(name) =>
                      void sky.predictMotion({ ra: measurePoint.ra, dec: measurePoint.dec, name, date_from: predictFrom, date_to: predictTo })
                    }
                    onClearPredict={sky.clearPredict}
                    onCenter={(c) => handleViewport({ ra: c.ra, dec: c.dec })}
                    asteroid={sky.asteroid}
                    loadingAsteroid={sky.loadingAsteroid}
                    asteroidError={sky.asteroidError}
                    pickMode={pickMode}
                    asteroidId={asteroidId}
                    horizonDays={horizonDays}
                    onAsteroidId={setAsteroidId}
                    onHorizonDays={setHorizonDays}
                    onTogglePick={() => setPickMode((m) => !m)}
                    onClearAsteroid={sky.clearAsteroid}
                  />
                )}
                {inspectorTab === 'local' && (
                  <LocalTab
                    center={{ ra: urlState.ra, dec: urlState.dec }}
                    onGoTo={(ra, dec) => {
                      setL2View('off');
                      updateUrlState({ ra, dec });
                    }}
                  />
                )}
                {inspectorTab === 'data' && (
                  <DataTab
                    frame={l2View !== 'off' ? sky.l2?.frame ?? null : shownFrame}
                    modeLabel={l2View !== 'off' ? 'Exposición L2 original' : MODE_LABEL[urlState.mode]}
                    sequence={sky.sequence}
                    stack={urlState.mode === 'diff' || urlState.mode === 'sum' ? sky.stack : null}
                    l2Pixel={sky.l2Pixel}
                    cubePixel={sky.cubePixel}
                    status={sky.status}
                    warnings={sky.warnings}
                    shareUrl={shareUrl}
                    backup={backup}
                  />
                )}
              </Inspector>
            </div>
          )
        )}
      </div>

      <CompositionModal
        open={compositionOpen}
        onClose={() => setCompositionOpen(false)}
        result={sky.composition}
        job={sky.compositionJob}
        loading={sky.loadingComposition}
        error={sky.compositionError}
        onRetry={sky.compositionCoord ? () => void sky.analyzeComposition(sky.compositionCoord!.ra, sky.compositionCoord!.dec) : undefined}
      />
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      <CommandSearchModal
        targets={SPHEREX_TARGETS}
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectTarget={handleSelectTarget}
        onJumpCoordinates={handleJump}
        onResolveName={handleResolveName}
        onExecuteAction={handleCmdAction}
      />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <SpherexExplorerShell />
    </BrowserRouter>
  );
}
