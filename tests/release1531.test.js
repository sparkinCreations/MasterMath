import test from 'node:test';
import assert from 'node:assert/strict';

import { solveProblem } from '../src/lib/api.js';
import { solvePlain } from './helpers/solvePlain.js';

// 1.53.1: textbook answers for one equation in two unknowns, the domain a
// cancellation changes, exact inequality endpoints (and two wrong answers
// found on the way), and partial fractions within the budget.

test('one equation in two unknowns is solved over the reals, in textbook form', async () => {
  for (const [p, answer] of [
    ['x^2 + y^2 = 25', 'x = ±√(25 - y^2)'], // was x = -(-y^2+25)^(1/2)  or  x = (-y^2+25)^(1/2)
    ['x^3 + y^3 = 1', 'x = ∛(1 - y^3)'], // the two complex roots are dropped
    ['x^2 = y', 'x = ±√y'], ['x^2 + y^2 + z^2 = 1', 'x = ±√(1 - y^2 - z^2)'],
    ['3x^2 + y = 7', 'x = ±√((7 - y)/3)'], ['x^2 + x*y = 1', 'x = -1/2*y ± 1/2*√(4 + y^2)'],
    ['x^4 + y^2 = 16', 'x = ±(16 - y^2)^(1/4)'], ['x^5 + y = 3', 'x = (3 - y)^(1/5)'],
    ['2x + 3y = 6', 'x = -3/2*y + 3'], ['x*y = 1', 'x = 1/y'],
  ]) {
    const r = await solveProblem(p, 'algebra');
    assert.equal(r.status, 'solved', p);
    assert.equal(r.answer, answer, p);
  }
  // No real point at all: refused, not a relation with i in it.
  assert.equal((await solveProblem('x^2 + y^2 = -1', 'algebra')).status, 'unsupported');
  const cubic = await solvePlain('x^3 + y^3 = 1', 'algebra');
  assert.ok(cubic.steps.some((s) => /keep the real roots/.test(s)));
  assert.ok(cubic.steps.some((s) => /^Check: substituting each root back/.test(s)));
});

test('a cancelled factor states where the simplified form differs from the original', async () => {
  for (const [p, answer] of [
    ['(x^2-1)/(x-1)', 'x + 1, for x ≠ 1'], ['simplify (x^2-1)/(x-1)', 'x + 1, for x ≠ 1'], ['(x^2+2x)/x', 'x + 2, for x ≠ 0'],
    ['(x^2-5x+6)/(x^2-4)', '(x - 3)/(x + 2), for x ≠ 2'], ['(x^3-x)/(x^2-1)', 'x, for x ≠ -1, x ≠ 1'], ['x/x', '1, for x ≠ 0'],
  ]) assert.equal((await solveProblem(p, 'algebra')).answer, answer, p);
  // Nothing cancelled, nothing stated.
  assert.equal((await solveProblem('1/(x-1)', 'algebra')).answer, '1/(x - 1)');
  assert.equal((await solveProblem('(2x+4)/2', 'algebra')).answer, 'x + 2');
  const r = await solvePlain('(x^2-1)/(x-1)', 'algebra');
  assert.match(r.steps.at(-1), /divides by zero at x = 1, where the simplified form does not/);
});

test('inequality endpoints are exact, with the decimal alongside', async () => {
  for (const [p, answer] of [
    ['x^2 > 2', 'x < -√2  or  x > √2  (√2 ≈ 1.4142)'],
    ['x^2 - x - 1 > 0', 'x < (1 - √5)/2  or  x > (1 + √5)/2  ((1 - √5)/2 ≈ -0.618, (1 + √5)/2 ≈ 1.618)'],
    ['e^x > 2', 'x > ln(2)  (ln(2) ≈ 0.6931)'], ['2^x >= 5', 'x ≥ ln(5)/ln(2)  (ln(5)/ln(2) ≈ 2.3219)'],
    ['2x^2 - 3 > 0', 'x < -√6/2  or  x > √6/2  (√6/2 ≈ 1.2247)'], ['(3x-1)*(x+2) > 0', 'x < -2  or  x > 1/3  (1/3 ≈ 0.3333)'],
    ['(x-1)/(x^2-3) > 0', '-√3 < x < 1  or  x > √3  (√3 ≈ 1.7321)'], ['x^2 - 4 > 0', 'x < -2  or  x > 2'],
  ]) assert.equal((await solveProblem(p, 'algebra')).answer, answer, p);
  // A root with no closed form stays a decimal, and the step says it was located numerically.
  const cubic = await solvePlain('x^3 - x - 1 > 0', 'algebra');
  assert.equal(cubic.answer, 'x > 1.3247');
  assert.ok(cubic.steps.some((s) => /located numerically/.test(s)));
});

