// @ts-check
import { defineConfig } from 'astro/config';

// Cambia `site` al dominio definitivo cuando se despliegue.
export default defineConfig({
  site: 'https://blinkx.example',
  trailingSlash: 'ignore',
  build: { inlineStylesheets: 'auto' },
  prefetch: false,
});
