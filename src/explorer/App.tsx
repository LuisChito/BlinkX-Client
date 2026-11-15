import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrowserRouter, useSearchParams } from 'react-router-dom';
import { SPHEREX_TARGETS } from './data/spherexCatalog';
import type {
  CatalogOverlayState,
  ExplorerUrlState,
  FloatingModuleVisibility,
  LayoutViewMode,
  MolecularLensId,
  TargetCatalogEntry,
  ViewMode,
} from './types/spherex';
import {
  clampDec,
  normalizeRa,
  parseExplorerUrlParams,
  serializeExplorerUrlParams,
} from './utils/urlState';
import { SkyCanvasHUD } from './components/SkyCanvasHUD';
import { SixDetectorEpochPanel } from './components/SixDetectorEpochPanel';
import { TopTelemetryBar } from './components/TopTelemetryBar';
import { SpectralTelemetryModule } from './components/SpectralTelemetryModule';
import { TimeTravelBlinkBar } from './components/TimeTravelBlinkBar';
import { CommandSearchModal } from './components/CommandSearchModal';
import { DraggableHUDPanel } from './components/DraggableHUDPanel';
import { ContractJobBanner } from './components/ContractJobBanner';
import {
  type Cmap,
  type Detector,
  type Scale,
  type Stretch,
  useSkyContract,
} from './hooks/useSkyContract';
import { ApiError } from '../lib/skyApi';

