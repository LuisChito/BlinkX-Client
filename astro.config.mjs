// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';

// DATA (en .env): true → el visor consulta la API (IRSA/NASA en vivo); false → solo datos locales
// (public/backup y public/local-data), sin ninguna petición a la API. Por defecto: true.
const proc = /** @type {any} */ (globalThis).process;
const env = loadEnv(proc.env.NODE_ENV === 'production' ? 'production' : 'development', proc.cwd(), '');
const DATA = String(env.DATA ?? env.PUBLIC_DATA ?? 'true').trim().toLowerCase() !== 'false';

// Cambia `site` al dominio definitivo cuando se despliegue.
export default defineConfig({
  site: 'https://blinkx.example',
  trailingSlash: 'ignore',
  build: { inlineStylesheets: 'auto' },
  prefetch: false,
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    define: { __BX_LIVE_DATA__: JSON.stringify(DATA) },
  },
});
