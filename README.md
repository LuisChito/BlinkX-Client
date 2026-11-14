# Blink X

Herramienta web para ver cómo cambia el cielo en las imágenes infrarrojas de SPHEREx y encontrar lo que se mueve.
Reto **Planet X and SPHEREx**, NASA Space Apps Challenge 2026.

- `/` cuenta la historia del problema en once capítulos.
- `/ver` es el visor: escribe un nombre o unas coordenadas y reproduce las imágenes de esa región como un video.

El nombre viene del *blink comparator*, el aparato con el que se descubrió Plutón en 1930 alternando dos placas fotográficas.

## Comandos

```bash
npm install        # instalar dependencias
npm run dev        # servidor local en http://localhost:4321
npm test           # pruebas (Vitest)
npm run build      # genera el sitio en /dist
npm run preview    # sirve /dist para probar la versión final
```

Requiere Node 22 o superior.

## Datos simulados y API real

Por ahora todo funciona con **datos simulados**: un módulo dentro del navegador responde igual que la API
(contrato `openapi.yaml` v0.3) y dibuja el cielo por código. Los movimientos y brillos de los cinco objetos de
prueba siguen sus valores reales aproximados; nada se exagera.

Para conectar la API real, crea un archivo `.env` (hay un ejemplo en `.env.example`):

```bash
PUBLIC_USE_MOCKS=false
PUBLIC_API_BASE=https://tu-backend.example
```

Con los datos simulados puedes forzar situaciones añadiendo `?mock=` a la URL del visor:
`slow` (todo tarda), `fail` (los trabajos fallan), `partial` (una fuente no responde) y `empty` (región sin imágenes).

## Usar el visor

| Acción | Cómo |
|---|---|
| Buscar | Nombre (`WISE 0855`) o coordenadas (`133.795 -7.245`, `08h55m10.8s -07d14m42s`) |
| Reproducir / pausar | Botón ▶ o barra espaciadora |
| Imagen anterior / siguiente | ← / → |
| Parpadeo A/B | Botón o tecla `B` |
| Resta A − B | Botón o tecla `D` (lo nuevo queda ámbar; lo que ya no está, cian) |
| Cambiar de detector | Teclas `1` a `6` o panel Imagen |
| Campo de visión | `+` acerca, `-` aleja, o panel Imagen |
| Espectro y curva de luz | Clic en un punto de la imagen (panel Datos) |
| Compartir | El enlace de la barra de direcciones guarda la vista. `&embed=1` la deja lista para incrustar |

## Estructura

```
src/
  pages/              index.astro (historia) y ver.astro (visor)
  data/               todos los textos: story.ts, viewer.ts, targets.ts, bands.ts, illustrations.ts
  components/         Nav, Footer, Icon y los bloques de la historia
  scripts/story/      movimiento (GSAP + Lenis), parpadeo y mini reto
  scripts/viewer/     estado, escenario, reproductor, cajón y paneles
  lib/                coordenadas, proyección cielo→píxel, URL, trabajos, almacén
  lib/api/            tipos del contrato, cliente real y mocks (lib/api/mock)
  styles/             global.css (sistema visual), story.css, viewer.css
docs/                 diseño, plan e ilustraciones
```

## Editar contenido

- **Textos de la historia:** `src/data/story.ts`.
- **Textos del visor:** `src/data/viewer.ts`.
- **Qué revela cada detector:** `src/data/bands.ts` (borrador: verificar con la documentación de SPHEREx).
- **Ilustraciones:** guarda la imagen en `src/assets/img/` y regístrala en `src/data/illustrations.ts`.
  Todas se muestran con la etiqueta «Ilustración». Los prompts están en `docs/ilustraciones.md`.

## Reglas del proyecto

- En el visor solo hay datos de SPHEREx (o simulados y marcados como tales). Nada decorativo se presenta como dato.
- El frontend nunca construye una `png_url`: usa la que devuelve la API.
- Todo funciona con teclado y respeta «reducir movimiento».
