// AI-assisted development used for code development, debugging and documentation.
// Tool: ChatGPT, Claude
/* Pestaña Datos: metadatos de la imagen visible, lecturas de píxel, estado de las fuentes y enlace. */
import { useState } from 'react';
import { Check, HardDriveDownload, Link2 } from 'lucide-react';
import type { BackupInfo } from '../../../lib/skyApi';
import type { Frame, SequenceResult } from '../../../lib/skyApi';
import type { CubePixelResult, L2PixelResult, StackResult, StatusResponse } from '../../hooks/useSkyContract';
import { Button, Chip, KV, SectionHeader, fmtDateTime, summarizeWarnings } from '../ui/primitives';

interface Props {
  frame: Frame | null;
  modeLabel: string;
  sequence: SequenceResult | null;
  stack: StackResult | null;
  l2Pixel: L2PixelResult | null;
  cubePixel: CubePixelResult | null;
  status: StatusResponse | null;
  warnings: string[];
  shareUrl: string;
  backup: BackupInfo & { setOnly: (on: boolean) => void };
}

const SOURCE_NAMES: Record<string, string> = {
  spherex: 'SPHEREx (IRSA)',
  simbad: 'SIMBAD',
  ned: 'NED',
  gaia: 'Gaia',
  wise: 'WISE',
  horizons: 'JPL Horizons',
};

