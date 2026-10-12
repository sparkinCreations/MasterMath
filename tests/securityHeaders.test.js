import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readGlobalHeaders } from '../scripts/netlifyHeaders.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const headers = readGlobalHeaders(path.resolve(here, '../public/_headers'));
const csp = headers['Content-Security-Policy'] ?? '';
const directive = (name) => csp.split(';').map((d) => d.trim().split(/\s+/)).find(([n]) => n === name)?.slice(1) ?? [];

// Every executable inline <script> in index.html (the boot watchdog) must be
// allowed by hash. A stale hash would not break the app — it would silently
// disable the watchdog, which only runs when the app has already failed.
test('script-src allows every inline script in index.html by its exact hash', () => {
  const html = fs.readFileSync(path.resolve(here, '../index.html'), 'utf8');
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter(([, attrs]) => !/application\/ld\+json/.test(attrs));
  assert.ok(inline.length > 0, 'expected the inline boot watchdog');
  for (const [, , body] of inline) {
    const hash = `'sha256-${crypto.createHash('sha256').update(body).digest('base64')}'`;
    assert.ok(directive('script-src').includes(hash),
      `index.html's inline script changed: put ${hash} in script-src in public/_headers`);
  }
});

test('the policy forbids eval, inline script and framing', () => {
  const scripts = directive('script-src');
  assert.ok(scripts.length > 0, 'script-src is set');
  assert.ok(!scripts.includes("'unsafe-eval'"));
  assert.ok(!scripts.includes("'unsafe-inline'"));
  assert.deepEqual(directive('object-src'), ["'none'"]);
  assert.deepEqual(directive('frame-ancestors'), ["'none'"]);
});

test('the Feedback form endpoint is the only outside origin the app may contact', () => {
  const feedback = fs.readFileSync(path.resolve(here, '../src/pages/Feedback.jsx'), 'utf8');
  const origin = new URL(feedback.match(/fetch\('([^']+)'/)[1]).origin;
  assert.deepEqual(directive('connect-src'), ["'self'", origin]);
});

test('the companion hardening headers are present', () => {
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['X-Frame-Options'], 'DENY');
  assert.ok(headers['Referrer-Policy']);
});
