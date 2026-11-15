// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// Cambia `site` al dominio definitivo cuando se despliegue.
export default defineConfig({
  site: 'https://blinkx.example',
  trailingSlash: 'ignore',
  build: { inlineStylesheets: 'auto' },
  prefetch: false,
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
