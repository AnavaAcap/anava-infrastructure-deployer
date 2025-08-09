import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  root: path.resolve(__dirname, './src/renderer'),
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
  },
  build: {
    outDir: path.resolve(__dirname, './dist/renderer'),
    emptyOutDir: true,
    // Use esbuild for faster builds (default in Vite)
    minify: 'esbuild',
    // Remove manual chunking that's causing issues
    // Increase chunk size warning limit since we're bundling for Electron
    chunkSizeWarningLimit: 2000,
  },
  optimizeDeps: {
    // Pre-bundle heavy dependencies
    include: ['react', 'react-dom', '@mui/material', 'firebase'],
    // Exclude electron-specific modules
    exclude: ['electron'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@renderer': path.resolve(__dirname, './src/renderer'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@types': path.resolve(__dirname, './src/types'),
    },
  },
})