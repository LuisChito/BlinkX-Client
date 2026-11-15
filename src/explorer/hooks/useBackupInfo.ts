// AI-assisted development used for code development, debugging and documentation.
// Tool: ChatGPT, Claude
// Estado del respaldo sin conexión (public/backup) para la interfaz: se actualiza con el evento "bx-backup".
import { useCallback, useEffect, useState } from 'react';
import { getBackupInfo, setBackupOnly, type BackupInfo } from '../../lib/skyApi';

export function useBackupInfo(): BackupInfo & { setOnly: (on: boolean) => void } {
  const [info, setInfo] = useState<BackupInfo>(getBackupInfo);
  useEffect(() => {
    const update = () => setInfo(getBackupInfo());
    window.addEventListener('bx-backup', update);
    update();
    return () => window.removeEventListener('bx-backup', update);
  }, []);
  const setOnly = useCallback((on: boolean) => setBackupOnly(on), []);
  return { ...info, setOnly };
}
