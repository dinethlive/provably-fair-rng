import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// On GitHub Pages, the site is served from `/provably-fair-rng/` rather than `/`.
// Set BASE_PATH in CI to make Vite emit asset URLs with that prefix.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  server: { port: 5173, host: true },
  build: { sourcemap: true, target: 'es2022' },
});
