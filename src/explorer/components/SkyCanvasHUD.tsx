import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Globe, Layers, Loader2, Minus, Plus, RotateCcw } from 'lucide-react';
import type {
  CatalogOverlayState,
  TargetCatalogEntry,
  ViewMode,
} from '../types/spherex';
import { clampDec, normalizeRa } from '../utils/urlState';
import {
  abs,
  clickToPng,
  skyToSequencePixel,
  type Coord,
  type SequenceResult,
} from '../../lib/skyApi';
import { pixelToSky, skyToPixel } from '../../lib/projection';
import type {
  AsteroidPredictResult,
  Cmap,
  CubePixelResult,
  CubeResult,
  L2PixelResult,
  L2Result,
  ObjectsResponse,
  OverlayResponse,
  PredictResult,
  Scale,
  SkyObject,
  StackResult,
  Stretch,
} from '../hooks/useSkyContract';

export type L2ViewMode = 'off' | 'raw' | 'color';

interface SkyCanvasHUDProps {
  target: TargetCatalogEntry;
  ra: number;
  dec: number;
  fov: number;
  frameIndex: number;
  blinkFrame: 1 | 2;
  mode: ViewMode;
  catalogOverlays: CatalogOverlayState;
  isDrawerOpen?: boolean;
  isSplitView?: boolean;
  onViewportChange: (next: { ra?: number; dec?: number; fov?: number }) => void;
  onToggleCatalogOverlay: (key: keyof CatalogOverlayState) => void;
  sequenceResult?: SequenceResult | null;
  stackResult?: StackResult | null;
  gaiaOverlay?: OverlayResponse | null;
  wiseOverlay?: OverlayResponse | null;
  objectsResult?: ObjectsResponse | null;
  predictResult?: PredictResult | null;
  l2Result?: L2Result | null;
  l2Pixel?: L2PixelResult | null;
  cubeResult?: CubeResult | null;
  cubePixel?: CubePixelResult | null;
  asteroidResult?: AsteroidPredictResult | null;
  stretch?: Stretch;
  cmap?: Cmap;
  scale?: Scale;
  isLoadingSequence?: boolean;
  isLoadingStack?: boolean;
  isLoadingL2?: boolean;
  onChangeStretch?: (s: Stretch) => void;
  onChangeCmap?: (c: Cmap) => void;
  onChangeScale?: (sc: Scale) => void;
  onLoadL2?: () => Promise<L2Result | null>;
  onInspectL2Pixel?: (frameId: string, x: number, y: number, size?: number) => Promise<L2PixelResult | null>;
  onInspectCubePixel?: (tileId: string, x: number, y: number, size?: number) => void;
  probeCoord?: Coord | null;
  resolvedCenter?: Coord | null;
  onProbeSpectrum?: (ra: number, dec: number) => void;
}

