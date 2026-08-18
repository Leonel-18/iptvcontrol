import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * Configuración de Vite.
 *
 * Sin Next.js a propósito: es un panel administrativo interno, no necesita SSR
 * ni SEO (docs/01_Instrucciones_del_Proyecto.md → stack).
 *
 * El proxy de `/api` evita problemas de CORS en desarrollo: el frontend llama a
 * rutas relativas y Vite las reenvía al backend NestJS.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Se separan las dependencias grandes que casi no cambian, para que un
        // deploy del panel no invalide todo el cache del navegador.
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
          auth: ['@auth0/auth0-react'],
          ui: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            'lucide-react',
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
