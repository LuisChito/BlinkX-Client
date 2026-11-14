# Blink X Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir Blink X: una portada `/` que cuenta la historia del reto en capítulos y un visor `/ver` a pantalla completa para ver cómo cambia una región del cielo de SPHEREx, todo sobre datos simulados que respetan el contrato v0.3.

**Architecture:** Sitio estático en Astro. Los componentes `.astro` solo generan marcado; el comportamiento vive en scripts TypeScript (`src/scripts/`) que leen y escriben un almacén de estado pequeño. La API se consume a través de una interfaz `Api` con dos implementaciones intercambiables por variable de entorno: `httpApi` (real) y `mockApi` (cielo simulado dibujado en canvas, dentro del navegador).

**Tech Stack:** Astro 7, TypeScript estricto, GSAP 3 (ScrollTrigger, SplitText, Flip), Lenis, Fontsource (Archivo Variable, JetBrains Mono), CSS propio con variables, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-14-blinkx-design.md`. Contrato: `../SpaceX/openapi.yaml` (v0.3). Código a portar: `../SpaceX/web/src/lib/`. Proyecto de referencia del stack: `../../yud-tattos-web/`.

## Global Constraints

- Sin framework de componentes (ni Preact/React/Vue) y sin Tailwind.
- Solo modo oscuro. Tokens exactos: fondo `#050304`, superficie `#0e0a0b`, vidrio `rgb(14 10 11 / .82)` con borde `rgb(255 255 255 / .14)`, texto `#f6f1ee`, secundario `#b9a8a3`, acento `#ff8a5c`, rampa de bandas `#3b1d6e → #7b1f5c → #c2402f → #e9a23b`, Gaia `#6fd3ff`, WISE `#9fe0ad`, error `#ff6b6b`.
- Tipografía: Archivo Variable (títulos condensados 800 en mayúsculas; cuerpo ancho normal 400) y JetBrains Mono con cifras tabulares para coordenadas, fechas y números.
- Todos los textos visibles en español y en `src/data/*.ts`, nunca dentro de los componentes.
- Toda imagen generada lleva la etiqueta visible "Ilustración". Todo cielo simulado lleva el chip "Datos simulados". En el visor no hay imágenes de otros telescopios ni decorativas.
- El frontend nunca construye una `png_url`: usa la que devuelve la API.
- `prefers-reduced-motion`: todo en estado final, sin scroll suave, el video no arranca solo.
- Accesibilidad: contraste AA, foco visible, objetivos táctiles ≥ 44 px, operable con teclado, sin emoji como icono.
- GSAP y Lenis solo se cargan en `/`. En `/ver` las transiciones duran 150–250 ms.
- Variables de entorno: `PUBLIC_USE_MOCKS` (por defecto `true`) y `PUBLIC_API_BASE`.
- Cada tarea termina con `npm test` y `npm run build` en verde, un commit y `git push`.
- Servidor de desarrollo: `npx astro dev --background` (ver `AGENTS.md` del proyecto de referencia).

## Review Focus

1. **Coordenadas escritas de formas raras** (`08h55m10.831s -7d14m42.53s`, `08:55:10.8 -07:14:42`, `133.795 -7.245`, declinación `-00 30 00`, RA `360`): se aceptan o se muestra un error claro junto al buscador; nunca se navega a un punto equivocado. → Tarea 2.
2. **Región sin imágenes** (`total = 0`): el visor muestra "SPHEREx aún no tiene imágenes de esta región", el reproductor queda deshabilitado y nada falla. → Tareas 5 y 7.
3. **Búsqueda nueva mientras un trabajo sigue corriendo**: el resultado viejo se descarta; nunca se pintan frames de la región anterior. → Tareas 2 y 6.
4. **Proyección cerca de RA 0/360 y a declinación alta** (R Draconis, dec +66.75): un objeto a RA 359.999 con centro en RA 0.001 cae junto al centro, no al otro lado de la imagen. → Tarea 2.
5. **URL con parámetros inválidos** (`fov=abc`, `det=9`, `from` posterior a `to`, `mode=xyz`): se recortan a valores válidos por defecto y el visor carga. → Tarea 2.

---

### Task 1: Proyecto base y sistema visual

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `AGENTS.md`, `README.md`, `.env.example`, `public/favicon.svg`
- Create: `src/styles/global.css`, `src/layouts/Base.astro`, `src/components/Icon.astro`, `src/components/Nav.astro`, `src/components/Footer.astro`
- Create: `src/pages/index.astro`, `src/pages/ver.astro` (provisionales: título y enlace entre ambas)

**Interfaces:**
- Produces: `Base.astro` con props `{ title: string; description?: string; bodyClass?: string }`, que incluye enlace "Saltar al contenido" hacia `#main`. `Icon.astro` con prop `{ name: IconName; size?: number }` donde `IconName` = `'play' | 'pause' | 'prev' | 'next' | 'clock' | 'compare' | 'image' | 'layers' | 'info' | 'share' | 'code' | 'close' | 'search' | 'refresh' | 'crosshair'`. Clases CSS globales: `.glass`, `.btn`, `.btn-icon`, `.chip`, `.chip-accent`, `.mono`, `.eyebrow`, `.sr-only`, `.sk` (esqueleto).

