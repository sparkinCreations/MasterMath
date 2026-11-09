// Textbook equations that fell to the numeric scan (sweep, November 2026;
// 1.75.0). Each now has its method, exact answers, and its steps; the scan,
// when it still runs, says it is a numeric answer and names the hand method.
import test from 'node:test';
import assert from 'node:assert/strict';
import { solvePlain } from './helpers/solvePlain.js';

const notScanned = (r) => !r.steps.some((s) => /crosses zero|found numerically/.test(s));

test('a product equal to 0: each factor, a root kept where every factor is defined', async () => {
  for (const [p, answer] of [
    // The scan missed x = 0, where √x touches 0 at the edge of its domain.
    ['(x-2)*sqrt(x) = 0', 'x = 0  or  x = 2'],
    ['x*e^x = 0', 'x = 0'],
    ['x*ln(x) = x', 'x = e'],
    ['x^2*e^x - 4e^x = 0', 'x = -2  or  x = 2'],
    ['(2x-1)*ln(x) = 0', 'x = 1/2  or  x = 1'],
    ['x*ln(x) = 0', 'x = 1'],
  ]) {
    const r = await solvePlain(p, 'auto');
    assert.equal(r.answer, answer, p);
    assert.ok(notScanned(r), p);
  }
  const r = await solvePlain('x*ln(x) = x', 'auto');
  assert.ok(r.steps.includes('Move everything to one side and take out the common factor: x(ln(x) - 1) = 0'), r.steps.join('\n'));
  assert.ok(r.steps.includes('Reject x = 0: there ln(x) - 1 is undefined.'), r.steps.join('\n'));
});

test('|A| = |B|: A = B or A = −B', async () => {
  for (const [p, answer] of [
    ['abs(x+2) = abs(2x-1)', 'x = -1/3  or  x = 3'],
    ['abs(x-1) = abs(x+1)', 'x = 0'],
  ]) {
    const r = await solvePlain(p, 'auto');
    assert.equal(r.answer, answer, p);
    assert.ok(notScanned(r), p);
  }
});

test('exponentials in one base, or two bases by logarithms', async () => {
  for (const [p, answer] of [
    ['9^x - 3^(x+1) - 4 = 0', 'x = ln(4)/ln(3) (≈ 1.2619)'],
    ['2^(x+1) + 2^x = 12', 'x = 2'],
    ['4^x = 8^(x-1)', 'x = 3'],
    ['2^x = 3^(x-1)', 'x = ln(3)/(ln(3) - ln(2)) (≈ 2.7095)'],
  ]) {
    const r = await solvePlain(p, 'auto');
    assert.equal(r.answer, answer, p);
    assert.ok(notScanned(r), p);
  }
  const r = await solvePlain('4^x = 8^(x-1)', 'auto');
  assert.ok(r.steps.includes('Equal powers of the same base have equal exponents: 2x = 3x - 3, so x = 3.'), r.steps.join('\n'));
});

test('a polynomial in a power of x, by u = x^p', async () => {
  for (const [p, answer] of [
    ['x^(2/3) - 5x^(1/3) + 6 = 0', 'x = 8  or  x = 27'],
    ['x^(-2) - x^(-1) - 2 = 0', 'x = -1  or  x = 1/2'],
    ['(x^2-1)^2 - 5(x^2-1) + 4 = 0', 'x = -√5  or  x = -√2  or  x = √2  or  x = √5'],
  ]) {
    const r = await solvePlain(p, 'auto');
    assert.equal(r.answer, answer, p);
    assert.ok(notScanned(r), p);
  }
});

test('two square roots: isolate one, square, solve, check in the original', async () => {
  for (const [p, answer] of [
    ['sqrt(x) + sqrt(x-5) = 5', 'x = 9'],
    ['sqrt(x+7) - sqrt(x) = 1', 'x = 9'],
    ['sqrt(3x+1) = sqrt(x) + 1', 'x = 0  or  x = 1'],
  ]) {
    const r = await solvePlain(p, 'auto');
    assert.equal(r.answer, answer, p);
    assert.ok(notScanned(r), p);
  }
});

test('the numeric scan, when it runs, says so and names the hand method', async () => {
  const r = await solvePlain('abs(x) + abs(x-2) = 4', 'auto');
  assert.equal(r.answer, 'x = -1  or  x = 3');
  assert.match(r.steps[1], /^MasterMath has no step-by-step method for this equation, so its solutions were found numerically/);
  assert.match(r.steps[2], /^By hand: split each absolute value into cases/);
  assert.ok(r.steps.some((s) => s === 'Rewrite as (|x| + |x - 2|) - (4) = 0'), r.steps.join('\n'));
  const t = await solvePlain('e^x = x + 2', 'auto');
  assert.match(t.steps.join('\n'), /usually has no algebraic solution/);
  // The trig solver explains its own numeric method; the line is not repeated.
  const c = await solvePlain('x = cos(x)', 'auto');
  assert.ok(!c.steps.some((s) => /^MasterMath has no step-by-step method/.test(s)), c.steps.join('\n'));
});
