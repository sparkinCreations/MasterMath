// The symbol strip above the problem box: one tap inserts a symbol a phone
// keyboard hides two or three taps deep (^, √, ∫, π, even + and =), with
// the caret left where the next thing goes. Pure: the component passes the
// textarea's value and selection in and applies what comes back, so every
// entry can be checked against the parser in a unit test.
//
// Entries are grouped (Basic / Algebra / Calculus / Functions); one strip of
// everything was too long on a phone. The topic picks the starting group
// (groupForTopic) but every group stays reachable: the solver routes by
// what is typed, not by the topic, so nothing is hidden.

// `text` is inserted at the selection; `caret` is where the caret lands,
// counted from the start of the inserted text (default: its end); `select`
// is an optional [start, end] within the inserted text to leave selected,
// so typing replaces a placeholder bound. `groups` lists where it appears.
export const GROUPS = [
  { key: 'basic', label: 'Basic' },
  { key: 'algebra', label: 'Algebra' },
  { key: 'calculus', label: 'Calculus' },
  { key: 'functions', label: 'Functions' },
];

export const SYMBOLS = [
  { key: 'plus', glyph: '+', label: 'Insert plus', text: ' + ', groups: ['basic'] },
  { key: 'minus', glyph: '−', label: 'Insert minus', text: ' - ', groups: ['basic'] },
  { key: 'times', glyph: '×', label: 'Insert multiplication', text: '*', groups: ['basic'] },
  { key: 'divide', glyph: '÷', label: 'Insert division', text: '/', groups: ['basic'] },
  { key: 'equals', glyph: '=', label: 'Insert equals', text: ' = ', groups: ['basic', 'algebra'] },
  { key: 'parens', glyph: '( )', label: 'Insert parentheses', text: '()', caret: 1, groups: ['basic', 'algebra'] },
  { key: 'fraction', glyph: 'a/b', label: 'Insert a fraction', text: '()/()', caret: 1, groups: ['basic', 'algebra'] },
  { key: 'square', glyph: 'x²', label: 'Insert squared', text: '^2', groups: ['basic', 'algebra', 'calculus'] },
  { key: 'power', glyph: 'xⁿ', label: 'Insert a power', text: '^()', caret: 2, groups: ['basic', 'algebra', 'calculus'] },
  { key: 'sqrt', glyph: '√', label: 'Insert a square root', text: '√()', caret: 2, groups: ['basic', 'algebra'] },
  { key: 'pi', glyph: 'π', label: 'Insert pi', text: 'π', groups: ['basic', 'functions'] },
  { key: 'le', glyph: '≤', label: 'Insert less than or equal', text: ' ≤ ', groups: ['algebra'] },
  { key: 'ge', glyph: '≥', label: 'Insert greater than or equal', text: ' ≥ ', groups: ['algebra'] },
  { key: 'abs', glyph: '|x|', label: 'Insert absolute value bars', text: '||', caret: 1, groups: ['algebra'] },
  { key: 'system', glyph: ';', label: 'Insert a semicolon between the equations of a system', text: '; ', groups: ['algebra'] },
  { key: 'integral', glyph: '∫', label: 'Insert an indefinite integral', text: '∫  dx', caret: 2, groups: ['calculus'] },
  { key: 'definite', glyph: '∫ₐᵇ', label: 'Insert a definite integral, then edit the bounds', text: '∫_0^1  dx', caret: 6, select: [2, 3], groups: ['calculus'] },
  { key: 'ddx', glyph: 'd/dx', label: 'Insert a derivative', text: 'd/dx()', caret: 5, groups: ['calculus'] },
  { key: 'lim', glyph: 'lim', label: 'Insert a limit as x approaches 0', text: 'lim x->0 ()', caret: 10, select: [7, 8], groups: ['calculus'] },
  { key: 'infinity', glyph: '∞', label: 'Insert infinity', text: '∞', groups: ['calculus'] },
  { key: 'e', glyph: 'eˣ', label: 'Insert e to a power', text: 'e^()', caret: 3, groups: ['calculus'] },
  { key: 'ln', glyph: 'ln', label: 'Insert natural log', text: 'ln()', caret: 3, groups: ['calculus', 'functions'] },
  { key: 'log', glyph: 'log', label: 'Insert log base 10', text: 'log()', caret: 4, groups: ['functions'] },
  { key: 'sin', glyph: 'sin', label: 'Insert sine', text: 'sin()', caret: 4, groups: ['functions'] },
  { key: 'cos', glyph: 'cos', label: 'Insert cosine', text: 'cos()', caret: 4, groups: ['functions'] },
  { key: 'tan', glyph: 'tan', label: 'Insert tangent', text: 'tan()', caret: 4, groups: ['functions'] },
  { key: 'sec', glyph: 'sec', label: 'Insert secant', text: 'sec()', caret: 4, groups: ['functions'] },
  { key: 'csc', glyph: 'csc', label: 'Insert cosecant', text: 'csc()', caret: 4, groups: ['functions'] },
  { key: 'cot', glyph: 'cot', label: 'Insert cotangent', text: 'cot()', caret: 4, groups: ['functions'] },
  { key: 'arcsin', glyph: 'sin⁻¹', label: 'Insert inverse sine', text: 'arcsin()', caret: 7, groups: ['functions'] },
  { key: 'arccos', glyph: 'cos⁻¹', label: 'Insert inverse cosine', text: 'arccos()', caret: 7, groups: ['functions'] },
  { key: 'arctan', glyph: 'tan⁻¹', label: 'Insert inverse tangent', text: 'arctan()', caret: 7, groups: ['functions'] },
];

export function symbolsInGroup(group) {
  return SYMBOLS.filter((s) => s.groups.includes(group));
}

// The group a topic starts on. Every group stays reachable.
export function groupForTopic(topic) {
  switch (topic) {
    case 'derivatives':
    case 'integrals':
    case 'limits':
      return 'calculus';
    case 'trigonometry':
      return 'functions';
    case 'algebra':
    case 'functions':
      return 'algebra';
    default:
      return 'basic';
  }
}

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
