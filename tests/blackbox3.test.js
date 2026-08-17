import test from 'node:test';
import assert from 'node:assert/strict';

import { solveProblem } from '../src/lib/api.js';
import { STATUS } from '../src/lib/solutionEnvelope.js';

// Findings from the third black-box pass (on v1.20.1).

// ── High: my own regression — underflow-to-zero tails.
test('e^(-x^2) = 0 has no solution: an underflowed-to-zero tail is not a touch root', async () => {
  // Was (v1.20.x): "x = -28.5 or -28 or … 28" — e^(-x²) is exactly 0 in floats
  // for |x| ≳ 27, so "0 ≤ 0 ≤ 0" passed the local-minimum test.
  const r = await solveProblem('e^(-x^2) = 0', 'algebra');
  assert.match(r.answer, /No real solution/);
  // real touch roots still count
  assert.match((await solveProblem('abs(x-1) = 0', 'algebra')).answer, /x = 1/);
  assert.match((await solveProblem('x*e^x = 0', 'algebra')).answer, /x = 0/);
});

// ── High: the degrees converter rewrote every integer.
test('sin(45)^2 = 1/2 — only the angle inside the trig call is converted to radians', async () => {
  // Was 0.988: sin(45)^2 became sin(45°)^(2°).
  assert.equal((await solveProblem('sin(45)^2', 'trigonometry')).answer, '1/2 (≈ 0.5)');
  assert.equal((await solveProblem('2*sin(30)', 'trigonometry')).answer, '1');
  assert.equal((await solveProblem('sin(30)^2 + cos(30)^2', 'trigonometry')).answer, '1');
});

// ── High: extraneous roots.
test('solutions that make the original equation undefined are rejected and explained', async () => {
  // Was: x = 0 or x = 1 (x = 1 zeroes both denominators).
  const r = await solveProblem('x^2/(x-1) = 1/(x-1) + 1', 'algebra');
  assert.equal(r.answer, 'x = 0');
  assert.match(r.steps.join('\n'), /x = 1 makes a denominator zero, so it is extraneous/);
  const none = await solveProblem('x/(x-2) = 2/(x-2)', 'algebra');
  assert.match(none.answer, /^No solution/);
});

// ── High: uppercase variable.
test('an uppercase variable is the same unknown as its lowercase form', async () => {
  // Was: "No real solution found" for 2X + 4 = 10.
  assert.equal((await solveProblem('2X + 4 = 10', 'algebra')).answer, 'x = 3');
  assert.equal((await solveProblem('3Y - 1 = 5', 'algebra')).answer, 'y = 2');
  // …without breaking the things that legitimately use capitals
  assert.equal((await solveProblem('C(5,2)', 'other')).answer, '10');
  assert.equal((await solveProblem('5C2', 'other')).answer, '10');
  assert.equal((await solveProblem('E^2', 'other')).answer, '7.3891');
  assert.equal((await solveProblem('PI/2', 'other')).answer, '1.5708');
});

// ── Medium: bare integral sign, "limit of" phrasing.
test('∫x dx and "limit of … as x approaches" are read', async () => {
  assert.match((await solveProblem('∫x dx', 'integrals')).answer, /1\/2\*x\^2 \+ C$/);
  assert.match((await solveProblem('∫ sin(x) dx', 'integrals')).answer, /-cos\(x\) \+ C$/);
  const l = await solveProblem('limit of (1+x)^(1/x) as x approaches 0', 'limits');
  assert.match(l.answer, /= 2\.7183$/);
  assert.doesNotMatch(l.answer, /limitof/);
});

// ── Medium: arcsin(2).
test('inverse trig outside [-1, 1] is "undefined for real numbers", not a raw complex', async () => {
  const r = await solveProblem('arcsin(2)', 'trigonometry');
  assert.equal(r.status, STATUS.UNDEFINED);
  assert.match(r.answer, /Undefined for real numbers/);
  assert.doesNotMatch(r.answer, /\d+\.\d{6,}/);
});

// ── Medium: divergent vs convergent improper integrals at an endpoint.
test('∫_0^1 1/x dx diverges — and says so; ∫_0^1 1/√x dx = 2', async () => {
  const d = await solveProblem('∫_0^1 1/x dx', 'integrals');
  assert.equal(d.status, STATUS.UNSUPPORTED);
  assert.match(d.answer, /^Diverges/);
  const c = await solveProblem('∫_0^1 1/sqrt(x) dx', 'integrals');
  assert.equal(c.status, STATUS.SOLVED);
  assert.match(c.answer, /= 2$/);
  assert.match((await solveProblem('∫_0^4 1/sqrt(4-x) dx', 'integrals')).answer, /= 4$/);
});

// ── Medium: domain line and asymptote line agree.
test('1/sin(x): the domain excludes every pole the asymptote finder found', async () => {
  const r = await solveProblem('1/sin(x)', 'functions');
  assert.match(r.answer, /domain: x ≠ -9\.4248, -6\.2832, -3\.1416, 0, 3\.1416, 6\.2832, 9\.4248;/);
});

// ── Medium: N/D′ substitution.
test('u = denominator works when Algebrite normalises the ratio', async () => {
  assert.match((await solveProblem('(x+1)/(x^2+2x)', 'integrals')).answer, /1\/2\*ln\|x\^2 \+ 2x\| \+ C$/);
  assert.match((await solveProblem('x^2/(x^3+1)', 'integrals')).answer, /1\/3\*ln\|x\^3 \+ 1\| \+ C$/);
});

// ── Low tail from the same pass.
test('trig-equation solutions at π/8, π/18 display exactly', async () => {
  const r = await solveProblem('tan(2x) = 1', 'trigonometry');
  assert.match(r.answer, /on \[0, 2π\): π\/8, 5π\/8, 9π\/8, 13π\/8/);
  const s = await solveProblem('sin(3x) = 1/2', 'trigonometry');
  assert.match(s.answer, /π\/18, 5π\/18/);
});

test('sin(2x)/sin(x) → 2cos(x); scientific notation; "2 x 3"', async () => {
  assert.equal((await solveProblem('sin(2x)/sin(x)', 'trigonometry')).answer, '2cos(x)');
  assert.equal((await solveProblem('1e3 + 1', 'other')).answer, '1001');
  assert.equal((await solveProblem('2.5e-2 * 4', 'other')).answer, '0.1');
  assert.equal((await solveProblem('2 x 3', 'other')).answer, '6');
  // e as a constant is untouched
  assert.equal((await solveProblem('e^2', 'other')).answer, 'e^2 ≈ 7.3891');
});

test('odd roots are real for negative x in function analysis; cusp vs slow-stationary', async () => {
  const c = await solveProblem('x^(1/3)', 'functions');
  assert.match(c.answer, /domain: all real numbers/);
  const t = await solveProblem('x^(2/3)', 'functions');
  assert.match(t.answer, /domain: all real numbers/);
  assert.match(t.answer, /local minimum \(0, 0\) \(cusp\)/);
  // x^(4/3) IS differentiable at 0 (f' = (4/3)x^(1/3) → 0): not a cusp
  const f = await solveProblem('x^(4/3)', 'functions');
  assert.match(f.answer, /local minimum \(0, 0\)\./);
  assert.doesNotMatch(f.answer, /cusp/);
  // even roots keep their restricted domain
  assert.match((await solveProblem('x^(1/2)', 'functions')).answer, /domain: x ≥ 0/);
});
