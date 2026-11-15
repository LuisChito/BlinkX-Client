// AI-assisted development used for code development, debugging and documentation.
// Tool: ChatGPT, Claude
/* Franja de estado bajo la barra superior: IRSA (NASA) caído y/o modo "solo respaldo". */
import { useState } from 'react';
import { CloudOff, HardDriveDownload, X } from 'lucide-react';
import type { StatusResponse } from '../../hooks/useSkyContract';
import { LIVE_DATA, type BackupInfo } from '../../../lib/skyApi';
import { cx } from '../ui/primitives';

interface Props {
  status: StatusResponse | null;
  backup: BackupInfo & { setOnly: (on: boolean) => void };
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

export function SystemBanner({ status, backup }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const spherex = (status?.sources as Record<string, { ok: boolean; last_error: string | null }> | undefined)?.spherex;
  const irsaDown = spherex?.ok === false;

  if (!LIVE_DATA) {
    return (
      <div role="status" className="shrink-0 flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 border-b border-data/30 bg-data/10 text-xs text-fg">
        <HardDriveDownload className="w-4 h-4 text-data shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <b className="font-semibold">Datos locales:</b> API Caida, no consulta la API(<code className="font-mono"></code>).
        </span>
      </div>
    );
  }

  if (backup.only) {
    return (
      <div role="status" className="shrink-0 flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 border-b border-data/30 bg-data/10 text-xs text-fg">
        <HardDriveDownload className="w-4 h-4 text-data shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <b className="font-semibold">Copia de seguridad activada:</b> imágenes reales de SPHEREx ya descargadas{backup.generatedAt ? ` (${fmt(backup.generatedAt)})` : ''}, sin usar el backend.
          {' En el menú: «guardado» = imágenes completas, «solo L2» = imagen L2 / L2 color.'}
        </span>
        <button type="button" onClick={() => backup.setOnly(false)} className="shrink-0 h-7 px-2.5 rounded-md border border-data/40 text-data hover:bg-data/15 font-medium cursor-pointer">
          Usar datos en vivo
        </button>
      </div>
    );
  }

  if (!irsaDown || dismissed) return null;

  return (
    <div role="alert" className="shrink-0 flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 border-b border-warn/30 bg-warn/10 text-xs text-warn-fg">
      <CloudOff className="w-4 h-4 text-warn shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <b className="font-semibold">El archivo de la NASA (IRSA) no responde{spherex?.last_error ? ` (${spherex.last_error})` : ''}.</b>{' '}
        Las zonas ya consultadas siguen disponibles; las zonas nuevas pueden fallar hasta que IRSA se recupere.
        {backup.available && ' Hay una copia de seguridad de los objetivos del reto.'}
      </span>
      {backup.available && (
        <button
          type="button"
          onClick={() => backup.setOnly(true)}
          className={cx('shrink-0 h-7 px-2.5 rounded-md bg-warn text-ink font-semibold hover:brightness-110 cursor-pointer')}
        >
          Usar copia de seguridad
        </button>
      )}
      <button type="button" onClick={() => setDismissed(true)} aria-label="Ocultar aviso" className="shrink-0 p-1 rounded text-warn-fg/80 hover:text-fg cursor-pointer">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
