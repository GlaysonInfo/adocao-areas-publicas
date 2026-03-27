import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunk - React and core dependencies
          vendor: ['react', 'react-dom', 'react-router-dom'],

          // UI libraries
          'ui-core': ['@hookform/resolvers', 'react-hook-form', 'zod'],
        }
      }
    },
    // Enable source maps for debugging
    sourcemap: true,
    // Optimize chunk size
    chunkSizeWarningLimit: 1000
  }
})
