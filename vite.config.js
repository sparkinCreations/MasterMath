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

      // Every hashed asset the build emitted, for the worker to precache at
      // install. JS and CSS are the code-split routes, solver modules and
      // libraries; woff2 are the KaTeX fonts (the woff/ttf siblings are
      // fallbacks no supported browser will request). Sorted for a stable
      // sw.js across identical builds.
      const assetsDir = path.resolve(__dirname, 'dist', 'assets')
      const precache = fs.existsSync(assetsDir)
        ? fs
            .readdirSync(assetsDir)
            .filter((f) => /\.(js|css|woff2)$/.test(f))
            .sort()
            .map((f) => `/assets/${f}`)
        : []

      const stamped = fs
        .readFileSync(swPath, 'utf8')
        .replace(
          /const CACHE_NAME = '[^']*'/,
          `const CACHE_NAME = 'mastermath-v${pkg.version}-${commit}'`
        )
        .replace(
          /const PRECACHE_ASSETS = \[[^\]]*\];/,
          `const PRECACHE_ASSETS = ${JSON.stringify(precache)};`
        )
      fs.writeFileSync(swPath, stamped)
      const bytes = precache.reduce((n, f) => n + fs.statSync(path.join(assetsDir, path.basename(f))).size, 0)
      console.log(`[stamp-service-worker] CACHE_NAME → mastermath-v${pkg.version}-${commit}`)
      console.log(`[stamp-service-worker] precache manifest → ${precache.length} assets, ${(bytes / 1024 / 1024).toFixed(1)} MB raw`)
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
    // Vite 8 bundles with Rolldown; this is Rolldown's chunk-group API.
    //
    // Chunking has two jobs here, and they pull in opposite directions.
    //
    // 1. Keep the heavy libraries in their own chunks so a lazy route pays
    //    for them only when it is opened.
    // 2. Keep them off the entry chunk's *static* import graph. Vite emits
    //    a <link rel="modulepreload"> for everything the entry statically
    //    imports, so a single stray reference makes the landing page
    //    download the whole thing.
    //
    // Job 2 is the subtle one. A module no group claims is co-located with
    // whichever chunk is convenient — and when a module shared with the entry
    // (a Babel helper under jsPDF, a utility under Recharts) lands inside a
    // heavy chunk, the entry must statically import that chunk to reach it.
    // That is how the landing page came to preload Recharts, jsPDF, mathjs and
    // Algebrite for a few kB of shared code — under Rollup in July 2026, and
    // again on the Vite 8 upgrade (September 2026), because Rolldown makes
    // different co-location choices.
    //
    // The policy below says it directly, which Rollup's manualChunks could
    // not: each heavy library owns ONLY its own files (dependencies are not
    // pulled in recursively), and any node_modules file shared by two or more
    // chunks goes to `shared`. A dependency used by one library only
    // (decimal.js under mathjs, lodash under Recharts) matches no group and is
    // co-located with that library, off the landing page's critical path.
    // tests/buildPreload.test.js asserts the outcome on the built index.html.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // The entry's own framework and UI helpers. Named first so nothing
            // below can claim React.
            {
              name: 'vendor',
              priority: 30,
              test: /node_modules\/(react|react-dom|react-router|react-router-dom|scheduler|clsx|tailwind-merge|class-variance-authority|lucide-react)\//,
              includeDependenciesRecursively: false,
            },
            // Heavy libraries, each reachable only from a lazy route or a
            // lazily imported solver. Own files only.
            { name: 'algebrite', priority: 20, test: /node_modules\/algebrite\//, includeDependenciesRecursively: false },
            { name: 'mathjs', priority: 20, test: /node_modules\/mathjs\//, includeDependenciesRecursively: false },
            { name: 'charts', priority: 20, test: /node_modules\/(recharts|d3-[a-z-]+)\//, includeDependenciesRecursively: false },
            { name: 'pdf', priority: 20, test: /node_modules\/jspdf\//, includeDependenciesRecursively: false },
            // Anything else from node_modules that two or more chunks share goes to
            // its own small chunk:
            // Babel runtime helpers, small utilities. Single-owner dependencies
            // do not match (minShareCount) and stay with their owner.
            {
              name: 'shared',
              priority: 10,
              test: /node_modules\//,
              minShareCount: 2,
              includeDependenciesRecursively: false,
            },
          ],
        },
      },
    },
  },
})
