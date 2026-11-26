import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: new URL('.', import.meta.url).pathname,
  // Relative asset paths, so the build works under any subpath, such as GitHub Pages.
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
  plugins: [react()],
});
