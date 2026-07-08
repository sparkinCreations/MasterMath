// Regression suite — each block pins a specific bug that shipped (or nearly
// shipped) so it can never return silently. Cite the original wrong output in
// a comment when adding a case; that context is what makes a failure here
// immediately diagnosable.

import test from 'node:test';
import assert from 'node:assert/strict';

import { solveLimit } from '../src/lib/solvers/otherSolvers.js';
import { solveDerivative } from '../src/lib/solvers/derivativesSolver.js';
import { solveIntegral } from '../src/lib/solvers/integralsSolver.js';
import { solveAlgebra } from '../src/lib/solvers/algebraSolver.js';

// ---------------------------------------------------------------------------
// Limits: cancellation-prone 0/0 forms (fixed July 2026, v1.3.1)
// Numeric-only sampling returned confidently wrong answers through
// floating-point cancellation — e.g. (1-cos(x))/x^2 -> 0 instead of 0.5,
// (sin(x)-x)/x^3 -> 0 instead of -1/6. The symbolic ladder (simplify ->
// Taylor -> L'Hôpital) resolves these exactly and marks them verified.
// ---------------------------------------------------------------------------

test('regression: (1-cos(x))/x^2 at 0 is 0.5, not 0', async () => {
  const r = await solveLimit('lim x->0 (1-cos(x))/x^2');
  assert.match(r.answer, /=\s*0\.5$/);
  assert.equal(r.verified, true);
});

test('regression: (sin(x)-x)/x^3 at 0 is -1/6, not 0', async () => {
  const r = await solveLimit('lim x->0 (sin(x)-x)/x^3');
  assert.match(r.answer, /=\s*-0\.1667$/);
  assert.equal(r.verified, true);
});

test('regression: (tan(x)-sin(x))/x^3 at 0 is 0.5', async () => {
  const r = await solveLimit('lim x->0 (tan(x)-sin(x))/x^3');
  assert.match(r.answer, /=\s*0\.5$/);
});

test('regression: (sqrt(1+x)-1)/x at 0 is 0.5 (rationalization family)', async () => {
  const r = await solveLimit('lim x->0 (sqrt(1+x)-1)/x');
  assert.match(r.answer, /=\s*0\.5$/);
});

test('regression: log(x)/(x-1) at 1 is 1', async () => {
  const r = await solveLimit('lim x->1 (log(x))/(x-1)');
  assert.match(r.answer, /=\s*1$/);
});

// The symbolic ladder must not resurrect the tan(pi/2) float blow-up: an
// Algebrite substitution AT an asymptote yields ~1.6e16 rounding noise, which
// the ladder's simplify rung initially accepted (caught in review before
// shipping). The magnitude guard in algebriteNumber rejects it so the numeric
// rung reports divergence instead.
test('regression: lim tan(x) at pi/2 stays "Does not exist", never 1.6e16', async () => {
  const r = await solveLimit('lim x->pi/2 tan(x)');
  assert.match(r.answer, /Does not exist$/);
  assert.doesNotMatch(r.answer, /\d{8,}/);
});

// Direct substitution still wins for continuous functions (ladder rung 1) —
// and reports its method honestly.
test('regression: continuous limits still use direct substitution', async () => {
  const r = await solveLimit('lim x->2 x^2 + 1');
  assert.match(r.answer, /=\s*5$/);
  assert.equal(r.verificationMethod, 'direct substitution');
});

// ---------------------------------------------------------------------------
// Reciprocal trig: sec/csc/cot (fixed July 2026, v1.3.1)
// Algebrite has no sec/csc/cot: derivatives came back as the unevaluated
// literal "d(sec(x),x)" and integrals threw "Unsupported function sec".
// rewriteReciprocalTrig converts to sin/cos forms before the handoff.
// ---------------------------------------------------------------------------

test('regression: d/dx sec(x) is evaluated, not the literal d(sec(x),x)', async () => {
  const r = await solveDerivative('sec(x)');
  assert.doesNotMatch(r.answer, /d\(sec/);
  assert.match(r.answer, /sin\(x\)/); // sec'(x) = sin(x)/cos^2(x)
});

test('regression: d/dx csc(x) and cot(x) are evaluated', async () => {
  const csc = await solveDerivative('csc(x)');
  assert.doesNotMatch(csc.answer, /d\(csc/);
  const cot = await solveDerivative('cot(x)');
  assert.doesNotMatch(cot.answer, /d\(cot/);
});

test('regression: integral of sec(x)^2 is tan(x) + C, not a failure', async () => {
  const r = await solveIntegral('sec(x)^2');
  assert.match(r.answer, /tan\(x\) \+ C$/);
});

// ---------------------------------------------------------------------------
// Cubic roots (fixed July 2026, v1.3.1)
// Algebrite's symbolic roots for many cubics emit principal-complex-root
// notation like "-2*(-1)^(1/3)" for x^3 = 8 — unreadable, and wrong as the
// real solution. The polynomialRoot fallback recomputes numerically.
// ---------------------------------------------------------------------------

test('regression: x^3 = 8 yields x = 2, not -2*(-1)^(1/3)', async () => {
  const r = await solveAlgebra('x^3 = 8');
  assert.match(r.answer, /x = 2/);
  assert.doesNotMatch(r.answer, /\(-1\)\^/);
  // The complex pair is reported too.
  assert.match(r.answer, /i/);
});

test('regression: quadratics still take the exact-radical path', async () => {
  // Guard that the cubic fallback did not hijack the quadratic flow.
  const r = await solveAlgebra('x^2 = 2');
  assert.match(r.answer, /2\^\(1\/2\)/);
});
