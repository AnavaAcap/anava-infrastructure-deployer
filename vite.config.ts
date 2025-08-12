import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Custom plugin to ensure script is in body
const moveScriptToBody = () => {
  return {
    name: 'move-script-to-body',
    transformIndexHtml(html) {
      // Find all script tags with type="module"
      const scriptRegex = /<script[^>]*type="module"[^>]*><\/script>/g;
      const scripts = html.match(scriptRegex) || [];
      
      // Remove scripts from head
      scripts.forEach(script => {
        html = html.replace(script, '');
      });
      
      // Add scripts before closing body tag
      if (scripts.length > 0) {
        html = html.replace('</body>', scripts.join('\n') + '\n</body>');
      }
      
      return html;
    },
  };
};

export default defineConfig({
  root: path.resolve(__dirname, './src/renderer'),
  plugins: [react(), moveScriptToBody()],
  base: './',
  server: {
    port: 5173,
  },
  build: {
    outDir: path.resolve(__dirname, './dist/renderer'),
    emptyOutDir: true,
    // TEMPORARILY DISABLE MINIFICATION to test if it's breaking Firebase
    minify: false, // was 'esbuild'
    // Remove manual chunking that's causing issues
    // Increase chunk size warning limit since we're bundling for Electron
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        // Ensure script tags are injected correctly
        inlineDynamicImports: false,
      },
      // Ensure the script is placed in body
      plugins: [],
    },
  },
  optimizeDeps: {
    // Pre-bundle heavy dependencies
    include: [
      'react', 
      'react-dom', 
      '@mui/material',
      'firebase/app',
      'firebase/auth',
      'firebase/firestore',
      'firebase/storage'
    ],
    // Exclude electron-specific modules
    exclude: ['electron'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@renderer': path.resolve(__dirname, './src/renderer'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@types': path.resolve(__dirname, './src/types'),
      // Fix for Firebase package resolution
      'firebase': path.resolve(__dirname, 'node_modules/firebase'),
    },
  },
})