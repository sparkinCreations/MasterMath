// November 2026 review, round 2: a 20-problem benchmark found four defects,
// and a sweep of the same classes found more. Each case is pinned here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { solvePlain } from './helpers/solvePlain.js';
import { solveProblem } from '../src/lib/api.js';
import { practiceKind, readCorrect, checkAnswer } from '../src/lib/practice/check.js';
import { isPresentable } from '../src/lib/api/finalize.js';

const fn = (p) => solvePlain(p, 'functions');
const steps = (r) => r.steps.join('\n');

test('a constant function in disguise is proved constant: no fake turning points', async () => {
  for (const [p, c, domain] of [
    ['sin(x)^2+cos(x)^2', '1', 'all real numbers'],
    ['tan(x)*cot(x)', '1', 'x ≠ nπ/2, n any integer'],
    ['sec(x)^2-tan(x)^2', '1', 'x ≠ π/2 + nπ, n any integer'],
    ['cosh(x)^2-sinh(x)^2', '1', 'all real numbers'],
    ['(x+1)^2-(x-1)^2-4x', '0', 'all real numbers'],
    ['x/x', '1', 'x ≠ 0'],
    ['(x^2-1)/(x-1) - x', '1', 'x ≠ 1'],
    ['ln(x) - ln(x)', '0', 'x > 0'],
  ]) {
    const r = await fn(p);
    assert.match(r.answer, new RegExp(`constant, f\\(x\\) = ${c} on its domain \\(domain: ${domain.replace(/[()+]/g, '\\$&')}\\)`), `${p}: ${r.answer}`);
    assert.match(r.answer, /every point is a non-strict local maximum and minimum, with no isolated turning points/);
    assert.doesNotMatch(steps(r), /Local (?:minimum|maximum) at|changes from (?:negative|positive)/, p);
    assert.equal(r.graph.annotations.extrema.length, 0, p);
  }
});

test('a constant has no x-intercept list: c = 0 lies on the axis, any other c never meets it', async () => {
  assert.match(steps(await fn('(x+1)^2-(x-1)^2-4x')), /x-intercepts: every point of the domain/);
  assert.match(steps(await fn('sin(x)^2+cos(x)^2')), /x-intercepts: none — the line y = 1 never meets the x-axis/);
});

test('the constant keeps the original domain, and the graph has a gap at each excluded point', async () => {
  const r = await fn('tan(x)*cot(x)');
  assert.match(steps(r), /tan\(x\) is undefined at x = π\/2 \+ nπ; cot\(x\) is undefined at x = nπ/);
  assert.match(steps(r), /y-intercept: none — x = 0 is not in the domain/);
  // nπ/2 in −10 ≤ x ≤ 10: 13 points.
  assert.equal(r.graph.annotations.holes.length, 13);
});

test('a function that is not constant still gets the full analysis', async () => {
  for (const p of ['sin(x)^2', 'x^2 - 4x + 3', 'sin(x)/x']) {
    assert.doesNotMatch((await fn(p)).answer, /constant, f\(x\) =/, p);
  }
});

test('e^(ln x) is defined only for x > 0: no intercept at the origin', async () => {
  const r = await fn('e^(ln(x))');
  assert.match(r.answer, /^f\(x\) = e\^\(ln\(x\)\): domain: x > 0; no y-intercept; no x-intercepts/);
});

test('a zero of f′ outside the domain is not a critical point, and the steps say why', async () => {
  for (const [p, domain] of [['ln(x^2-9)', 'x < -3 or x > 3'], ['ln(x^2-4)', 'x < -2 or x > 2'], ['1/sqrt(x^2-1)', 'x < -1 or x > 1'], ['sqrt(x^2-1)', 'x ≤ -1 or x ≥ 1']]) {
    const r = await fn(p);
    const s = steps(r);
    assert.match(r.answer, new RegExp(`domain: ${domain}`), p);
    assert.doesNotMatch(s, /does not change sign, so there is no extremum|the graph flattens/, p);
    assert.match(s, /x = 0 is not in the domain \(f is undefined there\), so it is not a critical point/, p);
  }
});

