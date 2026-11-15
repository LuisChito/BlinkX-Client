// AI-assisted development used for code development, debugging and documentation.
// Tool: ChatGPT, Claude
/* Escenario del cielo: imagen real de SPHEREx (secuencia, resta/suma o L2) + capa vectorial con
   objetos, catálogos, trayectorias y el punto medido. Solo dibuja e interactúa; los controles viven en el dock. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ImageOff, Loader2 } from 'lucide-react';
import type { CatalogOverlayState, ViewMode } from '../types/spherex';
import { objectTypeLabel } from './ui/primitives';
import { clampDec, normalizeRa } from '../utils/urlState';
import { abs, clickToPng, isBackupOnly, skyToSequencePixel, type Coord, type SequenceResult } from '../../lib/skyApi';
import { pixelToSky, skyToPixel } from '../../lib/projection';
import type {
  AsteroidPredictResult,
  L2PixelResult,
  L2Result,
  ObjectsResponse,
  OverlayResponse,
  PredictResult,
  SkyObject,
  StackResult,
} from '../hooks/useSkyContract';

export type L2ViewMode = 'off' | 'raw' | 'color';

const C = { ember: '#ff8a5c', data: '#6fd3ff', wise: '#9fe0ad', ok: '#34d399', fg: '#f6f1ee' };
const LABEL_FONT = '500 11px "JetBrains Mono Variable", "JetBrains Mono", monospace';

interface SkyStageProps {
  ra: number;
  dec: number;
  fov: number;
  frameIndex: number;
  blinkFrame: 1 | 2;
  mode: ViewMode;
  l2View: L2ViewMode;
  catalogOverlays: CatalogOverlayState;
  showLabels: boolean;
  sequenceResult?: SequenceResult | null;
  stackResult?: StackResult | null;
  gaiaOverlay?: OverlayResponse | null;
  wiseOverlay?: OverlayResponse | null;
  objectsResult?: ObjectsResponse | null;
  predictResult?: PredictResult | null;
  l2Result?: L2Result | null;
  l2Pixel?: L2PixelResult | null;
  asteroidResult?: AsteroidPredictResult | null;
  isLoading?: boolean;
  loadingLabel?: string;
  probeCoord?: Coord | null;
  /** Posición predicha (/api/predict) para la fecha de la imagen visible. */
  predictNow?: { ra: number; dec: number; sigma_arcsec: number; date: string } | null;
  /** Modo "marcar asteroide": el clic no mide el espectro, marca la observación actual. */
  pickMode?: boolean;
  altText: string;
  onViewportChange: (next: { ra?: number; dec?: number; fov?: number }) => void;
  onInspectL2Pixel?: (frameId: string, x: number, y: number, size?: number) => Promise<L2PixelResult | null>;
  onProbe?: (ra: number, dec: number) => void;
  onCursorMove?: (c: Coord | null) => void;
}

