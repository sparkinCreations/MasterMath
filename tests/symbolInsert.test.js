import test from 'node:test';
import assert from 'node:assert/strict';
import { SYMBOLS, GROUPS, symbolsInGroup, groupForTopic, insertSymbol, readSymbolStripOpen, writeSymbolStripOpen } from '../src/lib/symbolInsert.js';
import { validateMathInput } from '../src/lib/validation.js';
import { solveProblem } from '../src/lib/api.js';

test('insertSymbol inserts at the selection and places the caret where the next thing goes', () => {
  const sqrt = SYMBOLS.find((s) => s.key === 'sqrt');
  assert.deepEqual(insertSymbol('', 0, 0, sqrt), { value: '√()', selectionStart: 2, selectionEnd: 2 });
  assert.deepEqual(insertSymbol('2 + ', 4, 4, sqrt), { value: '2 + √()', selectionStart: 6, selectionEnd: 6 });
  // A selection is replaced.
  assert.deepEqual(insertSymbol('x + y', 0, 5, SYMBOLS.find((s) => s.key === 'pi')), { value: 'π', selectionStart: 1, selectionEnd: 1 });
  // The definite integral leaves its lower bound selected for typing over.
  const def = insertSymbol('', 0, 0, SYMBOLS.find((s) => s.key === 'definite'));
  assert.equal(def.value, '∫_0^1  dx');
  assert.equal(def.value.slice(def.selectionStart, def.selectionEnd), '0');
  // Out-of-range selections are clamped.
  assert.equal(insertSymbol('ab', 10, 20, SYMBOLS.find((s) => s.key === 'square')).value, 'ab^2');
});

test('every symbol is a distinct 44px-target entry with a label, and parses once filled in', async () => {
  assert.equal(new Set(SYMBOLS.map((s) => s.key)).size, SYMBOLS.length);
  for (const s of SYMBOLS) {
    assert.ok(s.label.startsWith('Insert'), s.key);
    assert.ok(s.glyph.length <= 5, s.key);
    const caret = s.select ? s.select[0] : (s.caret ?? s.text.length);
    const filled = s.select ? s.text.slice(0, s.select[0]) + '2' + s.text.slice(s.select[1]) : s.text.slice(0, caret) + 'x' + s.text.slice(caret);
    // A bare operator needs operands around it to be a problem.
    const sample = /^[*^\/]|^ [≤≥=+-] $|^; $/.test(s.text) ? `x${s.text}2` : filled;
    assert.equal(validateMathInput(sample).isValid, true, `${s.key}: ${sample}`);
  }
});

test('the strip entries solve as real problems', async () => {
  const cases = [
    ['integrals', '∫ x^2 dx', /x\^3/],
    ['integrals', '∫_0^1 x^2 dx', /0\.3333|1\/3/],
    ['algebra', '√(x+1) = 3', /x = 8/],
    ['derivatives', 'd/dx(x^3)', /3x\^2/],
    ['limits', 'lim x->0 (sin(x)/x)', /= 1/],
    ['algebra', '|x - 2| = 5', /x = -3/],
    ['algebra', 'x^2 - 4 ≥ 0', /x ≤ -2/],
    ['trigonometry', 'sin(π/4)', /√2\/2/],
    ['other', '(3)/(4) * 2', /3\/2|1\.5/],
    ['other', '7 - 3 + 2 * 4 / 2', /8/],
    ['limits', 'lim x->∞ (1/x)', /= 0/],
    ['trigonometry', 'arcsin(1/2)', /π\/6/],
    ['trigonometry', 'cot(pi/4)', /1/],
    ['algebra', '2x + 3y = 6; x - y = 4', /x = 18\/5/],
  ];
  for (const [topic, problem, expected] of cases) {
    const r = await solveProblem(problem, topic);
    assert.match(String(r.answer), expected, problem);
  }
});

test('the strip remembers whether it was left open', () => {
  const data = {};
  const storage = { getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
  assert.equal(readSymbolStripOpen(storage), false);
  writeSymbolStripOpen(storage, true);
  assert.equal(readSymbolStripOpen(storage), true);
  writeSymbolStripOpen(storage, false);
  assert.equal(readSymbolStripOpen(storage), false);
  assert.equal(readSymbolStripOpen(null), false);
  assert.equal(readSymbolStripOpen({ getItem: () => { throw new Error('blocked'); } }), false);
});

test('every symbol belongs to a known group, every group has symbols, and the topic picks a group', () => {
  const keys = new Set(GROUPS.map((g) => g.key));
  for (const s of SYMBOLS) {
    assert.ok(s.groups.length >= 1 && s.groups.every((g) => keys.has(g)), s.key);
  }
  for (const g of GROUPS) assert.ok(symbolsInGroup(g.key).length >= 6, g.key);
  assert.ok(symbolsInGroup('basic').some((s) => s.key === 'plus'));
  assert.ok(symbolsInGroup('calculus').some((s) => s.key === 'integral'));
  assert.equal(groupForTopic('integrals'), 'calculus');
  assert.equal(groupForTopic('limits'), 'calculus');
  assert.equal(groupForTopic('trigonometry'), 'functions');
  assert.equal(groupForTopic('algebra'), 'algebra');
  assert.equal(groupForTopic('functions'), 'algebra');
  assert.equal(groupForTopic('other'), 'basic');
  assert.equal(groupForTopic(undefined), 'basic');
});
