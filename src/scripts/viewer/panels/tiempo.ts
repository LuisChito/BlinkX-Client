// Panel Tiempo: cobertura por semana y filtro de fechas.
import { T } from '../../../data/viewer';
import { isDate } from '../../../lib/url';
import { esc, fmtDate } from '../dom';
import type { Panel } from '../drawer';
import { setView, store } from '../state';
import { passGroups } from '../timeline';

let rangeError = '';

export const tiempo: Panel = {
  key: (s) => JSON.stringify([s.coverage?.weeks.length, s.coverage?.first_date, s.coverage?.last_date, s.view.from, s.view.to, s.frames.length, s.total, rangeError]),

  html(s) {
    const c = s.coverage;
    const max = Math.max(1, ...(c?.weeks.map((w) => w.count) ?? [1]));
    const bars = c?.weeks.length
      ? `<div class="bars" role="img" aria-label="${esc(`${T.tiempo.coverage}: ${c.weeks.length} semanas con imágenes`)}">${c.weeks
          .map((w) => `<i title="${esc(`${fmtDate(w.week_start)}: ${w.count}`)}" style="height:${Math.max(6, (w.count / max) * 100)}%"></i>`)
          .join('')}</div>
        <p class="help mono">${esc(fmtDate(c.first_date!))} — ${esc(fmtDate(c.last_date!))}</p>`
      : `<p class="help">${esc(c ? T.tiempo.none : '…')}</p>`;
    const passes = passGroups(s.frames).length;
    const summary = s.total
      ? `<p class="help">${s.total} ${esc(T.tiempo.summary)}${passes ? ` · ${passes} ${esc(T.tiempo.passes)} cargadas` : ''}</p>`
      : '';
    return `
      <section><h3>${esc(T.tiempo.coverage)}</h3>${bars}${summary}</section>
      <section>
        <form class="stack" data-submit="dates" novalidate>
          <div class="row">
            <div class="stack"><label for="d-from">${esc(T.tiempo.from)}</label><input id="d-from" data-fid="from" type="date" value="${esc(s.view.from ?? '')}" min="2025-05-01"></div>
            <div class="stack"><label for="d-to">${esc(T.tiempo.to)}</label><input id="d-to" data-fid="to" type="date" value="${esc(s.view.to ?? '')}" min="2025-05-01" aria-describedby="d-err"></div>
          </div>
          <p id="d-err" class="err" role="alert" ${rangeError ? '' : 'hidden'}>${esc(rangeError)}</p>
          <div class="row">
            <button class="btn btn-primary" type="submit" data-fid="apply">${esc(T.tiempo.apply)}</button>
            <button class="btn" type="button" data-act="clear" data-fid="clear" ${s.view.from || s.view.to ? '' : 'disabled'}>${esc(T.tiempo.clear)}</button>
          </div>
        </form>
      </section>`;
  },

  on(action, _el, root) {
    if (action === 'clear') {
      rangeError = '';
      void setView({ from: undefined, to: undefined });
      return;
    }
    if (action !== 'dates') return;
    const from = root.querySelector<HTMLInputElement>('#d-from')!.value || undefined;
    const to = root.querySelector<HTMLInputElement>('#d-to')!.value || undefined;
    const bad = (from && !isDate(from)) || (to && !isDate(to)) || (from && to && from > to);
    rangeError = bad ? T.tiempo.badRange : '';
    if (bad) {
      // Fuerza el repintado para mostrar el error junto al campo.
      store.set({ view: { ...store.get().view } });
      return;
    }
    void setView({ from, to });
  },
};
