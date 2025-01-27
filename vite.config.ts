import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solidPlugin()],
  server: {
    host: "0.0.0.0",
    port: 8082,
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
    },
    allowedHosts: ["scarlettparker.co.uk"],
  },
  preview: {
    host: "0.0.0.0",
    port: 8082,
    allowedHosts: ["scarlettparker.co.uk"]
  },
  build: {
    target: 'esnext',
  },
});
