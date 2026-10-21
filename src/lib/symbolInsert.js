// The symbol strip above the problem box: one tap inserts a symbol a phone
// keyboard hides two or three taps deep (^, √, ∫, π), with the caret left
// where the next thing goes. Pure: the component passes the textarea's
// value and selection in and applies what comes back, so every entry can be
// checked against the parser in a unit test.

// `text` is inserted at the selection; `caret` is where the caret lands,
// counted from the start of the inserted text (default: its end); `select`
// is an optional [start, end] within the inserted text to leave selected,
// so typing replaces a placeholder bound.
export const SYMBOLS = [
  { key: 'square', glyph: 'x²', label: 'Insert squared', text: '^2' },
  { key: 'power', glyph: 'xⁿ', label: 'Insert a power', text: '^()', caret: 2 },
  { key: 'sqrt', glyph: '√', label: 'Insert a square root', text: '√()', caret: 2 },
  { key: 'fraction', glyph: 'a/b', label: 'Insert a fraction', text: '()/()', caret: 1 },
  { key: 'pi', glyph: 'π', label: 'Insert pi', text: 'π' },
  { key: 'times', glyph: '×', label: 'Insert multiplication', text: '*' },
  { key: 'parens', glyph: '( )', label: 'Insert parentheses', text: '()', caret: 1 },
  { key: 'abs', glyph: '|x|', label: 'Insert absolute value bars', text: '||', caret: 1 },
  { key: 'le', glyph: '≤', label: 'Insert less than or equal', text: ' ≤ ' },
  { key: 'ge', glyph: '≥', label: 'Insert greater than or equal', text: ' ≥ ' },
  { key: 'integral', glyph: '∫', label: 'Insert an indefinite integral', text: '∫  dx', caret: 2 },
  { key: 'definite', glyph: '∫ₐᵇ', label: 'Insert a definite integral, then edit the bounds', text: '∫_0^1  dx', caret: 6, select: [2, 3] },
  { key: 'ddx', glyph: 'd/dx', label: 'Insert a derivative', text: 'd/dx()', caret: 5 },
  { key: 'lim', glyph: 'lim', label: 'Insert a limit as x approaches 0', text: 'lim x->0 ()', caret: 10, select: [7, 8] },
  { key: 'sin', glyph: 'sin', label: 'Insert sine', text: 'sin()', caret: 4 },
  { key: 'cos', glyph: 'cos', label: 'Insert cosine', text: 'cos()', caret: 4 },
  { key: 'tan', glyph: 'tan', label: 'Insert tangent', text: 'tan()', caret: 4 },
  { key: 'ln', glyph: 'ln', label: 'Insert natural log', text: 'ln()', caret: 3 },
  { key: 'log', glyph: 'log', label: 'Insert log base 10', text: 'log()', caret: 4 },
  { key: 'e', glyph: 'eˣ', label: 'Insert e to a power', text: 'e^()', caret: 3 },
];

export function insertSymbol(value, selectionStart, selectionEnd, symbol) {
  const v = String(value ?? '');
  const start = Math.max(0, Math.min(selectionStart ?? v.length, v.length));
  const end = Math.max(start, Math.min(selectionEnd ?? start, v.length));
  const next = v.slice(0, start) + symbol.text + v.slice(end);
  if (symbol.select) {
    return { value: next, selectionStart: start + symbol.select[0], selectionEnd: start + symbol.select[1] };
  }
  const caret = start + (symbol.caret ?? symbol.text.length);
  return { value: next, selectionStart: caret, selectionEnd: caret };
}

export const SYMBOL_STRIP_KEY = 'symbolStrip';

export function readSymbolStripOpen(storage) {
  try {
    return storage?.getItem(SYMBOL_STRIP_KEY) === 'open';
  } catch {
    return false;
  }
}

export function writeSymbolStripOpen(storage, open) {
  try {
    storage?.setItem(SYMBOL_STRIP_KEY, open ? 'open' : 'closed');
  } catch {
    // nothing to persist to
  }
}
