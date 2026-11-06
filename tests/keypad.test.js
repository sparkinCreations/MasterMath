import test from 'node:test';
import assert from 'node:assert/strict';

import { KEYPAD_ROWS, KEYPAD_KEYS, applyKey, deleteBackward, readKeypadOpen, writeKeypadOpen, KEYPAD_KEY, touchFirstDevice } from '../src/lib/keypad.js';

const key = (k) => KEYPAD_KEYS.find((x) => x.key === k);
// Type a sequence of keys into an empty box, the caret following each one.
function type(keys, start = { value: '', selectionStart: 0, selectionEnd: 0 }) {
  return keys.reduce((s, k) => applyKey(s.value, s.selectionStart, s.selectionEnd, key(k)), start);
}

test('four rows of six keys, every key named and unique', () => {
  assert.equal(KEYPAD_ROWS.length, 4);
  for (const row of KEYPAD_ROWS) assert.equal(row.length, 6);
  assert.equal(new Set(KEYPAD_KEYS.map((k) => k.key)).size, KEYPAD_KEYS.length);
  for (const k of KEYPAD_KEYS) assert.ok(k.label || /^\d$/.test(k.glyph), k.key);
  for (const d of '0123456789') assert.ok(key(d), d);
});

test('the keys type a problem the solver reads', () => {
  const s = type(['3', 'x', 'power', '2', 'minus', '5', 'x', 'plus', '2', 'equals', '0']);
  assert.equal(s.value, '3x^2 - 5x + 2 = 0');
  assert.equal(s.selectionStart, s.value.length);
  assert.equal(type(['open', '1', 'point', '5', 'close', 'times', 'y', 'divide', '4']).value, '(1.5)*y/4');
});

test('backspace takes one character, a padded operator whole, or the selection', () => {
  assert.deepEqual(deleteBackward('2 + ', 4, 4), { value: '2', selectionStart: 1, selectionEnd: 1 });
  assert.deepEqual(deleteBackward('2 + 3', 5, 5), { value: '2 + ', selectionStart: 4, selectionEnd: 4 });
  assert.deepEqual(deleteBackward('x^2', 3, 3), { value: 'x^', selectionStart: 2, selectionEnd: 2 });
  assert.deepEqual(deleteBackward('sin(x)', 4, 5), { value: 'sin()', selectionStart: 4, selectionEnd: 4 });
  assert.deepEqual(deleteBackward('abc', 0, 0), { value: 'abc', selectionStart: 0, selectionEnd: 0 });
  assert.deepEqual(deleteBackward('  x', 2, 2), { value: 'x', selectionStart: 0, selectionEnd: 0 });
  // In the middle: the text after the caret stays.
  assert.deepEqual(deleteBackward('12 = 34', 5, 5), { value: '1234', selectionStart: 2, selectionEnd: 2 });
});

test('the arrows move the caret, and collapse a selection to its edge', () => {
  assert.deepEqual(applyKey('abc', 2, 2, key('left')), { value: 'abc', selectionStart: 1, selectionEnd: 1 });
  assert.deepEqual(applyKey('abc', 0, 0, key('left')), { value: 'abc', selectionStart: 0, selectionEnd: 0 });
  assert.deepEqual(applyKey('abc', 2, 2, key('right')), { value: 'abc', selectionStart: 3, selectionEnd: 3 });
  assert.deepEqual(applyKey('abc', 3, 3, key('right')), { value: 'abc', selectionStart: 3, selectionEnd: 3 });
  assert.deepEqual(applyKey('abc', 1, 3, key('left')), { value: 'abc', selectionStart: 1, selectionEnd: 1 });
  assert.deepEqual(applyKey('abc', 1, 3, key('right')), { value: 'abc', selectionStart: 3, selectionEnd: 3 });
  // Typing replaces a selection, as the Symbols strip does.
  assert.deepEqual(applyKey('x + 1', 4, 5, key('2')), { value: 'x + 2', selectionStart: 5, selectionEnd: 5 });
});

test('open by default where the main pointer is a finger, then as last chosen', () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  assert.equal(readKeypadOpen(storage, true), true);
  assert.equal(readKeypadOpen(storage, false), false);
  writeKeypadOpen(storage, false);
  assert.equal(store.get(KEYPAD_KEY), 'closed');
  assert.equal(readKeypadOpen(storage, true), false);
  writeKeypadOpen(storage, true);
  assert.equal(readKeypadOpen(storage, false), true);
  // Storage that throws (private browsing) falls back to the device default.
  const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
  assert.equal(readKeypadOpen(broken, true), true);
  assert.doesNotThrow(() => writeKeypadOpen(broken, true));
  assert.equal(touchFirstDevice({ matchMedia: (q) => ({ matches: q === '(pointer: coarse)' }) }), true);
  assert.equal(touchFirstDevice({ matchMedia: () => ({ matches: false }) }), false);
  assert.equal(touchFirstDevice(undefined), false);
});
