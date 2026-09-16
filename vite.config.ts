import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';
export default defineConfig({
  plugins: [reactRouter()],
  build: { sourcemap: false, target: 'es2022' },
  server: { host: '127.0.0.1', port: 4410 },
});
