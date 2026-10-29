import test from 'node:test';
import assert from 'node:assert/strict';

import { solveProblem } from '../src/lib/api.js';
import { solvePlain } from './helpers/solvePlain.js';

// 1.53.2: the October 2026 test list reproduced on 1.53.1, and the same
// classes of input swept. f'(x) notation, one exponential, the derivative
// rules named, root display, limit wording, inequality and quadratic tips.

test("f'(x) with its function defined is that function's derivative", async () => {
  for (const [p, answer] of [
    ["f'(x) where f(x) = x^3", "f'(x) = 3x^2"], // was "x^3", marked Solved
    ["f(x) = x^3, find f'(x)", "f'(x) = 3x^2"], // was "f'(x)", marked Solved
    ["f(x) = x^2; f'(3)", "f'(3) = 6"], // was a parse error
    ["find f'(x) if f(x) = sin(x)", "f'(x) = cos(x)"], // was '"iff" is not a known function'
    ["f'(2) where f(x) = x^2", "f'(2) = 4"],
    ["g'(t) where g(t) = t^2", "g'(t) = 2t"], // in the input's own letter
    ["h''(x) where h(x) = x^4 at x = 1", "h''(1) = 12"],
    ["y'(x) where y = x^2", "y'(x) = 2x"],
    ["f''(x) where f(x) = x^3", "f''(x) = 6x"],
    ["f''(x) where f(x) = x^3 at x = 2", "f''(2) = 12"],
  ]) {
    assert.equal((await solveProblem(p, 'derivatives')).answer, answer, p);
  }
  // Under Auto-detect and Algebra it is still a derivative, and says so.
  const auto = await solveProblem("f'(x) where f(x) = x^3", 'auto');
  assert.equal(auto.answer, "f'(x) = 3x^2");
  assert.equal(auto.routedTopic, 'derivatives');
});

test("f'(x) with no function given is refused, never differentiated as the letter f", async () => {
  // "f'(x)" answered "f'(f) = 1"; "f'(x) at x = 2" answered "f'(2) = 0".
  for (const p of ["f'(x)", "f'(x) at x = 2", "g''(t)"]) {
    const r = await solveProblem(p, 'derivatives');
    assert.equal(r.status, 'unsupported', p);
    assert.match(r.answer, /^The function [fg] is not given$/, p);
  }
});

test("an equation in f'(x) that does not define f is a differential equation", async () => {
  for (const p of ["f''(x) + f(x) = 0", "y'(x) = 3x^2", "f'(x) = 2x", "y''(t) = -y(t)"]) {
    const r = await solveProblem(p, 'derivatives');
    assert.equal(r.answer, 'Differential equations are not supported', p);
  }
  // y'(x) = 3x^2 only gives the derivative: the tip names the integral to type.
  const r = await solveProblem("y'(x) = 3x^2", 'derivatives');
  assert.ok(r.tips.some((t) => t.includes('"∫ 3x^2 dx"')), r.tips.join(' | '));
});

test('one exponential with a linear exponent is isolated and logged, exactly', async () => {
  for (const [p, answer] of [
    ['e^(2x) = 7', 'x = ln(7)/2 (≈ 0.973)'], // was ln(√7)
    ['e^(3x) = 5', 'x = ln(5)/3 (≈ 0.5365)'], // was "x = 0.5365" from the numeric scan, with "="
    ['e^(2x+1) = 7', 'x = (ln(7) - 1)/2 (≈ 0.473)'], // was 0.473
    ['e^(x/2) = 3', 'x = 2ln(3) (≈ 2.1972)'],
    ['5 - e^(-x) = 2', 'x = -ln(3) (≈ -1.0986)'],
    ['6/e^x = 2', 'x = ln(3) (≈ 1.0986)'],
    ['2^(2x) = 7', 'x = ln(7)/(2ln(2)) (≈ 1.4037)'], // was ln(√7)/ln(2)
    ['3*2^(x+1) - 4 = 20', 'x = 2'],
    ['2^x = 10', 'x = ln(10)/ln(2) (≈ 3.3219)'],
    ['e^x = 5', 'x = ln(5) (≈ 1.6094)'],
    ['(2/3)^x = 5', 'x = ln(5)/ln(2/3) (≈ -3.9694)'], // the base keeps its brackets
  ]) {
    assert.equal((await solveProblem(p, 'algebra')).answer, answer, p);
  }
  assert.match((await solveProblem('e^x = -2', 'algebra')).answer, /^No real solution/);
  // Each operation undone is shown, then the logarithm.
  const r = await solvePlain('3*2^(x+1) - 4 = 20', 'algebra');
  assert.deepEqual(r.steps.slice(1, 4), ['Add 4 to both sides: 3*2^(x + 1) = 24', 'Divide both sides by 3: 2^(x + 1) = 8', 'Take ln of both sides (ln(2^u) = u·ln(2)), then divide by ln(2): x + 1 = 3']);
  // A polynomial in e^x still takes the substitution.
  assert.equal((await solveProblem('e^(2x) - 3e^x + 2 = 0', 'algebra')).answer, 'x = 0  or  x = ln(2) (≈ 0.6931)');
});