- [ ] **Step 1:** Crear `package.json` (`name: "blinkx-client"`, scripts `dev`, `build`, `preview`, `test: "vitest run"`) con dependencias `astro@^7`, `gsap@^3.15`, `lenis@^1.3`, `@fontsource-variable/archivo`, `@fontsource-variable/jetbrains-mono` y devDependencies `typescript`, `vitest`. Ejecutar `npm install`.
- [ ] **Step 2:** `astro.config.mjs` igual al de referencia pero sin `sitemap` y con `site: 'https://blinkx.example'`; `tsconfig.json` extiende `astro/tsconfigs/strict`.
- [ ] **Step 3:** `global.css`: tokens de Global Constraints como variables (`--bg`, `--surface`, `--glass`, `--line`, `--fg`, `--muted`, `--accent`, `--ir-1`…`--ir-4`, `--gaia`, `--wise`, `--err`, `--f-display`, `--f-body`, `--f-mono`, `--gutter: clamp(1rem, 4vw, 3.5rem)`, `--dur-fast: 150ms`, `--dur: 250ms`), reset, foco visible, clases de la sección Interfaces. El ancho condensado de títulos se logra con `font-stretch: 62%` de Archivo.
- [ ] **Step 4:** `Base.astro`, `Icon.astro` (SVG de trazo 1.5, 24×24, `aria-hidden`), `Nav.astro` (marca "BLINK X" con el punto que parpadea, enlaces Historia / Visor), `Footer.astro`.
- [ ] **Step 5:** Run `npm run build` → Expected: 2 páginas generadas, sin errores de tipos.
- [ ] **Step 6:** Commit `chore: proyecto base y sistema visual` y push.

### Task 2: Lógica base (coordenadas, proyección, URL, trabajos, almacén)

**Files:**
- Create: `src/lib/coords.ts`, `src/lib/projection.ts`, `src/lib/url.ts`, `src/lib/jobs.ts`, `src/lib/store.ts`
- Test: `src/lib/coords.test.ts`, `projection.test.ts`, `url.test.ts`, `jobs.test.ts`, `store.test.ts`
- Portar desde `../SpaceX/web/src/lib/` `coords.ts`, `url.ts`, `jobs.ts` y sus tests; adaptar a las firmas de abajo.

**Interfaces (Produces):**
```ts
// coords.ts
interface SkyPoint { ra: number; dec: number }
parseCoords(input: string): SkyPoint | null        // decimal y sexagesimal
formatRA(deg: number): string                      // "17h57m48.5s"
formatDec(deg: number): string                     // "+04°41′36″"
separationArcsec(a: SkyPoint, b: SkyPoint): number

// projection.ts — fórmula del contrato v0.3
skyToPixel(p: SkyPoint, center: SkyPoint, fov: number, size: number): { x: number; y: number }
pixelToSky(x: number, y: number, center: SkyPoint, fov: number, size: number): SkyPoint
decimalYear(d: Date): number
propagate(pos: SkyPoint & { epoch: number }, pm: { ra: number; dec: number } | null, toEpoch: number): SkyPoint

// url.ts
type ViewMode = 'video' | 'blink' | 'diff' | 'stack'
interface ViewState { ra?: number; dec?: number; name?: string; fov: number; det?: 1|2|3|4|5|6;
  from?: string; to?: string; mode: ViewMode; stretch: 'linear'|'log'|'sqrt'|'asinh';
  cmap: 'gray'|'viridis'|'magma'|'inferno'; scale: 'sequence'|'frame'; embed: boolean }
DEFAULT_STATE: ViewState   // fov 300, mode 'video', stretch 'asinh', cmap 'gray', scale 'sequence', embed false
FOV_MIN = 30; FOV_MAX = 3600
readState(search: string): ViewState
writeState(s: ViewState): string                   // "" o "?ra=…"; omite valores por defecto

// jobs.ts
type Started<T> = { kind: 'result'; result: T } | { kind: 'job'; job: Job }
runJob<T>(start: () => Promise<Started<T>>, getJob: (id: string) => Promise<Job>,
  opts: { signal: AbortSignal; onProgress?: (j: Job) => void }): Promise<T>   // rechaza con ApiError si status=failed
isAbort(e: unknown): boolean

// store.ts
createStore<S extends object>(initial: S): { get(): S; set(patch: Partial<S>): void;
  subscribe(fn: (s: S, prev: S) => void): () => void }
```

