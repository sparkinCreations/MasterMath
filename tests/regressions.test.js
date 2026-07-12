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
import { solveProblem } from '../src/lib/api.js';

// ---------------------------------------------------------------------------
// Limits: cancellation-prone 0/0 forms (fixed July 2026, v1.3.1)
// Numeric-only sampling returned confidently wrong answers through
// floating-point cancellation — e.g. (1-cos(x))/x^2 -> 0 instead of 0.5,
// (sin(x)-x)/x^3 -> 0 instead of -1/6. The symbolic ladder (simplify ->
// Taylor -> L'Hôpital) resolves these exactly and marks them verified.
// ---------------------------------------------------------------------------

test('regression: (1-cos(x))/x^2 at 0 is 0.5, not 0', async () => {
  // As of v1.9.1 removable limits report the exact fraction (1/2), not 0.5.
  const r = await solveLimit('lim x->0 (1-cos(x))/x^2');
  assert.match(r.answer, /=\s*1\/2$/);
  assert.equal(r.verified, true);
});

test('regression: (sin(x)-x)/x^3 at 0 is -1/6, not 0', async () => {
  const r = await solveLimit('lim x->0 (sin(x)-x)/x^3');
  assert.match(r.answer, /=\s*-1\/6$/); // exact form (was shown as -0.1667)
  assert.equal(r.verified, true);
});

test('regression: (tan(x)-sin(x))/x^3 at 0 is 1/2', async () => {
  const r = await solveLimit('lim x->0 (tan(x)-sin(x))/x^3');
  assert.match(r.answer, /=\s*1\/2$/);
});