test('rational and log equations state their restriction first and with the answer', async () => {
  for (const [p, answer, restriction] of [
    ['(x+1)/(x-2) = 3', 'x = 7/2, where x ≠ 2', /the denominator cannot be 0, so x - 2 ≠ 0, that is x ≠ 2/],
    ['log_2(x-1) = 3', 'x = 9, where x > 1', /a logarithm needs a positive argument, so x - 1 > 0, that is x > 1/],
    ['ln(x) + ln(x-2) = ln(3)', 'x = 3, where x > 2', /so x > 0 and x - 2 > 0\. Together: x > 2/],
    ['1/x + 1/(x-1) = 3/2', 'x = 1/3  or  x = 2, where x ≠ 0, 1', /Together: x ≠ 0, 1/],
    ['ln(x^2) = 2', 'x = -e (≈ -2.7183)  or  x = e (≈ 2.7183), where x ≠ 0', /x\^2 > 0, that is x ≠ 0/],
    ['ln(3-x) = 0', 'x = 2, where x < 3', /3 - x > 0, that is x < 3/],
  ]) {
    const r = await solvePlain(p, 'auto');
    assert.equal(r.answer, answer, p);
    assert.match(steps(r), restriction, p);
    assert.match(steps(r), /satisf(?:y|ies) the restriction/, p);
  }
  // No solution: the restriction is still said.
  const none = await solvePlain('x/(x-3) = 3/(x-3)', 'auto');
  assert.match(none.answer, /^No solution/);
  assert.match(steps(none), /that is x ≠ 3/);
  // A denominator that is never 0 excludes nothing; |g| is 0 where g is.
  assert.equal((await solvePlain('e^(2x)/e^x = 3', 'auto')).answer, 'x = ln(3) (≈ 1.0986)');
  assert.equal((await solvePlain('1/abs(x-1) = 3', 'auto')).answer, 'x = 2/3  or  x = 4/3, where x ≠ 1');
  assert.equal((await solvePlain('(x-2)^(-1) = 3', 'auto')).answer, 'x = 7/3, where x ≠ 2');
});

test('the restriction is only on the answer a student reads: inner solves stay exact', async () => {
  assert.equal((await solvePlain('x*ln(x) = x', 'auto')).answer, 'x = e, where x > 0');
  assert.equal((await solvePlain('ln(x) < 1', 'auto')).answer, '0 < x < e  (e ≈ 2.7183)');
});

test('a logarithm of a power of a linear expression is solved exactly (was "No solution")', async () => {
  for (const [p, answer] of [
    ['ln((x+1)^3) = 3', 'x = e - 1 (≈ 1.7183), where x > -1'],
    ['ln((2x+1)^3) = 3', 'x = (e - 1)/2 (≈ 0.8591), where x > -1/2'],
    ['ln((2x+1)^2) = 2', 'x = (-e - 1)/2 (≈ -1.8591)  or  x = (e - 1)/2 (≈ 0.8591), where x ≠ -1/2'],
  ]) {
    const r = await solvePlain(p, 'auto');
    assert.equal(r.answer, answer, p);
    assert.doesNotMatch(steps(r), /Cannot read|properties of null/, p);
  }
});

test('practice mode still reads and checks an answer that carries a restriction', async () => {
  for (const [p, typed] of [['(x+1)/(x-2) = 3', '7/2'], ['log_2(x-1) = 3', '9'], ['1/x + 1/(x-1) = 3/2', '1/3, 2']]) {
    const r = await solvePlain(p, 'auto');
    assert.equal(practiceKind(r, 'algebra', p)?.kind, 'solutions', p);
    assert.equal(checkAnswer(readCorrect(r, 'algebra', p), typed, { problem: p }).verdict, 'correct', p);
  }
});

test('a piecewise function is refused for what it is', async () => {
  const r = await solveProblem('f(x) = {x^2 if x<0; x+1 if x>=0}. Find f(0).', 'auto');
  assert.equal(r.status, 'parse_error');
  assert.match(r.answer, /^Piecewise functions are not supported yet/);
  // Plain braces keep their grouping hint.
  assert.match((await solveProblem('{x+1}^2', 'auto')).answer, /^Curly braces are not used here/);
});

test('an engine failure message is never presentable as a step or an answer', () => {
  assert.equal(isPresentable("x = Cannot read properties of null (reading 'elem')"), false);
  assert.equal(isPresentable('TypeError: x is not a function'), false);
  assert.equal(isPresentable('The function is not defined on either side of x = 0, so there is nothing'), true);
  assert.equal(isPresentable('f is undefined for x ≤ 0'), true);
});

// CodeRabbit's review of PR #80: each finding, reproduced and pinned.
test('an exact stationary point is classified by the first-derivative test, however flat', async () => {
  assert.match((await fn('x^4')).answer, /local minimum \(0, 0\)/);
  assert.match((await fn('x^6 - 1')).answer, /local minimum \(0, -1\)/);
  assert.match((await fn('-x^8 + 2')).answer, /local maximum \(0, 2\)/);
  assert.doesNotMatch((await fn('x^3')).answer, /local (?:minimum|maximum)/);
});

