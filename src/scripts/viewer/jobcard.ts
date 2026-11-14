// Tarjeta de progreso de los procesos lentos (patrón 202 + trabajo).
import { T } from '../../data/viewer';
import type { Job } from '../../lib/api/types';
import { esc } from './dom';

/** HTML de la tarjeta. `cancel` añade el botón Cancelar (data-act="cancel-job"). */
export function jobCardHtml(title: string, job: Job | null, opts: { cancel?: boolean } = {}): string {
  return `
    <div class="jobcard glass" data-jobcard>
      <p class="eyebrow">${esc(title)}</p>
      <p class="jobcard-stage" data-job-stage aria-live="polite">${esc(stageText(job))}</p>
      <progress class="jobcard-bar" data-job-bar max="1" ${job ? `value="${job.progress}"` : ''} aria-label="${esc(title)}"></progress>
      <p class="jobcard-meta mono" data-job-meta>${esc(metaText(job))}</p>
      ${opts.cancel ? `<button class="btn" type="button" data-act="cancel-job">${esc(T.states.cancel)}</button>` : ''}
    </div>`;
}

/** Actualiza una tarjeta ya pintada sin reemplazarla (así el foco no se pierde en cada sondeo). */
export function updateJobCard(root: ParentNode, job: Job | null): void {
  const stage = root.querySelector<HTMLElement>('[data-job-stage]');
  const bar = root.querySelector<HTMLProgressElement>('[data-job-bar]');
  const meta = root.querySelector<HTMLElement>('[data-job-meta]');
  if (!stage || !bar || !meta) return;
  const text = stageText(job);
  if (stage.textContent !== text) stage.textContent = text;
  if (job) bar.value = job.progress;
  else bar.removeAttribute('value');
  meta.textContent = metaText(job);
}

function stageText(job: Job | null): string {
  return job?.stage || 'Conectando…';
}

function metaText(job: Job | null): string {
  if (!job) return '';
  const parts = [`${Math.round(job.progress * 100)} %`];
  if (job.status === 'queued' && job.queue_position > 0) parts.push(`${T.states.queue}: ${job.queue_position}`);
  if (job.eta_s != null && job.eta_s > 0) parts.push(`${T.states.eta} ${job.eta_s} ${T.states.seconds}`);
  return parts.join(' · ');
}
