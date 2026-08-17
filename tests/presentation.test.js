import test from 'node:test';
import assert from 'node:assert/strict';

import { solveProblem } from '../src/lib/api.js';
import { STATUS } from '../src/lib/solutionEnvelope.js';

// ── QA report (Low): exact-first number presentation.

test('arithmetic: rational results are shown as fractions first, decimal alongside', async () => {
  assert.equal((await solveProblem('1/3+1/6', 'other')).answer, '1/2 (= 0.5)');
  assert.equal((await solveProblem('2/3', 'other')).answer, '2/3 (= 0.6667)');
  assert.equal((await solveProblem('0.1+0.2', 'other')).answer, '3/10 (= 0.3)');
  // integers stay integers; irrationals stay decimal
  assert.equal((await solveProblem('(5 + 3) * 4 - 2^3', 'other')).answer, '24');
  assert.equal((await solveProblem('sqrt(2)', 'other')).answer, '1.4142');
});

test('arithmetic: constant expressions in e and π keep the exact form', async () => {
  assert.equal((await solveProblem('e^2', 'other')).answer, 'e^2 ≈ 7.3891');
  assert.equal((await solveProblem('e', 'other')).answer, 'e ≈ 2.7183');
  assert.equal((await solveProblem('pi/4', 'other')).answer, 'π/4 ≈ 0.7854');
  assert.equal((await solveProblem('2*pi', 'other')).answer, '2π ≈ 6.2832');
  // but not when a function call is involved — that has its own exact value
  assert.equal((await solveProblem('sin(pi/6)', 'other')).answer, '0.5');
});

test('arithmetic: division by zero is undefined, not ∞', async () => {
  // Was "∞ (1/0)" / "NaN (0/0)" through v1.23.1 — a number where there is
  // none. ∞ describes how a limit behaves; it is not the value of 1/0, and
  // "-∞" was being handed back as the answer to (5+3)*4 - 2^3/0.
  const byZero = await solveProblem('1/0', 'other');
  assert.equal(byZero.status, 'undefined');
  assert.equal(byZero.answer, 'Undefined — division by zero');

  const zeroOverZero = await solveProblem('0/0', 'other');
  assert.equal(zeroOverZero.status, 'indeterminate');
  assert.equal(zeroOverZero.answer, 'Indeterminate (0/0)');

  // Buried in a larger expression, and behind a denominator that works out
  // to zero rather than being written as one.
  assert.equal((await solveProblem('(5 + 3) * 4 - 2^3 / 0', 'other')).status, 'undefined');
  assert.equal((await solveProblem('8/(3-3)', 'other')).status, 'undefined');

  // Overflow is still its own thing, and ordinary division is untouched.
  assert.equal((await solveProblem('9999999999^9999', 'other')).status, 'overflow');
  assert.equal((await solveProblem('1/0.5', 'other')).answer, '2');
});

test('trigonometry: special values exact-first, inverse trig as multiples of π', async () => {
  assert.equal((await solveProblem('sin(pi/4)', 'trigonometry')).answer, '√2/2 (≈ 0.7071)');
  assert.equal((await solveProblem('cos(60)', 'trigonometry')).answer, '1/2 (≈ 0.5)');
  assert.equal((await solveProblem('tan(pi/3)', 'trigonometry')).answer, '√3 (≈ 1.7321)');
  assert.equal((await solveProblem('arcsin(1/2)', 'trigonometry')).answer, 'π/6 (≈ 0.5236)');
  assert.equal((await solveProblem('asin(1/2)', 'trigonometry')).answer, 'π/6 (≈ 0.5236)');
  assert.equal((await solveProblem('arccos(0)', 'trigonometry')).answer, 'π/2 (≈ 1.5708)');
  assert.equal((await solveProblem('arctan(-1)', 'trigonometry')).answer, '-π/4 (≈ -0.7854)');
  // non-special stays decimal
  assert.equal((await solveProblem('arcsin(0.3)', 'trigonometry')).answer, '0.3047');
  assert.equal((await solveProblem('sin(1)', 'trigonometry')).answer, '0.8415');
});

// ── QA report (Low): "50% of 80".

test('percent notation: N% of M and bare N%', async () => {
  const r = await solveProblem('50% of 80', 'other');
  assert.equal(r.status, STATUS.SOLVED);
  assert.equal(r.answer, '40');
  assert.match(r.steps.join('\n'), /Percent means "per hundred"/);
  assert.equal((await solveProblem('25%', 'other')).answer, '1/4 (= 0.25)');
  assert.equal((await solveProblem('12.5% of 200', 'other')).answer, '25');
});

// ── QA report (Medium): function analysis "Final Answer" summarises findings.

test('function analysis: the answer summarises the findings, not the input', async () => {
  const q = await solveProblem('x^2-4*x+3', 'functions');
  assert.equal(q.answer, 'f(x) = x^2 - 4x + 3: domain: all real numbers; y-intercept (0, 3); x-intercepts at x = 1, 3; vertex (2, -1) (minimum), axis x = 2.');
  const r = await solveProblem('1/(x-2)', 'functions');
  assert.match(r.answer, /domain: x ≠ 2/);
  assert.match(r.answer, /vertical asymptote x = 2/);
  assert.match(r.answer, /horizontal asymptote y = 0/);
  const s = await solveProblem('sqrt(x-2)', 'functions');
  assert.match(s.answer, /domain: x ≥ 2/);
  assert.match(s.answer, /absolute minimum \(2, 0\) at the domain endpoint/);
  const h = await solveProblem('(x^2-1)/(x-1)', 'functions');
  assert.match(h.answer, /hole at \(1, 2\)/);
  const a = await solveProblem('abs(x)', 'functions');
  assert.match(a.answer, /local minimum \(0, 0\) \(cusp\)/);
});

// ── QA report (Low): integration fallback wording distinguishes the two claims.

test('integration: engine limitation is not dressed up as non-elementarity', async () => {
  // Beyond the engine (has an elementary antiderivative in fact) → limitation wording.
  const r = await solveProblem('x^x', 'integrals'); // genuinely no elementary antiderivative, but not in the known list
  assert.equal(r.status, STATUS.UNSUPPORTED);
  assert.match(r.answer, /could not solve this integral symbolically/);
  assert.doesNotMatch(r.answer, /non-elementary/);
  // Known non-elementary → the theorem is stated.
  const s = await solveProblem('sin(x^2)', 'integrals');
  assert.match(s.answer, /non-elementary/);
  assert.match(s.answer, /Fresnel/);
});
