import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

// This file is ESM, so it has no dirname global of its own. Vite has been
// supplying one by bundling the config through esbuild, but the native config
// loader (the planned default) does not, and it warns about the use on every
// run. Deriving the path from import.meta.url works under either loader.
const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    // functions/ is server code but its per-vendor normalisation decides
    // what gets written into a customer's directory, so it is unit-tested too.
    include: ['src/**/*.test.{js,jsx}', 'functions/**/*.test.js'],
    // The Firestore rules suite needs the emulator, so it is not part of the
    // default fast run. `npm run test:rules` starts the emulator around it,
    // and CI runs both.
    exclude: ['**/node_modules/**', 'src/lib/firestore-rules.test.js'],
  },
  server: {
    port: 5173,
    open: true
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: {
        main: resolve(rootDir, 'index.html'),
        authRedirect: resolve(rootDir, 'auth-redirect.html'),
      },
      output: {
        manualChunks: (id) => {
          // Vendor splitting — keep heavy libraries in their own chunks
          // so they cache independently and load in parallel.
          // Order matters: more specific checks first.
          if (id.includes('node_modules')) {
            // Firebase is huge — split it out (auth + firestore + app)
            if (id.includes('firebase') || id.includes('@firebase')) {
              return 'vendor-firebase';
            }
            // Recharts pulls in d3 — heavy charting
            if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-vendor')) {
              return 'vendor-charts';
            }
            // Lucide icons — large but tree-shakeable
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            // Framer Motion — animation library
            if (id.includes('framer-motion')) {
              return 'vendor-motion';
            }
            // Everything else (React, router, query, date-fns, toast, scheduler...)
            // bundled together to avoid circular dep issues since they all
            // depend on each other.
            return 'vendor-core';
          }
        },
      },
    },
  },
})