test('a log of a power of a linear expression: exact rationals only, written correctly, never a false "no solution"', async () => {
  assert.equal((await solvePlain('ln((x/2+1)^3) = 3', 'auto')).answer, 'x = 2(e - 1) (≈ 3.4366), where x > -2');
  assert.equal((await solvePlain('ln((3-x)^3) = 3', 'auto')).answer, 'x = 3 - e (≈ 0.2817), where x < 3');
  assert.equal((await solvePlain('ln((2x/3+1)^3) = 3', 'auto')).answer, 'x = 3(e - 1)/2 (≈ 2.5774), where x > -3/2');
  assert.doesNotMatch((await solvePlain('ln((e*x+1)^3) = 3', 'auto')).answer, /\d{5,}\//);
  assert.match((await solvePlain('ln((e*x+1)^3) = 3', 'auto')).answer, /^x ≈ 0\.6321/);
  // A coefficient that rounds to a rational in floating point is not one:
  // no exact root, and no exact edge, is claimed for it.
  const near = await solvePlain('ln((x*(1+e/10^20)+1)^3) = 3', 'auto');
  assert.match(near.answer, /^x ≈ 1\.7183/);
  assert.doesNotMatch(near.answer, /e - 1|x > -1/);
  // Numbers alone can round too: 1 + 1/10^20 is 1 in floating point. The
  // coefficients are read exactly, so the edge is exact and the root ≈.
  const tiny = await solvePlain('ln((x*(1+1/10^20)+1)^3) = 3', 'auto');
  assert.equal(tiny.answer, 'x ≈ 1.7183, where x > -100000000000000000000/100000000000000000001');
  // Cancellation: (10^20 + 1 − 10^20 + 1) is 2 exactly, 1 in floating point.
  // The exact path reads 2 (its candidate is (e − 1)/2); it never shows the
  // rounded coefficient's x = e − 1.
  assert.doesNotMatch((await solvePlain('ln(((10^20+1-10^20+1)*x+1)^3) = 3', 'auto')).answer, /^x = e - 1/);
  // Rounding merges −1 ± e^−40 with −1: declined honestly, not "No solution".
  const merged = await solvePlain('ln((x+1)^2) = -80', 'auto');
  assert.notEqual(merged.status, 'solved');
  assert.doesNotMatch(merged.answer, /^No solution \(/);
});

test('a restriction keeps its brackets, and is stated beside a radical\'s domain and on ≈ answers', async () => {
  const r = await solvePlain('1/((x+1)*(x-1)) = 1', 'auto');
  assert.match(steps(r), /so \(x \+ 1\) \* \(x - 1\) ≠ 0, that is x ≠ -1, 1/);
  assert.match(r.answer, /, where x ≠ -1, 1$/);
  assert.equal((await solvePlain('sqrt(x) + (x-1)/(x-1) = 3', 'auto')).answer, 'x = 4, where x ≠ 1');
});

test('a constant function\'s domain is read off the expression, exactly, in its own variable', async () => {
  for (const [p, domain] of [
    ['tan(4*x)*cot(4*x)', 'x ≠ nπ/8, n any integer'],
    ['(x^2-2)/(x^2-2)', 'x ≠ -√2, √2'],
    ['sec(t)^2-tan(t)^2', 't ≠ π/2 + nπ, n any integer'],
    ['ln(100-x)-ln(100-x)', 'x < 100'],
    ['sqrt(x)^2/x', 'x > 0'],
    ['sqrt(x-3)-sqrt(x-3)', 'x ≥ 3'],
    // A negative power is a denominator; an even root's power needs a base ≥ 0.
    ['(x-100)^(-1) - (x-100)^(-1)', 'x ≠ 100'],
    ['x^(-2)*x^2', 'x ≠ 0'],
    ['x^(-1/2)*x^(1/2)', 'x > 0'],
  ]) {
    const r = await fn(p);
    assert.equal(r.status, 'solved', p);
    assert.ok(r.answer.includes(`(domain: ${domain})`), `${p}: ${r.answer}`);
  }
});

test('a union is grouped before another domain condition', async () => {
  assert.match((await fn('ln(x^2-9)+1/(x+4)')).answer, /domain: \(x < -3 or x > 3\) and x ≠ -4;/);
});

test('graph samples leave out a point where a logarithm is undefined', async () => {
  const { sampleFunction } = await import('../src/lib/solvers/solverUtils.js');
  assert.ok(!sampleFunction('e^(ln(x))', 'x', { min: -1, max: 1, step: 0.5 }).some((p) => p.x === 0));
});

test('two roots a hair apart are both kept, and close edges are compared exactly', async () => {
  // ±e^−15/1000 are 6e−10 apart: an absolute 1e−9 merge dropped one.
  assert.match((await solvePlain('ln((1000*x)^2) = -30', 'auto')).answer, /^x = -1\/e\^15\/1000 \(≈ 0\)  or  x = 1\/e\^15\/1000 \(≈ 0\)/);
  // x > 1/10^13 is tighter than x > 0, though 1e−13 is within rounding of 0.
  assert.match((await fn('ln(x - 1/10^13) - ln(x - 1/10^13) + ln(x) - ln(x)')).answer, /\(domain: x > 1\/10000000000000\)/);
});
