import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getSettings,
  saveSettings,
  resetSettings,
  DEFAULT_SETTINGS,
} from '../src/lib/settings.js';
import { solveTrigonometry } from '../src/lib/solvers/otherSolvers.js';
import { formatNumber } from '../src/lib/solvers/solverUtils.js';

// node:test runs without localStorage, so the module must fall back to
// defaults instead of throwing.
test('getSettings returns defaults when localStorage is unavailable', () => {
  assert.deepEqual(getSettings(), { ...DEFAULT_SETTINGS });
});

test('saveSettings sanitizes bad values and merges with defaults', () => {
  // Provide a localStorage shim so the persistence path runs.
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };

  try {
    assert.equal(saveSettings({ angleUnit: 'gradians' }).angleUnit, 'auto');
    assert.equal(saveSettings({ decimalPlaces: 99 }).decimalPlaces, 6);
    assert.equal(saveSettings({ decimalPlaces: 0 }).decimalPlaces, 2);
    assert.equal(saveSettings({ decimalPlaces: '3' }).decimalPlaces, 3);

    // Valid values persist and round-trip.
    saveSettings({ angleUnit: 'degrees', decimalPlaces: 5 });
    assert.deepEqual(getSettings(), { angleUnit: 'degrees', decimalPlaces: 5 });

    // Corrupt storage falls back to defaults rather than throwing.
    store.set('mastermath-settings', '{not json');
    assert.deepEqual(getSettings(), { ...DEFAULT_SETTINGS });

    assert.deepEqual(resetSettings(), { ...DEFAULT_SETTINGS });
  } finally {
    delete globalThis.localStorage;
  }
});

test('angle unit preference changes how bare numbers are interpreted', () => {
  // auto (default): common angles read as degrees
  const auto = solveTrigonometry('sin(30)');
  assert.match(auto.answer, /^0\.5/);

  // radians: sin(30) is 30 radians, with a cross-check note offered
  const rad = solveTrigonometry('sin(30)', { angleUnit: 'radians' });
  assert.match(rad.answer, /^-0\.988/);
  assert.ok(rad.steps.some((s) => /set to radians/i.test(s)));
  assert.ok(rad.steps.some((s) => /if you meant 30°/i.test(s)));

  // degrees: even non-common angles convert (auto would treat 37 as radians)
  const deg = solveTrigonometry('sin(37)', { angleUnit: 'degrees' });
  assert.ok(Math.abs(parseFloat(deg.answer) - 0.6018) < 1e-3);
  assert.ok(deg.steps.some((s) => /set to degrees/i.test(s)));
});

test('explicit pi stays radians even with degrees preference', () => {
  const result = solveTrigonometry('sin(pi/2)', { angleUnit: 'degrees' });
  assert.equal(parseFloat(result.answer), 1);
});

test('asymptote detection respects the degrees preference', () => {
  const result = solveTrigonometry('tan(90)', { angleUnit: 'degrees' });
  assert.equal(result.answer, 'Undefined');
});

test('formatNumber accepts an explicit decimals argument', () => {
  assert.equal(formatNumber(0.123456789, 2), '0.12');
  assert.equal(formatNumber(0.123456789, 6), '0.123457');
  // Default (no settings in node) remains 4.
  assert.equal(formatNumber(0.123456789), '0.1235');
});