export function SkyStage({
  ra,
  dec,
  fov,
  frameIndex,
  blinkFrame,
  mode,
  l2View: l2ViewProp,
  catalogOverlays,
  showLabels,
  sequenceResult = null,
  stackResult = null,
  gaiaOverlay = null,
  wiseOverlay = null,
  objectsResult = null,
  predictResult = null,
  l2Result = null,
  l2Pixel = null,
  asteroidResult = null,
  isLoading = false,
  loadingLabel = 'Cargando imagen de SPHEREx…',
  probeCoord = null,
  predictNow = null,
  pickMode = false,
  altText,
  onViewportChange,
  onInspectL2Pixel,
  onProbe,
  onCursorMove,
}: SkyStageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const l2View: L2ViewMode = l2Result ? l2ViewProp : 'off';
  const [l2Marker, setL2Marker] = useState<{ x: number; y: number } | null>(null);
  const [imgError, setImgError] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number } | null>(null);
  const [hostSize, setHostSize] = useState({ w: 800, h: 800 });
  const [hovered, setHovered] = useState<{ obj: SkyObject; x: number; y: number } | null>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setHostSize({ w: r.width, h: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const dragRef = useRef({ active: false, moved: false, startX: 0, startY: 0, startRa: ra, startDec: dec });

  useEffect(() => setL2Marker(null), [ra, dec, l2Result]);

  const imageUrl = useMemo(() => {
    if (l2View !== 'off' && l2Result) {
      const u = l2View === 'raw' ? l2Result.raw_png_url : l2Result.color_png_url;
      if (u) return abs(u);
    }
    if ((mode === 'diff' || mode === 'sum') && stackResult?.png_url) return abs(stackResult.png_url);
    const frames = sequenceResult?.frames ?? [];
    if (!frames.length) return null;
    const idx = mode === 'blink' ? (blinkFrame === 1 ? 0 : frames.length - 1) : Math.min(frames.length - 1, Math.max(0, frameIndex));
    const u = frames[idx]?.png_url;
    return u ? abs(u) : null;
  }, [l2View, l2Result, mode, stackResult, sequenceResult, blinkFrame, frameIndex]);

  useEffect(() => setImgError(false), [imageUrl]);

  const wcs = (mode === 'diff' || mode === 'sum') && stackResult ? stackResult : sequenceResult;
  const tanSize = Math.max(hostSize.w, hostSize.h);
  const viewFovArcsec = Math.max(30, fov * 3600);
  const tanFovArcsec = wcs?.fov_arcsec ?? viewFovArcsec;
  const tanCenter = wcs?.center ?? { ra, dec };

  const viewCenter = useMemo(() => {
    if (!dragOffset) return { ra, dec };
    const degPerPx = fov / Math.max(200, tanSize);
    return { ra: normalizeRa(ra + dragOffset.dx * degPerPx), dec: clampDec(dec + dragOffset.dy * degPerPx) };
  }, [dec, dragOffset, fov, ra, tanSize]);

  const imgTransform = useMemo(() => {
    if (l2View !== 'off') {
      const s = Math.max(0.25, Math.min(6, 0.15 / Math.max(0.05, fov)));
      return `translate(${dragOffset?.dx ?? 0}px, ${dragOffset?.dy ?? 0}px) scale(${s.toFixed(4)})`;
    }
    const zoom = Math.max(0.25, Math.min(8, tanFovArcsec / viewFovArcsec));
    const p = skyToPixel(tanCenter, viewCenter, viewFovArcsec, tanSize);
    return `translate(${(p.x - tanSize / 2).toFixed(2)}px, ${(p.y - tanSize / 2).toFixed(2)}px) scale(${zoom.toFixed(4)})`;
  }, [dragOffset, fov, l2View, tanCenter, tanFovArcsec, tanSize, viewCenter, viewFovArcsec]);

  /** Proyección cielo → píxel del lienzo, alineada con la imagen TAN. */
  const makeProjector = useCallback(
    (w: number, h: number) => {
      const size = Math.max(w, h);
      const ox = (w - size) / 2;
      const oy = (h - size) / 2;
      const zoom = Math.max(0.25, Math.min(8, tanFovArcsec / viewFovArcsec));
      const off = skyToPixel(tanCenter, viewCenter, viewFovArcsec, size);
      const idx = off.x - size / 2;
      const idy = off.y - size / 2;
      const toCanvas = (p: Coord) => {
        if (wcs && wcs.size_px > 0) {
          const s = skyToSequencePixel(p.ra, p.dec, wcs);
          const bx = (s.x / wcs.size_px) * size;
          const by = (s.y / wcs.size_px) * size;
          return { x: ox + size / 2 + idx + (bx - size / 2) * zoom, y: oy + size / 2 + idy + (by - size / 2) * zoom };
        }
        const px = skyToPixel(p, viewCenter, viewFovArcsec, size);
        return { x: ox + px.x, y: oy + px.y };
      };
      const inside = (pt: { x: number; y: number }) => pt.x >= 0 && pt.x <= w && pt.y >= 0 && pt.y <= h;
      return { toCanvas, inside, size, ox, oy };
    },
    [tanCenter, tanFovArcsec, viewCenter, viewFovArcsec, wcs],
  );

  // Capa vectorial -----------------------------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !host || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(hostSize.w));
    const h = Math.max(1, Math.floor(hostSize.h));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.font = LABEL_FONT;

    const reticle = (x: number, y: number, color: string, r = 9) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      for (const [a, b, c, d] of [[-r - 7, 0, -r - 2, 0], [r + 2, 0, r + 7, 0], [0, -r - 7, 0, -r - 2], [0, r + 2, 0, r + 7]]) {
        ctx.moveTo(x + a, y + b);
        ctx.lineTo(x + c, y + d);
      }
      ctx.stroke();
    };
    const tag = (x: number, y: number, text: string, color: string) => {
      const tw = ctx.measureText(text).width;
      ctx.fillStyle = 'rgba(5,3,4,0.82)';
      ctx.beginPath();
      ctx.roundRect(x, y - 13, tw + 10, 18, 4);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.fillText(text, x + 5, y);
    };

    // L2: solo el marcador del píxel inspeccionado.
    if (l2View !== 'off') {
      const m = l2Marker ?? (l2Pixel ? { x: l2Pixel.x, y: l2Pixel.y } : null);
      const img = imgRef.current;
      if (m && img) {
        const ir = img.getBoundingClientRect();
        const hr = host.getBoundingClientRect();
        const nw = img.naturalWidth || l2Result?.size_px || 1024;
        const nh = img.naturalHeight || l2Result?.size_px || 1024;
        reticle(ir.left - hr.left + (m.x / nw) * ir.width, ir.top - hr.top + (m.y / nh) * ir.height, C.ember);
      }
      return;
    }

    const { toCanvas, inside, size } = makeProjector(w, h);

    // Catálogos
    if (catalogOverlays.gaiaDr3 && gaiaOverlay?.sources) {
      ctx.strokeStyle = C.data;
      ctx.lineWidth = 1.1;
      for (const s of gaiaOverlay.sources.slice(0, 150)) {
        const p = toCanvas(s);
        if (!inside(p)) continue;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    if (catalogOverlays.allWise && wiseOverlay?.sources) {
      ctx.strokeStyle = C.wise;
      ctx.lineWidth = 1.1;
      for (const s of wiseOverlay.sources.slice(0, 150)) {
        const p = toCanvas(s);
        if (inside(p)) ctx.strokeRect(p.x - 4.5, p.y - 4.5, 9, 9);
      }
    }

    // Objetos SIMBAD / NED: punto siempre; nombre solo si "Etiquetas" está activo (12 más cercanos, sin choques).
    if (objectsResult?.objects?.length) {
      const sorted = [...objectsResult.objects].sort((a, b) => (a.distance_arcsec ?? 1e9) - (b.distance_arcsec ?? 1e9));
      const boxes: Array<{ x: number; y: number; w: number; h: number }> = [];
      let labelled = 0;
      for (const obj of sorted) {
        const p = toCanvas(obj);
        if (!inside(p)) continue;
        const simbad = obj.source?.toLowerCase() === 'simbad';
        ctx.fillStyle = simbad ? C.data : 'rgba(246,241,238,0.6)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, simbad ? 2.6 : 2, 0, Math.PI * 2);
        ctx.fill();
        if (!showLabels || !simbad || labelled >= 12 || !obj.name) continue;
        const name = obj.name.replace(/\s+/g, ' ');
        const bw = ctx.measureText(name).width + 10;
        const bx = p.x + 6;
        const by = p.y - 16;
        if (boxes.some((b) => bx < b.x + b.w && bx + bw > b.x && by < b.y + b.h && by + 18 > b.y)) continue;
        boxes.push({ x: bx, y: by, w: bw, h: 18 });
        tag(bx, p.y + 1, name, simbad ? C.data : C.fg);
        labelled++;
      }
    }

    // Trayectoria predicha (/api/predict): línea por todas las fechas y círculo en la fecha visible.
    if (predictResult?.positions && predictResult.positions.length >= 2) {
      ctx.strokeStyle = 'rgba(111,211,255,0.75)';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      predictResult.positions.forEach((pos, i) => {
        const p = toCanvas(pos);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(111,211,255,0.55)';
      for (const pos of predictResult.positions) {
        const p = toCanvas(pos);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (predictNow) {
      const p = toCanvas(predictNow);
      if (inside(p)) {
        // Radio = incertidumbre (σ) en píxeles de pantalla, con un mínimo visible.
        const pxPerArcsec = size / viewFovArcsec;
        const r = Math.max(7, predictNow.sigma_arcsec * pxPerArcsec);
        ctx.strokeStyle = C.data;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.stroke();
        tag(p.x + r + 6, p.y - r, `Predicción ${predictNow.date.slice(0, 10)}`, C.data);
      }
    }

    // Asteroide (JPL Horizons): trayectoria, punto marcado y posición futura.
    if (asteroidResult) {
      const track = asteroidResult.track ?? [];
      if (track.length) {
        ctx.strokeStyle = C.ok;
        ctx.lineWidth = 1.6;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        track.forEach((t, i) => {
          const p = toCanvas(t);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = C.ok;
        for (const t of track) {
          const p = toCanvas(t);
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      const now = asteroidResult.current_observation;
      if (now) {
        const p = toCanvas({ ra: now.ra, dec: now.dec });
        if (inside(p)) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      const fut = toCanvas({ ra: asteroidResult.predicted_ra_deg, dec: asteroidResult.predicted_dec_deg });
      if (inside(fut)) {
        reticle(fut.x, fut.y, C.ok, 8);
        tag(fut.x + 18, fut.y - 12, `${asteroidResult.target} · +${asteroidResult.horizon_days} d`, C.ok);
      }
    }

    // Centro del campo (discreto) y punto medido (destacado)
    const c = toCanvas(viewCenter);
    ctx.strokeStyle = 'rgba(255,138,92,0.75)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const [a, b] of [[-14, -5], [5, 14]]) {
      ctx.moveTo(c.x + a, c.y);
      ctx.lineTo(c.x + b, c.y);
      ctx.moveTo(c.x, c.y + a);
      ctx.lineTo(c.x, c.y + b);
    }
    ctx.stroke();

    if (probeCoord) {
      const p = toCanvas(probeCoord);
      if (inside(p)) {
        reticle(p.x, p.y, C.ember, 9);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
        tag(p.x + 18, p.y - 12, 'Punto medido', C.ember);
      }
    }
  }, [
    asteroidResult, catalogOverlays, gaiaOverlay, hostSize, l2Marker, l2Pixel, l2Result, l2View, makeProjector,
    objectsResult, predictResult, predictNow, probeCoord, showLabels, viewCenter, viewFovArcsec, wiseOverlay,
  ]);

  // Interacción --------------------------------------------------------------------------------------------------
  const lastMove = useRef(0);
  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragRef.current.active) {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      if (Math.hypot(dx, dy) > 4) dragRef.current.moved = true;
      setDragOffset({ dx, dy });
      return;
    }
    const now = performance.now();
    if (now - lastMove.current < 40) return;
    lastMove.current = now;
    const rect = e.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const lx = e.clientX - rect.left - (rect.width - size) / 2;
    const ly = e.clientY - rect.top - (rect.height - size) / 2;
    if (l2View === 'off') onCursorMove?.(pixelToSky(lx, ly, viewCenter, viewFovArcsec, size));

    if (l2View === 'off' && objectsResult?.objects?.length) {
      const { toCanvas } = makeProjector(rect.width, rect.height);
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      let best: { obj: SkyObject; x: number; y: number; d: number } | null = null;
      for (const obj of objectsResult.objects) {
        const p = toCanvas(obj);
        const d = Math.hypot(p.x - mx, p.y - my);
        if (d <= 12 && (!best || d < best.d)) best = { obj, x: p.x, y: p.y, d };
      }
      setHovered(best ? { obj: best.obj, x: best.x, y: best.y } : null);
    } else setHovered(null);
  };

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    dragRef.current = { active: true, moved: false, startX: e.clientX, startY: e.clientY, startRa: ra, startDec: dec };
  };

  const onMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    const { active, moved, startX, startY, startRa, startDec } = dragRef.current;
    dragRef.current.active = false;
    setDragOffset(null);
    if (!active) return;
    if (moved) {
      const degPerPx = fov / Math.max(200, tanSize);
      onViewportChange({
        ra: Number(normalizeRa(startRa + (e.clientX - startX) * degPerPx).toFixed(5)),
        dec: Number(clampDec(startDec + (e.clientY - startY) * degPerPx).toFixed(5)),
      });
      return;
    }
    // Clic: L2 → inspeccionar píxel; TAN → medir ese punto del cielo.
    if (l2View !== 'off' && l2Result?.frame?.id && imgRef.current && onInspectL2Pixel) {
      const { x, y } = clickToPng(e.nativeEvent, imgRef.current);
      if (x < 0 || y < 0 || x > imgRef.current.naturalWidth || y > imgRef.current.naturalHeight) return;
      setL2Marker({ x, y });
      void onInspectL2Pixel(l2Result.frame.id, x, y, l2Result.size_px ?? 1024).then((px) => {
        if (px && Number.isFinite(px.ra) && Number.isFinite(px.dec)) onProbe?.(px.ra, px.dec);
      });
      return;
    }
    if (l2View === 'off' && hostRef.current && onProbe) {
      const rect = hostRef.current.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const lx = e.clientX - rect.left - (rect.width - size) / 2;
      const ly = e.clientY - rect.top - (rect.height - size) / 2;
      // Si el clic cae sobre un objeto, se mide exactamente su posición.
      const target = hovered?.obj && !pickMode ? { ra: hovered.obj.ra, dec: hovered.obj.dec } : pixelToSky(lx, ly, viewCenter, viewFovArcsec, size);
      onProbe(target.ra, target.dec);
    }
  };

  // Zoom con rueda: listener no pasivo para poder cancelar el scroll de la página.
  const fovRef = useRef(fov);
  fovRef.current = fov;
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const f = fovRef.current * (e.deltaY > 0 ? 1.12 : 0.89);
      onViewportChange({ fov: Number(Math.max(0.05, Math.min(4, f)).toFixed(3)) });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onViewportChange]);

  // Teclado: flechas desplazan el campo, +/- hacen zoom.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = fov * 0.1;
    const map: Record<string, () => void> = {
      ArrowLeft: () => onViewportChange({ ra: normalizeRa(ra + step) }),
      ArrowRight: () => onViewportChange({ ra: normalizeRa(ra - step) }),
      ArrowUp: () => onViewportChange({ dec: clampDec(dec + step) }),
      ArrowDown: () => onViewportChange({ dec: clampDec(dec - step) }),
      '+': () => onViewportChange({ fov: Math.max(0.05, fov * 0.8) }),
      '=': () => onViewportChange({ fov: Math.max(0.05, fov * 0.8) }),
      '-': () => onViewportChange({ fov: Math.min(4, fov * 1.25) }),
    };
    if (map[e.key]) {
      e.preventDefault();
      map[e.key]();
    }
  };

  return (
    <div
      ref={hostRef}
      tabIndex={0}
      role="application"
      aria-label={`${altText}. Arrastra para mover, rueda para acercar, clic para medir un punto. Flechas y +/− también funcionan.`}
      onKeyDown={onKeyDown}
      onMouseMove={onMouseMove}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={() => {
        dragRef.current.active = false;
        setDragOffset(null);
        setHovered(null);
        onCursorMove?.(null);
      }}
      className={`relative w-full h-full overflow-hidden bg-ink select-none ${dragOffset ? 'cursor-grabbing' : 'cursor-crosshair'} ${pickMode ? 'ring-2 ring-inset ring-ok/70' : ''}`}
    >
      {pickMode && (
        <div className="absolute inset-x-0 top-14 z-10 flex justify-center pointer-events-none">
          <div className="bx-float rounded-full px-3 py-1.5 text-xs text-ok-fg border-ok/50">
            Haz clic sobre el asteroide en la imagen visible
          </div>
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div style={{ width: tanSize, height: tanSize }} className="relative shrink-0 overflow-hidden flex items-center justify-center">
          {imageUrl && !imgError ? (
            <img
              ref={imgRef}
              src={imageUrl}
              alt={altText}
              onError={() => setImgError(true)}
              style={{ width: '100%', height: '100%', transform: imgTransform, transformOrigin: 'center', imageRendering: 'pixelated' }}
              className="object-contain will-change-transform"
              draggable={false}
            />
          ) : !isLoading ? (
            <div className="flex flex-col items-center gap-2 text-muted text-[13px] text-center px-6">
              <ImageOff className="w-6 h-6" aria-hidden="true" />
              {imgError
                ? 'No se pudo cargar la imagen.'
                : isBackupOnly()
                  ? 'La copia de seguridad no tiene la secuencia de esta zona. Prueba «L2» o «L2 color» abajo, o usa los datos en vivo.'
                  : 'SPHEREx no tiene exposiciones en esta posición.'}
            </div>
          ) : null}
        </div>
      </div>

      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true" />

      {isLoading && (
        <div className="absolute inset-x-0 top-3 flex justify-center pointer-events-none">
          <div className="bx-float rounded-full px-3 py-1.5 text-xs text-soft flex items-center gap-2" role="status">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-ember" aria-hidden="true" />
            {loadingLabel}
          </div>
        </div>
      )}

      {hovered && (
        <div
          style={{ left: Math.round(hovered.x + 14), top: Math.round(hovered.y - 14) }}
          className="absolute z-10 pointer-events-none bx-float rounded-lg px-2.5 py-1.5 shadow-lg max-w-[260px]"
        >
          <div className="text-xs font-semibold text-data truncate">{hovered.obj.name}</div>
          <div className="text-[11px] text-muted">
            {objectTypeLabel(hovered.obj.type, hovered.obj.type_raw)} · {hovered.obj.source.toUpperCase()}
            {hovered.obj.distance_arcsec !== undefined ? ` · ${hovered.obj.distance_arcsec.toFixed(1)}″ del centro` : ''}
          </div>
          {!pickMode && <div className="text-[11px] text-faint">Clic para medir este objeto</div>}
        </div>
      )}
    </div>
  );
}