- [ ] **Step 1: Tests que fallan.** Además de los tests portados, añadir:
```ts
// coords.test.ts — Review Focus 1
expect(parseCoords('08h55m10.831s -7d14m42.53s')).toEqual({ ra: expect.closeTo(133.795129, 5), dec: expect.closeTo(-7.245147, 5) });
expect(parseCoords('08:55:10.8 -07:14:42')!.dec).toBeLessThan(0);
expect(parseCoords('10 00 00 -00 30 00')!.dec).toBeCloseTo(-0.5, 6);
expect(parseCoords('360 10')).toBeNull();
expect(parseCoords('120 91')).toBeNull();
expect(parseCoords('Barnard')).toBeNull();

// projection.test.ts — Review Focus 4
const c = { ra: 0.001, dec: 66.75 };
const p = skyToPixel({ ra: 359.999, dec: 66.75 }, c, 300, 512);
expect(Math.abs(p.x - 256)).toBeLessThan(10);             // junto al centro, no al otro lado
expect(skyToPixel(c, c, 300, 512)).toEqual({ x: 256, y: 256 });
expect(skyToPixel({ ra: c.ra, dec: c.dec + 150 / 3600 }, c, 300, 512).y).toBeCloseTo(0, 6);   // norte arriba
expect(skyToPixel({ ra: c.ra + 0.01, dec: c.dec }, c, 300, 512).x).toBeLessThan(256);         // este a la izquierda
const back = pixelToSky(100, 400, c, 300, 512); expect(skyToPixel(back, c, 300, 512).x).toBeCloseTo(100, 4);
// propagate: Barnard, pm (-802.8, 10362.5) mas/año, 2000.0 → 2026.0 se mueve ≈ 269″ al norte
expect((propagate({ ra: 269.4521, dec: 4.6934, epoch: 2000 }, { ra: -802.8, dec: 10362.5 }, 2026).dec - 4.6934) * 3600).toBeCloseTo(269.4, 0);
expect(propagate({ ra: 10, dec: 20, epoch: 2000 }, null, 2026)).toEqual({ ra: 10, dec: 20 });

// url.test.ts — Review Focus 5
const s = readState('?fov=abc&det=9&mode=xyz&from=2026-05-01&to=2025-05-01&ra=400');
expect(s.fov).toBe(300); expect(s.det).toBeUndefined(); expect(s.mode).toBe('video');
expect(s.from).toBeUndefined(); expect(s.to).toBeUndefined(); expect(s.ra).toBeUndefined();
expect(readState('?fov=99999').fov).toBe(3600);
expect(readState(writeState({ ...DEFAULT_STATE, ra: 133.795129, dec: -7.245147, det: 6, mode: 'blink' }))).toMatchObject({ ra: 133.795129, det: 6, mode: 'blink' });

// jobs.test.ts — Review Focus 3
// runJob con signal abortado a mitad del sondeo rechaza con un error para el que isAbort() es true
// y no vuelve a llamar a getJob después del abort.
```
- [ ] **Step 2:** Run `npm test` → Expected: FAIL (módulos inexistentes).
- [ ] **Step 3:** Implementar los cinco módulos. `skyToPixel` normaliza `ra − ra0` al intervalo (−180, 180] antes de aplicar la fórmula. `runJob` espera `job.poll_after_ms` entre consultas.
- [ ] **Step 4:** Run `npm test` → Expected: PASS.
- [ ] **Step 5:** Commit `feat: lógica base de coordenadas, proyección, URL y trabajos` y push.

### Task 3: Tipos del contrato v0.3 y cliente HTTP

**Files:**
- Create: `src/lib/api/types.ts`, `src/lib/api/client.ts`, `src/lib/api/index.ts`
- Test: `src/lib/api/client.test.ts`

**Interfaces (Produces):**
```ts
// types.ts: un tipo por cada schema de openapi.yaml v0.3, con los mismos nombres y campos:
// ResolveResponse, SkyObject, ObjectsResponse, FrameMeta, Frame, FramesResponse, Job, SequenceResult,
// StackResult, PredictResult, SpectrumResponse, OverlayResponse, CoverageResponse, StatusResponse,
// ErrorDetail, ProperMotion, EpochPosition. FrameFlag = string. Detector = 1|2|3|4|5|6.
class ApiError extends Error { code: ErrorDetail['code']; status: number }
interface Api {
  resolve(p: { name: string; at?: string }): Promise<ResolveResponse>
  objects(p: { ra: number; dec: number; radius?: number }): Promise<ObjectsResponse>
  frames(p: RegionParams & { limit?: number; offset?: number }): Promise<FramesResponse>
  sequence(p: RegionParams & { size?: number; stretch?: Stretch; cmap?: Cmap; scale?: Scale; limit?: number; offset?: number }): Promise<Started<SequenceResult>>
  stack(p: { ra: number; dec: number; fov: number; size?: number; stretch?: Stretch; cmap?: Cmap; op: StackOp; a: string[]; b?: string[] }): Promise<Started<StackResult>>
  predict(p: { ra: number; dec: number; name?: string; date_from: string; date_to: string }): Promise<Started<PredictResult>>
  spectrum(p: { ra: number; dec: number; aperture?: number; date_from?: string; date_to?: string }): Promise<Started<SpectrumResponse>>
  overlay(p: { ra: number; dec: number; fov: number; catalog: 'gaia' | 'wise'; at?: string }): Promise<OverlayResponse>
  coverage(p: { ra: number; dec: number; detector?: Detector }): Promise<CoverageResponse>
  status(): Promise<StatusResponse>
  job(id: string): Promise<Job>
}
// RegionParams = { ra: number; dec: number; fov: number; detector?: Detector; date_from?: string; date_to?: string }
// index.ts
USE_MOCKS: boolean; api: Api; absolute(u: string): string   // antepone PUBLIC_API_BASE a rutas relativas; deja intactas blob: y http(s):
```

