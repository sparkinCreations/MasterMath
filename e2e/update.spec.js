// How a release reaches an open page (1.58.1). A release is simulated by
// rewriting the built dist/sw.js that `vite preview` serves, then asking the
// page's registration to check for an update, as the browser does on its own.
//
//   same version, new commit → switched quietly: no prompt, no reload
//   a different version      → "Update to v…" beside the version in the
//                              footer; nothing reloads until it is tapped
//
// The 'update' project runs this file alone, after the others finish.
import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const SW = new URL('../dist/sw.js', import.meta.url);
const original = readFileSync(SW, 'utf8');
const cacheName = original.match(/const CACHE_NAME = '([^']*)'/)[1];

const release = (newName) => writeFileSync(SW, original.replace(cacheName, newName));
const workerVersion = (page) => page.evaluate(() => new Promise((resolve) => {
  const channel = new MessageChannel();
  channel.port1.onmessage = (e) => resolve(e.data.version);
  navigator.serviceWorker.controller.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
}));

async function openControlled(page) {
  await page.goto('/');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  // Survives only if the page is never reloaded.
  await page.evaluate(() => { window.__notReloaded = true; });
}
const checkForUpdate = (page) => page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));

test.describe.configure({ mode: 'serial' });
test.afterEach(() => writeFileSync(SW, original));

test('a release of the version already on screen switches quietly, with no prompt and no reload', async ({ page }) => {
  await openControlled(page);
  const quiet = cacheName.replace(/-[0-9a-z]+$/, (h) => `-${'f'.repeat(h.length - 1)}`);
  release(quiet);
  await checkForUpdate(page);
  await expect.poll(() => workerVersion(page), { timeout: 20_000 }).toBe(quiet);
  await expect(page.getByRole('button', { name: /Update/ })).toHaveCount(0);
  expect(await page.evaluate(() => window.__notReloaded)).toBe(true);
});

test('a different version is offered in the footer, and reloads only when tapped', async ({ page }) => {
  await openControlled(page);
  const newer = cacheName.replace(/^mastermath-v\d+/, 'mastermath-v99');
  release(newer);
  await checkForUpdate(page);
  const offer = page.locator('footer').getByRole('button', { name: /^Update to v99\./ });
  await expect(offer).toBeVisible({ timeout: 20_000 });
  // Offered, not forced: still the same page, still the old worker.
  expect(await page.evaluate(() => window.__notReloaded)).toBe(true);
  expect(await workerVersion(page)).toBe(cacheName);
  // Tapped: the page reloads into the new worker.
  await Promise.all([page.waitForEvent('framenavigated', { timeout: 20_000 }), offer.click()]);
  await page.waitForLoadState('load');
  expect(await page.evaluate(() => window.__notReloaded ?? false)).toBe(false);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  expect(await workerVersion(page)).toBe(newer);
});
