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
import { parseMathExpression } from '../src/lib/mathParser.js';
import { toLatex } from '../src/lib/latex.js';

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

test('regression: ln(x)/(x-1) at 1 is 1', async () => {
  const r = await solveLimit('lim x->1 (ln(x))/(x-1)');
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
  assert.match(r.answer, /√2/);
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
  // Exact-first since v1.19.0: "1/2 (≈ 0.5)". The point of this regression is
  // that the value is computed at all — assert the value, in either form.
  assert.match(r.answer, /^(?:1\/2 \(≈ 0\.5\)|0\.5)/);
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
  assert.match(r.answer, /^No solution \(a square root cannot equal a negative number\)/);
});

test('regression: audit — the scanner still finds genuine fallback roots', async () => {
  // A control: radical equations the symbolic engines cannot do must keep
  // working through the hardened numeric path.
  const r = await solveProblem('sqrt(x) = 3', 'algebra');
  assert.equal(r.answer, 'x = 9');
});

test('regression: audit — periodic equations prefer roots nearest zero', async () => {
  // sin(x) = 0 has ~63 roots in the numeric scan range; whatever is shown must
  // be what a student expects (around 0), never x = -100, -99.5, …
  //
  // Since the trig-equation solver, a single trig equation under Algebra is
  // answered exactly — the general solution x = πn plus the [0, 2π) list —
  // rather than by the numeric scan, so the roots near zero appear as 0 and π.
  const r = await solveProblem('sin(x) = 0', 'algebra');
  assert.match(r.answer, /x = πn/);
  assert.match(r.answer, /on \[0, 2π\): 0, π/);
  assert.doesNotMatch(r.answer, /-100/);

  // sin(x) = cos(x) is now solved exactly (→ tan x = 1); a genuinely
  // out-of-family equation still goes through the numeric scan, and that
  // scan must still prefer the roots nearest zero.
  const exact = await solveProblem('sin(x) = cos(x)', 'algebra');
  assert.match(exact.answer, /x = π\/4 \+ πn/);
  const scan = await solveProblem('sin(x) = sin(2x) + 0.5', 'algebra');
  assert.doesNotMatch(scan.answer, /-100/);
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
  assert.match(r.answer, /improper|unable|diverges/i);
  assert.equal(r.status, 'diverges');
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

test('regression: an underdetermined system (two equations, three unknowns) is refused, not mis-solved', async () => {
  const r = await solveProblem('x + y + z = 1; x - y = 2', 'algebra');
  assert.equal(r.status, 'unsupported');
  assert.match(r.answer, /3 variables/i);
});

test('regression: a nonlinear system with a linear equation is solved by substitution (refused until v1.32.0)', async () => {
  const r = await solveProblem('x^2 + y = 1; x - y = 0', 'algebra');
  assert.equal(r.status, 'solved');
  assert.match(r.answer, /√5/);
  // Two general conics are still refused, never mis-solved.
  const conics = await solveProblem('x^2 + y^2 = 1; x^2 + y^2 = 4', 'algebra');
  assert.equal(conics.status, 'unsupported');
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

test('regression: a chained inequality is solved (refused as out of scope until v1.32.0)', async () => {
  const r = await solveProblem('-2 < x < 3', 'algebra');
  assert.equal(r.status, 'solved');
  assert.equal(r.answer, '-2 < x < 3');
});

test('regression: an equation is not misrouted to the inequality solver', async () => {
  const r = await solveProblem('2x + 5 = 11', 'algebra');
  assert.match(r.answer, /x = 3/);
});

// ---------------------------------------------------------------------------
// Integration by parts walkthrough (v1.12.0) — roadmap item 11.
// A linear-accumulator engine drives ∫u dv = uv − ∫v du on Algebrite's
// single-step primitives: it SHOWS the derivation, and computes the two
// families Algebrite fails outright — repeated (x^3 sin x) and cyclic
// (e^x sin x) by-parts. Every result is differentiated back before trusting.
// ---------------------------------------------------------------------------

// Helper: the numeric derivative of the reported antiderivative must equal the
// integrand at sample points (finite difference — goes through math.evaluate,
// which understands the ln/arctan aliases that math.derivative does not).
async function antiderivMatches(problem, integrand) {
  const { math } = await import('../src/lib/solvers/solverUtils.js');
  const r = await solveProblem(problem, 'integrals');
  const F = String(r.answer)
    .replace(/^.*=\s*/, '')
    .replace(/\s*\+\s*C\s*$/, '')
    .replace(/ln\|([^|]+)\|/g, 'log($1)'); // display ln|…| → evaluable log(…)
  const f = (x) => Number(math.evaluate(F, { x }));
  const g = (x) => Number(math.evaluate(integrand, { x }));
  let ok = 0;
  for (const x of [0.3, 0.8, 1.4, 2.2]) {
    const dNum = (f(x + 1e-6) - f(x - 1e-6)) / 2e-6;
    const want = g(x);
    if (!Number.isFinite(dNum) || !Number.isFinite(want)) continue;
    if (Math.abs(dNum - want) < 1e-3 * (1 + Math.abs(want))) ok += 1;
  }
  return ok >= 3;
}

test('regression: repeated by-parts — x^3 sin(x) now computes (Algebrite fails it)', async () => {
  const r = await solveProblem('x^3*sin(x)', 'integrals');
  assert.doesNotMatch(r.answer, /Unable/i);
  assert.ok(await antiderivMatches('x^3*sin(x)', 'x^3*sin(x)'));
  assert.ok(r.steps.some((s) => /round 3/i.test(s)), 'shows the third by-parts round');
});

test('regression: cyclic by-parts — e^x sin(x) solves algebraically', async () => {
  const r = await solveProblem('e^x*sin(x)', 'integrals');
  assert.doesNotMatch(r.answer, /Unable/i);
  assert.ok(await antiderivMatches('e^x*sin(x)', 'exp(x)*sin(x)'));
  assert.ok(r.steps.some((s) => /reappears/i.test(s)), 'shows the cyclic algebra step');
});

test('regression: e^x cos(x) (cyclic) also solves', async () => {
  assert.ok(await antiderivMatches('e^x*cos(x)', 'exp(x)*cos(x)'));
});

test('regression: single-pass by-parts shows the walkthrough (x cos x)', async () => {
  const r = await solveProblem('x*cos(x)', 'integrals');
  assert.ok(await antiderivMatches('x*cos(x)', 'x*cos(x)'));
  assert.ok(r.steps.some((s) => /integration by parts/i.test(s)));
  assert.ok(r.steps.some((s) => /Choose the parts/i.test(s)));
});

test('regression: ln(x) and arctan(x) integrate by parts (dv = dx)', async () => {
  assert.ok(await antiderivMatches('ln(x)', 'log(x)'));
  assert.ok(await antiderivMatches('arctan(x)', 'atan(x)'));
});

test('regression: a by-parts term inside a sum still integrates', async () => {
  const r = await solveProblem('x^3*sin(x) + x^2', 'integrals');
  assert.doesNotMatch(r.answer, /Unable/i);
  assert.ok(await antiderivMatches('x^3*sin(x) + x^2', 'x^3*sin(x) + x^2'));
});

test('regression: plain integrals are unaffected by the by-parts path', async () => {
  const poly = await solveProblem('x^2', 'integrals');
  assert.match(poly.answer, /1\/3\*x\^3 \+ C$/);
  const trig = await solveProblem('sin(x)', 'integrals');
  assert.match(trig.answer, /-cos\(x\) \+ C$/);
});

test('regression: an integrand the engine cannot do is refused, never faked', async () => {
  // x*sin(x^2) is u-substitution. When this test was written neither
  // Algebrite nor the solver could do it, and the point was that the answer
  // must not be a fabricated antiderivative. The solver now has substitution
  // (v1.18.0): the same point holds — anything reported must differentiate
  // back to the integrand — and the answer is the real one, -½cos(x²).
  const r = await solveProblem('x*sin(x^2)', 'integrals');
  assert.equal(r.status, 'solved');
  assert.match(r.answer, /-1\/2\*cos\(x\^2\) \+ C$/);

  // The refusal contract itself, on something still beyond the engine:
  const refused = await solveProblem('sin(x^2)', 'integrals');
  assert.equal(refused.status, 'unsupported');
  assert.ok(!/\+ C$/.test(refused.answer), 'must not present a fabricated antiderivative');
});

// ---------------------------------------------------------------------------
// sin^2(x): textbook power notation on a function (fixed Aug 2026, v1.24.0)
//
// `sin^2(x) = 1/2` was read as "sin squared, times x": the implicit-
// multiplication rules produced `sin^2*(x)`, leaving `sin` as a BARE name.
// Algebrite applies a bare function name to its PREVIOUS result, so the
// equation was "solved" as x = 1/(2sin([-2,2])^2) — carrying the last
// problem's roots — and each further solve nested one level deeper. On a
// cold engine the same input was answered "No real solution found", which is
// wrong the other way: it has infinitely many.
// ---------------------------------------------------------------------------

test('regression: sin^2(x) means (sin(x))^2, not sin^2 times x', () => {
  assert.equal(parseMathExpression('sin^2(x) = 1/2'), '(sin(x))^2=1/2');
  assert.equal(parseMathExpression('sin^2 x'), '(sin(x))^2');
  assert.equal(parseMathExpression('2sin^3(2x)'), '2*(sin(2*x))^3');
  assert.equal(parseMathExpression('cos^2(x)+sin^2(x)'), '(cos(x))^2+(sin(x))^2');
  // The inverse form still wins; sin^-1 is arcsin, not (sin x)^-1.
  assert.equal(parseMathExpression('sin^-1(x)'), 'arcsin(x)');
  // A name that merely ends in "sin" is not the sin function.
  assert.equal(parseMathExpression('arcsin^2(x)'), '(arcsin(x))^2');
});

test('regression: sin^2(x) = 1/2 gives real solutions, not "no real solution"', async () => {
  const r = await solveProblem('sin^2(x) = 1/2', 'algebra');
  assert.equal(r.status, 'solved');
  // ±π/4 and ±3π/4 are the solutions nearest zero.
  // Now exact, via u = sin(x): u² = 1/2 → u = ±√2/2 → π/4, 3π/4, 5π/4, 7π/4.
  assert.match(r.answer, /on \[0, 2π\): π\/4, 3π\/4, 5π\/4, 7π\/4/);
  assert.doesNotMatch(r.answer, /No real solution/i);
});

test('regression: a previous answer never leaks into the next solve', async () => {
  // The inequality leaves [-2,2] as Algebrite's last result. Before the fix
  // that list appeared inside the NEXT answer, and grew on every repeat.
  await solveProblem('x^2 - 4 > 0', 'algebra');
  const first = await solveProblem('sin^2(x) = 1/2', 'algebra');
  const second = await solveProblem('sin^2(x) = 1/2', 'algebra');
  assert.doesNotMatch(first.answer, /\[\s*-?\d[^\])]*\]/, 'a bracketed number list is a leaked previous result');
  assert.equal(second.answer, first.answer, 'the same input must give the same answer every time');
});

test('regression: an equation that cannot be evaluated is refused, not called unsolvable', async () => {
  // "sin^2 = 1/2" has no argument at all — unreadable, not solution-free.
  // A bare function name is now caught at the door as a parse error with a
  // hint (sin needs an argument); either way it must never be "no solution".
  const r = await solveProblem('sin^2 = 1/2', 'algebra');
  assert.ok(['unsupported', 'parse_error'].includes(r.status), r.status);
  assert.doesNotMatch(r.answer, /No real solution/i);
  assert.match(r.answer, /sin needs an argument/);

  // The genuinely solution-free cases must still say so.
  const none = await solveProblem('x + 1 = x + 2', 'algebra');
  assert.match(none.answer, /No solution/i);
  const negRoot = await solveProblem('sqrt(x) = -5', 'algebra');
  assert.match(negRoot.answer, /No (?:real )?solution/i);
});

// ---------------------------------------------------------------------------
// Systems routed by intent (fixed Aug 2026, v1.24.0)
//
// Two equations typed under any non-Algebra topic went to that topic's
// solver, which extracts ONE expression: "2x + 3y = 6; x - y = 4" under
// Derivatives kept the "6" and answered "f(x) = 4, f'(x) = 0" — marked
// Solved. Systems detection now sits in the intent router, like calculus
// notation and single equations.
// ---------------------------------------------------------------------------

test('regression: a system routes to the systems solver from any topic', async () => {
  for (const topic of ['derivatives', 'integrals', 'limits', 'functions', 'trigonometry', 'other']) {
    const r = await solveProblem('2x + 3y = 6; x - y = 4', topic);
    assert.equal(r.status, 'solved', `${topic}: expected a solved system`);
    assert.match(r.answer, /x = 18\/5/, `${topic}: wrong x`);
    assert.match(r.answer, /y = -2\/5/, `${topic}: wrong y`);
    assert.match(r.steps[0], /Solved as Algebra/, `${topic}: routing must be stated`);
    assert.equal(r.routedTopic, 'algebra', `${topic}: history must file it under Algebra`);
  }

  // Under Algebra it is unchanged — solved directly, with no routing note.
  const direct = await solveProblem('2x + 3y = 6; x - y = 4', 'algebra');
  assert.match(direct.answer, /x = 18\/5/);
  assert.doesNotMatch(direct.steps[0], /Solved as/);
});

// ---------------------------------------------------------------------------
// Inequalities routed by intent (fixed Aug 2026, v1.24.0)
// "x^2 - 4 > 0" under Derivatives was refused as beyond the engine, while the
// sign-chart solver had the answer the whole time — the operator just never
// reached it from a non-Algebra topic.
// ---------------------------------------------------------------------------

test('regression: an inequality routes to the sign-chart solver from any topic', async () => {
  for (const topic of ['derivatives', 'integrals', 'limits', 'functions', 'trigonometry', 'other']) {
    const r = await solveProblem('x^2 - 4 > 0', topic);
    assert.equal(r.status, 'solved', `${topic}: expected the inequality to be solved`);
    assert.match(r.answer, /x < -2\s+or\s+x > 2/, `${topic}: wrong solution set`);
    assert.match(r.steps[0], /Solved as Algebra/, `${topic}: routing must be stated`);
    assert.equal(r.routedTopic, 'algebra', `${topic}: history must file it under Algebra`);
  }
});

// ---------------------------------------------------------------------------
// Arithmetic under Trigonometry (fixed Aug 2026, v1.24.0)
// A pure-number expression was evaluated by the trig path, which described it
// as "the trigonometric expression" and attached sin/cos tips to a PEMDAS
// problem.
// ---------------------------------------------------------------------------

test('regression: a pure-number expression under Trigonometry is arithmetic', async () => {
  const r = await solveProblem('(5 + 3) * 4 - 2^3', 'trigonometry');
  assert.equal(r.answer, '24');
  assert.equal(r.routedTopic, 'other');
  assert.match(r.steps[0], /Solved as Arithmetic \(you chose Trigonometry\)/);
  assert.ok(r.tips.some((t) => /PEMDAS/i.test(t)), 'should carry arithmetic tips');
  assert.ok(!r.tips.some((t) => /sin\(30/.test(t)), 'must not carry trig tips');

  // Anything with an actual angle or function stays in Trigonometry.
  const trig = await solveProblem('sin(pi/4)', 'trigonometry');
  assert.equal(trig.answer, '√2/2 (≈ 0.7071)');
  assert.equal(trig.routedTopic, undefined);
});

// ---------------------------------------------------------------------------
// Words inside a math fragment (fixed Aug 2026, v1.24.0)
// "F(1) = 0 and F(0) = -1" typeset as "F(1)=0andF(0)=−1": the whole fragment
// went to KaTeX, and "and" came out as three italic variables jammed against
// the equations on both sides.
// ---------------------------------------------------------------------------

test('regression: "and" inside a math fragment is text, not a product of variables', () => {
  assert.match(toLatex('F(1) = 0 and F(0) = -1'), /\\;\\text\{and\}\\;/);
  assert.match(toLatex('x = 30° and x = 150°'), /30\^\{\\circ\} \\;\\text\{and\}\\; x/);
  assert.match(toLatex('x = -2 or x = 2'), /\\;\\text\{or\}\\;/); // unchanged
  assert.match(toLatex('lim (x→0) 1/x = DNE'), /\\text\{DNE\}/);
  // A variable whose name merely contains the letters is untouched.
  assert.doesNotMatch(toLatex('band = 2'), /\\text\{and\}/);
});

// ---------------------------------------------------------------------------
// September 2026 production audit (docs/evaluations/2026-09/). Two rows came
// back with a "solved" status that had not solved anything, and one limit
// named a decimal where the exact constant was known.
// ---------------------------------------------------------------------------

test('audit A02: an unreadable operator sequence under Algebra is a parse error, never "simplest form"', async () => {
  // Was: status solved, answer "x^2 + *3", step "already in simplest form".
  const r = await solveProblem('x^2 +* 3', 'algebra');
  assert.equal(r.status, 'parse_error');
  assert.doesNotMatch(r.answer, /simplest form/);
  assert.doesNotMatch(r.steps.join('\n'), /simplest form/);
});

test('audit A25: a trailing semicolon does not turn one equation into a refusal', async () => {
  // Was: status solved, answer 'Please enter either one equation, or a 2×2 system…'.
  const r = await solveProblem('x^2 = 4;', 'algebra');
  assert.equal(r.status, 'solved');
  assert.match(r.answer, /x = -2/);
  assert.match(r.answer, /x = 2/);
  // A genuine multi-equation string still refuses — now with a refusal status.
  const multi = await solveAlgebra('x = 1; y = 2; z = 3');
  assert.equal(multi.status, 'parse_error');
  assert.match(multi.answer, /one equation/);
});

test('audit L08: a limit at infinity that is a power of e or a small rational is named exactly', async () => {
  // Was: 20.0855 with no mention of e^3 (e and e^2 were already named).
  const cube = await solveLimit('lim x->infinity (1+3/x)^x');
  assert.match(cube.answer, /e\^3 \(≈ 20\.0855\)/);
  const ratio = await solveLimit('lim x->infinity (2x^2 + 1)/(5x^2 - 3)');
  assert.match(ratio.answer, /2\/5 \(≈ 0\.4\)/);
  // A value with no short name stays a plain decimal.
  const plain = await solveLimit('lim x->infinity (1+1/x)^(x*1.37)');
  assert.doesNotMatch(plain.answer, /\(≈/);
});

// ---------------------------------------------------------------------------
// Wave 2 of the September 2026 roadmap (items 12–16) plus one confidently-wrong
// answer found on the way: mathsteps "factored" x² − 2x − 1 as (x − 1)².
// ---------------------------------------------------------------------------

test('mathsteps output is verified: x^2 - 2x - 1 = 0 is 1 ± √2, never "x = 1, repeated root"', async () => {
  // Was: "factor perfect square: (x - 1)^2 = 0", answer x = 1 (repeated root).
  const r = await solveProblem('x^2 - 2x - 1 = 0', 'algebra');
  assert.match(r.answer, /1 - √2/);
  assert.match(r.answer, /1 \+ √2/);
  assert.doesNotMatch(r.answer, /repeated/);
  // A genuine perfect square still reports its repeated root.
  const square = await solveProblem('x^2 - 2x + 1 = 0', 'algebra');
  assert.match(square.answer, /x = 1/);
  assert.match(square.answer, /repeated root/);
});

test('audit G06/G09: rational and exponential equations are solved exactly', async () => {
  const rational = await solveProblem('1/(x-1) + 1/(x+1) = 1', 'algebra');
  assert.match(rational.answer, /1 - √2/);
  assert.match(rational.answer, /1 \+ √2/);
  assert.ok(rational.steps.some((s) => /clear the fractions/i.test(s)));
  const reciprocal = await solveProblem('x + 1/x = 3', 'algebra');
  assert.match(reciprocal.answer, /\(3 - √5\)\/2/);
  assert.match(reciprocal.answer, /\(3 \+ √5\)\/2/);
  // Clearing denominators can manufacture a root at a pole; it must still be dropped.
  const hole = await solveProblem('(x^2 - 9)/(x + 3) = 0', 'algebra');
  assert.match(hole.answer, /x = 3/);
  assert.doesNotMatch(hole.answer, /x = -3/);
  const exponential = await solveProblem('e^(2x) - 3e^x + 2 = 0', 'algebra');
  assert.match(exponential.answer, /x = 0/);
  assert.match(exponential.answer, /ln\(2\)/);
  assert.ok(exponential.steps.some((s) => /u = e\^x/.test(s)));
});

test('audit V06: the half-angle family has exact values', async () => {
  assert.match((await solveProblem('sin(pi/12)', 'trigonometry')).answer, /\(√6 − √2\)\/4/);
  assert.match((await solveProblem('tan(pi/8)', 'trigonometry')).answer, /√2 − 1/);
  assert.match((await solveProblem('cos(5pi/12)', 'trigonometry')).answer, /\(√6 − √2\)\/4/);
  assert.match((await solveProblem('sin(15°)', 'trigonometry')).answer, /\(√6 − √2\)\/4/);
});

test('audit R01: a negative base under an odd root gives the real root', async () => {
  const cube = await solveProblem('(-8)^(1/3)', 'other');
  assert.equal(cube.answer, '-2');
  assert.ok(cube.steps.some((s) => /principal complex root/.test(s)));
  assert.equal((await solveProblem('(-27)^(1/3)', 'algebra')).answer, '-3');
  assert.equal((await solveProblem('(-8)^(2/3)', 'other')).answer, '4');
  // An even root of a negative number is still complex.
  assert.match((await solveProblem('(-4)^(1/2)', 'other')).answer, /i/);
});

test('audit: cyclic by-parts keeps rational coefficients', async () => {
  const r = await solveProblem('∫ e^(2x)*cos(x) dx', 'integrals');
  assert.match(r.answer, /1\/5\*e\^\(2x\)\*\(2cos\(x\) \+ sin\(x\)\)/);
  assert.doesNotMatch(r.answer, /0\.4|0\.2|1\.0/);
});

test('audit: an interior singularity is reported as divergent, not "not supported"', async () => {
  for (const [p, at] of [['∫_{-1}^{1} 1/x^2 dx', 'x = 0'], ['∫_0^2 1/(x-1)^2 dx', 'x = 1'], ['∫_{-1}^{1} 1/x dx', 'x = 0']]) {
    const r = await solveProblem(p, 'integrals');
    assert.equal(r.status, 'diverges', p);
    assert.match(r.answer, /Diverges/, p);
    assert.match(r.answer, new RegExp(`${at.replace('x = ', 'x = ')} inside the interval`), p);
  }
});

test('audit: ∞ in arithmetic is an indeterminate form or "not a number", never a syntax error', async () => {
  assert.equal((await solveProblem('∞ - ∞', 'other')).status, 'indeterminate');
  const quotient = await solveProblem('infinity/infinity', 'other');
  assert.equal(quotient.status, 'indeterminate');
  assert.match(quotient.answer, /∞\/∞/);
  assert.equal((await solveProblem('∞ + 1', 'other')).status, 'undefined');
});

// ---------------------------------------------------------------------------
// Roadmap 2026-09 item 3: limits narrate the technique a course would use.
// The ladder (Taylor / L'Hôpital) still verifies and still catches the rest.
// ---------------------------------------------------------------------------

test('limits: sin(kx)/x and (1 − cos x)/x² are named standard limits', async () => {
  const s = await solveLimit('lim x->0 sin(3x)/x');
  assert.match(s.answer, /=\s*3$/);
  assert.equal(s.verificationMethod, 'standard limit + numeric check');
  assert.ok(s.steps.some((t) => /standard limit sin\(u\)\/u → 1/.test(t)), s.steps.join(' | '));
  const c = await solveLimit('lim x->0 (1-cos(x))/x^2');
  assert.match(c.answer, /=\s*1\/2$/);
  assert.ok(c.steps.some((t) => /\(1 − cos u\)\/u² → 1\/2/.test(t)));
  const t = await solveLimit('lim x->0 tan(2x)/(5x)');
  assert.match(t.answer, /=\s*2\/5$/);
});

test('limits: x·sin(1/x) at 0 and sin(x)/x at ∞ use the squeeze theorem with the bounds shown', async () => {
  const zero = await solveLimit('lim x->0 x*sin(1/x)');
  assert.match(zero.answer, /=\s*0$/);
  assert.equal(zero.verified, true);
  assert.ok(zero.steps.some((t) => /−\|x\| ≤ x·sin\(1\/x\) ≤ \|x\|/.test(t)), zero.steps.join(' | '));
  assert.ok(zero.steps.some((t) => /squeeze theorem/.test(t)));
  const inf = await solveLimit('lim x->infinity sin(x)/x');
  assert.match(inf.answer, /=\s*0$/);
  assert.ok(inf.steps.some((t) => /squeeze theorem/.test(t)));
  assert.equal(inf.verificationMethod, 'squeeze theorem + numeric check');
});

test('limits: a radical difference is rationalized with the conjugate', async () => {
  const a = await solveLimit('lim x->0 (sqrt(x+1)-1)/x');
  assert.match(a.answer, /=\s*1\/2$/);
  assert.equal(a.verificationMethod, 'conjugate + numeric check');
  assert.ok(a.steps.some((t) => /conjugate, sqrt\(x \+ 1\) \+ 1/.test(t)), a.steps.join(' | '));
  const b = await solveLimit('lim x->4 (sqrt(x)-2)/(x-4)');
  assert.match(b.answer, /=\s*1\/4$/);
  assert.ok(b.steps.some((t) => /conjugate/.test(t)));
});

test('limits: a removable rational 0/0 is factored and the common factor cancelled', async () => {
  const r = await solveLimit('lim x->2 (x^2-4)/(x-2)');
  assert.match(r.answer, /=\s*4$/);
  assert.equal(r.verificationMethod, 'factor and cancel + numeric check');
  assert.ok(r.steps.some((t) => /Both contain the factor \(x − 2\)/.test(t)), r.steps.join(' | '));
  const n = await solveLimit('lim x->-3 (x^2+5x+6)/(x+3)');
  assert.match(n.answer, /=\s*-1$/);
  assert.ok(n.steps.some((t) => /factor \(x \+ 3\)/.test(t)));
});

test('limits at ±∞ of rational functions compare leading terms, exactly and with sign', async () => {
  const same = await solveLimit('lim x->infinity (3x^2+1)/(2x^2-5)');
  assert.match(same.answer, /=\s*3\/2 \(≈ 1\.5\)$/);
  assert.equal(same.verificationMethod, 'leading terms + numeric check');
  assert.ok(same.steps.some((t) => /leading coefficients 3\/2/.test(t)), same.steps.join(' | '));
  const lower = await solveLimit('lim x->infinity (x+1)/(x^2+1)');
  assert.match(lower.answer, /=\s*0$/);
  assert.ok(lower.steps.some((t) => /denominator grows faster/.test(t)));
  const higher = await solveLimit('lim x->infinity x^3/(x^2+1)');
  assert.match(higher.answer, /=\s*∞$/);
  const negative = await solveLimit('lim x->-infinity x^3/(x^2+1)');
  assert.match(negative.answer, /=\s*-∞$/);
  const bare = await solveLimit('lim x->-infinity 2x^3 - x');
  assert.match(bare.answer, /=\s*-∞$/);
});

test('limits: non-matching cases still take the ladder unchanged', async () => {
  const taylor = await solveLimit('lim x->0 (sin(x)-x)/x^3');
  assert.match(taylor.answer, /=\s*-1\/6$/);
  const e3 = await solveLimit('lim x->infinity (1+3/x)^x');
  assert.match(e3.answer, /e\^3/);
  const direct = await solveLimit('lim x->2 x^2 + 1');
  assert.equal(direct.verificationMethod, 'direct substitution');
});

// ---------------------------------------------------------------------------
// Roadmap 2026-09 items 4 and 5: non-linear 2×2 systems by substitution, and
// compound inequalities by set intersection / union.
// ---------------------------------------------------------------------------

test('systems: a line and a parabola / circle / hyperbola solve by substitution, every pair verified', async () => {
  const circle = await solveProblem('x^2 + y^2 = 25; y = x + 1', 'algebra');
  assert.equal(circle.status, 'solved');
  assert.match(circle.answer, /\(x, y\) = /);
  assert.match(circle.answer, /\(3, 4\)/);
  assert.match(circle.answer, /\(-4, -3\)/);
  assert.equal(circle.verified, true);
  assert.ok(circle.steps.some((s) => /solve it for y: y = x \+ 1/.test(s)), circle.steps.join(' | '));
  assert.ok(circle.steps.some((s) => /Substitute into equation 1/.test(s)));

  const parabola = await solveProblem('y = x^2; y = 2x + 3', 'algebra');
  assert.match(parabola.answer, /\(3, 9\)/);
  assert.match(parabola.answer, /\(-1, 1\)/);
  assert.ok(parabola.graph && parabola.graph.secondaryPoints, 'both curves are functions of x, so both are drawn');

  const hyperbola = await solveProblem('x*y = 6; x + y = 5', 'algebra');
  assert.match(hyperbola.answer, /\(2, 3\)/);
  assert.match(hyperbola.answer, /\(3, 2\)/);

  const irrational = await solveProblem('x^2 + y = 1; x - y = 0', 'algebra');
  assert.match(irrational.answer, /√5/);
  assert.match(irrational.answer, /  or  /);

  // Not linear in either variable on its own, but explicit in y.
  const two = await solveProblem('x^2 + y^2 = 1; x^2 - y = 1', 'algebra');
  assert.match(two.answer, /\(0, -1\)/);
  assert.match(two.answer, /\(1, 0\)/);
  assert.match(two.answer, /\(-1, 0\)/);
});

test('systems: no real intersection is said, two general conics are refused, linear systems are untouched', async () => {
  const miss = await solveProblem('x^2 + y^2 = 1; y = x + 5', 'algebra');
  assert.equal(miss.status, 'solved');
  assert.match(miss.answer, /No real solution/);
  assert.ok(miss.steps.some((s) => /not real/.test(s)));

  const conics = await solveProblem('x^2 + y^2 = 1; x^2 + y^2 = 4', 'algebra');
  assert.equal(conics.status, 'unsupported');
  assert.match(conics.answer, /neither equation can be solved for one variable/);

  const linear = await solveProblem('2x+3y=6; x-y=4', 'algebra');
  assert.equal(linear.answer, 'x = 18/5,  y = -2/5');
});

test('inequalities: a chain is solved as the intersection of its two halves', async () => {
  const chain = await solveProblem('-1 < 2x + 1 <= 5', 'algebra');
  assert.equal(chain.status, 'solved');
  assert.equal(chain.answer, '-1 < x ≤ 2');
  assert.ok(chain.steps.some((s) => /Part 1: -1 < 2x \+ 1/.test(s)), chain.steps.join(' | '));
  assert.ok(chain.steps.some((s) => /Intersection: -1 < x ≤ 2/.test(s)));
  assert.ok(chain.steps.some((s) => /\(-1, 2\]/.test(s)));
  assert.ok(chain.graph && chain.graph.annotations.shadedRegions.length === 1);

  const squares = await solveProblem('1 < x^2 < 9', 'algebra');
  assert.equal(squares.answer, '-3 < x < -1  or  1 < x < 3');

  const wrongWay = await solveProblem('1 < x > 0', 'algebra');
  assert.equal(wrongWay.status, 'unsupported');
  assert.match(wrongWay.answer, /different directions/);
});

test('inequalities: "and" intersects, "or" unites, and the trivial outcomes are named', async () => {
  const and = await solveProblem('x > 1 and x < 4', 'algebra');
  assert.equal(and.answer, '1 < x < 4');
  const or = await solveProblem('x < 2 or x > 5', 'algebra');
  assert.equal(or.answer, 'x < 2  or  x > 5');
  const empty = await solveProblem('x < 2 and x > 5', 'algebra');
  assert.match(empty.answer, /^No solution/);
  const all = await solveProblem('x > 1 or x < 4', 'algebra');
  assert.match(all.answer, /^All real numbers/);
  const touching = await solveProblem('x <= 2 or x >= 2', 'algebra');
  assert.match(touching.answer, /^All real numbers/);
  const gap = await solveProblem('x < 2 or x > 2', 'algebra');
  assert.equal(gap.answer, 'x < 2  or  x > 2');
  // A single inequality is exactly as before.
  const single = await solveProblem('x^2 - 4 > 0', 'algebra');
  assert.equal(single.answer, 'x < -2  or  x > 2');
});

// ---------------------------------------------------------------------------
// September 2026 teaching-quality review (v1.35.0). The mathematics was right;
// the WORK shown was not always the method a student should learn.
// ---------------------------------------------------------------------------

test('fractions: sums and differences are taught by common denominators, never via decimals', async () => {
  for (const input of ['1/3 + 1/7', '(1/3) + (1/7)', 'add 1/3 and 1/7', 'what is the sum of 1/3 and 1/7?']) {
    const r = await solveProblem(input, 'other');
    assert.equal(r.answer, '10/21 (= 0.4762)', input);
    const work = r.steps.join('\n');
    assert.match(work, /least common denominator is 21/, input);
    assert.match(work, /1\/3 = 7\/21/, input);
    assert.match(work, /7\/21 \+ 3\/21 = \(7 \+ 3\)\/21 = 10\/21/, input);
    assert.doesNotMatch(work, /0\.3333|0\.1429|2381/, `${input}: rounded decimals must never appear in exact fraction work`);
  }
  // Reduction is shown, whole numbers are named, and a difference keeps its sign.
  const reduce = await solveProblem('1/3+1/6', 'other');
  assert.equal(reduce.answer, '1/2 (= 0.5)');
  assert.match(reduce.steps.join('\n'), /Reduce by the common factor 3: 3\/6 = 1\/2/);
  const mixed = await solveProblem('2 - 1/4 + 1/2', 'other');
  assert.match(mixed.steps.join('\n'), /2 = 8\/4/);
  assert.match(mixed.steps.join('\n'), /\(8 - 1 \+ 2\)\/4 = 9\/4/);
  const negative = await solveProblem('-1/3 + 1/7', 'other');
  assert.match(negative.steps.join('\n'), /\(-7 \+ 3\)\/21 = -4\/21/);
  assert.equal(negative.answer, '-4/21 (= -0.1905)');
  // Fraction-relevant guidance, not PEMDAS boilerplate.
  assert.match(reduce.tips.join('\n'), /common denominator/);
  assert.match(reduce.common_mistakes.join('\n'), /1\/3 \+ 1\/7 is not 2\/10/);
});

test('fractions: products multiply across and quotients use the reciprocal', async () => {
  const product = await solveProblem('multiply 2/3 by 3/4', 'other');
  assert.equal(product.answer, '1/2 (= 0.5)');
  assert.match(product.steps.join('\n'), /\(2 × 3\)\/\(3 × 4\) = 6\/12/);
  const quotient = await solveProblem('(1/2)/(3/4)', 'other');
  assert.equal(quotient.answer, '2/3 (= 0.6667)');
  assert.match(quotient.steps.join('\n'), /reciprocal: 1\/2 ÷ 3\/4 = 1\/2 × 4\/3/);
  // A parenthesised group that works out to a fraction is shown as one.
  const grouped = await solveProblem('(1/3 + 1/7)*21', 'other');
  assert.equal(grouped.answer, '10');
  assert.match(grouped.steps[1], /\(1\/3\+1\/7\) = 10\/21/);
  assert.doesNotMatch(grouped.steps.join('\n'), /0\.476/);
});

test('fractions: the PEMDAS narration still runs for everything else', async () => {
  const r = await solveProblem('(5 + 3) * 4 - 2^3', 'other');
  assert.equal(r.answer, '24');
  assert.match(r.steps.join('\n'), /Exponents first: 2 \^ 3 = 8/);
  assert.equal((await solveProblem('0.1+0.2', 'other')).answer, '3/10 (= 0.3)');
});

test('linear inequalities take the two-line method, and say when the sign reverses', async () => {
  const r = await solveProblem('-2x > 4', 'algebra');
  assert.equal(r.answer, 'x < -2');
  assert.equal(r.verified, true);
  assert.ok(r.steps.length <= 5, `expected a short solution, got ${r.steps.length} steps`);
  assert.match(r.steps.join('\n'), /REVERSES the inequality, so > becomes </);
  assert.doesNotMatch(r.steps.join('\n'), /Test the sign/);
  assert.match(r.tips.join('\n'), /negative number reverses/);

  const positive = await solveProblem('2x + 3 < 7', 'algebra');
  assert.equal(positive.answer, 'x < 2');
  assert.match(positive.steps.join('\n'), /2x < 4/);
  assert.match(positive.steps.join('\n'), /direction stays the same/);

  const bothSides = await solveProblem('3x + 2 > 5x - 4', 'algebra');
  assert.equal(bothSides.answer, 'x < 3');
  assert.match(bothSides.steps.join('\n'), /-2x > -6/);

  const fractional = await solveProblem('x/2 + 1 <= 3', 'algebra');
  assert.equal(fractional.answer, 'x ≤ 4');
  assert.match(fractional.steps.join('\n'), /Multiply both sides by 2, the reciprocal of 1\/2/);

  // A chain of two linear halves still combines.
  assert.equal((await solveProblem('-1 < 2x + 1 <= 5', 'algebra')).answer, '-1 < x ≤ 2');
  // Non-linear inequalities keep the sign chart.
  const quadratic = await solveProblem('x^2 - 4 > 0', 'algebra');
  assert.equal(quadratic.answer, 'x < -2  or  x > 2');
  assert.match(quadratic.steps.join('\n'), /Test the sign/);
  const rational = await solveProblem('(x-1)/(x+2) >= 0', 'algebra');
  assert.equal(rational.answer, 'x < -2  or  x ≥ 1');
  assert.match(rational.steps.join('\n'), /Test the sign/);
});

test('∫e^(−x²) dx explains the error function instead of calling it a rule', async () => {
  const r = await solveProblem('∫e^(-x^2) dx', 'integrals');
  assert.equal(r.status, 'solved');
  assert.equal(r.answer, '∫(e^(-x^2)) dx = (√π/2)·erf(x) + C');
  const work = r.steps.join('\n');
  assert.match(work, /no elementary antiderivative/);
  assert.match(work, /erf\(x\) = \(2\/√π\)·∫₀\^x e\^\(−t²\) dt/);
  assert.match(work, /Check by differentiating/);
  assert.doesNotMatch(work, /Exponential rule|u-substitution|pi\^\(1\/2\)/);
  assert.match(r.tips.join('\n'), /special function/);
  assert.doesNotMatch(r.tips.join('\n'), /Power rule/);
  assert.match(r.common_mistakes.join('\n'), /u = −x²/);
  // A constant factor and a scaled argument carry through.
  assert.equal((await solveProblem('∫ 3e^(-x^2) dx', 'integrals')).answer, '∫(3e^(-x^2)) dx = (3√π/2)·erf(x) + C');
  assert.equal((await solveProblem('∫ e^(-4x^2) dx', 'integrals')).answer, '∫(e^(-4x^2)) dx = (√π/4)·erf(2x) + C');
  // Elementary neighbours are untouched.
  assert.match((await solveProblem('∫ x e^(-x^2) dx', 'integrals')).answer, /-1\/2\*e\^\(-x\^2\) \+ C$/);
  assert.match((await solveProblem('∫ e^x dx', 'integrals')).steps[1], /Exponential rule/);
});

test('word arithmetic is read as arithmetic: add / subtract from / times / divided by / sum of', async () => {
  const cases = [
    ['add 1/3 and 1/7', '10/21 (= 0.4762)'],
    ['add 2 to 3', '5'],
    ['subtract 2 from 9', '7'],
    ['multiply 2/3 by 3/4', '1/2 (= 0.5)'],
    ['divide 1/2 by 3/4', '2/3 (= 0.6667)'],
    ['the quotient of 1/2 and 3/4', '2/3 (= 0.6667)'],
    ['calculate the product of 5 and 6', '30'],
    ['the difference between 10 and 4', '6'],
    ['what is 5 plus 3', '8'],
    ['5 times 4', '20'],
    ['8 divided by 2', '4'],
    ['9 minus 2', '7'],
  ];
  for (const [input, expected] of cases) {
    const r = await solveProblem(input, 'other');
    assert.equal(r.status, 'solved', `${input}: ${r.answer}`);
    assert.equal(r.answer, expected, input);
  }
  // The rewrite is topic-neutral: "add 2x and 3x" is algebra.
  assert.equal((await solveProblem('add 2x and 3x', 'algebra')).answer, '5x');
});

test('sin(1) says it is reading radians, the way sin(45) says it is reading degrees', async () => {
  const radians = await solveProblem('sin(1)', 'trigonometry');
  assert.equal(radians.answer, '0.8415');
  assert.match(radians.steps.join('\n'), /Interpreting 1 as radians: 1 rad = 1 × 180\/π ≈ 57\.2958°/);
  const half = await solveProblem('sin(0.5)', 'trigonometry');
  assert.match(half.steps.join('\n'), /Interpreting 0\.5 as radians/);
  // The degrees branch, an explicit π, and inverse trig are untouched.
  const degrees = await solveProblem('sin(45)', 'trigonometry');
  assert.match(degrees.steps.join('\n'), /Detected input as degrees/);
  assert.doesNotMatch(degrees.steps.join('\n'), /Interpreting 45 as radians/);
  assert.doesNotMatch((await solveProblem('sin(pi/6)', 'trigonometry')).steps.join('\n'), /Interpreting/);
  assert.doesNotMatch((await solveProblem('arcsin(0.5)', 'trigonometry')).steps.join('\n'), /Interpreting/);
});

test('sum-product factoring shows the search for the pair and checks by expanding', async () => {
  const r = await solveProblem('x^2 - 5x + 6 = 0', 'algebra');
  assert.equal(r.answer, 'x = 2  or  x = 3');
  const work = r.steps.join('\n');
  assert.match(work, /two numbers whose product is 6 \(the constant term\) and whose sum is -5/);
  assert.match(work, /Factor pairs of 6: 1·6, \(-1\)·\(-6\), 2·3, \(-2\)·\(-3\)/);
  assert.match(work, /the pair -2 and -3 sums to -5/);
  assert.match(work, /Check by expanding: .* = x\^2 - 5x \+ 6\. ✓/);
  // The search precedes mathsteps' own factor line, which is kept.
  const searchAt = r.steps.findIndex((s) => /look for two numbers/.test(s));
  const factorAt = r.steps.findIndex((s) => /^Factor using the sum-product method/.test(s));
  assert.ok(searchAt >= 0 && factorAt > searchAt);
  // Mixed signs.
  assert.match((await solveProblem('x^2 - x - 6 = 0', 'algebra')).steps.join('\n'), /the pair 2 and -3 sums to -1/);
  // A non-monic quadratic gets no fabricated search.
  const nonMonic = await solveProblem('2x^2 - 5x + 2 = 0', 'algebra');
  assert.doesNotMatch(nonMonic.steps.join('\n'), /look for two numbers/);
  assert.match(nonMonic.answer, /x = 1 \/ 2  or  x = 2/);
});

test('limit cancellation explains the excluded point and the hole', async () => {
  const r = await solveProblem('lim x->1 (x^2-1)/(x-1)', 'limits');
  assert.match(r.answer, /= 2$/);
  const work = r.steps.join('\n');
  assert.match(work, /Cancelling is allowed only for x ≠ 1/);
  assert.match(work, /a limit asks what the function approaches for x NEAR 1, never at it/);
  assert.match(work, /a single hole at \(1, 2\) — a removable discontinuity/);
});

test('derivative tips and mistakes are chosen from the rules the solution used', async () => {
  const poly = await solveProblem('x^3 + 2x', 'derivatives');
  assert.match(poly.tips.join('\n'), /Power rule/);
  assert.doesNotMatch(poly.tips.join('\n'), /product, quotient, or chain rule/);
  assert.doesNotMatch(poly.common_mistakes.join('\n'), /chain rule|inside function/);

  const chain = await solveProblem('sin(x^2)', 'derivatives');
  assert.match(chain.tips.join('\n'), /Chain rule/);
  assert.match(chain.common_mistakes.join('\n'), /derivative of the inside function/);
  assert.doesNotMatch(chain.tips.join('\n'), /Power rule/);

  const product = await solveProblem('x*e^x', 'derivatives');
  assert.match(product.tips.join('\n'), /Product rule/);
  const quotient = await solveProblem('ln(x)/x', 'derivatives');
  assert.match(quotient.tips.join('\n'), /Quotient rule/);
  const trig = await solveProblem('cos(x)', 'derivatives');
  assert.match(trig.common_mistakes.join('\n'), /minus sign in d\/dx cos\(x\)/);
  // Every derivative still has at least one tip and one mistake.
  for (const input of ['7', 'x^x', '1/x^2 + 5', 'e^(3x)', 'ln(x)']) {
    const r = await solveProblem(input, 'derivatives');
    assert.ok(r.tips.length >= 1 && r.common_mistakes.length >= 1, input);
  }
});

test('u-substitution substitutes the whole du factor instead of isolating dx', async () => {
  const r = await solveProblem('∫2x cos(x^2) dx', 'integrals');
  assert.match(r.answer, /sin\(x\^2\) \+ C$/);
  const work = r.steps.join('\n');
  assert.match(work, /Let u = x\^2\. Then du = 2x dx — so wherever 2x dx appears in the integrand it becomes du/);
  assert.doesNotMatch(work, /dx = du\//);
});

// ---------------------------------------------------------------------------
// September 2026 teaching-quality review, batch 1 (v1.38.0): displayed
// reasoning that was invalid or mislabeled even though the answer was right.
// ---------------------------------------------------------------------------

test('improper integrals at an endpoint are taken as one-sided limits, never F(a) at the singularity', async () => {
  const root = await solveProblem('∫_0^1 1/sqrt(x) dx', 'integrals');
  assert.equal(root.status, 'solved');
  assert.match(root.answer, /= 2$/);
  const work = root.steps.join('\n');
  assert.match(work, /improper integral/);
  assert.match(work, /lim \(s→0⁺\) ∫_s\^1/);
  assert.match(work, /F\(1\) − F\(s\) = 2 − \(2s\^\(1\/2\)\)/);
  assert.match(work, /as s → 0⁺, F\(s\) → 0/);
  assert.doesNotMatch(work, /F\(0\) = 0|Apply the Fundamental Theorem of Calculus: ∫_a\^b/, 'no direct F(0) substitution');
  assert.doesNotMatch(work, /Simpson's rule\)/);

  const log = await solveProblem('∫_0^1 ln(x) dx', 'integrals');
  assert.equal(log.status, 'solved');
  assert.match(log.answer, /= -1$/);
  assert.match(log.steps.join('\n'), /lim \(s→0⁺\)/);

  // Divergent endpoint singularities say so, with the divergent status.
  for (const [input, at] of [['∫_0^1 1/x dx', 'x = 0'], ['∫_0^1 1/x^2 dx', 'x = 0']]) {
    const r = await solveProblem(input, 'integrals');
    assert.equal(r.status, 'diverges', input);
    assert.match(r.answer, new RegExp(`^Diverges.*unbounded at ${at}`), input);
    assert.match(r.steps.join('\n'), /F\(s\) → [−+]∞ .* so the limit is not a finite number/, input);
  }
  // An interior singularity still diverges (and never returns 0).
  const interior = await solveProblem('∫_-1^1 1/x dx', 'integrals');
  assert.equal(interior.status, 'diverges');
  assert.doesNotMatch(interior.answer, /dx = 0|= 0$/);
  // The singular upper end, reversed bounds, and both ends singular.
  assert.match((await solveProblem('∫_0^4 1/sqrt(4-x) dx', 'integrals')).answer, /= 4$/);
  const reversed = await solveProblem('∫_1^0 1/sqrt(x) dx', 'integrals');
  assert.match(reversed.answer, /= -2$/);
  assert.match(reversed.steps.join('\n'), /Reversing the bounds changes the sign/);
  const both = await solveProblem('∫_-1^1 1/sqrt(1-x^2) dx', 'integrals');
  assert.equal(both.status, 'solved');
  assert.match(both.answer, /= π \(≈ 3\.1416\)$/);
  // A proper integral is untouched.
  const proper = await solveProblem('∫_0^1 x^2 dx', 'integrals');
  assert.match(proper.steps.join('\n'), /Apply the Fundamental Theorem of Calculus/);
  assert.doesNotMatch(proper.steps.join('\n'), /improper/);
});

test('a divergent integral carries the diverges status, not unsupported', async () => {
  const { STATUS: S, statusLabel: label, shouldSaveToHistory: keep } = await import('../src/lib/solutionEnvelope.js');
  assert.equal(S.DIVERGES, 'diverges');
  assert.equal(label(S.DIVERGES), 'Diverges');
  assert.equal(keep(S.DIVERGES), true);
  for (const input of ['∫_0^1 1/x dx', '∫_-1^1 1/x dx', '∫_1^∞ 1/x dx']) {
    assert.equal((await solveProblem(input, 'integrals')).status, S.DIVERGES, input);
  }
  // Genuinely unsupported stays unsupported.
  assert.equal((await solveProblem('∫ sin(x^2) dx', 'integrals')).status, S.UNSUPPORTED);
});

test('integration methods are named from the integrand, never "Power rule" as a fallback', async () => {
  const cases = [
    ['∫ 1/(1+x^2) dx', /arctan\(x\) \+ C$/, /inverse-tangent pattern/],
    ['∫ 2/(1+4x^2) dx', /arctan\(2x\) \+ C$/, /Let u = 2x, so du = 2 dx/],
    ['∫ 1/(9+x^2) dx', /1\/3\*arctan\(1\/3\*x\) \+ C$/, /factoring out 9/],
    ['∫ x/(x^2+1) dx', /1\/2\*ln\(x\^2 \+ 1\) \+ C$/, /Let u = x\^2 \+ 1/],
    ['∫ 3x^2/(x^3+7) dx', /ln\|x\^3 \+ 7\| \+ C$/, /Let u = x\^3 \+ 7/],
    ['∫ 1/sqrt(1-x^2) dx', /arcsin\(x\) \+ C$/, /inverse-sine pattern/],
    ['∫ 1/sqrt(4-x^2) dx', /arcsin\(1\/2\*x\) \+ C$/, /factoring out 4/],
    ['∫ sec(x)^2 dx', /tan\(x\) \+ C$/, /Trig rule/],
    ['∫ 1/(2x+1) dx', /1\/2\*ln\|2x \+ 1\| \+ C$/, /Linear substitution/],
  ];
  for (const [input, answer, method] of cases) {
    const r = await solveProblem(input, 'integrals');
    assert.equal(r.status, 'solved', input);
    assert.match(r.answer, answer, input);
    const work = r.steps.join('\n');
    assert.match(work, method, input);
    assert.doesNotMatch(work, /\(Power rule\)/, `${input}: mislabeled as the power rule`);
    assert.doesNotMatch(r.tips.join('\n'), /^Power rule/, `${input}: power-rule tip`);
  }
  // Positivity note only where the log argument is always positive.
  assert.match((await solveProblem('∫ x/(x^2+1) dx', 'integrals')).steps.join('\n'), /x\^2 \+ 1 > 0 for every x, the absolute-value bars/);
  assert.doesNotMatch((await solveProblem('∫ 3x^2/(x^3+7) dx', 'integrals')).steps.join('\n'), /absolute-value bars/);
  // Genuine power-rule integrals keep the label; unknown table results are named honestly.
  assert.match((await solveProblem('∫ x^2 dx', 'integrals')).steps[1], /\(Power rule\)/);
  assert.match((await solveProblem('∫ 5x dx', 'integrals')).steps[1], /\(Power rule\)/);
  assert.match((await solveProblem('∫ 1/(x^2-1) dx', 'integrals')).steps[1], /\(Table antiderivative\)/);
  // The first tip follows the rule that was used.
  assert.match((await solveProblem('∫ e^x dx', 'integrals')).tips[0], /its own antiderivative/);
  assert.match((await solveProblem('∫ 1/x dx', 'integrals')).tips[0], /ln\|x\|/);
  assert.match((await solveProblem('∫ sec(x)^2 dx', 'integrals')).tips[0], /∫sec² = tan/);
});

test('a quotient-rule derivative never steps backward to an expanded form', async () => {
  const r = await solveProblem('d/dx (x^2+1)/(x-1)', 'derivatives');
  assert.equal(r.answer, "f'(x) = (x^2 - 2x - 1)/((x - 1)^2), x ≠ 1");
  const work = r.steps.join('\n');
  assert.match(work, /\(2x·\(x - 1\) − \(x\^2 \+ 1\)·1\)\/\(x - 1\)²/);
  assert.match(work, /d\/dx\(\(x\^2 \+ 1\)\/\(x - 1\)\) = \(x\^2 - 2x - 1\)\/\(\(x - 1\)\^2\)/);
  assert.doesNotMatch(work, /So f'\(x\) = -1\/\(\(x - 1\)\^2\)/, 'the raw expanded sum must not follow the simplified form');
  assert.doesNotMatch(work, /2x\/\(x - 1\) - x\^2/);
  // The last expression shown is the answer.
  const last = r.steps.filter((s) => /^d\/dx\(/.test(s)).pop();
  assert.match(last, /\(x\^2 - 2x - 1\)\/\(\(x - 1\)\^2\)$/);
  // Higher orders differentiate the simplified form, and show it.
  const second = await solveProblem('second derivative of (x^2+1)/(x-1)', 'derivatives');
  assert.match(second.answer, /4\/\(\(x - 1\)\^3\)/);
  assert.match(second.steps.join('\n'), /f''\(x\) = d\/dx\[\(x\^2 - 2x - 1\)\/\(\(x - 1\)\^2\)\] = 4\/\(\(x - 1\)\^3\)/);
  // Sums still close with the combined line; single terms are not restated.
  assert.match((await solveProblem('d/dx x^3 + 2x', 'derivatives')).steps.join('\n'), /Add the term derivatives and simplify: f'\(x\) = 3x\^2 \+ 2/);
  assert.doesNotMatch((await solveProblem('d/dx sin(x)', 'derivatives')).steps.join('\n'), /So f'\(x\)/);
});

// ---------------------------------------------------------------------------
// September 2026 teaching-quality review, batch 2 (v1.38.0): templates that
// were missing — the answer was right but the governing method was not shown.
// ---------------------------------------------------------------------------

test('absolute-value equations are solved by the two-case rule, with every candidate checked', async () => {
  const r = await solveProblem('abs(2x-3) = 5', 'algebra');
  assert.equal(r.answer, 'x = -1  or  x = 4');
  const work = r.steps.join('\n');
  assert.match(work, /\|2x - 3\| = 5 means the expression inside is either 5 or −5/);
  assert.match(work, /Case 1 .*: 2x - 3 = 5\n\s+Add 3 to both sides: 2x = 8\n\s+Divide both sides by 2: x = 4/);
  assert.match(work, /Case 2 .*: 2x - 3 = -5\n\s+Add 3 to both sides: 2x = -2\n\s+Divide both sides by 2: x = -1/);
  assert.match(work, /Check in the original equation: x = -1 gives \|2x - 3\| = 5/);
  assert.doesNotMatch(work, /crosses zero/);
  assert.equal((await solveProblem('|x+1| = -2', 'algebra')).answer, 'No real solution — an absolute value is never negative');
  assert.equal((await solveProblem('|x-4| = 0', 'algebra')).answer, 'x = 4');
  assert.equal((await solveProblem('|x| = 3', 'algebra')).answer, 'x = -3  or  x = 3');
  // Isolation first, a swapped side, exact fractions, and a non-linear inside.
  const isolated = await solveProblem('2|x - 1| + 1 = 7', 'algebra');
  assert.equal(isolated.answer, 'x = -2  or  x = 4');
  assert.match(isolated.steps.join('\n'), /First isolate the absolute value.*\|x - 1\| = 3/);
  assert.equal((await solveProblem('5 = |3x + 2|', 'algebra')).answer, 'x = -7/3  or  x = 1');
  const quad = await solveProblem('|x^2 - 4| = 5', 'algebra');
  assert.equal(quad.answer, 'x = -3  or  x = 3');
  assert.match(quad.steps.join('\n'), /This case gives no real solution/);
});

test('every solved equation ends with a substitution check', async () => {
  assert.match((await solveProblem('2x + 5 = 11', 'algebra')).steps.join('\n'), /Check in the original equation: x = 3 gives 2x \+ 5 = 11 and 11 = 11 ✓/);
  assert.match((await solveProblem('x^2 - 5x + 6 = 0', 'algebra')).steps.join('\n'), /x = 2 gives x\^2 - 5x \+ 6 = 0 and 0 = 0; x = 3 gives/);
});

test('logarithmic differentiation is derived in full, not just named', async () => {
  const r = await solveProblem('d/dx x^x', 'derivatives');
  assert.equal(r.answer, "f'(x) = x^x*(1 + ln(x)), x > 0");
  const work = r.steps.join('\n');
  assert.match(work, /Let y = x\^x, with x > 0/);
  assert.match(work, /ln\(y\) = ln\(x\^x\) = x·ln\(x\)/);
  assert.match(work, /d\/dx ln\(y\) = y′\/y/);
  assert.match(work, /d\/dx\[x·ln\(x\)\] = ln\(x\) \+ x·1\/x = 1 \+ ln\(x\)/);
  assert.match(work, /y′ = y·\(1 \+ ln\(x\)\)/);
  assert.match(work, /Substitute y = x\^x back: y′ = x\^x·\(1 \+ ln\(x\)\)/);
  // The general u^v form, and a scaled exponent.
  const general = await solveProblem('d/dx (x+1)^x', 'derivatives');
  assert.match(general.answer, /\(x \+ 1\)\^x\*\(ln\(x \+ 1\) \+ x\/\(x \+ 1\)\), x > -1$/);
  assert.match(general.steps.join('\n'), /with x \+ 1 > 0/);
  assert.match((await solveProblem('d/dx x^(2x)', 'derivatives')).steps.join('\n'), /ln\(y\) = ln\(x\^\(2x\)\) = 2x·ln\(x\)/);
});

test('a negative exponent is taught as a reciprocal', async () => {
  const r = await solveProblem('2^-3', 'other');
  assert.equal(r.answer, '1/8 (= 0.125)');
  assert.match(r.steps[1], /a negative exponent means a reciprocal, a\^\(-n\) = 1\/a\^n \(the base cannot be 0\): 2\^\(-3\) = 1\/2\^3 = 1\/8/);
  assert.match((await solveProblem('(-2)^-3', 'other')).steps[1], /1\/\(-2\)\^3 = 1\/\(-8\) = -1\/8/);
  assert.equal((await solveProblem('10^-2', 'other')).answer, '1/100 (= 0.01)');
  assert.equal((await solveProblem('0^-1', 'other')).status, 'undefined');
  const unary = await solveProblem('-2^-2', 'other');
  assert.equal(unary.answer, '-1/4 (= -0.25)');
  assert.match(unary.steps.join('\n'), /apply the sign afterwards/);
  // A positive exponent gets no note.
  assert.equal((await solveProblem('2^3', 'other')).steps[1], 'Exponents first: 2 ^ 3 = 8');
});

test('linear equations show the distribution and the combining of constants', async () => {
  const r = await solveProblem('3(x-2)+4 = 2x+1', 'algebra');
  assert.equal(r.answer, 'x = 3');
  assert.equal(r.steps[0], 'Distribute across the parentheses: 3x - 6 + 4 = 2x + 1');
  assert.equal(r.steps[1], 'Collect and combine like terms: 3x - 2 = 2x + 1');
  assert.match(r.steps.join('\n'), /Check in the original equation: x = 3 gives 3\(x - 2\) \+ 4 = 7 and 2x \+ 1 = 7 ✓/);
  const negative = await solveProblem('-2(x-3)+1=7', 'algebra');
  assert.equal(negative.steps[0], 'Distribute across the parentheses: -2x + 6 + 1 = 7');
  assert.equal(negative.answer, 'x = 0');
  // 4 − 3(2x + 1) = 10: mathsteps' "x = -3 / 2" used to be read as the two
  // numbers −3 and 2, fail verification, and lose its steps to the roots path.
  const subtracted = await solveProblem('4-3(2x+1)=10', 'algebra');
  assert.match(subtracted.steps[0], /^Distribute across the parentheses: 4 - \(6x \+ 3\) = 10/);
  assert.match(subtracted.steps[1], /^Distribute the negative sign: 4 - 6x - 3 = 10/);
  assert.match(subtracted.answer, /-3 \/ 2$/);
  assert.match((await solveProblem('simplify 3(x-2)+4', 'algebra')).steps[0], /^Distribute across the parentheses: 3x - 6 \+ 4$/);
});

// ---------------------------------------------------------------------------
// September 2026 teaching-quality review, batch 3 (v1.38.0): coherence and
// polish — classifications shown rather than described, range, ambiguity,
// guidance chosen by concept, and the cosine limit derived.
// ---------------------------------------------------------------------------

test('a dependent 2×2 system shows the proportionality and parameterises the line', async () => {
  const r = await solveProblem('x + y = 2; 2x + 2y = 4', 'algebra');
  assert.equal(r.answer, 'Infinitely many solutions — the two equations describe the same line: (x, y) = (2 − t, t), t any real number');
  const work = r.steps.join('\n');
  assert.match(work, /equation 2 is 2 × equation 1 — divide equation 2 by 2 and it becomes x \+ y = 2/);
  assert.match(work, /Let y = t \(any real number\)\. Then from x \+ y = 2: x = \(2 − 1·t\)\/1 = 2 − t/);
  assert.match(work, /Solutions: \(x, y\) = \(2 − t, t\) for every real t/);
  const scaled = await solveProblem('2x - 4y = 6; -x + 2y = -3', 'algebra');
  assert.match(scaled.steps.join('\n'), /x = \(6 \+ 4·t\)\/2 = 3 \+ 2t/);
});

test('an inconsistent 2×2 system displays the contradiction', async () => {
  const same = await solveProblem('x + y = 2; x + y = 3', 'algebra');
  assert.equal(same.answer, 'No solution — the two lines are parallel');
  assert.match(same.steps.join('\n'), /Subtract equation 1 from equation 2: \(x \+ y\) − \(x \+ y\) = 3 − 2, which gives 0 = 1/);
  assert.match(same.steps.join('\n'), /0 = 1 is false for every \(x, y\): a contradiction/);
  const scaled = await solveProblem('2x + 3y = 6; 4x + 6y = 7', 'algebra');
  assert.match(scaled.steps.join('\n'), /multiply equation 1 by 2 .* 4x \+ 6y = 12 .* 0 = 7 − \(12\) = -5/);
  // A unique solution is untouched.
  assert.equal((await solveProblem('x + y = 2; x - y = 4', 'algebra')).answer, 'x = 3,  y = -1');
});

test('the range is stated for recognised function families, and only for them', async () => {
  const cases = [
    ['f(x) = sqrt(x-2)', 'y ≥ 0'],
    ['f(x) = 2x + 3', 'all real numbers'],
    ['f(x) = (x-1)^2 + 2', 'y ≥ 2'],
    ['f(x) = -x^2 + 4x', 'y ≤ 4'],
    ['f(x) = -2|x+1| + 3', 'y ≤ 3'],
    ['f(x) = -3sqrt(2x+1) + 5', 'y ≤ 5'],
    ['f(x) = 1/(x-2) + 1', 'y ≠ 1'],
    ['f(x) = 1/x', 'y ≠ 0'],
    ['f(x) = 3*2^x - 1', 'y > -1'],
    ['f(x) = -e^x + 2', 'y < 2'],
    ['f(x) = ln(x-1)', 'all real numbers'],
    ['f(x) = 2sin(x) + 1', '-1 ≤ y ≤ 3'],
    ['f(x) = cos(2x) - 3', '-4 ≤ y ≤ -2'],
  ];
  for (const [input, range] of cases) {
    const r = await solveProblem(input, 'functions');
    const line = r.steps.find((s) => /^Range: /.test(s));
    assert.ok(line, `${input}: no range line`);
    assert.ok(line.startsWith(`Range: ${range} — `), `${input}: ${line}`);
    assert.match(r.answer, new RegExp(`range: ${range.replace(/[-+≤≥≠]/g, (c) => `\\${c}`)}`), input);
  }
  // Outside the recognised families nothing is claimed — never read off the window.
  for (const input of ['f(x) = x^3 - x', 'f(x) = x^4 - x^2', 'f(x) = x*e^x']) {
    const r = await solveProblem(input, 'functions');
    assert.ok(!r.steps.some((s) => /^Range/.test(s)), `${input}: fabricated range`);
    assert.doesNotMatch(r.answer, /range:/, input);
  }
});

test('division followed by implicit multiplication carries a warning naming both readings', async () => {
  const r = await solveProblem('8/2(2+2)', 'other');
  assert.equal(r.answer, '16');
  assert.deepEqual(r.warnings, ['"8/2(2+2)" can be read two ways. MasterMath follows left-to-right precedence: (8/2)·(2+2) = 16. If you meant 8/(2·(2+2)) = 1, write the grouping explicitly: 8/(2*(2+2)).']);
  assert.match((await solveProblem('6/2x', 'algebra')).warnings[0], /\(6\/2\)·x\. If you meant 6\/\(2·x\)/);
  assert.match((await solveProblem('1/2pi', 'other')).warnings[0], /\(1\/2\)·pi/);
  assert.equal((await solveProblem('(8/2)*(2+2)', 'other')).warnings, undefined);
  assert.equal((await solveProblem('8/(2*(2+2))', 'other')).warnings, undefined);
  assert.equal((await solveProblem('2x + 5 = 11', 'algebra')).warnings, undefined);
});

test('the cosine standard limit is derived from the sine limit', async () => {
  const r = await solveProblem('lim x->0 (1-cos(x))/x^2', 'limits');
  assert.match(r.answer, /= 1\/2$/);
  const work = r.steps.join('\n');
  assert.match(work, /half-angle identity 1 − cos\(u\) = 2sin²\(u\/2\)/);
  assert.match(work, /\(1\/2\)·\[sin\(u\/2\)\/\(u\/2\)\]²/);
  assert.match(work, /sin\(u\/2\)\/\(u\/2\) → 1/);
  const scaled = await solveProblem('lim x->0 (1-cos(3x))/x^2', 'limits');
  assert.match(scaled.answer, /= 9\/2$/);
  assert.match(scaled.steps.join('\n'), /With u = 3x: .* = \(9\) · \(1 − cos\(3x\)\)\/\(3x\)²/);
});

test('guidance follows the concept: limits by technique, trig by function, fractions by operation', async () => {
  assert.match((await solveProblem('lim x->0 sin(3x)/x', 'limits')).tips[0], /standard limits sin\(u\)\/u → 1/);
  assert.match((await solveProblem('lim x->1 (x^2-1)/(x-1)', 'limits')).tips[0], /common factor is hiding/);
  assert.match((await solveProblem('lim x->infinity (3x^2+1)/(x^2-4)', 'limits')).tips[0], /highest power dominates/);
  assert.match((await solveProblem('lim x->2 x^2+1', 'limits')).tips[0], /substituting the value directly/);

  const cosine = await solveProblem('cos(pi/3)', 'trigonometry');
  assert.match(cosine.tips[0], /^Remember: cos\(0°\) = 1/);
  const arc = await solveProblem('arcsin(0.5)', 'trigonometry');
  assert.match(arc.tips[0], /returns an ANGLE/);
  assert.match(arc.common_mistakes.join('\n'), /Reading arcsin\(x\) as 1\/sin\(x\)/);
  const tangent = await solveProblem('tan(pi/4)', 'trigonometry');
  assert.match(tangent.tips[0], /tan = sin\/cos/);

  const product = await solveProblem('1/2 * 3/4', 'other');
  assert.doesNotMatch(product.tips.join('\n'), /divide by a fraction|reciprocal/i);
  const quotient = await solveProblem('(1/2)/(3/4)', 'other');
  assert.match(quotient.tips[0], /keep, change, flip/);
  // An integral that used no power rule is not warned about 1/x.
  assert.doesNotMatch((await solveProblem('∫ sec(x)^2 dx', 'integrals')).common_mistakes.join('\n'), /power rule to 1\/x/);
  assert.match((await solveProblem('∫ x^2 dx', 'integrals')).common_mistakes.join('\n'), /power rule to 1\/x/);
});

// ---------------------------------------------------------------------------
// v1.38.1 — consistency: one formatter for every integral step (ln|·|, e^…),
// bars dropped where the argument is always positive, divergence stated with
// its sign, guidance chosen by method for equations and arithmetic, and the
// internal common-log rewrite kept off the screen.
// ---------------------------------------------------------------------------

test('an integral walkthrough never switches between log and ln, or exp and e^', async () => {
  const sub = await solveProblem('∫ x/(x^2+1) dx', 'integrals');
  const work = sub.steps.join('\n');
  assert.doesNotMatch(work, /(?<![a-z])log\(/, 'raw log() in the steps');
  assert.match(work, /Integrate in u: ∫\(1\/\(2u\)\) du = 1\/2\*ln\|u\|/);
  assert.match(work, /the absolute-value bars in ln\|x\^2 \+ 1\| are not needed/);
  assert.equal(sub.answer, '∫(x/(x^2 + 1)) dx = 1/2*ln(x^2 + 1) + C');
  assert.match(sub.graph.description, /F\(x\) = 1\/2\*ln\(x\^2 \+ 1\)/);
  // Bars stay where the argument can be negative.
  assert.match((await solveProblem('∫ 2x/(x^2-4) dx', 'integrals')).answer, /ln\|x\^2 - 4\| \+ C$/);
  // exp() is written e^ in by-parts steps and answers alike.
  const parts = await solveProblem('∫ x*e^x dx', 'integrals');
  assert.doesNotMatch(parts.steps.join('\n'), /exp\(/);
  assert.match(parts.steps.join('\n'), /Choose the parts: u = x, dv = e\^x dx/);
  assert.equal(parts.answer, '∫(x*e^x) dx = e^x*(x - 1) + C');
  assert.match((await solveProblem('∫ x e^(-x^2) dx', 'integrals')).answer, /= -1\/2\*e\^\(-x\^2\) \+ C$/);
});

test('divergence is stated with its sign, and the principal value is named for a symmetric odd pole', async () => {
  const interior = await solveProblem('∫_-1^1 1/x dx', 'integrals');
  const work = interior.steps.join('\n');
  assert.match(work, /Left piece, ∫_\{-1\}\^\{0\} = lim \(s→0⁻\) \[F\(s\) − F\(-1\)\]: as s → 0⁻, F\(s\) → −∞ \(samples: -4\.6052/);
  assert.match(work, /Right piece, ∫_\{0\}\^\{1\} = lim \(t→0⁺\) \[F\(1\) − F\(t\)\]: as t → 0⁺, F\(t\) → −∞/);
  assert.match(work, /The one-sided improper integrals do not both converge, so the integral diverges/);
  assert.match(work, /Cauchy principal value, is 0\. It is not the value of the improper integral/);
  assert.doesNotMatch(work, /grows without bound/);
  // 1/x² is even about the pole: both pieces run to +∞ on the left... and no principal-value note.
  const even = await solveProblem('∫_-1^1 1/x^2 dx', 'integrals');
  assert.match(even.steps.join('\n'), /as s → 0⁻, F\(s\) → \+∞ .*\n.*as t → 0⁺, F\(t\) → −∞/);
  assert.doesNotMatch(even.steps.join('\n'), /principal value/);
  // Endpoint and infinite-bound wording carry the sign too.
  assert.match((await solveProblem('∫_0^1 1/x dx', 'integrals')).steps.join('\n'), /the integrand → \+∞ as x → 0⁺.*\n.*\n.*\n.*F\(s\) → −∞/);
  assert.match((await solveProblem('∫_0^1 ln(x) dx', 'integrals')).steps[1], /the integrand → −∞ as x → 0⁺/);
  assert.match((await solveProblem('∫_1^∞ 1/x dx', 'integrals')).steps.join('\n'), /F\(t\) → ∞ — slowly, but steadily/);
  // A divergent integral's graph never says "signed area NaN".
  assert.match((await solveProblem('∫_1^∞ 1/x dx', 'integrals')).graph.description, /diverges — the shaded region has no finite area/);
});

test('equation guidance follows the method: absolute value, radical, log, exponential, quadratic, rational, linear', async () => {
  const pick = async (input) => (await solveProblem(input, 'algebra'));
  assert.match((await pick('abs(2x-3) = 5')).tips[0], /\|A\| = b splits into two equations/);
  assert.match((await pick('abs(2x-3) = 5')).common_mistakes[0], /only the positive case/);
  assert.match((await pick('sqrt(x+1) = 3')).tips[0], /square both sides/);
  assert.match((await pick('ln(x) = 1')).tips[0], /ln\(x\) = c means x = e\^c/);
  assert.match((await pick('2^x = 10')).tips[0], /taking a logarithm of both sides/);
  assert.match((await pick('x^2 - 5x + 6 = 0')).tips[0], /A quadratic has up to two solutions/);
  assert.match((await pick('x/(x-1) = 2')).tips[0], /Clear the denominators/);
  assert.match((await pick('2x + 5 = 11')).tips[0], /Undo the operations in reverse order/);
  assert.match((await pick('simplify 3(x-2)+4')).tips[0], /Distribute first, then collect like terms/);
  for (const input of ['abs(2x-3) = 5', 'sqrt(x+1) = 3', 'ln(x) = 1', '2^x = 10']) {
    assert.doesNotMatch((await pick(input)).tips.join('\n'), /Combine like terms by adding or subtracting their coefficients/, input);
  }
});

test('arithmetic guidance follows the feature: negative exponent, factorial, percent, root, else PEMDAS', async () => {
  assert.match((await solveProblem('2^-3', 'other')).tips[0], /a\^\(−n\) = 1\/a\^n/);
  assert.match((await solveProblem('2^-3', 'other')).common_mistakes[1], /minus sign is in the exponent/);
  const fact = await solveProblem('7!', 'other');
  assert.equal(fact.steps[1], '7! means the product of every whole number from 7 down to 1: 7 × 6 × 5 × 4 × 3 × 2 × 1 = 5040.');
  assert.match(fact.tips[1], /0! = 1 by definition/);
  assert.match((await solveProblem('50% of 80', 'other')).answer, /^40$/);
  assert.match((await solveProblem('sqrt(2)', 'other')).tips[0], /√2 is irrational/);
  assert.match((await solveProblem('(5 + 3) * 4 - 2^3', 'other')).tips[0], /^PEMDAS/);
});

test('the common-log rewrite never reaches the screen', async () => {
  const r = await solveProblem('d/dx log(x)', 'derivatives');
  assert.equal(r.steps[0], 'Identify the function to differentiate: f(x) = log(x)');
  assert.match(r.steps[1], /^Logarithmic rule — log\(x\) is the base-10 logarithm/);
  assert.doesNotMatch(r.steps.join('\n') + r.graph.description, /log\(10\)\)/);
  assert.equal(r.answer, "f'(x) = 1/(x*ln(10)), x > 0");
});

test('limit guidance covers two-sided divergence and sampling at infinity', async () => {
  assert.match((await solveProblem('lim x->0 1/x', 'limits')).tips[0], /check each side separately/);
  assert.match((await solveProblem('lim x->infinity e^(-x)', 'limits')).tips[0], /highest power dominates/);
});
