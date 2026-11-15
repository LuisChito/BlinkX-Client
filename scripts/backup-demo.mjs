#!/usr/bin/env node
// AI-assisted development used for code development, debugging and documentation.
// Tool: ChatGPT, Claude
/**
 * Respaldo sin conexión del visor (/ver) para la presentación.
 *
 * Pide al backend, para los 5 objetivos del reto, exactamente las mismas consultas que hace el visor
 * (imágenes, objetos, cobertura, Gaia/WISE, resta/suma, espectro, composición, predicción, L2 y cubo),
 * y guarda las respuestas JSON y las imágenes PNG en public/backup/ con un manifest.json.
 * El visor (src/lib/skyApi.ts) usa ese respaldo cuando la API falla o con "solo respaldo" activado.
 * Además, todo queda en la caché del backend (útil si es tu Docker local, cuyo disco es persistente).
 *
 * Uso:
 *   node scripts/backup-demo.mjs                      # usa PUBLIC_API_BASE del .env (o Render)
 *   node scripts/backup-demo.mjs --wait               # espera a que IRSA vuelva y entonces descarga
 *   node scripts/backup-demo.mjs --api http://localhost:8000 --targets wise-0855,barnards-star
 *   node scripts/backup-demo.mjs --skip-heavy         # sin L2 (~65 MB) ni cubo (~320 MB por objetivo, primera vez)
 *   node scripts/backup-demo.mjs --force              # vuelve a descargar lo ya guardado
 *
 * Es reanudable: si se corta, al volver a ejecutarlo salta lo que ya está guardado.
 * IMPORTANTE: los parámetros deben coincidir con los del visor (useSkyContract.ts / App.tsx). Si cambian allá,
 * cámbialos aquí también, o el visor no encontrará las consultas en el respaldo.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'backup');

// ------------------------------------------------------------------------------------------------- argumentos
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};

function envApi() {
  try {
    const env = readFileSync(join(ROOT, '.env'), 'utf8');
    const m = env.match(/^\s*PUBLIC_API_BASE\s*=\s*(\S+)/m) ?? env.match(/^\s*PUBLIC_API_URL\s*=\s*(\S+)/m);
    return m?.[1];
  } catch {
    return undefined;
  }
}
const API = (opt('api') ?? envApi() ?? 'https://nasaspace-1ebj.onrender.com').replace(/\/+$/, '');
const FORCE = flag('force');
const SKIP_HEAVY = flag('skip-heavy');
const WAIT = flag('wait');
const JOB_TIMEOUT_MS = Number(opt('job-timeout-min', '25')) * 60_000;

// Objetivos del reto (src/explorer/data/spherexCatalog.ts)
const ALL_TARGETS = [
  { id: 'barnards-star', name: "Barnard's Star", ra: 269.4521, dec: 4.6934, fov: 0.15 },
  { id: 'wise-0855', name: 'WISE 0855', ra: 133.79513, dec: -7.24515, fov: 0.15 },
  { id: 'epsilon-indi-b', name: 'Epsilon Indi B', ra: 331.09575, dec: -56.80032, fov: 0.15 },
  { id: 'rw-aurigae', name: 'RW Aurigae', ra: 76.9565, dec: 30.4014, fov: 0.15 },
  { id: 'r-draconis', name: 'R Draconis', ra: 249.6021, dec: 66.7501, fov: 0.15 },
];
const only = opt('targets')?.split(',').map((s) => s.trim());
const TARGETS = only ? ALL_TARGETS.filter((t) => only.includes(t.id)) : ALL_TARGETS;

// Valores por defecto del visor
const AT = '2025-07-01';
const DATE_FROM = '2025-05-01';
const DATE_TO = '2026-06-01';
const STRETCH = 'asinh';
const CMAP = 'gray';

// ------------------------------------------------------------------- mismas reglas de clave que skyApi.ts
function qs(params = {}) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) v.forEach((x) => u.append(k, String(x)));
    else u.append(k, String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : '';
}
function roundParams(params = {}) {
  const out = {};
  for (const [k, v] of Object.entries(params)) out[k] = (k === 'ra' || k === 'dec') && typeof v === 'number' ? Math.round(v * 3600) / 3600 : v;
  return out;
}
const backupKey = (method, path, params, body) => `${method} ${path}${qs(roundParams(params))}${body ? ` ${JSON.stringify(body)}` : ''}`;
/** El visor toma ra/dec de la URL, que guarda 5 decimales. */
const url5 = (x) => Number(x.toFixed(5));

