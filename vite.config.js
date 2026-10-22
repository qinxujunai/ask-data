import { defineConfig } from 'vite';

// Relative paths, so the same build works at any address (GitHub Pages serves it under /ask-data/).
export default defineConfig({
  base: './',
  worker: { format: 'es' },
  build: { target: 'es2022', assetsInlineLimit: 0 },
});
