// The landing page must not preload the heavy solver libraries. Vite emits a
// <link rel="modulepreload"> for every chunk the entry statically imports, so
// if the bundler co-locates one shared helper inside the mathjs / Algebrite /
// Recharts / jsPDF chunk, a first visit downloads ~1.8 MB it will not use.
// This happened under Rollup in July 2026 and again on the Vite 8 (Rolldown)
// upgrade in September 2026; the chunk groups in vite.config.js are the fix
// and this test is what keeps it fixed. It runs a real production build into
// a scratch directory (a few seconds with Rolldown).

import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// `shared` is the lazy chunk of node_modules code the solver chunks have in
// common (mathjs's number types); it is heavy too.
const HEAVY = /(mathjs|algebrite|charts|pdf|html2canvas|purify|shared|katex)-/;

test('the built landing page preloads none of the heavy library chunks', () => {
  const out = mkdtempSync(path.join(tmpdir(), 'mastermath-build-'));
  try {
    execSync(`npx vite build --outDir ${JSON.stringify(out)} --emptyOutDir`, { stdio: 'ignore', cwd: process.cwd() });
    const html = readFileSync(path.join(out, 'index.html'), 'utf8');
    const preloads = [...html.matchAll(/rel="modulepreload"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
    const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
    const critical = [...preloads, ...scripts];
    assert.ok(critical.length > 0, 'no entry script or preload found in index.html');
    const heavy = critical.filter((href) => HEAVY.test(href));
    assert.deepEqual(heavy, [], `landing page preloads heavy chunks: ${heavy.join(', ')}`);

    // The heavy chunks still exist as separate lazy chunks (the policy
    // splits them out rather than inlining them somewhere).
    const assets = readdirSync(path.join(out, 'assets'));
    for (const name of ['mathjs', 'algebrite', 'charts', 'pdf', 'katex', 'html2canvas-pro']) {
      assert.ok(assets.some((f) => f.startsWith(`${name}-`) && f.endsWith('.js')), `no ${name} chunk emitted`);
    }

    // The pages that read or write history never reach the maths libraries
    // through static imports: those load in the solver worker (its own
    // entry), or on demand. Until 1.52.1 these pages imported the history
    // functions from api.js, the solve router, and pulled in mathjs (79 kB
    // gzipped) on the main thread.
    const staticImports = (file) => [...readFileSync(path.join(out, 'assets', file), 'utf8')
      .matchAll(/(?:\bimport|\bexport)\s*(?:[\w$*{},\s]*?from\s*)?"\.\/([^"]+\.js)"/g)].map((m) => m[1]);
    for (const pageName of ['Solver', 'Progress', 'Settings']) {
      const entry = assets.find((f) => f.startsWith(`${pageName}-`) && f.endsWith('.js'));
      assert.ok(entry, `no ${pageName} chunk emitted`);
      const seen = new Set();
      const queue = [entry];
      while (queue.length) {
        const file = queue.pop();
        if (seen.has(file)) continue;
        seen.add(file);
        queue.push(...staticImports(file));
      }
      const libraries = [...seen].filter((f) => /^(mathjs|algebrite)-/.test(f));
      assert.deepEqual(libraries, [], `the ${pageName} page statically imports ${libraries.join(', ')}`);
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