// ------------------------------------------------------------------------------------------------- manifest
mkdirSync(join(OUT, 'data'), { recursive: true });
mkdirSync(join(OUT, 'img'), { recursive: true });
const MANIFEST = join(OUT, 'manifest.json');
const manifest = existsSync(MANIFEST)
  ? JSON.parse(readFileSync(MANIFEST, 'utf8'))
  : { version: 1, generated_at: null, api: API, targets: [], entries: {}, images: {} };
manifest.api = API;
const saveManifest = () => {
  manifest.generated_at = new Date().toISOString();
  manifest.targets = [...new Set([...(manifest.targets ?? []), ...TARGETS.map((t) => t.id)])];
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
};
const hash = (s) => createHash('sha1').update(s).digest('hex').slice(0, 20);

const stats = { ok: 0, skipped: 0, images: 0, failed: [] };
const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Línea de progreso que se sobrescribe (solo en una terminal interactiva). */
const TTY = process.stdout.isTTY;
const progress = (text) => { if (TTY) process.stdout.write(`\r${text}`.padEnd(100).slice(0, 100)); };
const clearProgress = () => { if (TTY) process.stdout.write(`\r${' '.repeat(100)}\r`); };

// ---------------------------------------------------------------------------------------------------- HTTP
async function rawFetch(method, path, params, body) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}${path}${qs(roundParams(params))}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(180_000),
    });
    if (res.status === 429 && attempt < 5) {
      await sleep(Number(res.headers.get('Retry-After') || 3) * 1000);
      continue;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok && res.status !== 202) {
      const e = data?.error ?? {};
      throw new Error(`HTTP ${res.status} ${e.code ?? ''}: ${e.message ?? ''}`.trim());
    }
    return { status: res.status, data };
  }
}