export function SkyCanvasHUD({
  target,
  ra,
  dec,
  fov,
  frameIndex,
  blinkFrame,
  mode,
  catalogOverlays,
  isDrawerOpen = true,
  isSplitView = false,
  onViewportChange,
  onToggleCatalogOverlay,
  sequenceResult = null,
  stackResult = null,
  gaiaOverlay = null,
  wiseOverlay = null,
  objectsResult = null,
  predictResult = null,
  l2Result = null,
  l2Pixel = null,
  asteroidResult = null,
  stretch = 'asinh',
  cmap = 'gray',
  scale = 'sequence',
  isLoadingSequence = false,
  isLoadingStack = false,
  isLoadingL2 = false,
  onChangeStretch,
  onChangeCmap,
  onChangeScale,
  onLoadL2,
  onInspectL2Pixel,
  probeCoord = null,
  resolvedCenter = null,
  onProbeSpectrum,
}: SkyCanvasHUDProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [cursorSky, setCursorSky] = useState({ ra, dec });
  const [l2View, setL2View] = useState<L2ViewMode>('off');
  const [l2Marker, setL2Marker] = useState<{ x: number; y: number; ra?: number; dec?: number } | null>(null);
  const [imgError, setImgError] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number } | null>(null);
  const [hostSize, setHostSize] = useState<{ w: number; h: number }>({ w: 800, h: 800 });
  const [hoveredObject, setHoveredObject] = useState<{
    obj: SkyObject;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        setHostSize({ w: r.width, h: r.height });
      }
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const dragPanRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    startRa: number;
    startDec: number;
  }>({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    startRa: ra,
    startDec: dec,
  });

  // Reset L2 view when coordinates/l2Result clear
  useEffect(() => {
    if (!l2Result) {
      setL2View('off');
      setL2Marker(null);
    }
  }, [l2Result]);

  useEffect(() => {
    setL2Marker(null);
  }, [ra, dec, target.id]);

  const activeTanPngUrl = useMemo(() => {
    if (l2View !== 'off' && l2Result) {
      const rawOrColor = l2View === 'raw' ? l2Result.raw_png_url : l2Result.color_png_url;
      if (rawOrColor) return abs(rawOrColor);
    }
    if ((mode === 'diff' || mode === 'sum') && stackResult?.png_url) {
      return abs(stackResult.png_url);
    }
    const seqFrames = sequenceResult?.frames ?? [];
    if (seqFrames.length === 0) return null;
    const idx =
      mode === 'blink'
        ? blinkFrame === 1
          ? 0
          : seqFrames.length - 1
        : Math.min(seqFrames.length - 1, Math.max(0, frameIndex));
    const url = seqFrames[idx]?.png_url;
    return url ? abs(url) : null;
  }, [l2View, l2Result, mode, stackResult, sequenceResult, blinkFrame, frameIndex]);

  useEffect(() => {
    setImgError(false);
  }, [activeTanPngUrl]);

  const activeWcs =
    (mode === 'diff' || mode === 'sum') && stackResult ? stackResult : sequenceResult;
  const tanSize = Math.max(hostSize.w, hostSize.h);
  const viewFovArcsec = Math.max(30, fov * 3600);
  const tanFovArcsec = activeWcs?.fov_arcsec ?? viewFovArcsec;
  const tanCenter = activeWcs?.center ?? { ra, dec };

  const viewCenter = useMemo(() => {
    if (!dragOffset) return { ra, dec };
    const degPerPx = fov / Math.max(200, tanSize);
    return {
      ra: normalizeRa(ra + dragOffset.dx * degPerPx),
      dec: clampDec(dec + dragOffset.dy * degPerPx),
    };
  }, [dec, dragOffset, fov, ra, tanSize]);

  const imgTransform = useMemo(() => {
    if (l2View !== 'off' && l2Result) {
      const l2Scale = Math.max(0.25, Math.min(6, 0.15 / Math.max(0.05, fov)));
      const dx = dragOffset?.dx ?? 0;
      const dy = dragOffset?.dy ?? 0;
      return `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) scale(${l2Scale.toFixed(4)})`;
    }
    const zoomScale = Math.max(0.25, Math.min(8, tanFovArcsec / viewFovArcsec));
    const tanPx = skyToPixel(tanCenter, viewCenter, viewFovArcsec, tanSize);
    const dx = tanPx.x - tanSize / 2;
    const dy = tanPx.y - tanSize / 2;
    return `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) scale(${zoomScale.toFixed(4)})`;
  }, [dragOffset, fov, l2Result, l2View, tanCenter, tanFovArcsec, tanSize, viewCenter, viewFovArcsec]);

  // Render real WCS overlays (/api/overlay, /api/objects, /api/predict, /api/asteroids) aligned to TAN PNG
  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = host.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));

      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      // Skip TAN WCS overlays when viewing raw/color L2 detector frame (different projection)
      if (l2View !== 'off' && l2Result) {
        // Draw L2 detector marker if user clicked a pixel or l2Marker exists!
        const marker = l2Marker || (l2Pixel ? { x: l2Pixel.x, y: l2Pixel.y, ra: l2Pixel.ra, dec: l2Pixel.dec } : null);
        if (marker && imgRef.current) {
          const imgRect = imgRef.current.getBoundingClientRect();
          const hostRect = host.getBoundingClientRect();
          const naturalW = imgRef.current.naturalWidth || l2Result.size_px || 1024;
          const naturalH = imgRef.current.naturalHeight || l2Result.size_px || 1024;
          const canvasX = imgRect.left - hostRect.left + (marker.x / naturalW) * imgRect.width;
          const canvasY = imgRect.top - hostRect.top + (marker.y / naturalH) * imgRect.height;

          // Glowing reticle on L2 pixel
          ctx.strokeStyle = '#ff8a5c';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(canvasX, canvasY, 9, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(canvasX, canvasY, 3.5, 0, Math.PI * 2);
          ctx.stroke();

          // Crosshair lines
          ctx.strokeStyle = '#ff8a5c';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(canvasX - 16, canvasY);
          ctx.lineTo(canvasX - 10, canvasY);
          ctx.moveTo(canvasX + 10, canvasY);
          ctx.lineTo(canvasX + 16, canvasY);
          ctx.moveTo(canvasX, canvasY - 16);
          ctx.lineTo(canvasX, canvasY - 10);
          ctx.moveTo(canvasX, canvasY + 10);
          ctx.lineTo(canvasX, canvasY + 16);
          ctx.stroke();

          // Flagpole and Flag Badge
          ctx.strokeStyle = '#ff8a5c';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(canvasX, canvasY - 9);
          ctx.lineTo(canvasX, canvasY - 26);
          ctx.stroke();

          const label =
            marker.ra !== undefined && marker.dec !== undefined
              ? `⚑ L2 (${Math.round(marker.x)}, ${Math.round(marker.y)}) · RA ${marker.ra.toFixed(4)}° Dec ${marker.dec.toFixed(4)}°`
              : `⚑ L2 Píxel (${Math.round(marker.x)}, ${Math.round(marker.y)})`;

          ctx.font = 'bold 10px "JetBrains Mono", monospace';
          const textW = ctx.measureText(label).width;
          const badgeX = canvasX + 4;
          const badgeY = canvasY - 36;
          ctx.fillStyle = 'rgba(12, 10, 11, 0.92)';
          ctx.fillRect(badgeX, badgeY, textW + 12, 18);
          ctx.strokeStyle = '#ff8a5c';
          ctx.lineWidth = 1;
          ctx.strokeRect(badgeX, badgeY, textW + 12, 18);
          ctx.fillStyle = '#ff8a5c';
          ctx.fillText(label, badgeX + 6, badgeY + 13);
        }

        ctx.restore();
        return;
      }

      const localTanSize = Math.max(w, h);
      const tanOriginX = (w - localTanSize) / 2;
      const tanOriginY = (h - localTanSize) / 2;
      const zoomScale = Math.max(0.25, Math.min(8, tanFovArcsec / viewFovArcsec));
      const tanPxOffset = skyToPixel(tanCenter, viewCenter, viewFovArcsec, localTanSize);
      const imgDx = tanPxOffset.x - localTanSize / 2;
      const imgDy = tanPxOffset.y - localTanSize / 2;

      const toCanvas = (p: { ra: number; dec: number }) => {
        if (activeWcs && activeWcs.size_px > 0) {
          const seqPx = skyToSequencePixel(p.ra, p.dec, activeWcs);
          const baseX = (seqPx.x / activeWcs.size_px) * localTanSize;
          const baseY = (seqPx.y / activeWcs.size_px) * localTanSize;
          return {
            x: tanOriginX + localTanSize / 2 + imgDx + (baseX - localTanSize / 2) * zoomScale,
            y: tanOriginY + localTanSize / 2 + imgDy + (baseY - localTanSize / 2) * zoomScale,
          };
        }
        const px = skyToPixel(p, viewCenter, viewFovArcsec, localTanSize);
        return { x: tanOriginX + px.x, y: tanOriginY + px.y };
      };

      // Subtle TAN frame border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.strokeRect(tanOriginX, tanOriginY, localTanSize, localTanSize);

      // Target Reticle + Coordinate Flag at current view center
      const centerPt = toCanvas(viewCenter);

      // Glowing center reticle
      ctx.strokeStyle = '#ff8a5c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerPt.x, centerPt.y, 8, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(centerPt.x, centerPt.y, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Sharp crosshair ticks
      ctx.strokeStyle = '#ff8a5c';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(centerPt.x - 16, centerPt.y);
      ctx.lineTo(centerPt.x - 9, centerPt.y);
      ctx.moveTo(centerPt.x + 9, centerPt.y);
      ctx.lineTo(centerPt.x + 16, centerPt.y);
      ctx.moveTo(centerPt.x, centerPt.y - 16);
      ctx.lineTo(centerPt.x, centerPt.y - 9);
      ctx.moveTo(centerPt.x, centerPt.y + 9);
      ctx.lineTo(centerPt.x, centerPt.y + 16);
      ctx.stroke();

      // Flagpole and Flag Badge for the target coordinates
      ctx.strokeStyle = '#ff8a5c';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(centerPt.x, centerPt.y - 8);
      ctx.lineTo(centerPt.x, centerPt.y - 25);
      ctx.stroke();

      const targetLabel = `⚑ ${target.name} · RA ${ra.toFixed(4)}° Dec ${dec.toFixed(4)}°`;
      ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
      const flagW = ctx.measureText(targetLabel).width;
      const flagX = centerPt.x + 3;
      const flagY = centerPt.y - 36;
      ctx.fillStyle = 'rgba(12, 10, 11, 0.92)';
      ctx.fillRect(flagX, flagY, flagW + 10, 18);
      ctx.strokeStyle = 'rgba(255, 138, 92, 0.7)';
      ctx.lineWidth = 1;
      ctx.strokeRect(flagX, flagY, flagW + 10, 18);
      ctx.fillStyle = '#ff8a5c';
      ctx.fillText(targetLabel, flagX + 5, flagY + 12);

      // 1. Gaia DR3 real overlay (/api/overlay?catalog=gaia)
      if (catalogOverlays.gaiaDr3 && gaiaOverlay?.sources) {
        gaiaOverlay.sources.slice(0, 80).forEach((s) => {
          const pt = toCanvas(s);
          if (pt.x < tanOriginX || pt.x > tanOriginX + localTanSize || pt.y < tanOriginY || pt.y > tanOriginY + localTanSize) {
            return;
          }
          ctx.strokeStyle = '#6fd3ff';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
          ctx.stroke();
        });
      }

      // 2. AllWISE real overlay (/api/overlay?catalog=wise)
      if (catalogOverlays.allWise && wiseOverlay?.sources) {
        wiseOverlay.sources.slice(0, 80).forEach((s) => {
          const pt = toCanvas(s);
          if (pt.x < tanOriginX || pt.x > tanOriginX + localTanSize || pt.y < tanOriginY || pt.y > tanOriginY + localTanSize) {
            return;
          }
          ctx.strokeStyle = '#ff8a5c';
          ctx.lineWidth = 1.2;
          ctx.strokeRect(pt.x - 4, pt.y - 4, 8, 8);
        });
      }

      // 3. SIMBAD/NED objects (/api/objects): labels only for SIMBAD or 10 closest to center; others via hover tooltip
      if (objectsResult?.objects) {
        const sortedObjects = [...objectsResult.objects].sort(
          (a, b) => (a.distance_arcsec ?? 9999) - (b.distance_arcsec ?? 9999),
        );
        const placedBoxes: Array<{ x: number; y: number; w: number; h: number }> = [];
        ctx.font = '9px "JetBrains Mono", monospace';
        sortedObjects.forEach((obj, idx) => {
          const pt = toCanvas(obj);
          if (pt.x < tanOriginX || pt.x > tanOriginX + localTanSize || pt.y < tanOriginY || pt.y > tanOriginY + localTanSize) {
            return;
          }
          const isSimbad = obj.source?.toLowerCase() === 'simbad';
          ctx.fillStyle = isSimbad ? '#6fd3ff' : 'rgba(246, 241, 238, 0.72)';
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, isSimbad ? 2.6 : 2, 0, Math.PI * 2);
          ctx.fill();

          if (obj.name && (isSimbad || idx < 10)) {
            const labelW = ctx.measureText(obj.name).width + 6;
            const labelH = 12;
            const lx = pt.x + 5;
            const ly = pt.y - 11;
            const collides = placedBoxes.some(
              (b) => lx < b.x + b.w && lx + labelW > b.x && ly < b.y + b.h && ly + labelH > b.y,
            );
            if (!collides) {
              placedBoxes.push({ x: lx, y: ly, w: labelW, h: labelH });
              ctx.fillStyle = isSimbad ? '#6fd3ff' : 'rgba(246, 241, 238, 0.78)';
              ctx.fillText(obj.name, lx, pt.y - 3);
            }
          }
        });
      }

      // 4. Predicted trajectory (/api/predict)
      if (predictResult?.positions && predictResult.positions.length >= 2) {
        ctx.save();
        ctx.strokeStyle = 'rgba(111, 211, 255, 0.8)';
        ctx.lineWidth = 1.4;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        predictResult.positions.forEach((pos, idx) => {
          const pt = toCanvas(pos);
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
        ctx.setLineDash([]);

        predictResult.positions.forEach((pos) => {
          const pt = toCanvas(pos);
          ctx.fillStyle = '#6fd3ff';
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 2.2, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();
      }

      // 5. Asteroid ML prediction (/api/asteroids/predict-from-current)
      if (asteroidResult) {
        const predRa = asteroidResult.predicted_ra ?? asteroidResult.ra;
        const predDec = asteroidResult.predicted_dec ?? asteroidResult.dec;
        if (typeof predRa === 'number' && typeof predDec === 'number') {
          const pt = toCanvas({ ra: predRa, dec: predDec });
          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#34d399';
          ctx.font = '10px "JetBrains Mono", monospace';
          ctx.fillText('ASTEROID PRED', pt.x + 10, pt.y + 3);
        }
      }

      // 6. Active /api/spectrum probe marker with Flag
      if (probeCoord) {
        const pt = toCanvas(probeCoord);
        if (
          pt.x >= tanOriginX &&
          pt.x <= tanOriginX + localTanSize &&
          pt.y >= tanOriginY &&
          pt.y <= tanOriginY + localTanSize
        ) {
          ctx.strokeStyle = '#6fd3ff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
          ctx.fill();

          // Flagpole
          ctx.strokeStyle = '#6fd3ff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y - 8);
          ctx.lineTo(pt.x, pt.y - 25);
          ctx.stroke();

          const probeLabel = `⚑ SONDA · RA ${probeCoord.ra.toFixed(4)}° Dec ${probeCoord.dec.toFixed(4)}°`;
          ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
          const pW = ctx.measureText(probeLabel).width;
          const pX = pt.x + 3;
          const pY = pt.y - 36;
          ctx.fillStyle = 'rgba(12, 10, 11, 0.92)';
          ctx.fillRect(pX, pY, pW + 10, 18);
          ctx.strokeStyle = '#6fd3ff';
          ctx.lineWidth = 1;
          ctx.strokeRect(pX, pY, pW + 10, 18);
          ctx.fillStyle = '#6fd3ff';
          ctx.fillText(probeLabel, pX + 5, pY + 12);
        }
      }

      ctx.restore();
    };

    render();
    const onResize = () => render();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, [
    asteroidResult,
    catalogOverlays,
    dec,
    fov,
    gaiaOverlay,
    hostSize,
    l2Marker,
    l2Pixel,
    l2Result,
    l2View,
    mode,
    objectsResult,
    predictResult,
    probeCoord,
    ra,
    sequenceResult,
    stackResult,
    target.name,
    viewCenter,
    viewFovArcsec,
    wiseOverlay,
  ]);

  const lastMoveEmitRef = useRef(0);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (dragPanRef.current.active) {
        const dx = e.clientX - dragPanRef.current.startX;
        const dy = e.clientY - dragPanRef.current.startY;
        if (Math.hypot(dx, dy) > 4) {
          dragPanRef.current.moved = true;
        }
        setDragOffset({ dx, dy });
        return;
      }

      const now = performance.now();
      if (now - lastMoveEmitRef.current < 40) return;
      lastMoveEmitRef.current = now;

      const rect = e.currentTarget.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / Math.max(1, rect.width) - 0.5;
      const ny = 0.5 - (e.clientY - rect.top) / Math.max(1, rect.height);
      setCursorSky({
        ra: normalizeRa(ra - nx * fov),
        dec: clampDec(dec + ny * fov),
      });

      // Hover tooltip for SIMBAD/NED objects
      if (l2View === 'off' && objectsResult?.objects?.length) {
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const localTanSize = Math.max(rect.width, rect.height);
        const tanOriginX = (rect.width - localTanSize) / 2;
        const tanOriginY = (rect.height - localTanSize) / 2;
        const zoomScale = Math.max(0.25, Math.min(8, tanFovArcsec / viewFovArcsec));
        const tanPxOffset = skyToPixel(tanCenter, viewCenter, viewFovArcsec, localTanSize);
        const imgDx = tanPxOffset.x - localTanSize / 2;
        const imgDy = tanPxOffset.y - localTanSize / 2;

        let best: { obj: SkyObject; x: number; y: number; dist: number } | null = null;
        for (const obj of objectsResult.objects) {
          let cx: number;
          let cy: number;
          if (activeWcs && activeWcs.size_px > 0) {
            const seqPx = skyToSequencePixel(obj.ra, obj.dec, activeWcs);
            const baseX = (seqPx.x / activeWcs.size_px) * localTanSize;
            const baseY = (seqPx.y / activeWcs.size_px) * localTanSize;
            cx = tanOriginX + localTanSize / 2 + imgDx + (baseX - localTanSize / 2) * zoomScale;
            cy = tanOriginY + localTanSize / 2 + imgDy + (baseY - localTanSize / 2) * zoomScale;
          } else {
            const px = skyToPixel(obj, viewCenter, viewFovArcsec, localTanSize);
            cx = tanOriginX + px.x;
            cy = tanOriginY + px.y;
          }
          const d = Math.hypot(cx - mx, cy - my);
          if (d <= 14 && (!best || d < best.dist)) {
            best = { obj, x: cx, y: cy, dist: d };
          }
        }
        setHoveredObject(best ? { obj: best.obj, x: best.x, y: best.y } : null);
      } else {
        setHoveredObject(null);
      }
    },
    [activeWcs, dec, fov, l2View, objectsResult, ra, tanCenter, tanFovArcsec, viewCenter, viewFovArcsec],
  );

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || e.ctrlKey) return;
    if ((e.target as HTMLElement).closest('button, select')) return;
    dragPanRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      startRa: ra,
      startDec: dec,
    };
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    const wasActive = dragPanRef.current.active;
    const wasMoved = dragPanRef.current.moved;
    dragPanRef.current.active = false;
    setDragOffset(null);

    if (wasActive && wasMoved) {
      const dx = e.clientX - dragPanRef.current.startX;
      const dy = e.clientY - dragPanRef.current.startY;
      const degPerPx = fov / Math.max(200, tanSize);
      onViewportChange({
        ra: Number(normalizeRa(dragPanRef.current.startRa + dx * degPerPx).toFixed(5)),
        dec: Number(clampDec(dragPanRef.current.startDec + dy * degPerPx).toFixed(5)),
      });
      return;
    }

    if (wasActive && !wasMoved) {
      if (l2View !== 'off' && l2Result?.frame?.id && imgRef.current && onInspectL2Pixel) {
        const { x, y } = clickToPng(e.nativeEvent, imgRef.current);
        if (
          x >= 0 &&
          y >= 0 &&
          x <= imgRef.current.naturalWidth &&
          y <= imgRef.current.naturalHeight
        ) {
          setL2Marker({ x, y });
          void onInspectL2Pixel(l2Result.frame.id, x, y, l2Result.size_px ?? 1024).then((pxRes) => {
            if (pxRes && Number.isFinite(pxRes.ra) && Number.isFinite(pxRes.dec)) {
              setL2Marker({ x, y, ra: pxRes.ra, dec: pxRes.dec });
              if (onProbeSpectrum) {
                onProbeSpectrum(pxRes.ra, pxRes.dec);
              }
            }
          });
        }
      } else if (l2View === 'off' && hostRef.current && onProbeSpectrum) {
        const rect = hostRef.current.getBoundingClientRect();
        const localTanSize = Math.max(rect.width, rect.height);
        const tanOriginX = (rect.width - localTanSize) / 2;
        const tanOriginY = (rect.height - localTanSize) / 2;
        const localX = e.clientX - rect.left - tanOriginX;
        const localY = e.clientY - rect.top - tanOriginY;
        if (localX >= 0 && localY >= 0 && localX <= localTanSize && localY <= localTanSize) {
          const skyPt = pixelToSky(localX, localY, viewCenter, viewFovArcsec, localTanSize);
          onProbeSpectrum(skyPt.ra, skyPt.dec);
        }
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const factor = e.deltaY > 0 ? 1.12 : 0.89;
    const nextFov = Number(Math.max(0.05, Math.min(4.0, fov * factor)).toFixed(3));
    onViewportChange({ fov: nextFov });
  };

  const handleToggleL2 = async (nextMode: L2ViewMode) => {
    if (nextMode === 'off') {
      setL2View('off');
      return;
    }
    if (!l2Result && onLoadL2) {
      const res = await onLoadL2();
      if (res) setL2View(nextMode);
    } else if (l2Result) {
      setL2View(nextMode);
    }
  };

  const isLoadingImg = isLoadingSequence || isLoadingStack || isLoadingL2;

  return (
    <div
      ref={hostRef}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        dragPanRef.current.active = false;
        setDragOffset(null);
        setHoveredObject(null);
      }}
      onWheel={handleWheel}
      className="relative w-full h-full bg-[#050304] overflow-hidden cursor-crosshair select-none"
    >
      {/* LAYER A: Real Backend PNG (/api/sequence, /api/stack, or /api/l2) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {isLoadingImg && !activeTanPngUrl ? (
          <div
            style={{ width: tanSize, height: tanSize }}
            className="border border-[#ff8a5c]/25 bg-white/[0.02] animate-pulse flex flex-col items-center justify-center gap-2 text-xs font-mono text-[#b9a8a3]"
          >
            <Loader2 className="w-5 h-5 animate-spin text-[#ff8a5c]" />
            <span>Cargando imagen real de SPHEREx...</span>
          </div>
        ) : activeTanPngUrl && !imgError ? (
          <div
            style={{ width: tanSize, height: tanSize }}
            className="overflow-hidden bg-black flex items-center justify-center"
          >
            <img
              ref={imgRef}
              src={activeTanPngUrl}
              alt={`SPHEREx ${l2View !== 'off' ? `L2 ${l2View}` : 'TAN'} ${target.name}`}
              onError={() => setImgError(true)}
              style={{
                width: '100%',
                height: '100%',
                transform: imgTransform,
                transformOrigin: 'center center',
                imageRendering: 'pixelated',
              }}
              className="object-contain will-change-transform"
            />
          </div>
        ) : (
          <div
            style={{ width: tanSize, height: tanSize }}
            className="border border-white/10 bg-white/[0.02] flex items-center justify-center text-xs font-mono text-[#b9a8a3] text-center px-6"
          >
            {imgError
              ? 'No se pudo cargar la imagen desde el backend.'
              : 'Sin frames disponibles en /api/sequence para esta posición.'}
          </div>
        )}
      </div>

      {/* LAYER B: Real WCS Overlay Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Hovered Object Tooltip */}
      {hoveredObject && (
        <div
          style={{
            left: `${Math.round(hoveredObject.x + 12)}px`,
            top: `${Math.round(hoveredObject.y - 12)}px`,
          }}
          className="absolute z-30 pointer-events-none bg-[#181A20]/95 border border-white/15 rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-[#f6f1ee] shadow-lg"
        >
          <div className="font-semibold text-[#6fd3ff]">{hoveredObject.obj.name}</div>
          <div className="text-[#b9a8a3]">
            {hoveredObject.obj.source.toUpperCase()}
            {hoveredObject.obj.type ? ` · ${hoveredObject.obj.type}` : ''}
            {hoveredObject.obj.distance_arcsec !== undefined
              ? ` · ${hoveredObject.obj.distance_arcsec.toFixed(1)}"`
              : ''}
          </div>
        </div>
      )}

      {/* L2 Pixel Readout Pill */}
      {l2View !== 'off' && l2Pixel && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 hud-card-elevated px-3.5 py-1.5 rounded-full text-[11px] font-mono text-[#f6f1ee] border border-[#ff8a5c]/40 pointer-events-none">
          L2 ({Math.round(l2Pixel.x)}, {Math.round(l2Pixel.y)}) · RA {l2Pixel.ra.toFixed(5)}° Dec{' '}
          {l2Pixel.dec.toFixed(5)}° ·{' '}
          <strong className="text-[#ff8a5c]">
            {(l2Pixel.value ?? l2Pixel.flux ?? 0).toFixed(2)} {l2Pixel.unit ?? 'MJy/sr'}
          </strong>
          {l2Pixel.wavelength_um !== undefined ? ` @ ${l2Pixel.wavelength_um.toFixed(2)} μm` : ''}
        </div>
      )}

      {/* Bottom-Left Ordered Control Bar */}
      <div
        className={`absolute z-20 flex flex-wrap items-center gap-2 pointer-events-auto transition-all duration-300 ${
          isSplitView
            ? 'bottom-3 left-3 right-[595px] lg:right-[635px] xl:right-[675px]'
            : isDrawerOpen
              ? 'bottom-[88px] left-3 right-[355px]'
              : 'bottom-[88px] left-3 right-3'
        }`}
      >
        {/* L2 Mode Switcher (TAN vs L2 Raw vs L2 Color) */}
        <div className="hud-card-pill rounded-xl p-1 flex items-center gap-1 text-xs font-mono">
          <span className="px-2 text-[#b9a8a3] hidden sm:inline flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 inline text-[#ff8a5c]" />
            Vista:
          </span>
          <button
            type="button"
            onClick={() => handleToggleL2('off')}
            className={`px-3 py-1 rounded-lg transition-all active:scale-95 text-xs ${
              l2View === 'off'
                ? 'bg-[#ff8a5c] text-[#0c0a0b] font-bold shadow-[0_0_12px_rgba(255,138,92,0.5)]'
                : 'text-[#b9a8a3] hover:text-white hover:bg-white/10'
            }`}
          >
            TAN
          </button>
          <button
            type="button"
            disabled={isLoadingL2}
            onClick={() => handleToggleL2('raw')}
            title="Cargar imagen L2 Raw (clic en píxel → RA/Dec + MJy/sr)"
            className={`px-3 py-1 rounded-lg transition-all active:scale-95 text-xs ${
              l2View === 'raw'
                ? 'bg-[#ff8a5c] text-[#0c0a0b] font-bold shadow-[0_0_12px_rgba(255,138,92,0.5)]'
                : 'text-[#b9a8a3] hover:text-white hover:bg-white/10'
            }`}
          >
            {isLoadingL2 ? 'L2...' : 'L2 Raw'}
          </button>
          <button
            type="button"
            disabled={isLoadingL2}
            onClick={() => handleToggleL2('color')}
            title="Cargar imagen L2 Color (clic en píxel → RA/Dec + MJy/sr)"
            className={`px-3 py-1 rounded-lg transition-all active:scale-95 text-xs ${
              l2View === 'color'
                ? 'bg-[#6fd3ff] text-[#0c0a0b] font-bold shadow-[0_0_12px_rgba(111,211,255,0.5)]'
                : 'text-[#b9a8a3] hover:text-white hover:bg-white/10'
            }`}
          >
            L2 Color
          </button>
        </div>

        {/* Real Catalog Overlays: Gaia DR3 & AllWISE (/api/overlay) */}
        <div className="hud-card-pill rounded-xl p-1 flex items-center gap-1 text-xs font-mono">
          <button
            type="button"
            onClick={() => onToggleCatalogOverlay('gaiaDr3')}
            title="Superponer fuentes reales Gaia DR3 (/api/overlay)"
            className={`px-3 py-1 rounded-lg transition-all active:scale-95 text-xs ${
              catalogOverlays.gaiaDr3
                ? 'bg-[#6fd3ff] text-[#0c0a0b] font-bold shadow-[0_0_12px_rgba(111,211,255,0.5)]'
                : 'text-[#b9a8a3] hover:text-white hover:bg-white/10'
            }`}
          >
            Gaia DR3
          </button>
          <button
            type="button"
            onClick={() => onToggleCatalogOverlay('allWise')}
            title="Superponer fuentes reales AllWISE (/api/overlay)"
            className={`px-3 py-1 rounded-lg transition-all active:scale-95 text-xs ${
              catalogOverlays.allWise
                ? 'bg-[#ff8a5c] text-[#0c0a0b] font-bold shadow-[0_0_12px_rgba(255,138,92,0.5)]'
                : 'text-[#b9a8a3] hover:text-white hover:bg-white/10'
            }`}
          >
            WISE
          </button>
        </div>

        {/* TAN Stretch / Cmap / Scale */}
        <div className="hud-card-pill rounded-xl p-1 flex items-center gap-1.5 text-xs font-mono">
          {onChangeStretch && (
            <select
              value={stretch}
              onChange={(e) => onChangeStretch(e.target.value as Stretch)}
              aria-label="Stretch"
              className="bg-[#171112] text-[#f6f1ee] border border-white/10 rounded-lg px-2 py-1 text-xs font-mono outline-none"
            >
              <option value="asinh">asinh</option>
              <option value="log">log</option>
              <option value="sqrt">sqrt</option>
              <option value="linear">linear</option>
            </select>
          )}
          {onChangeCmap && (
            <select
              value={cmap}
              onChange={(e) => onChangeCmap(e.target.value as Cmap)}
              aria-label="Colormap"
              className="bg-[#171112] text-[#f6f1ee] border border-white/10 rounded-lg px-2 py-1 text-xs font-mono outline-none"
            >
              <option value="gray">gray</option>
              <option value="viridis">viridis</option>
              <option value="magma">magma</option>
              <option value="inferno">inferno</option>
            </select>
          )}
          {onChangeScale && (
            <button
              type="button"
              onClick={() => onChangeScale(scale === 'sequence' ? 'frame' : 'sequence')}
              title="Escala de brillo: compartida (sequence) o por frame (frame)"
              className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs font-mono text-[#b9a8a3] hover:text-white"
            >
              {scale}
            </button>
          )}
        </div>

        {!isSplitView && (
          <div className="hidden 2xl:flex items-center gap-2 hud-card-pill px-3 py-1.5 rounded-xl text-[10px] font-mono text-[#b9a8a3] truncate">
            <Globe className="w-3 h-3 text-[#ff8a5c] shrink-0" />
            <span className="truncate">
              {l2View !== 'off' ? `L2 ${l2View.toUpperCase()} (clic = pixel)` : 'SPHEREx TAN'}
            </span>
            <span className="text-[#525866]">|</span>
            <span className="text-[#C8CDD6] truncate">
              RA {cursorSky.ra.toFixed(3)}°, Dec {cursorSky.dec >= 0 ? '+' : ''}
              {cursorSky.dec.toFixed(3)}°
            </span>
          </div>
        )}

        {/* Zoom Controls */}
        <div className="hud-card-pill rounded-xl flex items-center divide-x divide-white/[0.08] overflow-hidden">
          <button
            type="button"
            onClick={() => onViewportChange({ fov: Number(Math.max(0.05, fov * 0.8).toFixed(3)) })}
            title="Acercar (Zoom In)"
            className="p-1.5 text-[#C8CDD6] hover:text-white hover:bg-white/10 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onViewportChange({ fov: Number(Math.min(4.0, fov * 1.25).toFixed(3)) })}
            title="Alejar (Zoom Out)"
            className="p-1.5 text-[#C8CDD6] hover:text-white hover:bg-white/10 transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              onViewportChange({
                ra: resolvedCenter?.ra ?? target.raDeg,
                dec: resolvedCenter?.dec ?? target.decDeg,
                fov: target.defaultFov,
              });
            }}
            title="Centrar objetivo"
            className="p-1.5 text-[#C8CDD6] hover:text-white hover:bg-white/10 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
