import test from 'node:test';
import assert from 'node:assert/strict';

import { solveProblem } from '../src/lib/api.js';
import { toLatex, segmentMathText } from '../src/lib/latex.js';

// 1.52.4: an outside review scored the app 8.5/10. Each claim was reproduced
// first; these are the confirmed ones, and what the sweep around them found.

test('an antiderivative combines like terms', async () => {
  const cases = [
    ['∫ 2 + 3 dx', '∫(2 + 3) dx = 5x + C'],
    ['∫ 32 - 8 dx', '∫(32 - 8) dx = 24x + C'],
    ['∫ 2^5 - 2^3 dx', '∫(2^5 - 2^3) dx = 24x + C'],
    ['∫ x + 2x dx', '∫(x + 2x) dx = 3/2*x^2 + C'],
    ['∫ 3x^2 + x^2 dx', '∫(3x^2 + x^2) dx = 4/3*x^3 + C'],
    ['∫ x - x dx', '∫(x - x) dx = C'],
    // Already simplest: unchanged, never factored or reordered.
    ['∫ 2x + 1 dx', '∫(2x + 1) dx = x^2 + x + C'],
    ['∫ x^2 - 5x + 6 dx', '∫(x^2 - 5x + 6) dx = 1/3*x^3 - 5/2*x^2 + 6x + C'],
  ];
  for (const [p, answer] of cases) assert.equal((await solveProblem(p, 'integrals')).answer, answer, p);
  const r = await solveProblem('∫ x + 2x dx', 'integrals');
  assert.ok(r.steps.some((s) => /^Combine like terms/.test(s)), 'the combining is shown');
});

test('a constant that divides by zero is undefined under every topic, never a function or a limit', async () => {
  for (const topic of ['integrals', 'derivatives', 'functions', 'limits', 'algebra', 'other']) {
    const r = await solveProblem('2/0', topic);
    assert.equal(r.status, 'undefined', topic);
    assert.equal(r.answer, 'Undefined — division by zero', topic);
    const z = await solveProblem('0/0', topic);
    assert.equal(z.status, 'indeterminate', topic);
  }
  // Was "f(x) = 2/0: a constant function" and "lim (x→0) 2/0 = ∞", both Solved.
  assert.equal((await solveProblem('lim x->0 1/0', 'limits')).status, 'undefined');
  // A plain number under Limits is evaluated, not given an invented x → 0.
  const half = await solveProblem('1/2', 'limits');
  assert.equal(half.answer, '1/2 (= 0.5)');
  assert.equal(half.routing?.to, 'other');
  // Real limits are untouched.
  assert.equal((await solveProblem('lim x->2 3', 'limits')).answer, 'lim (x→2) 3 = 3');
});

test('factor, expand, simplify and solve go to Algebra from any topic', async () => {
  const cases = [
    ['factor x^2-5x+6', 'integrals', '(x - 3)(x - 2)'],
    ['factorise x^2-9', 'derivatives', '(x - 3)(x + 3)'],
    ['expand (x+1)^2', 'limits', 'x^2 + 2x + 1'],
    ['simplify (x^2-1)/(x-1)', 'functions', 'x + 1, for x ≠ 1'], // the cancelled factor's zero, since 1.53.1
  ];
  for (const [p, topic, answer] of cases) {
    const r = await solveProblem(p, topic);
    assert.equal(r.answer, answer, p);
    assert.equal(r.routing?.to, 'algebra', p);
  }
});

test('a verb with a trig function goes to Trigonometry, which knows the identities', async () => {
  // Under Algebra "simplify tan(x)*cos(x)" came back unchanged; Trigonometry gives sin(x).
  for (const topic of ['trigonometry', 'integrals', 'algebra']) {
    assert.equal((await solveProblem('simplify tan(x)*cos(x)', topic)).answer, 'sin(x)', topic);
  }
  assert.equal((await solveProblem('simplify tan(x)*cos(x)', 'trigonometry')).routing, undefined);
  assert.equal((await solveProblem('simplify sin(2x)/cos(x)', 'trigonometry')).answer, '2sin(x)');
});

test('a bare polynomial under Algebra shows its factored form when it has one', async () => {
  assert.equal((await solveProblem('x^2-5x+6', 'algebra')).answer, 'x^2 - 5x + 6 = (x - 3)(x - 2)');
  assert.equal((await solveProblem('x^3-x', 'algebra')).answer, 'x^3 - x = x(x - 1)(x + 1)');
  // Nothing to factor: unchanged.
  assert.equal((await solveProblem('x^2+1', 'algebra')).answer, 'x^2 + 1');
  assert.equal((await solveProblem('2x+4', 'algebra')).answer, '2x + 4');
});

test('an integrand keeps brackets that are not a pair, and quotation marks stay prose', () => {
  // "∫ x+1)/((x−1)²…" — the first "(" and the last ")" were dropped as if they wrapped the whole.
  assert.equal(toLatex('∫ (x+1)/((x-1)^2*(x^2+1)) dx'), '\\int (x+1)/((x-1)^{2} \\cdot (x^{2}+1)) \\, dx');
  assert.equal(toLatex('∫(2x) dx'), '\\int 2x \\, dx');
  assert.equal(toLatex('∫_0^1 (x+1)/(x+2) dx'), '\\int_{0}^{1} (x+1)/(x+2) \\, dx');
  const segs = segmentMathText('“∫ (x+1) dx” is valid mathematical input.');
  assert.deepEqual(segs.filter((s) => s.type === 'math').map((s) => s.value), ['∫ (x+1) dx']);
  assert.equal(segs.map((s) => s.value).join(''), '“∫ (x+1) dx” is valid mathematical input.');
});

test('a y after an operator is part of an equation, never a "y = …" definition', async () => {
  // "x*y = 1" was read as the definition "y = 1" and answered "1", Solved;
  // so were x + y = 1, x - y = 0 and x/y = 2 (1.53.0).
  for (const [p, answer] of [['x*y = 1', 'x = 1/y'], ['x + y = 1', 'x = -y + 1'], ['x - y = 0', 'x = y'], ['x/y = 2', 'x = 2y'], ['2*x*y = 4', 'x = 2/y']]) {
    const r = await solveProblem(p, 'algebra');
    assert.equal(r.status, 'solved', p);
    assert.equal(r.answer, answer, p);
  }
  // One equation in two unknowns with no closed form is refused, not "1".
  assert.equal((await solveProblem('x^5 + y^5 + x*y = 1', 'algebra')).status, 'unsupported');
  // A definition is still a definition.
  for (const p of ['y = x^2', 'graph y = x^2']) assert.match((await solveProblem(p, 'functions')).answer, /^f\(x\) = x\^2: domain/, p);
});
