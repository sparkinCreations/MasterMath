// Browser smoke test against the PRODUCTION build.
//
// The unit suite (npm test) runs the solvers in node and cannot see the
// built app: a chunk cycle that crashes the graph, a page that throws on
// first render, a landing page that preloads 1.6 MB of solver libraries —
// all of which shipped or nearly shipped in September 2026 with 376 green
// tests. This suite builds, serves the bundle with `vite preview`, and drives
// real Chromium on a desktop and a phone viewport. Run it after any change
// to vite.config.js, the chunking, the dependencies, or a page component.
//
//   npm run smoke            all projects
//   npm run smoke -- --ui    interactive
//
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
  ],
});