test('the derivative names the rule it used: inverse trig, hyperbolic, sec/csc/cot', async () => {
  // All of these were labelled "Power rule — d/dx(x) = 1".
  for (const [p, rule] of [
    ['arcsin(x)', /^Inverse trig rule — d\/dx\[arcsin\(x\)\] = 1\/√\(1 − x\^2\)/], ['arctan(x)', /^Inverse trig rule/],
    ['sinh(x)', /^Hyperbolic rule — d\/dx\[sinh\(x\)\] = cosh\(x\)/], ['cosh(x)', /^Hyperbolic rule/],
    ['sec(x)', /^Trig rule — d\/dx\[sec\(x\)\] = sec\(x\)·tan\(x\)/], ['cot(x)', /^Trig rule/], ['arcsin(2x)', /^Chain rule/],
  ]) {
    const r = await solvePlain(p, 'derivatives');
    assert.match(r.steps[1], rule, p);
    assert.doesNotMatch(r.tips.join('\n'), /Power rule/, p);
  }
});

test('square roots in a derivative are written as roots', async () => {
  for (const [p, answer] of [
    ['arcsin(x)', "f'(x) = 1/√(1 - x^2)"], // was 1/((-x^2 + 1)^(1/2))
    ['arccos(x)', "f'(x) = -1/√(1 - x^2)"],
    ['arcsin(2x)', "f'(x) = 2/√(1 - 4x^2)"],
    ['sqrt(1+x^2)', "f'(x) = x/√(x^2 + 1)"],
    ['sqrt(x)', "f'(x) = 1/(2√x), x > 0"],
  ]) {
    assert.equal((await solveProblem(p, 'derivatives')).answer, answer, p);
  }
});

test('a limit that does not exist says so in a sentence', async () => {
  assert.equal((await solveProblem('limit of 1/x as x->0', 'limits')).answer, 'lim (x→0) 1/x does not exist');
  assert.equal((await solveProblem('limit of sin(1/x) as x->0', 'limits')).answer, 'lim (x→0) sin(1/x) does not exist');
});

test('tips fit the method: square roots and i, the formula, an absolute-value inequality', async () => {
  const sq = await solvePlain('x^2 + 1 = 0', 'algebra');
  assert.match(sq.tips[0], /x\^2 = c is solved by square roots/);
  assert.doesNotMatch([...sq.tips, ...sq.common_mistakes].join('\n'), /\(x − 2\)\(x − 3\)/);
  // Third since 1.62.0: the equation's own working is second.
  assert.match((await solvePlain('x^2 + x - 1 = 0', 'algebra')).tips[2], /discriminant/);
  assert.match((await solvePlain('x^2 - 5x + 6 = 0', 'algebra')).tips[2], /\(x − a\)\(x − b\) = 0/);
  const abs = await solvePlain('|2x-1| < 5', 'algebra');
  assert.match(abs.tips[0], /\|g\| < c/);
  assert.doesNotMatch(abs.tips.join('\n'), /numerator/);
  // A rational inequality keeps the numerator/denominator advice.
  assert.match((await solvePlain('(x-1)/(x+2) >= 0', 'algebra')).tips[1], /denominator/);
});

