// A limit with a parameter, as an r/mathematics commenter typed it
// (November 2026; 1.70.5): a word that might be a product says how to
// write it ("nx" itself is read as n*x since 1.71.0), and
// "sin(n*x)/x" says why it is refused and shows the case n = 3, rather than
// "beyond what this solver can compute".
import test from 'node:test';
import assert from 'node:assert/strict';
import { solvePlain } from './helpers/solvePlain.js';

test('letters that are not read as a product suggest writing one', async () => {
  // "nx" is read as n*x since 1.71.0 (tests/implicitLetters.test.js); three
  // letters without two of x, y, z still get the hint.
  const r = await solvePlain('abc + 1', 'algebra');
  assert.equal(r.status, 'parse_error');
  assert.match(r.answer, /"abc" is not a known function, constant or variable\. If you meant a product, write a\*b\*c\./);
  // A real word is not offered as a product.
  const w = await solvePlain('density of x^2', 'algebra');
  assert.doesNotMatch(w.answer, /If you meant a product/);
});

test('a limit with a parameter names it and shows a case with a number', async () => {
  for (const [p, letter, example] of [
    ['lim x->0 (sin(n*x)/x)', 'n', 'lim (x→0) (sin(3x)/x)'],
    ['lim x->0 sin(a*x)/x', 'a', 'lim (x→0) sin(3x)/x'],
  ]) {
    const r = await solvePlain(p, 'auto');
    assert.equal(r.status, 'unsupported', p);
    assert.equal(r.answer, `Limits with a parameter (${letter}) are not supported yet`, p);
    assert.ok(r.tips[0].includes(`Give ${letter} a number`), p);
    assert.ok(r.tips[0].includes(example), `${p}: ${r.tips[0]}`);
    assert.ok(!/replace x with/.test(r.tips[0]), p);
  }
});

test('a parameter that simplifies away is still worked', async () => {
  const r = await solvePlain('lim h->0 ((x+h)^2 - x^2)/h', 'auto');
  assert.equal(r.status, 'solved');
  assert.match(r.answer, /= 2x$/);
});
