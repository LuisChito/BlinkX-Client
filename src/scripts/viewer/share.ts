// Compartir: copiar el enlace de la vista o el código para incrustarla.
import { T } from '../../data/viewer';
import { $ } from './dom';

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;
export function toast(message: string): void {
  const el = $('[data-toast]');
  el.textContent = message;
  el.hidden = false;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { el.hidden = true; }, 2600);
}

export function embedCode(href: string): string {
  const u = new URL(href);
  u.searchParams.set('embed', '1');
  u.searchParams.delete('mock');
  return `<iframe src="${u.toString()}" width="640" height="720" style="border:0" loading="lazy" title="Blink X: imágenes de SPHEREx"></iframe>`;
}

export function mountShare(): void {
  $('[data-share]').addEventListener('click', async () => {
    toast((await copy(location.href)) ? T.share.linkDone : T.share.failed);
  });
  $('[data-embed]').addEventListener('click', async () => {
    toast((await copy(embedCode(location.href))) ? T.share.embedDone : T.share.failed);
  });
}
