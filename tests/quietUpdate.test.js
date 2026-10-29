// 1.59.0: a waiting service worker of the version already on screen is
// switched to quietly; only a different version is offered, in the footer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { versionFromCacheName, compareWorkerToPage, askWorkerVersion } from '../src/lib/swVersion.js';

test('the version is read from the stamped cache name', () => {
  assert.equal(versionFromCacheName('mastermath-v1.58.0-e907422'), '1.58.0');
  assert.equal(versionFromCacheName('mastermath-v0-unstamped'), null);
  assert.equal(versionFromCacheName(null), null);
});

test('same version is switched quietly; a different or unknown one is offered', () => {
  assert.equal(compareWorkerToPage('mastermath-v1.59.0-abc1234', '1.59.0'), 'same');
  assert.equal(compareWorkerToPage('mastermath-v1.58.2-abc1234', '1.59.0'), 'different');
  assert.equal(compareWorkerToPage(null, '1.59.0'), 'unknown');
});

test('a worker that never answers resolves to null instead of hanging', async () => {
  const silent = { postMessage() {} };
  assert.equal(await askWorkerVersion(silent, 20), null);
  assert.equal(await askWorkerVersion(null, 20), null);
});

test('the worker still answers GET_VERSION with its cache name, which the build stamps', () => {
  const sw = readFileSync('public/sw.js', 'utf8');
  assert.match(sw, /type === 'GET_VERSION'[\s\S]{0,80}postMessage\(\{ version: CACHE_NAME \}\)/);
  assert.match(readFileSync('vite.config.js', 'utf8'), /mastermath-v\$\{pkg\.version\}-\$\{commit\}/);
});
