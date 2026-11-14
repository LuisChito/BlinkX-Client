# Blink X · diseño del frontend

Fecha: 2026-11-14 · Reto: NASA Space Apps 2026, "Planet X and SPHEREx"

## 1. Qué es y por qué

Blink X es una herramienta web pública para ver cómo cambia un pedazo de cielo en las imágenes
infrarrojas de SPHEREx. El usuario da unas coordenadas (o un nombre) y ve una serie de imágenes
como un video corto; lo que se mueve o cambia de brillo salta a la vista.

El nombre viene del *blink comparator*, el aparato con el que se descubrió Plutón en 1930
alternando dos placas fotográficas.

Este frontend reemplaza al anterior (`NASA/SpaceX/web`). Se rehace para que la portada cuente bien
la historia del problema y para que la interfaz sea más cuidada. Mientras Backend termina la API,
todo funciona con datos simulados.

## 2. Metas, no-metas y anti-metas

**Metas**
- `/` cuenta la historia del problema a alguien que no sabe astronomía, y lo deja listo para usar el visor.
- `/ver` cumple el objetivo del reto y sus consideraciones: video de la región, campo de visión
  elegible, suma por detector, sumar/restar fechas, espectro al vuelo, capas Gaia/WISE, banderas de
  contaminación, coordenadas en la URL e incrustable.
- Funciona con los cinco objetos de prueba: Estrella de Barnard, Epsilon Indi B, WISE 0855,
  RW Aurigae y R Draconis.
- Cambiar de mocks a API real es cambiar una variable de entorno.

**No-metas**
- Conectar la API real (el cliente queda listo; la integración se prueba cuando exista Backend).
- Versión en inglés (los textos viven en archivos de datos para poder traducir después).
- Cuentas de usuario, guardar descubrimientos, bloque de "AI Insights".

**Anti-metas** (harían fracasar el proyecto aunque funcione)
- Mostrar como dato de SPHEREx algo que no lo es. No hay galaxias decorativas ni capas de otros
  telescopios en el visor. Toda imagen generada lleva la etiqueta "Ilustración"; todo cielo
  simulado lleva "Datos simulados".
- Que la historia sea ilegible sin animaciones (movimiento reducido, móvil, JS lento).
- Que un panel tape el objeto que el usuario está mirando.

## 3. Restricciones

- **Stack** (decidido por el usuario; igual que `yud-tattos-web`): Astro 7, GSAP (ScrollTrigger,
  SplitText, Flip), Lenis, fuentes Fontsource, CSS propio con variables, scripts TypeScript.
  Sin framework de componentes y sin Tailwind. Sitio estático.