test('two wrong inequality answers: x³ − 2 > 0 had "No solution", ln(x) < 1 included x ≤ 0', async () => {
  // Algebrite wrote the real root of x³ − 2 with i and (−1)^(1/3) in it, and every root containing i was dropped.
  assert.equal((await solveProblem('x^3 - 2 > 0', 'algebra')).answer, 'x > ∛2  (∛2 ≈ 1.2599)');
  // The sign chart now splits at the edge of the domain.
  for (const [p, answer] of [
    ['ln(x) < 1', '0 < x < e  (e ≈ 2.7183)'], ['sqrt(x - 1) < 3', '1 < x < 10'], ['ln(x - 2) <= 0', '2 < x ≤ 3'],
    ['sqrt(4 - x^2) >= 1', '-√3 ≤ x ≤ √3  (√3 ≈ 1.7321)'], ['ln(x) >= 2', 'x ≥ e^2  (e^2 ≈ 7.3891)'],
  ]) assert.equal((await solveProblem(p, 'algebra')).answer, answer, p);
  // The steps show ln, not Algebrite's log (a bare log reads as base 10 here).
  const r = await solvePlain('ln(x) < 1', 'algebra');
  assert.ok(r.steps.some((s) => /-1 \+ ln\(x\)/.test(s)) && !r.steps.some((s) => /log\(x\)/.test(s)));
});

test('partial fractions with repeated and quadratic factors, improper fractions: solved, fast', async () => {
  for (const [p, answer] of [
    // Algebrite's integral() ran past 60 s on this one; the budget stopped it at 10.
    ['(x+1)/((x-1)^2*(x^2+1))', '-1/2*ln|x - 1| - 1/(x - 1) + 1/4*ln(x^2 + 1) - 1/2*arctan(x)'],
    ['(2x+3)/((x+1)*(x^2+4))', '1/5*ln|x + 1| - 1/10*ln(x^2 + 4) + 11/10*arctan(x/2)'], // was 10.9 s
    ['x^3/((x^2+1)^2)', '1/2*ln(x^2 + 1) + 1/(2(x^2 + 1))'], // was over 15 s
    ['1/((x-1)^2)', '-1/(x - 1)'], ['(x^2+1)/((x-1)^3)', 'ln|x - 1| - 2/(x - 1) - 1/(x - 1)^2'],
    ['1/(x^3+1)', '1/3*ln|x + 1| - 1/6*ln|x^2 - x + 1| + 1/3*√3*arctan((2x - 1)/√3)'],
    ['1/(x^2+2x+5)', '1/2*arctan((x + 1)/2)'],
    // Improper: divide first. (x³ + 2)/((x − 1)(x + 1)²) took 58 s and gave up.
    ['(x^3+2)/((x-1)*(x+1)^2)', 'x + 3/4*ln|x - 1| - 7/4*ln|x + 1| + 1/(2(x + 1))'],
    ['(x^4+1)/(x^2+1)', '1/3*x^3 - x + 2arctan(x)'], ['(x^3-1)/(x-1)', '1/3*x^3 + 1/2*x^2 + x'],
  ]) {
    const started = Date.now();
    const r = await solveProblem(p, 'integrals');
    const ms = Date.now() - started;
    assert.equal(r.status, 'solved', p);
    assert.equal(r.answer.replace(/^∫.*\) dx = /, ''), `${answer} + C`, p);
    assert.ok(ms < 4000, `${p} took ${ms} ms`);
  }
  const r = await solvePlain('(x^3+2)/((x-1)*(x+1)^2)', 'integrals');
  assert.match(r.steps.join('\n'), /divide first/);
  assert.match(r.steps.join('\n'), /Partial fractions/);
});