- [ ] **Step 1: Test que falla** (`fetch` simulado con `vi.fn`): respuesta 200 en `sequence` → `{ kind: 'result' }`; respuesta 202 → `{ kind: 'job' }`; respuesta 404 con cuerpo `Error` → rechaza con `ApiError` de `code: 'not_found'` y el `message` del cuerpo; las listas (`a`, `b`) se serializan separadas por comas; `absolute('blob:x')` devuelve `'blob:x'`.
- [ ] **Step 2:** Run `npm test` → FAIL.
- [ ] **Step 3:** Implementar `types.ts`, `httpApi` en `client.ts` e `index.ts` (por ahora `api = httpApi`; el interruptor de mocks se añade en la Tarea 5).
- [ ] **Step 4:** Run `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: tipos del contrato v0.3 y cliente HTTP` y push.

### Task 4: Cielo simulado

**Files:**
- Create: `src/lib/api/mock/rng.ts`, `sky.ts`, `synth.ts`
- Test: `src/lib/api/mock/sky.test.ts`, `synth.test.ts`
- Portar desde `../SpaceX/web/src/lib/api/mock/` con estos cambios: `MOTION_EXAGGERATION` se elimina (movimiento propio real); `skyToPixel`/`pixelToSky` se importan de `lib/projection`; el tamaño por defecto es 512.

**Interfaces (Produces):** `TARGETS: Target[]` (los cinco del reto, con `pm` en mas/año, `parallax_mas`, época de catálogo y tipo), `findTarget(name)`, `positionAt(s, tMs): SkyPoint | null`, `fluxAt(s, det, tMs): number`, `fieldSources(center, fov)`, `surveyPasses(center, now?)`, `simulate(o: SimOptions): Float32Array` (brillo en MJy/sr), `toRGBA(data, stretch, cmap, vmin, vmax, diverging?): Uint8ClampedArray`, `DETECTOR_BANDS`.

- [ ] **Step 1: Tests que fallan:**
```ts
// sky.test.ts
const b = findTarget("Barnard's star")!;
const d = separationArcsec(positionAt(b, Date.UTC(2025, 4, 1))!, positionAt(b, Date.UTC(2026, 4, 1))!);
expect(d).toBeGreaterThan(9.5); expect(d).toBeLessThan(11.5);               // ≈ 10.4″/año, sin exagerar
const w = findTarget('WISE 0855')!;
expect(fluxAt(w, 6, t) / Math.max(fluxAt(w, 1, t), 1e-9)).toBeGreaterThan(50); // solo aparece en los últimos detectores
const r = findTarget('R Dra')!;                                              // variable: cambia de brillo, no de lugar
expect(Math.max(...months.map(m => fluxAt(r, 3, m))) / Math.min(...months.map(m => fluxAt(r, 3, m)))).toBeGreaterThan(2);
expect(separationArcsec(positionAt(r, t0)!, positionAt(r, t1)!)).toBeLessThan(0.5);
expect(TARGETS.map(x => x.name)).toEqual(expect.arrayContaining(["Barnard's star", 'Epsilon Indi B', 'WISE 0855', 'RW Aur', 'R Dra']));
// synth.test.ts
// simulate es determinista (misma entrada → mismo arreglo) y el píxel más brillante de un campo
// centrado en Barnard cae a menos de 3 px de skyToPixel(positionAt(b, t), centro, fov, size).
```
- [ ] **Step 2:** Run `npm test` → FAIL.
- [ ] **Step 3:** Portar y adaptar los tres módulos.
- [ ] **Step 4:** Run `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: cielo simulado para los cinco objetos del reto` y push.

### Task 5: Mocks de la API v0.3

**Files:**
- Create: `src/lib/api/mock/handlers.ts`
- Modify: `src/lib/api/index.ts` (activar `USE_MOCKS`)
- Test: `src/lib/api/mock/handlers.test.ts`

**Interfaces:**
- Consumes: Tareas 2, 3 y 4.
- Produces: `mockApi: Api`; `setMockMode(m: 'normal' | 'slow' | 'fail' | 'partial' | 'empty' | null): void` (también legible desde `?mock=` en la URL). Los PNG se dibujan en un canvas fuera de pantalla y se entregan como `blob:` en `png_url`.

