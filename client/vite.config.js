/**
 * client/vite.config.js — Vite Build & Dev Server Configuration
 *
 * The important piece here is the `proxy` setting:
 * Any request from the React app to /api/* is transparently forwarded
 * to the Express backend at localhost:3001.
 *
 * This means in development, both servers run independently but the
 * frontend just calls `/api/jobs` as if it's on the same server.
 * In production you'd configure nginx or a reverse proxy instead.
 *
 * Brandon: Vite's dev server is much faster than webpack/CRA because
 * it uses ES modules natively and only transpiles what's requested.
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    proxy: {
      // Proxy all /api/* requests to the Express backend
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
