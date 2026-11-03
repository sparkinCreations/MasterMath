// public/_redirects (Netlify): the SPA fallback must not answer for
// /.well-known/. A 200 with the HTML shell there reads as a broken manifest
// to agents and to Lighthouse's ARD audit; a 404 says there is none.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const rules = fs.readFileSync(path.resolve(here, '../public/_redirects'), 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => line.split(/\s+/));

test('/.well-known/ answers 404 before the SPA fallback answers 200', () => {
  const wellKnown = rules.findIndex(([from]) => from === '/.well-known/*');
  const fallback = rules.findIndex(([from]) => from === '/*');
  assert.ok(wellKnown >= 0, 'no /.well-known/* rule');
  assert.equal(rules[wellKnown][2], '404');
  assert.equal(rules[fallback][2], '200');
  assert.ok(wellKnown < fallback, 'the first matching rule wins: /.well-known/* must come first');
});