- [ ] **Step 1: Tests que fallan** (con temporizadores falsos):
```ts
const r = await mockApi.resolve({ name: "Barnard's star", at: '2026-11-14' });
expect(r.epoch).toBe(2000); expect(r.pm).not.toBeNull();
expect((r.current.dec - r.dec) * 3600).toBeGreaterThan(250);                 // la vista debe centrarse en current
await expect(mockApi.resolve({ name: 'Estrella Falsa' })).rejects.toMatchObject({ code: 'not_found' });
const s = await mockApi.sequence({ ra, dec, fov: 300, limit: 5 });
expect(s.kind).toBe('job');                                                  // primera vez: 202
const seq = await runJob(() => mockApi.sequence(p), mockApi.job, { signal });
expect(seq.frames).toHaveLength(5); expect(seq.total).toBeGreaterThan(5);
expect(seq.scale).toBe('sequence'); expect(seq.vmin).toBeLessThan(seq.vmax!); expect(seq.unit).toBe('MJy/sr');
expect((await mockApi.sequence(p)).kind).toBe('result');                     // segunda vez: caché
const sp = await runJob(() => mockApi.spectrum({ ra, dec }), mockApi.job, { signal });
expect(sp.points.every(q => q.date_obs && q.frame_id && q.detector >= 1)).toBe(true);
expect([...sp.points].sort((a, b) => a.wavelength - b.wavelength)).toEqual(sp.points);
// Review Focus 2
setMockMode('empty');
expect((await mockApi.frames({ ra, dec, fov: 300 })).total).toBe(0);
expect((await runJob(() => mockApi.sequence(p2), mockApi.job, { signal })).frames).toEqual([]);
setMockMode('fail'); await expect(runJob(() => mockApi.sequence(p3), mockApi.job, { signal })).rejects.toBeInstanceOf(ApiError);
setMockMode('partial'); expect((await mockApi.objects({ ra, dec })).partial).toBe(true);
```
- [ ] **Step 2:** Run `npm test` → FAIL.
- [ ] **Step 3:** Implementar `mockApi` (los once métodos). El id de trabajo es un hash determinista de los parámetros; el progreso avanza por etapas con textos como "Descargando frames 18/43". `stack` con `op: 'diff'` devuelve escala simétrica. En el entorno de pruebas (sin canvas) `png_url` es `blob:mock/<id>`.
- [ ] **Step 4:** Run `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: mocks de la API v0.3 en el navegador` y push.

### Task 6: Esqueleto del visor, búsqueda y estados

**Files:**
- Modify: `src/pages/ver.astro`
- Create: `src/components/viewer/TopBar.astro`, `Stage.astro`, `PlayerDock.astro`, `IconRail.astro`, `Drawer.astro`, `JobCard.astro`
- Create: `src/styles/viewer.css`, `src/data/viewer.ts` (textos), `src/scripts/viewer/main.ts`, `state.ts`, `search.ts`, `jobcard.ts`
- Test: `src/scripts/viewer/state.test.ts`

**Interfaces:**
- Produces:
```ts
// state.ts
interface ViewerState { view: ViewState; target: { ra: number; dec: number; label: string; catalog?: ResolveResponse } | null;
  phase: 'idle' | 'resolving' | 'not-found' | 'loading' | 'ready' | 'empty' | 'error';
  frames: Frame[]; total: number; seq: SequenceResult | null; idx: number; ab: [number, number];
  playing: boolean; speed: 1 | 2 | 4; panel: 'tiempo' | 'comparar' | 'imagen' | 'capas' | 'datos' | null;
  layers: { objects: boolean; gaia: boolean; wise: boolean; prediction: boolean; reticle: boolean };
  picked: SkyPoint | null; job: Job | null; error: string | null }
store: ReturnType<typeof createStore<ViewerState>>
search(query: string): Promise<void>        // nombre → resolve (centra en current); coordenadas → directo
loadSequence(): Promise<void>               // cancela la carga anterior con AbortController
```
- Distribución según el boceto de la sección 7 del spec. Cada pieza es un contenedor con `data-*` que los scripts rellenan.

- [ ] **Step 1: Test que falla** (Review Focus 3): con `mockApi` en modo `slow`, llamar `search("Barnard's star")` y, antes de que termine, `search('WISE 0855')`; al resolverse todo, `store.get().target.label` es `'WISE 0855'` y todos los `frames` pertenecen a esa región (su `center` dista menos de 1″ del `target`). Otro caso: `search('Estrella Falsa')` deja `phase: 'not-found'` con el mensaje de la API.
- [ ] **Step 2:** Run `npm test` → FAIL.
- [ ] **Step 3:** Implementar `state.ts`, `search.ts` y `main.ts` (lee la URL al cargar, escribe con `history.replaceState` en cada cambio de `view`/`target`).
- [ ] **Step 4:** Marcado y estilos: barra superior con buscador (`<form role="search">`, error junto al campo con `aria-describedby`), chip "Datos simulados" si `USE_MOCKS`, escenario a pantalla completa, paneles `.glass`. `jobcard.ts` pinta etapa, porcentaje, tiempo estimado, posición en cola y botones cancelar/reintentar dentro de una región `aria-live="polite"`.
- [ ] **Step 5:** Estados visibles: sin región, resolviendo, no encontrado, cargando (esqueleto), vacío, error con reintento.
- [ ] **Step 6:** Run `npm test` y `npm run build` → PASS. Verificar en el navegador `/ver?name=Barnard%27s%20star`, `/ver?name=xx` y `/ver?ra=133.795129&dec=-7.245147&mock=empty`.
- [ ] **Step 7:** Commit `feat: esqueleto del visor, búsqueda y estados` y push.

