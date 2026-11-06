// The on-screen keypad under the problem box (1.69.0): digits, x and y, the
// operators, brackets, backspace and the arrow keys, so a phone student types
// "3x^2 - 5x + 2" without switching the phone keyboard between its letter,
// number and symbol layouts. While it is open the textarea takes
// inputmode="none", so the phone keyboard stays closed and the page stays in
// view. Pure, so the unit suite covers it without a browser; the component is
// components/solver/MathKeypad.jsx.

import { insertSymbol } from './symbolInsert.js';

// Rows of six, each key a 44 px target or larger. `text` is inserted at the
// caret (the same rules as the Symbols strip); `action` keys edit instead.
// `label` is the accessible name where the glyph alone would be read wrongly
// ("÷" as "division sign", "^" as "caret").
export const KEYPAD_ROWS = [
  [
    { key: '7', glyph: '7', text: '7' }, { key: '8', glyph: '8', text: '8' }, { key: '9', glyph: '9', text: '9' },
    { key: 'divide', glyph: '÷', text: '/', label: 'Divide' },
    { key: 'open', glyph: '(', text: '(', label: 'Open parenthesis' },
    { key: 'close', glyph: ')', text: ')', label: 'Close parenthesis' },
  ],
  [
    { key: '4', glyph: '4', text: '4' }, { key: '5', glyph: '5', text: '5' }, { key: '6', glyph: '6', text: '6' },
    { key: 'times', glyph: '×', text: '*', label: 'Times' },
    { key: 'x', glyph: 'x', text: 'x', label: 'x' },
    { key: 'y', glyph: 'y', text: 'y', label: 'y' },
  ],
  [
    { key: '1', glyph: '1', text: '1' }, { key: '2', glyph: '2', text: '2' }, { key: '3', glyph: '3', text: '3' },
    { key: 'minus', glyph: '−', text: ' - ', label: 'Minus' },
    { key: 'power', glyph: 'xⁿ', text: '^', label: 'To the power' },
    { key: 'backspace', glyph: '⌫', action: 'backspace', label: 'Backspace' },
  ],
  [
    { key: '0', glyph: '0', text: '0' }, { key: 'point', glyph: '.', text: '.', label: 'Decimal point' },
    { key: 'equals', glyph: '=', text: ' = ', label: 'Equals' },
    { key: 'plus', glyph: '+', text: ' + ', label: 'Plus' },
    { key: 'left', glyph: '←', action: 'left', label: 'Move left' },
    { key: 'right', glyph: '→', action: 'right', label: 'Move right' },
  ],
];

export const KEYPAD_KEYS = KEYPAD_ROWS.flat();

// One key applied to the text and its selection: { value, selectionStart,
// selectionEnd }.
export function applyKey(value, selectionStart, selectionEnd, key) {
  const v = String(value ?? '');
  const start = Math.max(0, Math.min(selectionStart ?? v.length, v.length));
  const end = Math.max(start, Math.min(selectionEnd ?? start, v.length));
  if (key.action === 'backspace') return deleteBackward(v, start, end);
  if (key.action === 'left') {
    const at = start === end ? Math.max(0, start - 1) : start;
    return { value: v, selectionStart: at, selectionEnd: at };
  }
  if (key.action === 'right') {
    const at = start === end ? Math.min(v.length, end + 1) : end;
    return { value: v, selectionStart: at, selectionEnd: at };
  }
  return insertSymbol(v, start, end, key);
}

// Backspace: a selection goes as a whole; otherwise one character. An
// operator the keys pad with spaces (" + ", " - ", " = ") goes with its
// spaces, in one press, not three; "2 + 3" loses only the 3.
const PADDED = new Set(['+', '-', '=']);
export function deleteBackward(value, start, end) {
  const v = String(value ?? '');
  if (end > start) return { value: v.slice(0, start) + v.slice(end), selectionStart: start, selectionEnd: start };
  if (start === 0) return { value: v, selectionStart: 0, selectionEnd: 0 };
  let from = start;
  while (from > 0 && v[from - 1] === ' ') from -= 1;
  if (from === 0) return { value: v.slice(start), selectionStart: 0, selectionEnd: 0 };
  const removed = v[from - 1];
  from -= 1;
  if (PADDED.has(removed)) while (from > 0 && v[from - 1] === ' ') from -= 1;
  return { value: v.slice(0, from) + v.slice(start), selectionStart: from, selectionEnd: from };
}

// Open or closed, as last chosen on this device; until a choice is made,
// open where the main pointer is a finger (a phone or tablet) and closed
// where it is a mouse.
export const KEYPAD_KEY = 'keypad';

export function readKeypadOpen(storage, touchFirst) {
  try {
    const saved = storage?.getItem(KEYPAD_KEY);
    if (saved === 'open') return true;
    if (saved === 'closed') return false;
  } catch {
    // no storage: fall through to the device's default
  }
  return Boolean(touchFirst);
}

export function writeKeypadOpen(storage, open) {
  try {
    storage?.setItem(KEYPAD_KEY, open ? 'open' : 'closed');
  } catch {
    // nothing to persist to
  }
}

// Whether the device's main pointer is a finger. Not the screen width: a
// small laptop window is not a phone, and a tablet is.
export function touchFirstDevice(win = globalThis.window) {
  try {
    return Boolean(win?.matchMedia?.('(pointer: coarse)')?.matches);
  } catch {
    return false;
  }
}
