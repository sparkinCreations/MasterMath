// The mathjs instance is built from an explicit dependency list
// (src/lib/mathInstance.js) instead of `create(all)`, so the bundle does not
// carry matrices, units and bignumbers. The price is that a function missing
// from the list throws "Undefined function" only when a student types it.
// This battery evaluates every function and constant the input layer accepts
// through the app's own instance, so a missing one fails here instead.

import test from 'node:test';
import assert from 'node:assert/strict';

import { math } from '../src/lib/solvers/solverUtils.js';
import { createMath } from '../src/lib/mathInstance.js';
import { solveProblem } from '../src/lib/api.js';

const BATTERY = [
  ['sin(pi/6)', 0.5], ['cos(0)', 1], ['tan(pi/4)', 1], ['sec(0)', 1], ['csc(pi/2)', 1], ['cot(pi/4)', 1],
  ['asin(1)', Math.PI / 2], ['acos(1)', 0], ['atan(1)', Math.PI / 4], ['atan2(1, 1)', Math.PI / 4],
  ['arcsin(1)', Math.PI / 2], ['arccos(1)', 0], ['arctan(1)', Math.PI / 4],
  ['sinh(0)', 0], ['cosh(0)', 1], ['tanh(0)', 0], ['asinh(0)', 0], ['acosh(1)', 0], ['atanh(0)', 0],
  ['sqrt(16)', 4], ['cbrt(-8)', -2], ['nthRoot(32, 5)', 2], ['abs(-3)', 3], ['exp(0)', 1],
  ['log(e)', 1], ['ln(e)', 1], ['log10(1000)', 3], ['log2(8)', 3],
  ['floor(2.7)', 2], ['ceil(2.1)', 3], ['round(2.5)', 3], ['fix(-2.7)', -2], ['sign(-9)', -1], ['sgn(9)', 1], ['gamma(5)', 24],
  ['5!', 120], ['combinations(5, 2)', 10], ['permutations(5, 2)', 20], ['gcd(12, 18)', 6], ['lcm(4, 6)', 12],
  ['7 mod 3', 1], ['max(1, 5)', 5], ['min(1, 5)', 1], ['hypot(3, 4)', 5], ['square(3)', 9], ['cube(2)', 8],
  ['re(3 + 4i)', 3], ['im(3 + 4i)', 4], ['arg(i)', Math.PI / 2], ['re(conj(3 + 4i))', 3],
  ['2 * tau / pi', 4], ['-(-2)', 2], ['+2', 2], ['2^10 / 4', 256],
];

test('every function and constant the input layer accepts evaluates through the app instance', () => {
  for (const [expr, expected] of BATTERY) {
    let value;
    try {
      value = math.evaluate(expr);
    } catch (err) {
      assert.fail(`${expr} threw: ${err.message}`);
    }
    const n = typeof value === 'number' ? value : Number(value);
    assert.ok(Math.abs(n - expected) < 1e-9, `${expr} = ${String(value)}, expected ${expected}`);
  }
});

test('non-finite and complex results still come through as values, not throws', () => {
  assert.equal(math.evaluate('1/0'), Infinity);
  assert.ok(Number.isNaN(math.evaluate('0/0')));
  assert.ok(Number.isNaN(math.evaluate('Infinity - Infinity')));
  const c = math.evaluate('sqrt(-4)');
  assert.equal(c.im, 2);
  assert.equal(math.evaluate('2*x + 1 < 5', { x: 1 }), true);
});

test('the symbolic and formatting APIs the solvers call are present', () => {
  assert.equal(math.simplify('2*x + 3*x').toString(), '5 * x');
  const roots = math.polynomialRoot(-8, 0, 0, 1).map((r) => (typeof r === 'number' ? r : r.re));
  assert.ok(roots.some((r) => Math.abs(r - 2) < 1e-9));
  const threeQuarters = math.fraction(0.75);
  assert.equal(`${threeQuarters.n}/${threeQuarters.d}`, '3/4');
  assert.equal(math.format(math.complex(1, 1.7321), { precision: 5 }), '1 + 1.7321i');
  assert.equal(math.number(math.fraction(1, 4)), 0.25);
  assert.equal(math.typeOf(math.fraction(1, 3)), 'Fraction');
  assert.doesNotThrow(() => math.parse('x^2 + 3*x'));
  assert.throws(() => math.parse('x^2 +* 3'));
});

test('the Fraction-configured instance used by Arithmetic stays exact', () => {
  const exact = createMath({ number: 'Fraction' });
  assert.equal(exact.typeOf(exact.evaluate('1/3 + 1/6')), 'Fraction');
  assert.equal(String(exact.evaluate('1/3 + 1/6')), '0.5');
});

test('partial fractions still decompose without the mathjs matrix subsystem', async () => {
  const r = await solveProblem('∫ 1/((x-1)(x+2)) dx', 'integrals');
  assert.equal(r.status, 'solved');
  assert.match(r.answer, /ln\|x - 1\|/);
  assert.match(r.answer, /ln\|x \+ 2\|/);
  const quad = await solveProblem('∫ 1/((x-1)(x^2+1)) dx', 'integrals');
  assert.equal(quad.status, 'solved');
  assert.match(quad.answer, /arctan\(x\)|atan\(x\)/);
});

test('uppercase constants, the error function, and the named constants the parser protects are present', () => {
  assert.ok(Math.abs(math.evaluate('E^2') - Math.E ** 2) < 1e-9);
  assert.ok(Math.abs(math.evaluate('PI') - Math.PI) < 1e-12);
  assert.ok(Math.abs(math.evaluate('erf(1)') - 0.8427007929) < 1e-9);
  assert.ok(Math.abs(math.evaluate('SQRT2 * SQRT1_2') - 1) < 1e-12);
  assert.ok(Math.abs(math.evaluate('LN2 + LN10 + LOG2E + LOG10E + phi') - (Math.LN2 + Math.LN10 + Math.LOG2E + Math.LOG10E + 1.618033988749895)) < 1e-9);
  assert.ok(Math.abs(math.evaluate('expm1(0) + log1p(0)')) < 1e-12);
});