export function DataTab({ frame, modeLabel, sequence, stack, l2Pixel, cubePixel, status, warnings, shareUrl, backup }: Props) {
  const [copied, setCopied] = useState(false);
  const sources = (status?.sources ?? {}) as Record<string, { ok: boolean; latency_ms: number | null; last_error: string | null }>;

  return (
    <>
      <section>
        <SectionHeader title="Imagen visible" hint={modeLabel} />
        <dl className="bx-card px-3 py-1">
          {stack ? (
            <>
              <KV k="Operación" v={stack.op === 'diff' ? 'Resta (última − primera)' : stack.op === 'sum' ? 'Suma de fechas' : stack.op} mono={false} />
              <KV k="Exposiciones usadas" v={stack.n_frames} />
              <KV k="Campo" v={`${(stack.fov_arcsec / 60).toFixed(1)}′ · ${stack.size_px}px`} />
              <KV k="Rango de brillo" v={`${stack.vmin.toFixed(3)} – ${stack.vmax.toFixed(3)} ${stack.unit}`} />
            </>
          ) : frame ? (
            <>
              <KV k="Fecha (UTC)" v={fmtDateTime(frame.date_obs)} />
              <KV k="Detector" v={`D${frame.detector} · ${frame.band_um.toFixed(3)} µm${frame.band_exact ? '' : ' (aprox.)'}`} />
              <KV k="Exposición" v={`${frame.exposure_s.toFixed(1)} s`} />
              <KV k="Identificador" v={<span className="break-all">{frame.id}</span>} />
              <KV k="Banderas" v={frame.flags.length ? frame.flags.join(', ') : 'Ninguna'} />
              {sequence && <KV k="Rango de brillo" v={`${(frame.vmin ?? sequence.vmin).toFixed(3)} – ${(frame.vmax ?? sequence.vmax).toFixed(3)} ${sequence.unit}`} />}
              {sequence && <KV k="Campo" v={`${(sequence.fov_arcsec / 60).toFixed(1)}′ · ${sequence.size_px}px · 6.2″/px`} />}
            </>
          ) : (
            <p className="py-2 text-xs text-muted">Todavía no hay imagen cargada.</p>
          )}
        </dl>
      </section>

      {(l2Pixel || cubePixel) && (
        <section>
          <SectionHeader title="Lectura de píxel" />
          <dl className="bx-card px-3 py-1">
            {l2Pixel && (
              <>
                <KV k="Píxel L2" v={`(${Math.round(l2Pixel.x)}, ${Math.round(l2Pixel.y)})`} />
                <KV k="Coordenadas" v={`${l2Pixel.ra.toFixed(5)}°, ${l2Pixel.dec.toFixed(5)}°`} />
                <KV k="Brillo" v={<span className="text-data font-semibold">{(l2Pixel.value ?? l2Pixel.flux ?? 0).toFixed(3)} {l2Pixel.unit ?? 'MJy/sr'}</span>} />
                {l2Pixel.wavelength_um !== undefined && <KV k="Longitud de onda" v={`${l2Pixel.wavelength_um.toFixed(3)} µm`} />}
              </>
            )}
            {cubePixel && (
              <>
                <KV k="Píxel del cubo" v={`(${Math.round(cubePixel.x)}, ${Math.round(cubePixel.y)})`} />
                <KV k="Coordenadas" v={`${cubePixel.ra.toFixed(5)}°, ${cubePixel.dec.toFixed(5)}°`} />
                <KV k="Canales" v={cubePixel.spectrum?.length ?? 0} />
              </>
            )}
          </dl>
        </section>
      )}

      {warnings.length > 0 && (
        <section>
          <SectionHeader title="Avisos" hint={summarizeWarnings(warnings).headline} />
          <ul className="bx-card px-3 py-2 max-h-40 overflow-y-auto space-y-1 font-mono text-[11px] text-faint">
            {warnings.map((w) => <li key={w} className="break-all">{w}</li>)}
          </ul>
        </section>
      )}

      {status && (
        <section>
          <SectionHeader title="Fuentes de datos" hint={status.data_release} />
          <ul className="bx-card divide-y divide-line">
            {Object.entries(sources).map(([k, v]) => (
              <li key={k} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs" title={v.last_error ?? undefined}>
                <span className="text-soft">{SOURCE_NAMES[k] ?? k}</span>
                {v.ok ? <Chip tone="ok">{v.latency_ms != null ? `${v.latency_ms} ms` : 'OK'}</Chip> : <Chip tone="err">Sin respuesta</Chip>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionHeader
          title={<span className="flex items-center gap-1.5"><HardDriveDownload className="w-4 h-4 text-data" aria-hidden="true" />Respaldo sin conexión</span>}
          hint="Copia local de los objetivos del reto para que la presentación no dependa de internet."
        />
        {backup.available ? (
          <div className="bx-card p-3 space-y-2.5">
            <dl>
              <KV k="Guardado" v={backup.generatedAt ? new Date(backup.generatedAt).toLocaleString('es') : '—'} />
              <KV k="Objetivos" v={backup.targets.join(', ') || '—'} />
              <KV k="Consultas / imágenes" v={`${backup.entries} / ${backup.images}`} />
              {backup.uses > 0 && <KV k="Respuestas servidas desde el respaldo" v={backup.uses} />}
            </dl>
            <label className="flex items-start gap-2 text-xs text-soft cursor-pointer">
              <input type="checkbox" checked={backup.only} onChange={() => backup.setOnly(!backup.only)} className="mt-0.5 accent-[#ff8a5c]" />
              <span>
                <span className="text-fg font-medium">Usar solo el respaldo</span>
                <span className="block text-[11px] text-muted">No se conecta a la API. Si algo no está guardado, se avisa en lugar de esperar.</span>
              </span>
            </label>
            <p className="text-[11px] text-faint">Aunque no actives esta opción, si la API falla se usa el respaldo automáticamente.</p>
          </div>
        ) : (
          <p className="text-xs text-muted leading-relaxed">
            No hay respaldo. Genéralo con <code className="font-mono text-soft">node scripts/backup-demo.mjs --wait</code> y recarga la página.
          </p>
        )}
      </section>

      <section>
        <SectionHeader title="Compartir esta vista" hint="El enlace guarda coordenadas, zoom y modo." />
        <div className="flex gap-2">
          <input readOnly value={shareUrl} aria-label="Enlace de esta vista" onFocus={(e) => e.currentTarget.select()} className="flex-1 min-w-0 h-9 rounded-lg bg-raised border border-line px-2.5 font-mono text-[11px] text-soft" />
          <Button
            onClick={() => {
              void navigator.clipboard?.writeText(shareUrl);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check className="w-4 h-4 text-ok" aria-hidden="true" /> : <Link2 className="w-4 h-4" aria-hidden="true" />}
            {copied ? 'Copiado' : 'Copiar'}
          </Button>
        </div>
      </section>
    </>
  );
}
