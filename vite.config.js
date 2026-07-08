import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'

// Stamp the service worker's CACHE_NAME with the package version plus the
// git commit being built. Browsers only detect an app update when sw.js
// itself changes bytes — without this stamp, deploys that don't touch sw.js
// are invisible to the in-app update banner. The commit hash gives exactly
// one stamp per release: rebuilding the same commit yields the same sw.js
// (no false update prompts), and every push yields a new one. (Bundle
// filenames can't be used for this — Rollup's chunk hashes are not
// deterministic across builds.)
function stampServiceWorker() {
  return {
    name: 'stamp-service-worker',
    apply: 'build',
    closeBundle() {
      const swPath = path.resolve(__dirname, 'dist', 'sw.js')
      if (!fs.existsSync(swPath)) return

      const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'))

      // Netlify exposes the commit as COMMIT_REF; fall back to git locally.
      let commit = (process.env.COMMIT_REF || '').slice(0, 8)
      if (!commit) {
        try {
          commit = execSync('git rev-parse --short=8 HEAD', { cwd: __dirname }).toString().trim()
        } catch {
          commit = 'local'
        }
      }

      const stamped = fs
        .readFileSync(swPath, 'utf8')
        .replace(
          /const CACHE_NAME = '[^']*'/,
          `const CACHE_NAME = 'mastermath-v${pkg.version}-${commit}'`
        )
      fs.writeFileSync(swPath, stamped)
      console.log(`[stamp-service-worker] CACHE_NAME → mastermath-v${pkg.version}-${commit}`)
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), stampServiceWorker()],
  server: {
    // Honor an externally assigned port (e.g. when 5173 is already in use).
    port: Number(process.env.PORT) || 5173,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/algebrite')) {
            return 'algebrite';
          }
          if (id.includes('node_modules/mathjs')) {
            return 'mathjs';
          }
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
            return 'charts';
          }
          if (id.includes('node_modules/jspdf')) {
            return 'pdf';
          }
        },
      },
    },
  },
})
