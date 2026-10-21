import test from 'node:test';
import assert from 'node:assert/strict';
import { readThemePreference, writeThemePreference, resolveIsDark, systemPrefersDark, THEME_KEY, LEGACY_KEY } from '../src/lib/theme.js';

const memory = (init = {}) => {
  const data = { ...init };
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, removeItem: (k) => { delete data[k]; }, data };
};

test('new visitors follow the system; a stored theme wins; garbage is ignored', () => {
  assert.equal(readThemePreference(memory()), 'system');
  assert.equal(readThemePreference(memory({ theme: 'dark' })), 'dark');
  assert.equal(readThemePreference(memory({ theme: 'light' })), 'light');
  assert.equal(readThemePreference(memory({ theme: 'blue' })), 'system');
  assert.equal(readThemePreference(null), 'system');
});

test('the pre-1.42 darkMode boolean is honoured until migrated, and migrated on write', () => {
  assert.equal(readThemePreference(memory({ darkMode: 'true' })), 'dark');
  assert.equal(readThemePreference(memory({ darkMode: 'false' })), 'light');
  // An explicit theme beats the legacy key.
  assert.equal(readThemePreference(memory({ darkMode: 'true', theme: 'system' })), 'system');
  const store = memory({ darkMode: 'true' });
  writeThemePreference(store, readThemePreference(store));
  assert.equal(store.data[THEME_KEY], 'dark');
  assert.equal(LEGACY_KEY in store.data, false);
  assert.throws(() => writeThemePreference(store, 'sepia'));
});

test('resolution: dark/light are fixed, system follows the device', () => {
  assert.equal(resolveIsDark('dark', false), true);
  assert.equal(resolveIsDark('light', true), false);
  assert.equal(resolveIsDark('system', true), true);
  assert.equal(resolveIsDark('system', false), false);
  assert.equal(resolveIsDark('system', undefined), false);
});

test('systemPrefersDark reads matchMedia and is false without it', () => {
  assert.equal(systemPrefersDark({ matchMedia: () => ({ matches: true }) }), true);
  assert.equal(systemPrefersDark({ matchMedia: () => ({ matches: false }) }), false);
  assert.equal(systemPrefersDark({}), false);
  assert.equal(systemPrefersDark({ matchMedia: () => { throw new Error('nope'); } }), false);
});

test('the boot script in index.html resolves the theme the same way', async () => {
  const fs = await import('node:fs');
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const script = html.match(/<script>\s*\(function \(\) \{([\s\S]*?)\}\)\(\);\s*<\/script>/)?.[1] ?? '';
  assert.ok(/localStorage\.getItem\('theme'\)/.test(script), 'reads the theme key');
  assert.ok(/localStorage\.getItem\('darkMode'\)/.test(script), 'honours the legacy key');
  assert.ok(/prefers-color-scheme: dark/.test(script), 'consults the system setting');
  assert.ok(/classList\.add\('dark'\)/.test(script), 'applies the class before paint');
});
