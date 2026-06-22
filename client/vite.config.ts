import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // 构建产物输出到 server/public，方便生产环境由 Express 托管
    outDir: path.resolve(__dirname, '../server/public'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      // 开发时把 /api 代理到后端，避免跨域
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