test('found in the sweep: a function only named, never given, is refused on every path', async () => {
  // "d/dx f(x)" answered "f'(f) = x"; "∫ f(x) dx" ½·f·x² + C; "lim x->0 f(x)" 0.
  for (const [p, topic] of [['d/dx f(x)', 'derivatives'], ['derivative of g(t)', 'derivatives'], ['∫ f(x) dx', 'integrals'], ['lim x->0 f(x)', 'limits'], ['y = f(x)', 'algebra']]) {
    const r = await solveProblem(p, topic);
    assert.equal(r.status, 'unsupported', p);
    assert.match(r.answer, /^The function [fg] is not given$/, p);
  }
  // A letter applied to itself is a product, and a defined function is fine.
  assert.equal((await solveProblem('d/dx x(x)', 'derivatives')).answer, "f'(x) = 2x");
  assert.equal((await solveProblem('x(x+1) = 6', 'algebra')).answer, 'x = -3  or  x = 2');
  assert.equal((await solveProblem("f(x)=x^3-3x, f'(1)", 'derivatives')).answer, "f'(1) = 0");
});

test('found in the sweep: g(x) = … and h(x) = … are definitions, like f(x) = …', async () => {
  // "g(x) = 2x + 1" under Functions was solved for g: "g = 2 + 1/x", marked Solved.
  assert.match((await solveProblem('g(x) = 2x + 1', 'functions')).answer, /^f\(x\) = 2x \+ 1: domain: all real numbers/);
  assert.equal((await solveProblem('g(x) = 2x + 1', 'auto')).routedTopic, 'functions');
  assert.match((await solveProblem('h(x) = x^2 - 4', 'functions')).answer, /x-intercepts at x = -2, 2/);
  // Under Integrals a definition is integrated (it came back "x^2", Solved).
  assert.equal((await solveProblem('f(x) = x^2', 'integrals')).answer, '∫(x^2) dx = 1/3*x^3 + C');
  assert.equal((await solveProblem('g(t) = t^2', 'integrals')).answer, '∫(t^2) dt = 1/3*t^3 + C');
});

test('found in the sweep: exact rational logarithms, and ≈ for a root found numerically', async () => {
  for (const [p, answer] of [['4^x = 2', 'x = 1/2'], ['8^x = 4', 'x = 2/3'], ['27^(x-1) = 9', 'x = 5/3'], ['0.5^x = 8', 'x = -3']]) {
    assert.equal((await solveProblem(p, 'algebra')).answer, answer, p);
  }
  // A located root is ≈; = only when the number shown solves the equation exactly.
  assert.equal((await solveProblem('x*e^x = 1', 'algebra')).answer, 'x ≈ 0.5671');
  assert.equal((await solveProblem('cos(x) = x', 'algebra')).answer, 'x ≈ 0.7391');
  assert.equal((await solveProblem('2^x = x + 2', 'algebra')).answer, 'x ≈ -1.6901  or  x = 2');
});

test('a logarithm of a power solves exactly: ln(x^2) = 4 is x = ±e^2', async () => {
  for (const [p, answer] of [
    ['ln(x^2) = 4', 'x = -e^2 (≈ -7.3891)  or  x = e^2 (≈ 7.3891)'],
    ['ln(x^2) = 3', 'x = -e^(3/2) (≈ -4.4817)  or  x = e^(3/2) (≈ 4.4817)'],
    ['ln(x^3) = 6', 'x = e^2 (≈ 7.3891)'],
    ['ln(x^2) = -2', 'x = -1/e (≈ -0.3679)  or  x = 1/e (≈ 0.3679)'],
    ['log(x^2) = 2', 'x = -10  or  x = 10'],
  ]) {
    assert.equal((await solveProblem(p, 'algebra')).answer, answer, p);
  }
  // The steps name the function by its letter throughout.
  const r = await solvePlain("g'(t) where g(t) = t^2", 'derivatives');
  assert.equal(r.steps[0], 'Identify the function to differentiate: g(t) = t^2');
});