### Task 7: Escenario y reproductor

**Files:**
- Create: `src/scripts/viewer/stage.ts`, `overlay.ts`, `player.ts`, `shortcuts.ts`
- Modify: `src/components/viewer/Stage.astro`, `PlayerDock.astro`, `src/styles/viewer.css`
- Test: `src/scripts/viewer/player.test.ts`

**Interfaces:**
- Consumes: `store`, `skyToPixel`, `pixelToSky`, `api.objects`, `api.predict`.
- Produces: `passGroups(frames: Frame[]): number[][]` (agrupa por pasada: salto > 30 días), `nextIndex(idx: number, total: number, dir: 1 | -1): number`, `frameIntervalMs(speed: 1 | 2 | 4): number` (600, 300, 150).

- [ ] **Step 1: Test que falla:** `passGroups` separa dos pasadas con seis meses de diferencia; `nextIndex(42, 43, 1)` es `0`; `nextIndex(0, 43, -1)` es `42`; con `total = 0`, `nextIndex` devuelve `0` (Review Focus 2).
- [ ] **Step 2:** Run `npm test` → FAIL. **Step 3:** Implementar. **Step 4:** Run → PASS.
- [ ] **Step 5:** `stage.ts`: precarga las `png_url`, muestra el frame `idx` en un `<img>` cuadrado centrado que cubre el alto disponible; clic en el cielo → `picked` (vía `pixelToSky`) y abre el panel `datos`.
- [ ] **Step 6:** `overlay.ts`: capa SVG con retícula, objetos de catálogo (con nombre al pasar el puntero y al enfocar con teclado), y trayectoria predicha con un marcador en la fecha del frame actual. Usa siempre `skyToPixel` con el `size_px` de la secuencia.
- [ ] **Step 7:** `player.ts`: reproducir/pausar, velocidad, línea de tiempo como `<input type="range">` con marcas por pasada, contador "18 / 43" y fecha en mono; modo Parpadeo alterna `ab[0]` y `ab[1]`; botón "Cargar más" cuando `total > frames.length`. Con `total = 0` todos los controles quedan `disabled`. Con movimiento reducido no arranca solo.
- [ ] **Step 8:** `shortcuts.ts`: espacio, ←/→, `B`, `D`, `1`–`6`, `+`/`−`, `Esc`; inactivos cuando el foco está en un campo de texto.
- [ ] **Step 9:** Verificar en el navegador: Barnard se desplaza a lo largo de la trayectoria dibujada; WISE 0855 aparece al pasar al detector 6. `npm test` y `npm run build` en verde.
- [ ] **Step 10:** Commit `feat: escenario, capa de anotaciones y reproductor` y push.

### Task 8: Paneles Tiempo, Comparar, Imagen y Capas

**Files:**
- Create: `src/scripts/viewer/panels/tiempo.ts`, `comparar.ts`, `imagen.ts`, `capas.ts`, `src/scripts/viewer/drawer.ts`
- Modify: `src/components/viewer/Drawer.astro`, `IconRail.astro`, `src/styles/viewer.css`

**Interfaces:**
- Consumes: `store`, `api.coverage`, `api.stack`, `api.overlay`, `runJob`.
- Produces: `openPanel(id: ViewerState['panel']): void` (uno a la vez; `Esc` cierra y devuelve el foco al icono que lo abrió).

- [ ] **Step 1:** `drawer.ts` e `IconRail`: botones con `aria-expanded` y `aria-controls`; el cajón es `role="region"` con título.
- [ ] **Step 2:** *Tiempo*: histograma de `coverage.weeks`, campos de fecha `from`/`to` (si `from > to` se muestra error junto al campo y no se consulta).
- [ ] **Step 3:** *Comparar*: selección de A y B por pasada; modos Parpadeo, Resta (`op: 'diff'`, `a: [A]`, `b: [B]`) y Apilar (`op: 'mean'` con todos los frames de la pasada actual). El resultado reemplaza al frame en el escenario con una etiqueta ("Resta A − B", "Pasada apilada · N imágenes") y su tarjeta de progreso.
- [ ] **Step 4:** *Imagen*: detector (seis botones con su rango en µm, más "Todos"), campo de visión (30″–3600″ con valores rápidos 1′, 5′, 15′, 60′), contraste, color, escala de brillo compartida/por frame con una línea que explica la diferencia.
- [ ] **Step 5:** *Capas*: interruptores para objetos, Gaia, WISE, predicción y retícula; Gaia y WISE piden `overlay` con `at` igual a la fecha del frame actual; leyenda de colores.
- [ ] **Step 6:** Verificar en el navegador cada panel con teclado. `npm run build` en verde.
- [ ] **Step 7:** Commit `feat: paneles de tiempo, comparación, imagen y capas` y push.

### Task 9: Panel Datos, mini esfera, compartir y móvil

**Files:**
- Create: `src/scripts/viewer/panels/datos.ts`, `src/scripts/viewer/chart.ts`, `globe.ts`, `share.ts`, `src/data/bands.ts`
- Modify: `src/pages/ver.astro`, `src/styles/viewer.css`
- Test: `src/scripts/viewer/chart.test.ts`

