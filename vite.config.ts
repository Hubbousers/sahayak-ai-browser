import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@content': resolve(__dirname, 'src/content'),
      '@background': resolve(__dirname, 'src/background'),
      '@panel': resolve(__dirname, 'src/panel'),
      '@tools': resolve(__dirname, 'src/tools')
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        panel: resolve(__dirname, 'panel/index.html'),
        service_worker: resolve(__dirname, 'src/background/service_worker.ts'),
        content_script: resolve(__dirname, 'src/content/content_script.ts')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'service_worker') {
            return 'src/background/service_worker.js';
          }
          if (chunkInfo.name === 'content_script') {
            return 'src/content/content_script.js';
          }
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: () => 'assets/[name]-[hash][extname]'
      }
    }
  }
});