export function SpherexExplorerShell() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlState = useMemo(() => parseExplorerUrlParams(searchParams), [searchParams]);

  const selectedTarget = useMemo(
    () => SPHEREX_TARGETS.find((t) => t.id === urlState.target) ?? SPHEREX_TARGETS[0],
    [urlState.target],
  );

  const [visibility, setVisibility] = useState<FloatingModuleVisibility>({
    spectra: true,
    aiInsights: true,
    metadata: true,
    motionFilters: false,
    selectionTool: false,
    shareUrl: false,
  });

  const [detectorFilter, setDetectorFilter] = useState<Detector | undefined>(undefined);
  const [stretch, setStretch] = useState<Stretch>('asinh');
  const [cmap, setCmap] = useState<Cmap>('gray');
  const [scale, setScale] = useState<Scale>('sequence');
  const [catalogOverlays, setCatalogOverlays] = useState<CatalogOverlayState>({
    gaiaDr3: false,
    allWise: false,
  });

  const [frameIndex, setFrameIndex] = useState(0);
  const [blinkFrame, setBlinkFrame] = useState<1 | 2>(1);
  const [blinkSpeedMs, setBlinkSpeedMs] = useState<number>(420);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEpochPanelMaximized, setIsEpochPanelMaximized] = useState(false);
  const [cmdKOpen, setCmdKOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [activeTargetName, setActiveTargetName] = useState<string | undefined>(selectedTarget.name);
  const [isResolving, setIsResolving] = useState(false);

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
    showGaia: catalogOverlays.gaiaDr3,
    showWise: catalogOverlays.allWise,
  });

  const totalSeqFrames = sky.sequence?.frames.length ?? 0;

  useEffect(() => {
    setFrameIndex(0);
  }, [sky.sequence]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(null), 2800);
    return () => window.clearTimeout(t);
  }, [toastMsg]);

  const updateUrlState = useCallback(
    (patch: Partial<ExplorerUrlState>) => {
      const next: ExplorerUrlState = {
        ...urlState,
        ...patch,
      };
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
    const queryStr = serializeExplorerUrlParams(urlState).toString();
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'https://hextech-spherex.app';
    return `${origin}/?${queryStr}`;
  }, [urlState]);

  const handleToggleModule = useCallback((key: keyof FloatingModuleVisibility) => {
    setVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Cmd+K Search Shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        if (!cmdKOpen) {
          e.preventDefault();
          setCmdKOpen(true);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cmdKOpen]);

  // Blink mode automatic frame alternation (adjustable speed)
  useEffect(() => {
    if (urlState.mode !== 'blink') return;
    const timer = window.setInterval(() => {
      setBlinkFrame((prev) => (prev === 1 ? 2 : 1));
    }, blinkSpeedMs);
    return () => window.clearInterval(timer);
  }, [blinkSpeedMs, urlState.mode]);

  // Timelapse playback loop across real sequenceResult.frames
  useEffect(() => {
    if (!isPlaying || totalSeqFrames <= 1) return;
    const timer = window.setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % totalSeqFrames);
    }, Math.round(blinkSpeedMs * 1.4));
    return () => window.clearInterval(timer);
  }, [blinkSpeedMs, isPlaying, totalSeqFrames]);

  // Auto-load 6-channel + 3D Sky Cube by default when opening "6 Detectores / Épocas"
  useEffect(() => {
    if (urlState.view === 'split' && !sky.cube && !sky.loadingCube && !sky.error) {
      void sky.loadCube();
    }
  }, [urlState.view, sky.cube, sky.loadingCube, sky.error, sky.loadCube]);

  const handleSelectTarget = useCallback(
    async (target: TargetCatalogEntry) => {
      setIsPlaying(false);
      setFrameIndex(0);
      setActiveTargetName(target.name);
      setIsResolving(true);
      showToast(`Buscando "${target.name}" en SIMBAD/NED...`);
      try {
        const res = await sky.resolveByName(target.name, '2025-07-01');
        setActiveTargetName(res.matched_name);
        updateUrlState({
          target: target.id,
          ra: res.current.ra,
          dec: res.current.dec,
          fov: target.defaultFov,
        });
        showToast(`${res.matched_name} (${res.source.toUpperCase()})`);
      } catch {
        updateUrlState({
          target: target.id,
          ra: target.raDeg,
          dec: target.decDeg,
          fov: target.defaultFov,
        });
        showToast(`Objetivo: ${target.name}`);
      } finally {
        setIsResolving(false);
      }
    },
    [showToast, sky, updateUrlState],
  );

  const handleJumpCoordinates = useCallback(
    (ra: number, dec: number) => {
      setIsPlaying(false);
      setFrameIndex(0);
      setActiveTargetName(undefined);
      updateUrlState({ ra, dec });
      showToast(`RA ${ra.toFixed(5)}°, Dec ${dec.toFixed(5)}°`);
    },
    [showToast, updateUrlState],
  );

  const handleResolveName = useCallback(
    async (name: string) => {
      setIsResolving(true);
      showToast(`Buscando "${name}" en /api/resolve...`);
      try {
        const res = await sky.resolveByName(name, '2025-07-01');
        setIsPlaying(false);
        setFrameIndex(0);
        setActiveTargetName(res.matched_name);
        updateUrlState({ ra: res.current.ra, dec: res.current.dec });
        showToast(
          `${res.matched_name} (${res.source.toUpperCase()}) • época ${res.current.epoch.toFixed(1)}`,
        );
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : 'No se pudo resolver el objeto.';
        showToast(msg);
      } finally {
        setIsResolving(false);
      }
    },
    [showToast, sky, updateUrlState],
  );

  const handleViewportChange = useCallback(
    (next: { ra?: number; dec?: number; fov?: number }) => {
      updateUrlState({
        ra: next.ra ?? urlState.ra,
        dec: next.dec ?? urlState.dec,
        fov: next.fov ?? urlState.fov,
      });
    },
    [updateUrlState, urlState.dec, urlState.fov, urlState.ra],
  );

  const handleChangeLayoutView = useCallback(
    (view: LayoutViewMode) => {
      updateUrlState({ view });
    },
    [updateUrlState],
  );

  const handleStepBlink = useCallback(() => {
    if (urlState.mode !== 'blink') {
      updateUrlState({ mode: 'blink' });
    }
    setBlinkFrame((prev) => (prev === 1 ? 2 : 1));
  }, [updateUrlState, urlState.mode]);

  const handleToggleBlink = useCallback(() => {
    setIsPlaying(false);
    updateUrlState({ mode: urlState.mode === 'blink' ? 'normal' : 'blink' });
  }, [updateUrlState, urlState.mode]);

  const handleToggleDiff = useCallback(() => {
    setIsPlaying(false);
    updateUrlState({ mode: urlState.mode === 'diff' ? 'normal' : 'diff' });
  }, [updateUrlState, urlState.mode]);

  const handleToggleSum = useCallback(() => {
    setIsPlaying(false);
    updateUrlState({ mode: urlState.mode === 'sum' ? 'normal' : 'sum' });
  }, [updateUrlState, urlState.mode]);

  const handleToggleCatalogOverlay = useCallback(
    (key: keyof CatalogOverlayState) => {
      setCatalogOverlays((prev) => {
        const nextVal = !prev[key];
        const label = key === 'gaiaDr3' ? 'Gaia DR3' : 'AllWISE';
        showToast(`Capa ${label} ${nextVal ? 'activada' : 'ocultada'}`);
        return { ...prev, [key]: nextVal };
      });
    },
    [showToast],
  );

  const handleExecuteCmdAction = useCallback(
    (action: 'blink' | 'diff' | 'sum' | 'split' | 'motion' | 'selection') => {
      if (action === 'blink') handleToggleBlink();
      if (action === 'diff') handleToggleDiff();
      if (action === 'sum') handleToggleSum();
      if (action === 'split') {
        handleChangeLayoutView(urlState.view === 'split' ? 'hud' : 'split');
      }
      if (action === 'motion') {
        handleToggleModule('motionFilters');
      }
      if (action === 'selection') {
        handleChangeLayoutView('nested');
      }
    },
    [
      handleChangeLayoutView,
      handleToggleBlink,
      handleToggleDiff,
      handleToggleModule,
      handleToggleSum,
      urlState.view,
    ],
  );

  const isDrawerVisible =
    urlState.view !== 'nested' &&
    (visibility.spectra || visibility.aiInsights || visibility.metadata || visibility.shareUrl);

  const screenW = typeof window !== 'undefined' ? window.innerWidth : 1440;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#050304] text-[#f6f1ee] select-none">
      {/* LAYER 1: BASE VISUALIZATION SKY STAGE & SPLIT FLOATING DRAWER */}
      <main className="absolute inset-0 w-full h-full overflow-hidden">
        <div
          className={`relative h-full w-full transition-all duration-300 ${
            urlState.view === 'split' && isEpochPanelMaximized
              ? 'hidden'
              : urlState.view === 'split'
                ? 'block lg:pr-[636px] xl:pr-[676px]'
                : isDrawerVisible
                  ? 'block lg:pr-[355px]'
                  : 'block'
          }`}
        >
          <SkyCanvasHUD
            target={selectedTarget}
            ra={urlState.ra}
            dec={urlState.dec}
            fov={urlState.fov}
            frameIndex={frameIndex}
            blinkFrame={blinkFrame}
            mode={urlState.mode}
            catalogOverlays={catalogOverlays}
            isDrawerOpen={urlState.view === 'split' || (isDrawerVisible && urlState.view === 'hud')}
            isSplitView={urlState.view === 'split'}
            onViewportChange={handleViewportChange}
            onToggleCatalogOverlay={handleToggleCatalogOverlay}
            sequenceResult={sky.sequence}
            stackResult={sky.stack}
            gaiaOverlay={sky.gaiaOverlay}
            wiseOverlay={sky.wiseOverlay}
            objectsResult={sky.objects}
            predictResult={sky.predict}
            l2Result={sky.l2}
            l2Pixel={sky.l2Pixel}
            cubeResult={sky.cube}
            cubePixel={sky.cubePixel}
            asteroidResult={sky.asteroid}
            stretch={stretch}
            cmap={cmap}
            scale={scale}
            isLoadingSequence={sky.loadingSequence}
            isLoadingStack={sky.loadingStack}
            isLoadingL2={sky.loadingL2}
            onChangeStretch={setStretch}
            onChangeCmap={setCmap}
            onChangeScale={setScale}
            onLoadL2={sky.loadL2}
            onInspectL2Pixel={sky.inspectL2Pixel}
            onInspectCubePixel={sky.inspectCubePixel}
            probeCoord={sky.probeCoord}
            resolvedCenter={sky.resolveInfo?.current ? { ra: sky.resolveInfo.current.ra, dec: sky.resolveInfo.current.dec } : null}
            onProbeSpectrum={(probeRa, probeDec) => {
              void sky.probeSpectrumAt(probeRa, probeDec);
              showToast(`Sonda /api/spectrum en RA ${probeRa.toFixed(4)}°, Dec ${probeDec.toFixed(4)}°`);
            }}
          />
        </div>

        {/* 6 DETECTORES / ÉPOCAS / SKY CUBE */}
        {urlState.view === 'split' && (
          <div
            className={`fixed z-30 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isEpochPanelMaximized
                ? 'inset-x-3 sm:inset-x-6 top-16 bottom-3'
                : 'top-16 right-3 bottom-3 w-full sm:w-[580px] lg:w-[620px] xl:w-[660px] max-w-[calc(100vw-24px)]'
            }`}
          >
            <SixDetectorEpochPanel
              target={selectedTarget}
              ra={urlState.ra}
              dec={urlState.dec}
              mode={urlState.mode}
              framesMeta={sky.frames?.frames ?? []}
              sequenceResult={sky.sequence}
              contractSpectrum={sky.probeSpectrum ?? sky.spectrum}
              isLoadingSpectrum={sky.loadingSpectrum || sky.loadingProbeSpectrum}
              resolveInfo={sky.resolveInfo}
              cubeResult={sky.cube}
              loadingCube={sky.loadingCube}
              cubeJob={sky.cubeJob}
              error={sky.error}
              detectorFilter={detectorFilter}
              isMaximized={isEpochPanelMaximized}
              onToggleMaximize={() => setIsEpochPanelMaximized((p) => !p)}
              onChangeDetectorFilter={setDetectorFilter}
              onLoadCube={() => {
                void sky.loadCube();
              }}
              onMeasureSpectrum={() => {
                void sky.probeSpectrumAt(urlState.ra, urlState.dec);
                showToast(`Midiendo /api/spectrum en RA ${urlState.ra.toFixed(4)}°, Dec ${urlState.dec.toFixed(4)}°`);
              }}
              onChangeMode={(nextMode: ViewMode) => {
                setIsPlaying(false);
                updateUrlState({ mode: nextMode });
              }}
              onCloseSplit={() => {
                setIsEpochPanelMaximized(false);
                handleChangeLayoutView('hud');
              }}
            />
          </div>
        )}
      </main>

      {/* LAYER 2A: TOP TELEMETRY BAR */}
      <div className="fixed top-0 inset-x-0 z-40 pointer-events-none">
        <TopTelemetryBar
          targets={SPHEREX_TARGETS}
          selectedTarget={selectedTarget}
          ra={urlState.ra}
          dec={urlState.dec}
          layoutView={urlState.view}
          fov={urlState.fov}
          onSelectTarget={handleSelectTarget}
          onChangeLayoutView={handleChangeLayoutView}
          onChangeFov={(nextFov) => {
            handleViewportChange({ fov: nextFov });
            showToast(
              nextFov > 0.5
                ? `Campo amplio FoV ${nextFov.toFixed(2)}°: Mayor transferencia de datos para rastreo rápido`
                : `Campo de visión FoV ajustado a ${nextFov.toFixed(2)}°`,
            );
          }}
          onOpenCmdK={() => setCmdKOpen(true)}
          apiStatus={sky.status}
          resolveInfo={sky.resolveInfo}
          isResolving={isResolving}
        />
      </div>

      {/* LAYER 2E: RIGHT LATERAL TELEMETRY DRAWER (Only in HUD mode) */}
      {urlState.view === 'hud' && isDrawerVisible && (
        <DraggableHUDPanel
          id="telemetry-drawer"
          defaultPosition={{
            x: Math.max(20, screenW - 355),
            y: 64,
          }}
          headerTitle="Telemetry Drawer"
        >
          <SpectralTelemetryModule
            target={selectedTarget}
            contractSpectrum={sky.spectrum}
            probeCoord={sky.probeCoord}
            probeSpectrum={sky.probeSpectrum}
            loadingProbeSpectrum={sky.loadingProbeSpectrum}
            spectrumJob={sky.spectrumJob}
            framesMeta={sky.frames?.frames ?? []}
            isLoadingSpectrum={sky.loadingSpectrum}
            resolveInfo={sky.resolveInfo}
            l2Pixel={sky.l2Pixel}
            cubePixel={sky.cubePixel}
            lens={urlState.lens}
            mode={urlState.mode}
            layoutView={urlState.view}
            visibility={visibility}
            shareUrl={shareUrl}
            onOpenSixDetectors={() => handleChangeLayoutView('split')}
            onClearProbe={sky.clearProbeSpectrum}
            onMeasureCenterSpectrum={() => {
              void sky.probeSpectrumAt(urlState.ra, urlState.dec);
              showToast(`Midiendo /api/spectrum en RA ${urlState.ra.toFixed(4)}°, Dec ${urlState.dec.toFixed(4)}°`);
            }}
            onChangeLens={(lens: MolecularLensId) => updateUrlState({ lens })}
            onToggleVisibility={handleToggleModule}
            onExportReport={() => {}}
          />
        </DraggableHUDPanel>
      )}

      {/* LAYER 2G: BOTTOM TIME-TRAVEL BLINK BAR (Only in HUD mode) */}
      {urlState.view === 'hud' && (
        <div
          className={`fixed bottom-3 left-3 z-30 pointer-events-none transition-all duration-300 ${
            isDrawerVisible ? 'right-[365px]' : 'right-3'
          }`}
        >
          <TimeTravelBlinkBar
            frameIndex={frameIndex}
            blinkFrame={blinkFrame}
            blinkSpeedMs={blinkSpeedMs}
            mode={urlState.mode}
            isPlaying={isPlaying}
            coverage={sky.coverage}
            sequenceResult={sky.sequence}
            onFrameIndexChange={(idx) => {
              setIsPlaying(false);
              if (urlState.mode !== 'normal') updateUrlState({ mode: 'normal' });
              setFrameIndex(idx);
            }}
            onTogglePlay={() => {
              if (!isPlaying && urlState.mode !== 'normal') {
                updateUrlState({ mode: 'normal' });
              }
              setIsPlaying((p) => !p);
            }}
            onChangeBlinkSpeedMs={setBlinkSpeedMs}
            onToggleBlink={handleToggleBlink}
            onToggleDiff={handleToggleDiff}
            onToggleSum={handleToggleSum}
            onStepBlink={handleStepBlink}
          />
        </div>
      )}

      {/* LAYER 3A: CONTRACT JOB PROGRESS / WARNINGS & SUBTLE HUD TOAST */}
      <ContractJobBanner job={sky.activeJob} warnings={sky.warnings} error={sky.error} />
      {toastMsg && (
        <div className="fixed top-[68px] left-1/2 -translate-x-1/2 z-50 hud-card-elevated px-4 py-1.5 rounded-full text-xs font-mono text-[#f6f1ee] shadow-2xl animate-panel-enter pointer-events-none border border-white/15">
          {toastMsg}
        </div>
      )}

      {/* LAYER 3B: COMMAND SEARCH PALETTE (Cmd+K) */}
      <CommandSearchModal
        targets={SPHEREX_TARGETS}
        isOpen={cmdKOpen}
        onClose={() => setCmdKOpen(false)}
        onSelectTarget={handleSelectTarget}
        onJumpCoordinates={handleJumpCoordinates}
        onResolveName={handleResolveName}
        onExecuteAction={handleExecuteCmdAction}
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
