// Panel Datos: espectro y curva de luz del punto elegido, metadatos, banderas, objetos y leyenda.
import { BANDS, bandOf, rangeLabel } from '../../../data/bands';
import { T } from '../../../data/viewer';
import { formatDec, formatRA } from '../../../lib/coords';
import { lightCurve, lightCurveSvg, spectrumSvg } from '../chart';
import { esc, fmtDateTime } from '../dom';
import type { Panel } from '../drawer';
import { jobCardHtml, updateJobCard } from '../jobcard';
import { shown } from '../stage';
import { effectiveDetector, pick, store, type ViewerState } from '../state';

function spectrumHtml(s: ViewerState): string {
  const sp = s.spectrum;
  if (sp.status === 'idle') return `<p class="help">${esc(T.datos.pointHelp)}</p>`;
  if (sp.status === 'loading') return jobCardHtml(T.datos.spectrumJob, sp.job);
  if (sp.status === 'error') return `<p class="err" role="alert">${esc(sp.error)}</p>`;
  const points = sp.data!.points;
  if (!points.length) return `<p class="help">${esc(T.datos.spectrumEmpty)}</p>`;
  const det = effectiveDetector(s.view);
  const curve = lightCurve(points, det);
  const rows = points.map((p) => `<tr><td>${p.wavelength.toFixed(3)}</td><td>${p.flux.toFixed(1)}</td><td>${p.error?.toFixed(1) ?? '—'}</td><td>${esc(p.date_obs.slice(0, 10))}</td></tr>`).join('');
  return `
    <p class="help">${esc(T.datos.spectrumHelp)}</p>
    ${spectrumSvg(points)}
    ${sp.data!.warnings.map((w) => `<p class="warn">${esc(w)}</p>`).join('')}
    <details class="table"><summary>${esc(T.datos.table)}</summary><div class="scroll"><table>
      <thead><tr><th scope="col">µm</th><th scope="col">µJy</th><th scope="col">±</th><th scope="col">${esc(T.datos.date)}</th></tr></thead><tbody>${rows}</tbody></table></div></details>
    <h3 style="margin-top:.5rem">${esc(T.datos.light)} · det ${det}</h3>
    <p class="help">${esc(T.datos.lightHelp)}</p>
    ${curve.length > 1 ? lightCurveSvg(curve, bandOf(det).color) : `<p class="help">${esc(T.datos.spectrumEmpty)}</p>`}`;
}

export const datos: Panel = {
  key(s) {
    const cur = shown(s);
    const sp = s.spectrum;
    return JSON.stringify([s.picked, sp.status, sp.error, sp.data?.points.length, effectiveDetector(s.view), cur?.frameIdx, s.frames.length,
      s.objects?.objects.length, s.objects?.warnings, !!s.target]);
  },

  html(s) {
    const cur = shown(s);
    const f = cur ? s.frames[cur.frameIdx] : null;
    const p = s.picked;
    return `
      <section>
        <h3>${esc(T.datos.point)}</h3>
        ${p ? `<p class="mono" style="font-size:.8125rem">RA ${esc(formatRA(p.ra))} · Dec ${esc(formatDec(p.dec))}</p>` : ''}
        <button class="btn" type="button" data-act="center" data-fid="center" ${s.target ? '' : 'disabled'}>${esc(T.datos.center)}</button>
      </section>
      <section><h3>${esc(T.datos.spectrum)}</h3>${spectrumHtml(s)}</section>
      <section>
        <h3>${esc(T.datos.frame)}</h3>
        ${f ? `<dl class="meta">
          <dt>${esc(T.datos.date)}</dt><dd class="mono">${esc(fmtDateTime(f.date_obs))}</dd>
          <dt>${esc(T.imagen.detector)}</dt><dd class="mono">${f.detector} · ${esc(rangeLabel(bandOf(f.detector)))}</dd>
          <dt>${esc(T.datos.band)}</dt><dd class="mono">${f.band_um.toFixed(3)} µm</dd>
          <dt>${esc(T.datos.exposure)}</dt><dd class="mono">${f.exposure_s != null ? `${f.exposure_s} s` : '—'}</dd>
          <dt>${esc(T.datos.id)}</dt><dd class="mono">${esc(f.id)}</dd>
        </dl>
        <h3 style="margin-top:.5rem">${esc(T.datos.flags)}</h3>
        <div class="chips">${f.flags.length
          ? f.flags.map((x) => `<span class="chip chip-warn">${esc(T.flags[x] ?? x)}</span>`).join('')
          : `<span class="chip">${esc(T.datos.noFlags)}</span>`}</div>`
        : `<p class="help">—</p>`}
      </section>
      <section>
        <h3>${esc(T.datos.objects)}</h3>
        ${(s.objects?.warnings ?? []).map((w) => `<p class="warn">${esc(w)}</p>`).join('')}
        ${s.objects?.objects.length
          ? `<ul class="obj-list">${s.objects.objects.slice(0, 60).map((o) => `<li><span>${esc(o.name)}</span><small class="mono">${esc(T.objectType[o.type])} · ${esc(o.source.toUpperCase())} · ${o.distance_arcsec.toFixed(0)}″</small></li>`).join('')}</ul>`
          : `<p class="help">${esc(s.objects ? T.datos.noObjects : '…')}</p>`}
      </section>
      <section>
        <h3>${esc(T.datos.legend)}</h3>
        <ul class="legend">${BANDS.map((b) => `<li><i style="background:${b.color}"></i><div><b>${b.det} · ${esc(b.title)} <span class="mono">${esc(rangeLabel(b))}</span></b><span>${esc(b.reveals)}</span></div></li>`).join('')}</ul>
      </section>`;
  },

  on(action) {
    const s = store.get();
    if (action === 'center' && s.target) void pick({ ra: s.target.ra, dec: s.target.dec });
  },

  tick(s, root) {
    if (s.spectrum.status === 'loading') updateJobCard(root, s.spectrum.job);
  },
};