**Interfaces:**
- Produces: `scaleLinear(domain: [number, number], range: [number, number]): (v: number) => number`; `lightCurve(points: SpectrumResponse['points'], det: Detector): { t: number; flux: number }[]` (filtra por detector y ordena por fecha); `BANDS: { det: Detector; from: number; to: number; title: string; reveals: string }[]` con los seis textos de la tabla del spec (sección 6, capítulo 09).

- [ ] **Step 1: Test que falla:** `lightCurve` devuelve solo puntos del detector pedido, en orden de fecha creciente; con lista vacía devuelve `[]`; `scaleLinear([0, 10], [0, 100])(5)` es `50` y con dominio de ancho cero devuelve el punto medio del rango.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implementar. **Step 4:** Run → PASS.
- [ ] **Step 5:** *Datos*: espectro del punto elegido (SVG, eje en µm de 0.75 a 5, coloreado con la rampa de bandas, barras de error, tabla alternativa accesible), curva de luz, metadatos del frame, banderas como chips (cualquier valor desconocido se muestra tal cual), lista de objetos, leyenda `BANDS`. El espectro llega por trabajo: usa la tarjeta de progreso.
- [ ] **Step 6:** `globe.ts`: esfera en canvas 2D (proyección ortográfica, cuadrícula cada 30° en RA y dec, punto en la posición actual), 120 px, con texto alternativo "Posición en el cielo: RA …, Dec …".
- [ ] **Step 7:** `share.ts`: copiar enlace y copiar `<iframe>` con `embed=1`; aviso breve en `role="status"`. Con `embed=1` solo se muestran escenario y reproductor.
- [ ] **Step 8:** Móvil (< 768 px): el cajón es una hoja inferior con alturas 40 % y 85 %; la barra de iconos pasa al reproductor; la mini esfera se oculta.
- [ ] **Step 9:** Aviso de fuentes caídas: si `api.status()` devuelve `degraded` o `down`, banda discreta bajo la barra superior con las fuentes afectadas. Respuestas con `partial: true` muestran sus `warnings` en el panel correspondiente.
- [ ] **Step 10:** `npm test` y `npm run build` en verde; revisar 375, 768, 1024 y 1440 px.
- [ ] **Step 11:** Commit `feat: datos, espectro, curva de luz, esfera y modo incrustado` y push.

### Task 10: La historia en `/` (contenido y maquetación)

**Files:**
- Create: `src/data/story.ts`, `src/data/targets.ts`
- Create: `src/components/story/Chapter.astro`, `Hero.astro`, `Pluto.astro`, `Motion.astro`, `Telescope.astro`, `Problem.astro`, `Infrared.astro`, `PlanetX.astro`, `MiniGame.astro`, `Targets.astro`, `Bands.astro`, `Credits.astro`, `ProgressRail.astro`, `SkyCanvas.astro`
- Create: `src/styles/story.css`
- Modify: `src/pages/index.astro`

**Interfaces:**
- Produces: `STORY: { id: string; kicker: string; title: string; body: string[]; illustration?: { src: string; alt: string } }[]` con los once capítulos de la tabla del spec (ids `portada`, `pluton`, `movimiento`, `telescopio`, `problema`, `infrarrojo`, `planeta-x`, `reto`, `objetivos`, `colores`, `creditos`); `TARGET_CARDS: { name: string; label: string; blurb: string; href: string }[]` (cinco, con `href` a `/ver?name=…`); `Chapter.astro` con props `{ id; kicker; title; illustration? }` y `<slot />`; `SkyCanvas.astro` con atributos `data-target`, `data-fov`, `data-det` que un script rellena con cielo simulado.

- [ ] **Step 1:** Escribir `story.ts` y `targets.ts`. Textos breves (dos párrafos por capítulo como máximo), sin jerga, con los datos del reto: mayo de 2025, todo el cielo cada seis meses, 102 bandas, 0.75–5 µm, seis detectores, más de mil millones de objetos, Plutón en 1930.
- [ ] **Step 2:** Maquetar los capítulos: cada uno ocupa al menos `100svh`, título enorme (`clamp(3rem, 11vw, 9rem)`), texto en columna de 46 caracteres máximo, ilustración a sangre con degradado para legibilidad y etiqueta "Ilustración". Sin imágenes todavía: fondo de degradado (las ilustraciones llegan en la Tarea 12).
- [ ] **Step 3:** `Bands.astro` usa `BANDS`: franja horizontal con la rampa de color dividida en seis tramos; cada tramo es un botón que muestra qué revela. `Targets.astro`: cinco tarjetas con vista previa de cielo simulado y el buscador debajo. `Credits.astro`: fuentes de datos, aviso de datos simulados y enlace al reto.
- [ ] **Step 4:** `ProgressRail.astro`: lista de enlaces a cada capítulo, fija a la derecha en escritorio, oculta en móvil.
- [ ] **Step 5:** Verificar con JavaScript desactivado: la historia completa se lee en orden y todos los enlaces funcionan. `npm run build` en verde.
- [ ] **Step 6:** Commit `feat: historia de la portada en once capítulos` y push.