- **Contrato**: `openapi.yaml` v0.3 (`NASA/SpaceX/openapi.yaml`, publicado en
  https://claude.ai/artifact/FFHijhpU8k1CVeFW1gmPTm). Es la única fuente de verdad de la API.
- **Ubicación**: `NASA/BlinkX-client`.
- **Plazo**: hackathon del 14 y 15 de noviembre de 2026.
- **Idioma**: español (decisión mía; pendiente de confirmar).

## 4. Enfoques considerados

| Tema | Elegido | Descartado y por qué |
|---|---|---|
| Mocks | Módulo en el navegador con la misma interfaz que el cliente real; dibuja el cielo en canvas y entrega `blob:` URLs | Servidor de mocks aparte: dos despliegues. Service worker: frágil de depurar con poco tiempo |
| Lógica base | Portar de `SpaceX/web/src/lib` (coordenadas, URL, trabajos, generador de cielo y sus tests) y adaptar a v0.3 | Reescribir todo: gasta horas en código que ya está probado |
| Visor | TypeScript puro con un almacén de estado pequeño (suscripciones) y módulos por panel | Añadir Preact: contradice el stack pedido |
| Dirección visual | "Cine" en `/`, misma paleta con paneles de vidrio en `/ver` (elegido por el usuario en maquetas) | "Placa de observatorio" e "Instrumento infrarrojo": vistas y no elegidas |
| Distribución del visor | Escenario a pantalla completa (opción B) | Panel lateral con pestañas (opción A): la imagen ocupa menos |

Las decisiones de mocks, lógica base y visor en TS son mías; el usuario delegó el "cómo" fuera del stack.

## 5. Sistema visual

Solo modo oscuro.

- **Color**: fondo `#050304`; superficie `#0e0a0b`; vidrio `rgb(14 10 11 / .82)` con desenfoque y
  borde `rgb(255 255 255 / .14)`; texto `#f6f1ee`; texto secundario `#b9a8a3` (≥ 7:1);
  acento "lo que se mueve" `#ff8a5c` (retícula, trayectoria, control activo);
  rampa infrarroja para las bandas `#3b1d6e → #7b1f5c → #c2402f → #e9a23b`;
  capas: Gaia `#6fd3ff`, WISE `#9fe0ad`; error `#ff6b6b`.
  El acento nunca se usa como único indicador: siempre va con forma o texto.
- **Tipografía**: Archivo Variable (títulos: condensada, 800, mayúsculas; cuerpo: ancho normal, 400)
  y JetBrains Mono para coordenadas, fechas y cifras (números tabulares).
- **Firma**: el punto que parpadea entre dos posiciones. Aparece en la portada, en el logotipo y como
  indicador de carga.
- **Movimiento**: GSAP + Lenis solo en `/`. En `/ver` no hay scroll suave; las transiciones son de
  150–250 ms. Con `prefers-reduced-motion` todo se muestra en su estado final y el video no
  arranca solo.
- **Accesibilidad**: contraste AA, foco visible, objetivos táctiles ≥ 44 px, enlace "saltar al
  contenido", todo operable con teclado, textos alternativos, regiones `aria-live` para el progreso.
- **Iconos**: SVG propios en un componente `Icon.astro`; sin emoji.

## 6. Página `/` — la historia

Capítulos a pantalla completa que avanzan con el scroll. Barra de progreso lateral con los
capítulos. El orden del DOM es el orden de lectura.

| # | Capítulo | Contenido | Imagen |
|---|---|---|---|
| 00 | Algo se movió | Portada: dos imágenes parpadean, un punto salta. "Mil millones de objetos. Nadie puede revisarlos solo." Botones: empezar la historia / ir al visor | Cielo simulado + fondo Flow |
| 01 | Así se encontró Plutón | Tombaugh, 1930. El lector alterna dos placas con un botón | Ilustración Flow + animación |
| 02 | Lo que está cerca, se mueve | Asteroides, cometas, estrellas vecinas, el movimiento de la Tierra | Diagrama animado |
| 03 | El cielo en 102 colores | SPHEREx: todo el cielo cada seis meses, 0.75–5 µm, seis detectores | Ilustración Flow + franja de bandas |
| 04 | Demasiado cielo para una sola persona | Mosaico de recortes y contador | Animación |
| 05 | Mundos que solo brillan en infrarrojo | WISE 0855 a través de los seis detectores | Ilustración Flow + cielo simulado |
| 06 | ¿Y si hay algo más allá afuera? | El Planeta X y por qué hacen falta muchos ojos | Ilustración Flow |
| 07 | Encuentra el que se mueve | Mini reto: clic en el punto que salta; al acertar se revela qué era | Cielo simulado |
| 08 | Cinco lugares para empezar | Tarjetas de los cinco objetos de prueba + buscador | Cielo simulado |
| 09 | Qué significa cada color | Qué revela cada detector (ver abajo). Se reutiliza como leyenda en el visor | Franja de bandas |
| 10 | De dónde vienen los datos | SPHEREx (IRSA), SIMBAD, NED, Gaia, WISE; versión de datos; aviso de datos simulados; equipo | — |

**Capítulo 09, contenido por detector** (el equipo debe verificar los textos con la documentación de SPHEREx):

| Detector | Rango (µm) | Qué se ve |
|---|---|---|
| 1 | 0.75–1.09 | Luz de estrellas frías y rojas |
| 2 | 1.10–1.62 | Donde más brillan la mayoría de las estrellas; vapor de agua en enanas marrones |
| 3 | 1.63–2.41 | Agua, metano y monóxido de carbono en atmósferas frías |
| 4 | 2.42–3.82 | Hielo de agua (≈ 3 µm) y moléculas orgánicas (≈ 3.3 µm) |
| 5 | 3.83–4.41 | Hielo de dióxido de carbono (≈ 4.27 µm) |
| 6 | 4.42–5.00 | Hielo de monóxido de carbono (≈ 4.67 µm); donde más brillan las enanas marrones más frías |

**Ilustraciones de Flow** (seis): fondo de portada, comparador de placas de 1930, telescopio SPHEREx,
enana marrón, Planeta X, fondo de la sección de objetivos. Todas con etiqueta visible "Ilustración".
Si una ilustración no queda bien, el capítulo usa un fondo de gradiente y cielo simulado; ninguna
es bloqueante. Se guardan en `src/assets/img/` y Astro las convierte a AVIF/WebP.

## 7. Página `/ver` — el visor

Distribución: el cielo llena la pantalla; encima flotan paneles de vidrio.

```
┌────────────────────────────────────────────────────────────────────────┐
│ BLINK X   [ buscador: nombre o RA Dec ]            Compartir  Incrustar │
├────────────────────────────────────────────────────────────────────────┤
│ ◷  ESTRELLA DE ALTO MOVIMIENTO                        ┌──────────────┐ │
│ ⇄  Estrella de Barnard                                │ Cajón        │ │
│ ◐  RA 17h57m48.5s  Dec +04°41′36″ · posición 2026.9   │ (espectro,   │ │
│ ≋                                                     │ curva de luz,│ │
│ ⓘ                    ⊕ ← retícula y trayectoria       │ metadatos,   │ │
│ ◯ mini esfera                                         │ banderas)    │ │
│ ┌───────────────────────────────────────────────────┐ └──────────────┘ │
│ │ ▶  2×  ━━━━━━━●────────────  18 / 43 · 12 nov 2025 │                  │
│ │ Video · Parpadeo A/B · Resta · Apilar    Det 3 · 5′ · Capas           │
│ └───────────────────────────────────────────────────┘                  │
└────────────────────────────────────────────────────────────────────────┘
```

**Piezas**

- **Barra superior**: marca, buscador (acepta nombre, grados decimales o sexagesimal), compartir
  enlace, copiar código para incrustar, chip "Datos simulados".
- **Encabezado del objeto**: tipo, nombre, RA/Dec. Si el objeto tiene movimiento propio, la vista se
  centra en `current` de `/api/resolve` y se indica "posición propagada a <fecha>".
- **Escenario**: frames PNG alineados (norte arriba), con una capa SVG encima para retícula, objetos
  de catálogo, fuentes Gaia/WISE y la trayectoria predicha. Las coordenadas se pasan a píxeles con
  la fórmula del contrato. Clic en el cielo = elegir punto para el espectro.
- **Barra inferior (reproductor)**: reproducir/pausar, velocidad, línea de tiempo con marcas por
  pasada e histograma de cobertura, contador y fecha. Modos: Video, Parpadeo A/B, Resta (A − B),
  Apilar (pasada completa). Atajos: detector, campo de visión, capas. "Cargar más" cuando
  `total > limit`.
- **Barra de iconos (izquierda)**: abre un panel a la vez en el cajón derecho:
  - *Tiempo*: rango de fechas y cobertura por semana.
  - *Comparar*: elegir A y B, parpadeo o resta.
  - *Imagen*: detector, campo de visión, tamaño, contraste (`stretch`), color (`cmap`), escala de
    brillo compartida o por frame.
  - *Capas*: objetos SIMBAD/NED, Gaia, WISE, predicción, retícula.
  - *Datos*: espectro del punto elegido, curva de luz (los mismos puntos ordenados por fecha),
    metadatos del frame, banderas de contaminación, lista de objetos, leyenda de colores.
- **Mini esfera**: globo pequeño con cuadrícula RA/Dec y un punto donde se está mirando (canvas 2D).
- **Tarjeta de progreso**: para secuencia, apilado, predicción y espectro (patrón 202 + trabajo):
  etapa, porcentaje, tiempo estimado, posición en cola, cancelar/reintentar.

**Estados**: sin región, resolviendo nombre, nombre no encontrado, cargando (esqueletos), trabajo en
curso, trabajo fallido, sin cobertura en esa región, respuesta parcial (`partial: true` con sus
`warnings`), límite de peticiones (429), fuente caída (`/api/status`).

**URL**: todo el estado visible va en la query (`ra`, `dec`, `name`, `fov`, `det`, `from`, `to`,
`mode`, `stretch`, `cmap`, `scale`). `?embed=1` muestra solo el escenario y el reproductor.

**Teclado**: espacio = reproducir/pausar; ←/→ = frame anterior/siguiente; `B` = parpadeo;
`D` = resta; `1`–`6` = detector; `+`/`−` = campo de visión; `Esc` = cerrar cajón.

**Móvil**: el cajón pasa a ser una hoja inferior deslizable; la barra de iconos se integra en el
reproductor; la mini esfera se oculta.

## 8. Datos y API

- `src/lib/api/types.ts`: tipos escritos a mano a partir del contrato v0.3.
- `src/lib/api/client.ts`: cliente `fetch` real. `src/lib/api/mock/`: mismo interfaz, datos simulados.
  `PUBLIC_USE_MOCKS` (por defecto `true`) elige cuál; `PUBLIC_API_URL` apunta a Backend.
- Los mocks respetan el contrato: trabajos con 202 y progreso, `png_url` opaca, `current` en resolve,
  `vmin`/`vmax` compartidos, paginación, puntos de espectro con fecha, banderas como texto libre,
  respuestas parciales y errores simulables.
- Los cinco objetos de prueba se comportan como deben: Barnard y Epsilon Indi B y WISE 0855 se
  desplazan; RW Aurigae y R Draconis cambian de brillo; WISE 0855 solo aparece en los últimos detectores.
- El Frontend nunca construye una `png_url`: usa la que llega.

## 9. Estructura del proyecto

```
src/
  pages/index.astro, ver.astro
  layouts/Base.astro
  components/story/   un archivo .astro por capítulo
  components/viewer/  marcado estático del visor
  components/Icon.astro, Nav.astro, Footer.astro
  data/story.ts, targets.ts, bands.ts     ← todos los textos
  scripts/story/      motion.ts, blink.ts, minigame.ts
  scripts/viewer/     store.ts, stage.ts, player.ts, panels/*.ts, globe.ts, shortcuts.ts
  lib/                coords.ts, url.ts, jobs.ts, projection.ts, api/
  styles/global.css, viewer.css
  assets/img/         ilustraciones
```

## 10. Pruebas

Vitest para `lib/` (coordenadas, URL, trabajos, proyección cielo→píxel, manejadores de mocks contra
los tipos del contrato). La interfaz se verifica en el navegador en 375, 768, 1024 y 1440 px, con
teclado y con movimiento reducido.

## 11. Lo que queda a quien construye

Textos finales de cada capítulo, coreografía exacta de las animaciones, trazo de los iconos,
proporciones de los paneles y los prompts de las ilustraciones.

## 12. Pendiente de confirmar por el usuario

1. Idioma: español.
2. Lista de seis ilustraciones de Flow (sección 6).
3. Git: la carpeta no es un repositorio; ¿se inicializa uno?
