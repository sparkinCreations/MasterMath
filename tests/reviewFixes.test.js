import test from 'node:test';
import assert from 'node:assert/strict';
import { solveProblem } from '../src/lib/api.js';
import { describeGraphFeatures } from '../src/lib/graphDescription.js';

// September 2026 review: one derivative error (|x|), several thin step
// templates, and graph legibility. Each finding has a test here.

test('|x|: piecewise derivation, one-sided derivatives compared, f′(0) does not exist', async () => {
  const r = await solveProblem('abs(x)', 'derivatives');
  assert.equal(r.answer, "f'(x) = -1 for x < 0, 1 for x > 0; f'(0) does not exist");
  assert.ok(r.steps.some((s) => /power rule does not apply/.test(s)));
  assert.ok(r.steps.some((s) => /\|x\| = x when x ≥ 0, and \|x\| = −x when x < 0/.test(s)));
  assert.ok(r.steps.some((s) => /for x > 0, f'\(x\) = 1; for x < 0, f'\(x\) = -1/.test(s)));
  assert.ok(r.steps.some((s) => /one-sided derivatives.*They differ, so f'\(0\) does not exist/.test(s)));
  // The derivative graph breaks at 0 and marks both one-sided values hollow.
  assert.deepEqual(r.graph.secondaryBreaks, [0]);
  assert.deepEqual(r.graph.annotations.openPoints.map((o) => [o.x, o.y]), [[0, -1], [0, 1]]);
  assert.equal(r.graph.expression, 'abs(x)');
  const desc = describeGraphFeatures(r.graph);
  assert.ok(desc.some((d) => /Hollow markers at \(0, -1\) and \(0, 1\): f'\(0\) does not exist/.test(d)), desc.join(' | '));
  assert.ok(desc.some((d) => /f'\(x\)/.test(d) && !/f''/.test(d)));
});

test('|ax + b|: the corner moves; evaluating at it says the derivative does not exist', async () => {
  const r = await solveProblem('|2x - 4|', 'derivatives');
  assert.equal(r.answer, "f'(x) = -2 for x < 2, 2 for x > 2; f'(2) does not exist");
  assert.equal((await solveProblem('|2x - 4| at x = 2', 'derivatives')).answer, "f'(2) does not exist");
  assert.equal((await solveProblem('3*abs(x+1) at x = 5', 'derivatives')).answer, "f'(5) = 3");
  assert.equal((await solveProblem('3*abs(x+1) at x = -7', 'derivatives')).answer, "f'(-7) = -3");
});

test('other uses of abs keep sgn but state where the derivative does not exist', async () => {
  const r = await solveProblem('x*abs(x)', 'derivatives');
  assert.match(r.answer, /\(does not exist where x = 0\)$/);
  assert.ok(r.steps.some((s) => /corner and the derivative does not exist/.test(s)));
});

test('derivative answers state their domain: 1/x, sqrt(x), ln(x), sqrt(x − 3)', async () => {
  assert.equal((await solveProblem('1/x', 'derivatives')).answer, "f'(x) = -1/(x^2), x ≠ 0");
  assert.equal((await solveProblem('sqrt(x)', 'derivatives')).answer, "f'(x) = 1/(2x^(1/2)), x > 0");
  assert.equal((await solveProblem('ln(x)', 'derivatives')).answer, "f'(x) = 1/x, x > 0");
  assert.equal((await solveProblem('sqrt(x-3)', 'derivatives')).answer, "f'(x) = 1/(2(x - 3)^(1/2)), x > 3");
  assert.equal((await solveProblem('1/(x-2)', 'derivatives')).answer, "f'(x) = -1/((x - 2)^2), x ≠ 2");
  // Nothing restricts a polynomial: no suffix, no fabricated condition.
  assert.equal((await solveProblem('x^3 - 3*x', 'derivatives')).answer, "f'(x) = 3x^2 - 3");
  const r = await solveProblem('1/x', 'derivatives');
  assert.ok(r.steps.some((s) => /Domain of f'\(x\): x ≠ 0 — the denominator of f' is 0 at x = 0/.test(s)));
});

test('∫sin²x shows the half-angle identity and term-by-term integration', async () => {
  const r = await solveProblem('sin(x)^2', 'integrals');
  assert.match(r.answer, /1\/2\*\(x - 1\/2\*sin\(2x\)\) \+ C$/);
  assert.ok(r.steps.some((s) => /sin²\(u\) = \(1 − cos\(2u\)\)\/2 with u = x/.test(s)));
  assert.ok(r.steps.some((s) => /∫1 dx = x, and ∫cos\(2x\) dx = sin\(2x\)\/2/.test(s)));
  assert.ok(!r.steps.some((s) => /Trig rule/.test(s)));
  const c = await solveProblem('3*cos(2x)^2', 'integrals');
  assert.ok(c.steps.some((s) => /cos²\(u\) = \(1 \+ cos\(2u\)\)\/2 with u = 2x/.test(s)));
});

test('x² + 1 = 0 shows x² = −1 and x = ±√(−1) = ±i', async () => {
  const r = await solveProblem('x^2 + 1 = 0', 'algebra');
  assert.equal(r.answer, 'x = -i  or  x = i');
  assert.ok(r.steps.some((s) => /Isolate x²: x\^2 \+ 1 = 0 gives x\^2 = -1/.test(s)));
  assert.ok(r.steps.some((s) => /x = ±√\(-1\).*√\(-1\) = √1·√\(−1\) = i/.test(s)));
  assert.ok(!r.steps.some((s) => /by finding the roots/.test(s)));
});

test('a general quadratic shows a, b, c, the discriminant and the formula', async () => {
  const r = await solveProblem('x^2 - 2x - 1 = 0', 'algebra');
  assert.equal(r.answer, 'x = 1 - √2  or  x = 1 + √2');
  assert.ok(r.steps.some((s) => /with a = 1, b = -2, c = -1/.test(s)));
  assert.ok(r.steps.some((s) => /Discriminant: b² − 4ac = \(-2\)² − 4\(1\)\(-1\) = 8/.test(s)));
  assert.ok(r.steps.some((s) => /Quadratic formula: x = \(−b ± √\(b² − 4ac\)\)\/\(2a\) = \(2 ± √\(8\)\)\/2 = \(2 ± 2√2\)\/2/.test(s)));
});

test('sqrt(x + 2) = x: domain, squaring, both candidates, the extraneous one rejected with the reason', async () => {
  const r = await solveProblem('sqrt(x+2) = x', 'algebra');
  assert.equal(r.answer, 'x = 2');
  assert.ok(r.steps.some((s) => /Isolate the radical:.*√\(x \+ 2\) = x/.test(s)));
  assert.ok(r.steps.some((s) => /x \+ 2 ≥ 0; and a square root is never negative, so the other side must also satisfy x ≥ 0/.test(s)));
  assert.ok(r.steps.some((s) => /Square both sides: x \+ 2 = \(x\)² = x\^2/.test(s)));
  assert.ok(r.steps.some((s) => /x = -1 or x = 2/.test(s)));
  assert.ok(r.steps.some((s) => /x = -1: the right side x = -1 is negative.*extraneous.*x = 2: √\(4\) = 2 and x = 2 — balances ✓/.test(s)));
  assert.ok(!r.steps.some((s) => /Search for values where the expression crosses zero/.test(s)));
  assert.equal((await solveProblem('sqrt(x) = 5', 'algebra')).answer, 'x = 25');
  assert.equal((await solveProblem('sqrt(2x+3) = x', 'algebra')).answer, 'x = 3');
  assert.match((await solveProblem('sqrt(x) = -2', 'algebra')).answer, /^No solution \(a square root cannot equal a negative number\)/);
});

test('lim x/e^x samples are shown at their true size, with the underflow explained', async () => {
  const r = await solveProblem('lim x->infinity x/exp(x)', 'limits');
  assert.match(r.answer, /= 0$/);
  const samples = r.steps.find((s) => /^Samples:/.test(s));
  assert.match(samples, /^Samples: 3\.72e-42, 0, 0/);
  assert.match(samples, /cannot be represented in double precision/);
});

test('arithmetic steps show the expression after every operation, in PEMDAS order', async () => {
  const r = await solveProblem('3 + 4 * 2^3', 'other');
  assert.equal(r.answer, '35');
  assert.deepEqual(r.steps, [
    'Evaluate: 3+4*2^3',
    'Exponents first: 2 ^ 3 = 8  →  3 + 4 * 8',
    'Multiplication and division next, left to right: 4 * 8 = 32  →  3 + 32',
    'Addition and subtraction last, left to right: 3 + 32 = 35',
    'Final answer: 35',
  ]);
  const m = await solveProblem('-2^2', 'other');
  assert.equal(m.answer, '-4');
  assert.ok(m.steps.some((s) => /Exponents first: 2 \^ 2 = 4/.test(s)));
  assert.ok(m.steps.some((s) => /apply the sign afterwards: -\(4\) = -4/.test(s)));
  const d = await solveProblem('8/2*4', 'other');
  assert.ok(d.steps.some((s) => /left to right: 8 \/ 2 = 4  →  4 \* 4/.test(s)));
  const f = await solveProblem('1/3 + 1/6', 'other');
  assert.equal(f.answer, '1/2 (= 0.5)');
  assert.ok(f.steps.some((s) => /1 \/ 3 = 1\/3 \(≈ 0\.3333\)/.test(s)));
});

test('cos(x) = −1/2: the second angle is named on [0, 2π), not called "within one period"', async () => {
  const r = await solveProblem('cos(x) = -1/2', 'trigonometry');
  assert.ok(!r.steps.some((s) => /both work within one period/.test(s)));
  assert.ok(r.steps.some((s) => /−2π\/3 is the same angle as 2π − 2π\/3 = 4π\/3/.test(s)));
  assert.match(r.answer, /on \[0, 2π\): 2π\/3, 4π\/3$/);
});

test('graphs carry their expression and open on a window that frames the features', async () => {
  const cubic = await solveProblem('x^3 - 3*x', 'functions');
  assert.equal(cubic.graph.expression, 'x^3-3*x');
  assert.equal(cubic.graph.variable, 'x');
  assert.ok(cubic.graph.initialWindow.xMax < 5 && cubic.graph.initialWindow.xMin > -5, JSON.stringify(cubic.graph.initialWindow));
  const d = await solveProblem('x^3 - 3*x', 'derivatives');
  assert.equal(d.graph.secondaryExpression, '3*x^2-3');
  assert.ok(d.graph.initialWindow.xMax < 5, JSON.stringify(d.graph.initialWindow));
  const t = await solveProblem('tan(x)', 'functions');
  assert.deepEqual(t.graph.initialWindow, { xMin: -2 * Math.PI, xMax: 2 * Math.PI });
  const e = await solveProblem('x^2 - 5x + 6 = 0', 'algebra');
  assert.equal(e.graph.expression, 'x^2-5*x+6');
  const i = await solveProblem('2*x + 1', 'integrals');
  assert.equal(i.graph.expression, '2*x+1');
});

test('a periodic function is summarised by its pattern, not a wall of decimals', async () => {
  const t = await solveProblem('tan(x)', 'functions');
  assert.equal(t.answer, 'f(x) = tan(x): domain: all real numbers except x = π/2 + nπ (n any integer); y-intercept (0, 0); x-intercepts at x = nπ; vertical asymptotes at x = π/2 + nπ; periodic.');
  const s = await solveProblem('sin(x)', 'functions');
  assert.match(s.answer, /x-intercepts at x = nπ;/);
  // Non-periodic answers are unchanged.
  const r = await solveProblem('1/(x-2)', 'functions');
  assert.match(r.answer, /vertical asymptote x = 2/);
});