test('regression: (sqrt(1+x)-1)/x at 0 is 1/2 (rationalization family)', async () => {
  const r = await solveLimit('lim x->0 (sqrt(1+x)-1)/x');
  assert.match(r.answer, /=\s*1\/2$/);
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

// ---------------------------------------------------------------------------
// July 2026 evaluation — Wave 1 fixes (fixed July 2026)
// Each cites the eval CSV row it pins. These go through solveProblem (the real
// app pipeline) because several bugs lived in the parser, not the solver.
// ---------------------------------------------------------------------------

test('regression: eval — d/dx arctan(x) is 1/(x^2+1), not 0', async () => {
  // Was f'(a) = 0: extractVariable picked "a" from "arctan" (not in the
  // function-name list), so Algebrite differentiated w.r.t. the wrong variable.
  const r = await solveProblem('arctan(x)', 'derivatives');
  assert.doesNotMatch(r.answer, /f'\(a\)/);
  assert.match(r.answer.replace(/\s+/g, ''), /1\/\(x\^2\+1\)/);
});

test('regression: eval — 7! evaluates to 5040, not 7', async () => {
  // The trailing "!" was stripped as sentence punctuation before evaluation.
  const r = await solveProblem('7!', 'other');
  assert.equal(r.answer, '5040');
});

test('regression: eval — C(5,2) evaluates to 10 (combinatorics notation)', async () => {
  const r = await solveProblem('C(5,2)', 'other');
  assert.equal(r.answer, '10');
});

test('regression: eval — lim abs(x)/x at 0 does not exist, not 0', async () => {
  // The symbolic ladder returned a spurious, unverified 0; the verification
  // gate now falls through to numeric two-sided sampling → DNE.
  const r = await solveLimit('lim x->0 abs(x)/x');
  assert.match(r.answer, /Does not exist$/);
});

test('regression: eval — definite integrals compute via FTC (built v1.9.0)', async () => {
  // Was a refuse-clearly guard ("not supported yet"); now a real capability.
  // The eval's own row for this input expected 0.5.
  const r = await solveProblem('definite ∫_0^1 x dx', 'integrals');
  assert.match(r.answer, /=\s*1\/2/);
  assert.doesNotMatch(r.answer, /\+ C\s*$/); // definite, so no constant
});

test('regression: eval — systems of equations solve via Cramer (built v1.10.0)', async () => {
  // Was a refuse-clearly guard; now a real 2×2 solver with exact fractions.
  const r = await solveProblem('2x+3y=6; x-y=4', 'algebra');
  assert.equal(r.answer, 'x = 18/5,  y = -2/5');
  assert.equal(r.verified, true);
});

test('regression: eval — integral of 1/x displays ln|x|, not log(x)', async () => {
  const r = await solveIntegral('1/x');
  assert.match(r.answer, /ln\|x\| \+ C$/);
});

test('regression: eval — ln(x) is evaluable numerically (mathjs alias)', async () => {
  // mathjs has no "ln"; without the alias, graphs/sampling of ln died silently.
  const { math } = await import('../src/lib/solvers/solverUtils.js');
  assert.ok(Math.abs(math.evaluate('ln(exp(1))') - 1) < 1e-9);
});

// ---------------------------------------------------------------------------
// July 2026 evaluation — Wave 2: Functions/Graphing rebuild (fixed July 2026)
// The old module guessed features from coarse samples: a MIDPOINT fallback
// fabricated a "vertex" for monotonic functions, and any |y| < 0.1 sample was
// called an "intercept" (inventing intercepts near -10 for decaying tails).
// The rebuild computes features from f'(x)=0 / real roots and never fabricates.
// ---------------------------------------------------------------------------

test('regression: eval — exp(x) gets no fabricated vertex or intercepts', async () => {
  // Was: "vertex near (-1.5, 0.22); x-intercepts near -10, -9.5, -9".
  const r = await solveProblem('exp(x)', 'functions');
  assert.equal(r.features.extrema.length, 0);
  assert.equal(r.features.xIntercepts.list.length, 0);
  assert.equal(r.features.monotonic, 'increasing');
  assert.equal(r.features.yIntercept.y, 1);
});

test('regression: eval — 1/(x-2) reports the asymptote, not fake intercepts', async () => {
  // Was: "x-intercepts near -10, -9.5, -9" with no mention of x = 2.
  const r = await solveProblem('1/(x-2)', 'functions');
  assert.deepEqual(r.features.verticalAsymptotes, [2]);
  assert.equal(r.features.xIntercepts.list.length, 0);
  assert.ok(r.steps.some((s) => /vertical asymptote/i.test(s)));
});

test('regression: eval — sqrt(x-3) gets its domain and (3,0), not a fake vertex', async () => {
  // Was: "vertex near (6.5, 1.87)"; domain ignored.
  const r = await solveProblem('sqrt(x-3)', 'functions');
  assert.equal(r.features.extrema.length, 0);
  assert.ok(r.features.domain.some((d) => Math.abs(d.to - 3) < 1e-3));
  assert.ok(r.features.xIntercepts.list.some((i) => Math.abs(i.numeric - 3) < 1e-3));
});

test('regression: eval — ln(x) finds its (1,0) intercept', async () => {
  // Was: "no x-intercepts found" (mathjs has no ln; every evaluation died).
  const r = await solveProblem('ln(x)', 'functions');
  assert.ok(r.features.xIntercepts.list.some((i) => Math.abs(i.numeric - 1) < 1e-6));
});

test('regression: eval — x^3 - x extrema come from f\'(x)=0, not samples', async () => {
  // Was: "vertex near (-0.5, 0.375)"; true extrema are at ±1/√3 ≈ ±0.5774.
  const r = await solveProblem('x^3 - x', 'functions');
  const max = r.features.extrema.find((e) => e.kind === 'max');
  assert.ok(max && Math.abs(max.x + 1 / Math.sqrt(3)) < 1e-3);
  assert.ok(r.features.inflections.some((i) => Math.abs(i.x) < 1e-6));
});

test('regression: eval — log(x^2) domain excludes 0, zeros at ±1', async () => {
  const r = await solveProblem('log(x^2)', 'functions');
  assert.ok(r.features.domain.some((d) => Math.abs(d.from) < 1e-3 && Math.abs(d.to) < 1e-3));
  const xs = r.features.xIntercepts.list.map((i) => i.numeric);
  assert.ok(xs.includes(1) && xs.includes(-1));
});

test('regression: broken-domain functions never claim global monotonicity', async () => {
  // 1/(x-2) decreases on each side of its asymptote but not "on ℝ".
  const r = await solveProblem('1/(x-2)', 'functions');
  assert.equal(r.features.monotonic, null);
});

// ---------------------------------------------------------------------------
// Wave 3 presentation: graph annotation payloads (July 2026)
// GraphViewer renders these; the solvers must supply them.
// ---------------------------------------------------------------------------

test('functions graphs carry annotations (extrema, intercepts, asymptotes)', async () => {
  const r = await solveProblem('x^3 - x', 'functions');
  const ann = r.graph.annotations;
  assert.ok(ann.extrema.length === 2);
  assert.ok(ann.intercepts.some((p) => p.x === 0));
  const asym = await solveProblem('1/(x-2)', 'functions');
  assert.deepEqual(asym.graph.annotations.verticalAsymptotes, [2]);
});

test('limit graphs carry the approach guideline and finite limit point', async () => {
  const r = await solveLimit('lim x->2 (x^2 - 4)/(x - 2)');
  const ann = r.graph.annotations;
  assert.equal(ann.guideline.x, 2);
  assert.equal(ann.limitPoint.y, 4);
  // Window opens centered on the approach point with wider pannable data.
  assert.equal(r.graph.initialWindow.xMin, -8);
  assert.ok(r.graph.points.length > 0);
  assert.ok(r.graph.points[0].x <= -25);
});

// ---------------------------------------------------------------------------
// Wave 1 quality tail (July 2026 evaluation, items B2-B5 in ANALYSIS.md)
// Four "Partial" behaviours: one-sided limit notation silently degraded to
// the two-sided limit; "factor" echoed the input back; sqrt(50) answered a
// decimal instead of 5√2; sin(x)^2 + cos(x)^2 was "Unable to evaluate".
// ---------------------------------------------------------------------------

// B2 — one-sided limits. "lim x->0+ 1/x" used to parse the approach token
// "0+" through parseFloat (which silently drops the +) and answer the
// two-sided limit ("Does not exist") instead of ∞.
test('regression: lim x->0+ 1/x is ∞ (suffix notation)', async () => {
  const r = await solveLimit('lim x->0+ 1/x');
  assert.match(r.answer, /=\s*∞$/);
  assert.match(r.answer, /0⁺/);
});

test('regression: lim x->0- 1/x is -∞', async () => {
  const r = await solveLimit('lim x->0- 1/x');
  assert.match(r.answer, /=\s*-∞$/);
  assert.match(r.answer, /0⁻/);
});

test('regression: lim x->0^+ abs(x)/x is 1 (caret-suffix notation)', async () => {
  const r = await solveLimit('lim x->0^+ abs(x)/x');
  assert.match(r.answer, /=\s*1$/);
});

test('regression: one-sided "from the right" phrasing works too', async () => {
  const r = await solveLimit('limit as x approaches 0 from the right of 1/x');
  assert.match(r.answer, /=\s*∞$/);
});

test('regression: lim x->0- sqrt(x) does not exist (domain boundary)', async () => {
  // Direct substitution gives 0, but sqrt is undefined on the left of 0 —
  // a one-sided evaluator that trusts substitution alone gets this wrong.
  const r = await solveLimit('lim x->0- sqrt(x)');
  assert.match(r.answer, /Does not exist$/);
  assert.ok(r.steps.some((s) => /not defined on the left side/i.test(s)));
});

test('regression: lim x->0+ log(x) is -∞ (slow divergence, not a sample value)', async () => {
  // Naive sampling at 1e-8 reads log(x) as ≈ -18.4 and reports that number.
  const r = await solveLimit('lim x->0+ log(x)');
  assert.match(r.answer, /=\s*-∞$/);
});

test('regression: continuous one-sided limits verify by direct substitution', async () => {
  const r = await solveLimit('lim x->2+ x^2');
  assert.match(r.answer, /=\s*4$/);
  assert.equal(r.verified, true);
});

test('regression: a plain negative approach value is not read as one-sided', async () => {
  // "-2" ends in a digit, not a sign — the side detector must leave it alone.
  const r = await solveLimit('lim x->-2 x^2');
  assert.match(r.answer, /=\s*4$/);
  assert.doesNotMatch(r.answer, /[⁺⁻]/);
});

test('regression: two-sided lim x->0 1/x still does not exist', async () => {
  const r = await solveLimit('lim x->0 1/x');
  assert.match(r.answer, /Does not exist$/);
});

// B4 — the factor verb. "factor x^2 - 9" echoed back "x^2 - 9": the extractor
// stripped the verb, so the solver just simplified an already-simple input.
test('regression: eval — factor x^2 - 9 yields (x - 3)(x + 3)', async () => {
  const r = await solveProblem('factor x^2 - 9', 'algebra');
  assert.equal(r.answer, '(x - 3)(x + 3)');
  assert.ok(r.steps.some((s) => /difference of squares/i.test(s)));
  assert.ok(r.steps.some((s) => /check by expanding/i.test(s)));
});

test('regression: factoring pulls common factors and handles trinomials', async () => {
  const trinomial = await solveProblem('factor x^2 + 5x + 6', 'algebra');
  assert.equal(trinomial.answer, '(x + 2)(x + 3)');
  const common = await solveProblem('factor 2x^2 - 8', 'algebra');
  assert.equal(common.answer, '2(x - 2)(x + 2)');
});

test('regression: an irreducible polynomial factors honestly, not wrongly', async () => {
  const r = await solveProblem('factor x^2 + 1', 'algebra');
  assert.match(r.answer, /no simpler factors over the integers/);
});

// B5 — exact radicals. "sqrt(50)" answered 7.0711; the simplify path had no
// exact-radical rung even though the exact form is what the topic teaches.
test('regression: eval — sqrt(50) simplifies to 5√2, not 7.0711', async () => {
  const r = await solveProblem('sqrt(50)', 'algebra');
  assert.equal(r.answer, '5√2 (≈ 7.0711)');
  assert.ok(r.steps.some((s) => /50 = 25 × 2/.test(s)));
});

test('regression: perfect squares and already-simple radicals stay honest', async () => {
  assert.equal((await solveProblem('sqrt(49)', 'algebra')).answer, '7');
  assert.match((await solveProblem('sqrt(2)', 'algebra')).answer, /^√2 \(≈ 1\.4142\)$/);
  assert.match((await solveProblem('sqrt(72)', 'algebra')).answer, /^6√2/);
});

test('regression: radical sums combine exactly via the Algebrite rung', async () => {
  const r = await solveProblem('sqrt(8) + sqrt(2)', 'algebra');
  assert.match(r.answer, /^3√2/);
});

// B3 — symbolic trig identities. sin(x)^2 + cos(x)^2 hit math.evaluate,
// threw "Undefined symbol x", and answered "Unable to evaluate".
test('regression: eval — sin(x)^2 + cos(x)^2 simplifies to 1', async () => {
  const r = await solveProblem('sin(x)^2 + cos(x)^2', 'trigonometry');
  assert.equal(r.answer, '1');
  assert.ok(r.steps.some((s) => /pythagorean identity/i.test(s)));
});

test('regression: symbolic trig that cannot simplify says so honestly', async () => {
  const r = await solveProblem('sin(x) + cos(x)', 'trigonometry');
  assert.match(r.answer, /sin\(x\) \+ cos\(x\)/);
  assert.ok(r.steps.some((s) => /already in simplest terms|no trustworthy simplification/i.test(s)));
});

test('regression: numeric trig still evaluates after the symbolic split', async () => {
  const r = await solveProblem('sin(pi/6)', 'trigonometry');
  assert.match(r.answer, /^0\.5/);
});

// ---------------------------------------------------------------------------
// July 2026 production audit (v1.8.0) — the numeric equation fallback
// The last symbolic-failure path in the algebra solver reported confident
// wrong answers: sqrt(x) = 5 → five scan artifacts starting at x = -100
// (Complex values made every NaN sign comparison read as a sign change),
// identities → the same five grid points, |x-3| = 5 → "No real solution
// found" (pipes never parsed). Fixed with complex-safe scanning, constant
// detection, a back-substitution gate, and pipe→abs() translation.
// ---------------------------------------------------------------------------

test('regression: audit — sqrt(x) = 5 yields x = 25, not scan artifacts', async () => {
  const r = await solveProblem('sqrt(x) = 5', 'algebra');
  assert.equal(r.answer, 'x = 25');
  assert.doesNotMatch(r.answer, /-100|-99|-98/);
});

test('regression: audit — an identity reports all real numbers', async () => {
  const r = await solveProblem('2(x+3) = 2x+6', 'algebra');
  assert.match(r.answer, /All real numbers/);
  assert.ok(r.steps.some((s) => /identity/i.test(s)));
});

test('regression: audit — |x-3| = 5 solves via pipe→abs translation', async () => {
  const r = await solveProblem('|x-3| = 5', 'algebra');
  assert.match(r.answer, /x = -2/);
  assert.match(r.answer, /x = 8/);
});

test('regression: audit — a contradiction says "no solution" without hedging', async () => {
  const r = await solveProblem('5x-7 = 5x+2', 'algebra');
  assert.match(r.answer, /^No solution/);
  assert.doesNotMatch(r.answer, /searched range/i);
  assert.ok(r.steps.some((s) => /never be equal|never 0/i.test(s)));
});

test('regression: audit — x^4 = 16 shows clean roots, not (-1)^(1/4) forms', async () => {
  const r = await solveProblem('x^4 - 16 = 0', 'algebra');
  assert.match(r.answer, /x = -2 {2}or/);
  assert.match(r.answer, /x = 2i/);
  assert.doesNotMatch(r.answer, /\(-1\)\^/);
});

test('regression: audit — no-solution radical equations stay honest', async () => {
  // sqrt(x) = -2 genuinely has no real solution; the scanner must say so
  // rather than inventing roots (the back-substitution gate at work).
  const r = await solveProblem('sqrt(x) = -2', 'algebra');
  assert.match(r.answer, /No real solution found/);
});

test('regression: audit — the scanner still finds genuine fallback roots', async () => {
  // A control: radical equations the symbolic engines cannot do must keep
  // working through the hardened numeric path.
  const r = await solveProblem('sqrt(x) = 3', 'algebra');
  assert.equal(r.answer, 'x = 9');
});

test('regression: audit — periodic equations prefer roots nearest zero', async () => {
  // sin(x) = 0 has ~63 roots in the scan range; the five shown must be the
  // ones a student expects (around 0), not x = -100, -99.5, …
  const r = await solveProblem('sin(x) = 0', 'algebra');
  assert.ok(r.answer.includes('x = 0'));
  assert.doesNotMatch(r.answer, /-100/);
});

// ---------------------------------------------------------------------------
// Definite integrals (v1.9.0) — the honest refusal became a real capability.
// Exact value via Algebrite defint, worked FTC steps, and a Simpson numeric
// cross-check that doubles as the improper-integral guard: Algebrite returns
// a bogus complex value for ∫_{-1}^{1} 1/x dx, which must be refused.
// ---------------------------------------------------------------------------

test('regression: ∫_0^1 x dx = 1/2 via FTC (the eval row that was "nonsense")', async () => {
  const r = await solveProblem('definite ∫_0^1 x dx', 'integrals');
  assert.match(r.answer, /=\s*1\/2/);
  assert.equal(r.verified, true);
  assert.ok(r.steps.some((s) => /Fundamental Theorem/i.test(s)));
});

test('regression: definite integral of a polynomial (∫_0^2 x^2 = 8/3)', async () => {
  const r = await solveProblem('∫_0^2 x^2 dx', 'integrals');
  assert.match(r.answer, /=\s*8\/3/);
});

test('regression: definite integral with a pi bound (∫_0^pi sin = 2)', async () => {
  const r = await solveProblem('∫_0^pi sin(x) dx', 'integrals');
  assert.match(r.answer, /=\s*2\b/);
});

test('regression: arctan definite integral (∫_0^1 1/(x^2+1) = pi/4)', async () => {
  const r = await solveProblem('∫_0^1 1/(x^2+1) dx', 'integrals');
  const val = Number((r.answer.match(/≈\s*([\d.]+)/) || [])[1]);
  assert.ok(Math.abs(val - Math.PI / 4) < 1e-3, `got ${r.answer}`);
});

test('regression: "from a to b" phrasing works (x^2 from 0 to 3 = 9)', async () => {
  const r = await solveProblem('x^2 from 0 to 3', 'integrals');
  assert.match(r.answer, /=\s*9\b/);
});

test('regression: improper integral ∫_{-1}^{1} 1/x is refused, never -i*pi', async () => {
  const r = await solveProblem('∫_{-1}^{1} 1/x dx', 'integrals');
  assert.match(r.answer, /improper|unable/i);
  // Must not leak Algebrite's bogus complex value or its float (-3.14159…).
  assert.doesNotMatch(r.answer, /i\s*\*\s*pi|3\.14/i);
});

test('regression: indefinite integrals still work after the definite split', async () => {
  const r = await solveProblem('Integrate x^2', 'integrals');
  assert.match(r.answer, /x\^3.*\+ C$/);
  const sec = await solveProblem('sec(x)^2', 'integrals');
  assert.match(sec.answer, /tan\(x\) \+ C$/);
});

test('regression: swapped bounds negate (∫_2^0 x^2 = -8/3)', async () => {
  const r = await solveProblem('∫_2^0 x^2 dx', 'integrals');
  assert.match(r.answer, /=\s*-8\/3/);
});

// ---------------------------------------------------------------------------
// Cosmetic polish from the July 2026 production audit (v1.9.1)
// Three presentation nits, each with a correctness-preserving fix.
// ---------------------------------------------------------------------------

// Nit 1 — removable limits report the exact fraction, not a rounded decimal.
test('regression: audit polish — removable limits show exact fractions', async () => {
  const a = await solveProblem('lim x->0 (sin(x)-x)/x^3', 'limits');
  assert.match(a.answer, /=\s*-1\/6$/);
  const b = await solveProblem('lim x->0 (1-cos(x))/x^2', 'limits');
  assert.match(b.answer, /=\s*1\/2$/);
  // A clean integer limit stays an integer (no gratuitous fraction).
  const c = await solveProblem('lim x->1 (x^2-1)/(x-1)', 'limits');
  assert.match(c.answer, /=\s*2$/);
});

// Nit 2 — an oscillating limit says it oscillates; a jump says the sides
// disagree. The two DNE reasons must not be conflated.
test('regression: audit polish — sin(1/x) DNE is attributed to oscillation', async () => {
  const r = await solveProblem('lim x->0 sin(1/x)', 'limits');
  assert.match(r.answer, /Does not exist$/);
  assert.ok(r.steps.some((s) => /oscillat/i.test(s)));
  assert.ok(!r.steps.some((s) => /one-sided limits disagree/i.test(s)));
});

test('regression: audit polish — a jump limit still reads "sides disagree", not oscillation', async () => {
  const r = await solveProblem('lim x->0 abs(x)/x', 'limits');
  assert.match(r.answer, /Does not exist$/);
  assert.ok(r.steps.some((s) => /disagree/i.test(s)));
  assert.ok(!r.steps.some((s) => /oscillat/i.test(s)));
});

// Nit 3 — a simplification is never longer than the input. mathsteps split
// (x^2-9)/(x+3) into x^2/(x+3) - 9/(x+3); Algebrite cancels it to x-3.
test('regression: audit polish — (x^2-9)/(x+3) simplifies to x - 3, not a split fraction', async () => {
  const r = await solveProblem('(x^2-9)/(x+3)', 'algebra');
  assert.equal(r.answer, 'x - 3');
});

test('regression: audit polish — rational simplifications cancel fully', async () => {
  assert.equal((await solveProblem('(x^2-1)/(x-1)', 'algebra')).answer, 'x + 1');
  assert.equal((await solveProblem('(2x^2-8)/(x-2)', 'algebra')).answer, '2(x + 2)');
});

test('regression: audit polish — mathsteps keeps its steps when it is the best form', async () => {
  const r = await solveProblem('2x + 3x', 'algebra');
  assert.equal(r.answer, '5x');
  assert.ok(r.steps.length >= 1);
});

test('regression: audit polish — an already-simple expression is left alone', async () => {
  const r = await solveProblem('x^2 + 2x + 1', 'algebra');
  assert.match(r.answer, /x\^2 \+ 2x \+ 1/);
  assert.ok(r.steps.some((s) => /already in simplest form/i.test(s)));
});

// ---------------------------------------------------------------------------
// Systems of two linear equations (v1.10.0) — roadmap item 9.
// Cramer's rule in exact rational arithmetic; the solution is substituted back
// into both equations before it is reported. Replaces the refuse-clearly guard.
// ---------------------------------------------------------------------------

test('regression: 2x2 system solves with exact fractions', async () => {
  const r = await solveProblem('2x + 3y = 6; x - y = 4', 'algebra');
  assert.equal(r.answer, 'x = 18/5,  y = -2/5');
  assert.equal(r.verified, true);
  assert.ok(r.steps.some((s) => /Check:/i.test(s)));
});

test('regression: 2x2 system with an integer solution', async () => {
  const r = await solveProblem('x + y = 5; x - y = 1', 'algebra');
  assert.equal(r.answer, 'x = 3,  y = 2');
});

test('regression: 2x2 system in non-xy variables (a, b)', async () => {
  const r = await solveProblem('solve the system 3a + 2b = 12; a - b = 1', 'algebra');
  assert.equal(r.answer, 'a = 14/5,  b = 9/5');
});

test('regression: comma-separated system parses', async () => {
  const r = await solveProblem('2x + 3y = 6, x - y = 4', 'algebra');
  assert.equal(r.answer, 'x = 18/5,  y = -2/5');
});

test('regression: dependent system reports infinitely many solutions', async () => {
  const r = await solveProblem('2x + y = 5; 4x + 2y = 10', 'algebra');
  assert.match(r.answer, /[Ii]nfinitely many/);
});

test('regression: inconsistent system reports no solution (parallel)', async () => {
  const r = await solveProblem('x + y = 2; x + y = 5', 'algebra');
  assert.match(r.answer, /[Nn]o solution/);
  assert.match(r.answer, /parallel/i);
});

test('regression: a 3-variable system is refused, not mis-solved', async () => {
  const r = await solveProblem('x + y + z = 1; x - y = 2', 'algebra');
  assert.match(r.answer, /unable to solve this system/i);
});

test('regression: a nonlinear system is refused', async () => {
  const r = await solveProblem('x^2 + y = 1; x - y = 0', 'algebra');
  assert.match(r.answer, /unable to solve this system/i);
});

test('regression: single equations are unaffected by the system router', async () => {
  const r = await solveProblem('2x + 5 = 11', 'algebra');
  assert.match(r.answer, /x = 3/);
});

// ---------------------------------------------------------------------------
// Inequalities (v1.11.0) — roadmap item 10. Sign-chart method: move to one
// side, find zeros (numerator) and breaks (denominator), test each interval.
// Was echoed back unsolved ("x^2 - 4>0"); now solved with correct endpoints.
// ---------------------------------------------------------------------------

test('regression: linear inequality solves', async () => {
  const r = await solveProblem('2x + 3 < 7', 'algebra');
  assert.equal(r.answer, 'x < 2');
  assert.equal(r.verified, true);
});

test('regression: quadratic inequality gives two rays (strict, open ends)', async () => {
  const r = await solveProblem('x^2 - 4 > 0', 'algebra');
  assert.equal(r.answer, 'x < -2  or  x > 2');
});

test('regression: non-strict quadratic includes the roots', async () => {
  const r = await solveProblem('x^2 - 4 <= 0', 'algebra');
  assert.equal(r.answer, '-2 ≤ x ≤ 2');
});

test('regression: rational inequality excludes the pole, includes the zero', async () => {
  // (x-1)/(x+2) >= 0: zero at 1 (closed), pole at -2 (always open).
  const r = await solveProblem('(x-1)/(x+2) >= 0', 'algebra');
  assert.equal(r.answer, 'x < -2  or  x ≥ 1');
});

test('regression: cubic inequality reads the full sign chart', async () => {
  const r = await solveProblem('x^3 - x < 0', 'algebra');
  assert.equal(r.answer, 'x < -1  or  0 < x < 1');
});

test('regression: always-true inequality reports all real numbers', async () => {
  const r = await solveProblem('x^2 + 1 > 0', 'algebra');
  assert.match(r.answer, /[Aa]ll real numbers/);
});

test('regression: never-true inequality reports no solution', async () => {
  const r = await solveProblem('x^2 + 1 < 0', 'algebra');
  assert.match(r.answer, /[Nn]o solution/);
});

test('regression: a single-point solution reads x = c', async () => {
  const r = await solveProblem('x^2 <= 0', 'algebra');
  assert.equal(r.answer, 'x = 0');
});

test('regression: compound inequality is refused (out of scope)', async () => {
  const r = await solveProblem('-2 < x < 3', 'algebra');
  assert.match(r.answer, /unable to solve this inequality/i);
});

test('regression: an equation is not misrouted to the inequality solver', async () => {
  const r = await solveProblem('2x + 5 = 11', 'algebra');
  assert.match(r.answer, /x = 3/);
});
