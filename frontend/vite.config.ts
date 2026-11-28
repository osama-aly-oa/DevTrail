import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const proxy = {
  '/api': { target: 'http://127.0.0.1:' + (process.env.DEVTRAIL_API_PORT ?? '3000') },
};

export default defineConfig({
  plugins: [react(), tailwind()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy,
  },
  preview: { host: '127.0.0.1', port: 5173, strictPort: true, proxy },
});
