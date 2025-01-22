import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solidPlugin()],
  server: {
    port: 3000,
    proxy: {
      '/api/mojang': {
        target: 'https://api.mojang.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/mojang/, ''),
      },
      '/api/session': {
        target: 'https://sessionserver.mojang.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/session/, ''),
      }
    }
  },
  build: {
    target: 'esnext',
  },
});
