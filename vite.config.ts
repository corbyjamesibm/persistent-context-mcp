import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/components': resolve(__dirname, './src/ui/components'),
      '@/pages': resolve(__dirname, './src/ui/pages'),
      '@/hooks': resolve(__dirname, './src/ui/hooks'),
      '@/types': resolve(__dirname, './src/types'),
      '@/utils': resolve(__dirname, './src/utils'),
      '@/api': resolve(__dirname, './src/api'),
      '@/core': resolve(__dirname, './src/core'),
    },
  },
  build: {
    outDir: 'dist/ui',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "@carbon/react/scss/config" with ($prefix: "cds");`,
      },
    },
  },
})