/** Consulta con el patrón 202 + trabajo; devuelve el resultado final. */
async function call(label, method, path, params, body) {
  const key = backupKey(method, path, params, body);
  if (!FORCE && manifest.entries[key] && existsSync(join(OUT, manifest.entries[key]))) {
    stats.skipped++;
    return JSON.parse(readFileSync(join(OUT, manifest.entries[key]), 'utf8'));
  }
  const t0 = Date.now();
  let { status, data } = await rawFetch(method, path, params, body);
  if (status === 202) {
    let job = data;
    let lastStage = '';
    while (job.status !== 'done') {
      if (job.status === 'failed') throw new Error(`${job.error?.code}: ${job.error?.message}`);
      if (Date.now() - t0 > JOB_TIMEOUT_MS) throw new Error('tiempo de espera agotado');
      const stage = `${Math.round((job.progress ?? 0) * 100)}% ${job.stage ?? ''}`;
      if (stage !== lastStage) progress(`    … ${label}: ${stage}`);
      lastStage = stage;
      await sleep(Math.max(1000, job.poll_after_ms ?? 1500));
      job = (await rawFetch('GET', `/api/jobs/${job.id}`)).data;
    }
    if (lastStage) clearProgress();
    data = job.result;
  }
  const file = `data/${hash(key)}.json`;
  writeFileSync(join(OUT, file), JSON.stringify(data));
  manifest.entries[key] = file;
  saveManifest();
  stats.ok++;
  log(`    ✓ ${label} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  return data;
}

/** Descarga una imagen; `rel` es exactamente la URL relativa que usa el visor (abs(rel)). */
async function image(rel) {
  if (!rel) return;
  if (!FORCE && manifest.images[rel] && existsSync(join(OUT, manifest.images[rel]))) return;
  const res = await fetch(rel.startsWith('http') ? rel : `${API}${rel}`, { signal: AbortSignal.timeout(180_000) });
  if (!res.ok) throw new Error(`imagen HTTP ${res.status}`);
  const file = `img/${hash(rel)}.png`;
  writeFileSync(join(OUT, file), Buffer.from(await res.arrayBuffer()));
  manifest.images[rel] = file;
  stats.images++;
}

async function images(label, rels) {
  const list = rels.filter(Boolean);
  let done = 0;
  for (let i = 0; i < list.length; i += 4) {
    await Promise.all(list.slice(i, i + 4).map((r) => image(r).catch((e) => stats.failed.push(`${label}: ${r} → ${e.message}`))));
    done = Math.min(list.length, i + 4);
    progress(`    … ${label}: ${done}/${list.length} imágenes`);
  }
  clearProgress();
  saveManifest();
  if (list.length) log(`    ✓ ${label}: ${list.length} imágenes`);
}

/** Ejecuta un paso; si falla, lo anota y sigue con el resto. */
async function step(label, fn) {
  try {
    return await fn();
  } catch (e) {
    clearProgress();
    stats.failed.push(`${label}: ${e.message}`);
    log(`    ✗ ${label}: ${e.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------------- lo que pide el visor
async function backupCenter(t, c, names) {
  const ra = url5(c.ra);
  const dec = url5(c.dec);
  const fovArcsec = Math.max(30, Math.min(3600, Math.round(t.fov * 3600)));
  const seqFov = Math.max(540, fovArcsec);
  log(`  · Centro ${ra}, ${dec} (${c.label})`);

  // Metadatos rápidos (useSkyContract: objects / frames / coverage)
  await step('objetos', () => call('objetos SIMBAD/NED', 'GET', '/api/objects', { ra, dec, radius: Math.min(600, Math.round(seqFov / 2)) }));
  await step('frames', () => call('lista de exposiciones', 'GET', '/api/frames', { ra, dec, fov: seqFov, detector: undefined, limit: 48, offset: 0 }));
  const coverage = await step('cobertura', () => call('cobertura', 'GET', '/api/coverage', { ra, dec, detector: undefined }));

  // Secuencia (blink) y sus imágenes
  const seq = await step('secuencia', () =>
    call('secuencia de imágenes', 'GET', '/api/sequence', {
      ra, dec, fov: seqFov, size: 512, stretch: STRETCH, cmap: CMAP, scale: 'sequence', detector: undefined, limit: 12, offset: 0,
    }));
  if (seq?.frames?.length) {
    await images('imágenes de la secuencia', seq.frames.map((f) => f.png_url));

    // Capas Gaia / WISE (centradas en la secuencia)
    for (const catalog of ['gaia', 'wise']) {
      await step(`capa ${catalog}`, () => call(`capa ${catalog}`, 'GET', '/api/overlay', { ra: seq.center.ra, dec: seq.center.dec, fov: seq.fov_arcsec, catalog, at: AT }));
    }

    // Resta y suma
    if (seq.frames.length >= 2) {
      const ids = seq.frames.map((f) => f.id);
      for (const [op, a, b] of [['diff', [ids[ids.length - 1]], [ids[0]]], ['sum', ids.slice(0, 6), undefined]]) {
        const st = await step(`stack ${op}`, () =>
          call(op === 'diff' ? 'resta' : 'suma', 'GET', '/api/stack', { ra, dec, fov: fovArcsec, size: 512, stretch: STRETCH, cmap: CMAP, op, a, b }));
        if (st?.png_url) await images(op === 'diff' ? 'imagen de la resta' : 'imagen de la suma', [st.png_url]);
      }
    }
  }

  // Espectro y composición del centro ("Espectro del centro" / "Composición")
  await step('espectro', () => call('espectro del centro', 'GET', '/api/spectrum', { ra, dec, aperture: 8, date_from: DATE_FROM, date_to: DATE_TO }));
  await step('composición', () =>
    call('composición química', 'GET', '/api/composition', { ra, dec, aperture: 8, date_from: DATE_FROM, date_to: DATE_TO, context: undefined }));

  // Predicción (pestaña Movimiento): nombre sugerido y fechas de la cobertura
  const from = (coverage?.first_date ?? DATE_FROM).slice(0, 10);
  const to = (coverage?.last_date ?? DATE_TO).slice(0, 10);
  for (const name of names) {
    await step(`predicción ${name}`, () => call(`predicción (${name})`, 'GET', '/api/predict', { ra, dec, name, date_from: from, date_to: to }));
  }

  if (SKIP_HEAVY) return;

  // Imagen L2 completa (botón "L2" / "L2 color")
  const l2 = await step('L2', () => call('imagen L2 completa', 'GET', '/api/l2', { ra, dec, detector: undefined, date_from: undefined, date_to: undefined, frame_id: undefined, size: 1024 }));
  if (l2) await images('imágenes L2', [l2.raw_png_url, l2.color_png_url]);

  // Cubo de 102 canales (vista Detectores)
  const cube = await step('cubo', () => call('cubo de 102 canales', 'GET', '/api/cube', { ra, dec, size: 256 }));
  const tile = cube?.tile?.id;
  if (tile) {
    const rels = [
      ...(cube.six_channels ?? []).map((ch) => ch.png_url),
      ...Array.from({ length: 102 }, (_, i) => `/api/cube/${tile}/channel/${i + 1}.png${qs({ cmap: 'gray_r', size: 512 })}`),
      `/api/cube/${tile}/samples.png${qs({ ra, dec })}`,
      `/api/cube/${tile}/cube3d.png`,
    ];
    await images('canales del cubo', rels);
  }
}

async function waitForIrsa() {
  for (;;) {
    try {
      const { data } = await rawFetch('GET', '/api/status');
      const sx = data?.sources?.spherex;
      if (sx?.ok) {
        log('IRSA responde. Empezando.\n');
        return;
      }
      log(`[${new Date().toLocaleTimeString()}] IRSA sigue sin responder (${sx?.last_error ?? 'sin dato'}). Reintento en 60 s… (Ctrl+C para salir)`);
    } catch (e) {
      log(`[${new Date().toLocaleTimeString()}] El backend no responde (${e.message}). Reintento en 60 s…`);
    }
    await sleep(60_000);
  }
}

// ------------------------------------------------------------------------------------------------- principal
log(`Respaldo del visor → ${OUT}\nAPI: ${API}\nObjetivos: ${TARGETS.map((t) => t.id).join(', ')}${SKIP_HEAVY ? ' (sin L2 ni cubo)' : ''}\n`);
if (WAIT) await waitForIrsa();

for (const t of TARGETS) {
  log(`\n▶ ${t.name} (${t.id})`);
  const names = [t.name];
  const centers = [{ ra: t.ra, dec: t.dec, label: 'abrir /ver?target=…' }];

  // Elegirlo en el menú resuelve el nombre en SIMBAD/NED y centra en su posición actual.
  const res = await step('resolver nombre', () => call('resolver nombre', 'GET', '/api/resolve', { name: t.name, at: AT }));
  if (res?.current) {
    const same = Math.abs(res.current.ra - t.ra) * 3600 < 1 && Math.abs(res.current.dec - t.dec) * 3600 < 1;
    if (!same) centers.unshift({ ra: res.current.ra, dec: res.current.dec, label: 'elegido en el menú' });
    const matched = String(res.matched_name ?? '').replace(/\s+/g, ' ');
    if (matched && !names.includes(matched)) names.push(matched);
  }
  for (const c of centers) await backupCenter(t, c, names);
}

saveManifest();
log(`\nListo. Consultas nuevas: ${stats.ok} · ya guardadas: ${stats.skipped} · imágenes nuevas: ${stats.images}`);
log(`Total en el respaldo: ${Object.keys(manifest.entries).length} consultas y ${Object.keys(manifest.images).length} imágenes.`);
if (stats.failed.length) {
  log(`\n${stats.failed.length} pasos fallaron (vuelve a ejecutar el script para reintentarlos):`);
  for (const f of stats.failed) log(`  - ${f}`);
  process.exitCode = 1;
}
