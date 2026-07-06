import test from 'node:test';
import assert from 'node:assert/strict';

import {
  beautify,
  splitTerms,
  formatNumber,
  sampleFunction,
} from '../src/lib/solvers/solverUtils.js';

test('beautify drops explicit multiplication in coefficient products', () => {
  assert.equal(beautify('2*x'), '2x');
  assert.equal(beautify('2*x+3'), '2x + 3');
  assert.equal(beautify('2*(x+1)'), '2(x + 1)');
  assert.equal(beautify('2*sin(x)'), '2sin(x)');
});

test('beautify keeps multiplication where dropping it would be ambiguous', () => {
  // variable * function and fractional coefficients stay explicit
  assert.equal(beautify('sin(x)+x*cos(x)'), 'sin(x) + x*cos(x)');
  assert.equal(beautify('1/3*x^3'), '1/3*x^3');
  // exponents must not be merged into an implicit product
  assert.equal(beautify('x^2*y'), 'x^2*y');
});

test('beautify spaces binary operators but preserves signs and exponents', () => {
  assert.equal(beautify('x^2-4*x+3'), 'x^2 - 4x + 3');
  assert.equal(beautify('-exp(x)+x*exp(x)'), '-exp(x) + x*exp(x)');
  assert.equal(beautify('x^-2'), 'x^-2'); // negative exponent untouched
});

test('beautify removes redundant exponent of one', () => {
  assert.equal(beautify('x^1'), 'x');
  assert.equal(beautify('x^12'), 'x^12');
});

test('splitTerms separates top-level additive terms', () => {
  assert.deepEqual(
    splitTerms('x^2 - 4*x + 3').map((t) => t.signed),
    ['x^2', '-4*x', '3']
  );
  assert.deepEqual(
    splitTerms('-x^2 + 2').map((t) => t.signed),
    ['-x^2', '2']
  );
});

test('splitTerms keeps products, quotients, and exponents intact', () => {
  assert.deepEqual(splitTerms('(x+1)*(x-1)').map((t) => t.term), ['(x+1)*(x-1)']);
  assert.deepEqual(splitTerms('x/(x-1)').map((t) => t.term), ['x/(x-1)']);
  assert.deepEqual(splitTerms('x^-2 + 1').map((t) => t.signed), ['x^-2', '1']);
});

test('formatNumber cleans floating-point noise and trims zeros', () => {
  assert.equal(formatNumber(3.0000000001), '3');
  assert.equal(formatNumber(2.5), '2.5');
  assert.equal(formatNumber(0.7071067), '0.7071');
  assert.equal(formatNumber(Infinity), '∞');
});

test('sampleFunction skips undefined and exploding points', () => {
  const points = sampleFunction('1/x', 'x', { min: -2, max: 2, step: 0.5, cap: 1000 });
  // x = 0 is undefined (division) and must be skipped, not NaN-filled
  assert.ok(points.every((p) => Number.isFinite(p.y)));
  assert.ok(points.every((p) => p.x !== 0));
});