### Task 11: Movimiento e interacción de la historia

**Files:**
- Create: `src/scripts/story/motion.ts`, `blink.ts`, `minigame.ts`, `sky.ts`
- Modify: `src/pages/index.astro`, `src/styles/story.css`
- Test: `src/scripts/story/minigame.test.ts`

**Interfaces:**
- Produces: `hitTest(click: { x: number; y: number }, mover: { x: number; y: number }, radiusPx: number): boolean`; `startBlink(el: HTMLElement, opts: { intervalMs: number }): () => void` (devuelve la función para detenerlo).

- [ ] **Step 1: Test que falla:** `hitTest` acepta un clic a 20 px con radio 24 y rechaza uno a 30 px.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implementar. **Step 4:** Run → PASS.
- [ ] **Step 5:** `sky.ts` rellena cada `SkyCanvas` usando `simulate` y `toRGBA` de los mocks. `blink.ts`: portada y capítulo de Plutón alternan dos imágenes cada 700 ms; el capítulo de Plutón tiene además un botón "Alternar placas" para hacerlo a mano; se detiene fuera de pantalla.
- [ ] **Step 6:** `minigame.ts`: campo que parpadea, el usuario hace clic o usa Tab/Enter sobre candidatos enfocables; al acertar muestra qué objeto era y un enlace al visor; tras tres fallos resalta el punto.
- [ ] **Step 7:** `motion.ts` siguiendo el patrón de `../../yud-tattos-web/src/scripts/motion.ts`: Lenis sincronizado con ScrollTrigger, títulos con SplitText por líneas, ilustraciones con paralaje suave, franja de bandas que se dibuja al entrar, contador del capítulo "problema", riel de progreso sincronizado. Todo dentro de `gsap.matchMedia('(prefers-reduced-motion: no-preference)')`; en modo reducido se muestra el estado final.
- [ ] **Step 8:** Verificar en el navegador con y sin movimiento reducido, y en 375 px. `npm test` y `npm run build` en verde.
- [ ] **Step 9:** Commit `feat: movimiento e interacción de la historia` y push.

### Task 12: Ilustraciones de Google Flow

**Files:**
- Create: `src/assets/img/portada.*`, `comparador-1930.*`, `telescopio.*`, `enana-marron.*`, `planeta-x.*`, `objetivos.*`, `docs/ilustraciones.md` (prompts usados)
- Modify: `src/data/story.ts`

Requiere al usuario: se generan en su cuenta de Google Flow desde el navegador y **cada descarga se confirma con él antes de hacerla**.

- [ ] **Step 1:** Escribir en `docs/ilustraciones.md` un prompt por imagen. Estilo común: ilustración cinematográfica, fondo casi negro, paleta de brasas naranjas y violeta profundo, sin texto ni logotipos, formato 16:9, espacio vacío a la izquierda para el título. Temas: (1) campo de estrellas con un punto destacado; (2) comparador de placas fotográficas en un observatorio de 1930; (3) telescopio espacial con escudos cónicos sobre la Tierra; (4) enana marrón fría de bandas oscuras; (5) planeta helado lejano con el Sol como una estrella más; (6) horizonte de cielo estrellado.
- [ ] **Step 2:** Mostrar los prompts al usuario y esperar su visto bueno.
- [ ] **Step 3:** Generar en Flow, elegir con el usuario y descargar (confirmando nombre de archivo, origen y tamaño de cada una).
- [ ] **Step 4:** Añadir `illustration` a cada capítulo con texto alternativo descriptivo; usar `<Image>` de `astro:assets` (AVIF/WebP, `loading="lazy"` excepto la portada). La etiqueta "Ilustración" queda visible en cada una.
- [ ] **Step 5:** `npm run build` en verde; la portada pesa menos de 400 kB en imágenes.
- [ ] **Step 6:** Commit `feat: ilustraciones de la historia` y push.

Si alguna imagen no convence, el capítulo conserva su fondo de degradado: esta tarea no bloquea la entrega.

### Task 13: Revisión final

**Files:**
- Modify: `README.md`

- [ ] **Step 1:** Recorrer los cinco objetos de prueba en `/ver` y confirmar: Barnard, Epsilon Indi B y WISE 0855 se desplazan; RW Aurigae y R Draconis cambian de brillo; WISE 0855 solo se ve en los últimos detectores.
- [ ] **Step 2:** Recorrer los modos de mock `slow`, `fail`, `partial` y `empty` y confirmar que cada estado tiene mensaje y salida.
- [ ] **Step 3:** Navegar ambas páginas solo con teclado; revisar contraste y foco; probar movimiento reducido.
- [ ] **Step 4:** Revisar 375, 768, 1024 y 1440 px sin scroll horizontal.
- [ ] **Step 5:** `README.md`: qué es, comandos, estructura, cómo pasar de mocks a la API real (`PUBLIC_USE_MOCKS=false`, `PUBLIC_API_BASE`), dónde editar los textos.
- [ ] **Step 6:** `npm test` y `npm run build` en verde. Commit `docs: README y revisión final` y push.
