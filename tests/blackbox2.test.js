import test from 'node:test';
import assert from 'node:assert/strict';

import { solveProblem } from '../src/lib/api.js';
import { STATUS } from '../src/lib/solutionEnvelope.js';

// Findings from the second black-box pass (on v1.19.0). Each pins the wrong
// output that shipped, so it cannot return silently.

// ── High: asymptotic near-zero mistaken for a root.

test('e^x = 0 has no solution — decaying tails are not roots', async () => {
  // Was: x = -9 or x = -8.5 or … (e^-9 ≈ 1e-4 passed a loose |f| < 1e-3 test).
  const r = await solveProblem('e^x = 0', 'algebra');
  assert.equal(r.status, STATUS.SOLVED);
  assert.match(r.answer, /No real solution/);
  const r2 = await solveProblem('e^(-x) = 0', 'algebra');
  assert.match(r2.answer, /No real solution/);
  const r3 = await solveProblem('1/x = 0', 'algebra');
  assert.match(r3.answer, /No real solution/);
});

test('genuine touch roots still count', async () => {
  const r = await solveProblem('abs(x-1) = 0', 'algebra');
  assert.match(r.answer, /x = 1/);
});

test('e^(-x^2) has no x-intercepts — decaying tails are not intercepts', async () => {
  // Was: "x-intercepts at x = -10, -9.95, -9.9, …" — a fabricated feature.
  const r = await solveProblem('e^(-x^2)', 'functions');
  assert.match(r.answer, /no x-intercepts/);
  assert.equal(r.graph.annotations.intercepts.length, 0);
});

test('an exact-zero sample is one root, not three', async () => {
  // Was: x^3 → "x-intercepts at x = -0.0001, 0, 0.0001".
  const r = await solveProblem('x^3', 'functions');
  assert.match(r.answer, /x-intercept at x = 0;/);
  assert.equal(r.graph.annotations.intercepts.length, 1);
});

// ── High: a root between two poles was stepped over.

test('1/x + 1/(x+1) = 1 has both roots (1 ± √5)/2', async () => {
  // Was: x = 1.618 only; -0.618 sits between the poles at -1 and 0.
  const r = await solveProblem('1/x + 1/(x+1) = 1', 'algebra');
  assert.match(r.answer, /-0\.618/);
  assert.match(r.answer, /1\.618/);
});

// ── High: tan(x) claimed "domain: all real numbers" with no asymptotes.

test('tan(x): asymptotes at π/2 + kπ are found even though no grid point hits them', async () => {
  const r = await solveProblem('tan(x)', 'functions');
  const va = r.graph.annotations.verticalAsymptotes;
  assert.ok(va.some((a) => Math.abs(a - Math.PI / 2) < 1e-3), `π/2 missing from ${va}`);
  assert.ok(va.some((a) => Math.abs(a + Math.PI / 2) < 1e-3));
  assert.match(r.answer, /domain: all real numbers except x = /);
  assert.doesNotMatch(r.answer, /domain: all real numbers;/);
  // and no duplicates from the two candidate sources
  const sorted = [...va].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i += 1) assert.ok(sorted[i] - sorted[i - 1] > 1e-3, 'duplicate asymptote');
});

test('an off-grid pole is reported once', async () => {
  // 1/(3x-1): the symbolic root 1/3 and the numeric bisection both find it.
  const r = await solveProblem('1/(3x-1)', 'functions');
  assert.deepEqual(r.graph.annotations.verticalAsymptotes.length, 1);
  assert.match(r.answer, /vertical asymptote x = 0\.3333;/);
});

test('domain lists print every asymptote at full precision', async () => {
  // .map(formatNumber) passed the array index as the decimals argument:
  // "-8, -4.7, -1.57, 1.571 …". Every value must have the same precision.
  const r = await solveProblem('tan(x)', 'functions');
  assert.match(r.answer, /except x = -7\.854, -4\.7124, -1\.5708, 1\.5708, 4\.7124, 7\.854/);
});

// ── Medium: definite integrals of |x| and substitution integrands.

test('∫_{-1}^{1} |x| dx = 1 via the per-term antiderivative (Algebrite defint has no abs)', async () => {
  const r = await solveProblem('∫_-1^1 abs(x) dx', 'integrals');
  assert.equal(r.status, STATUS.SOLVED);
  assert.match(r.answer, /= 1$/);
  assert.match(r.steps.join('\n'), /F\(x\) = 1\/2\*x\*abs\(x\)/);
});

test('definite integrals prefer the exact FTC value when Algebrite can form one', async () => {
  const r = await solveProblem('∫_0^1 x*cos(x^2) dx', 'integrals');
  assert.match(r.answer, /1\/2\*sin\(1\) \(≈ 0\.4207\)/);
});

// ── Medium: denominators as substitution candidates.

test('u = denominator: (2x+3)/(x²+3x+5) and eˣ/(1+eˣ)', async () => {
  const a = await solveProblem('(2x+3)/(x^2+3x+5)', 'integrals');
  assert.equal(a.status, STATUS.SOLVED);
  assert.match(a.answer, /ln\|x\^2 \+ 3x \+ 5\| \+ C$/);
  const b = await solveProblem('e^x/(1+e^x)', 'integrals');
  assert.equal(b.status, STATUS.SOLVED);
  assert.match(b.answer, /ln\|1 \+ exp\(x\)\| \+ C$/);
});

// ── Medium: no imaginary unit in a real integral.

test('∫ e^(x²) dx is refused as non-elementary (erfi), never shown with i', async () => {
  const r = await solveProblem('e^(x^2)', 'integrals');
  assert.equal(r.status, STATUS.UNSUPPORTED);
  assert.match(r.answer, /erfi/);
  assert.doesNotMatch(r.answer, /\bi\b/);
});

// ── Small: repeated roots.

test('a repeated root is stated once, with its multiplicity', async () => {
  const r = await solveProblem('x^2 = 0', 'algebra');
  assert.equal(r.answer, 'x = 0 (repeated root, multiplicity 2)');
});
