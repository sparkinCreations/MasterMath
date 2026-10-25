import test from 'node:test';
import assert from 'node:assert/strict';

import { solveProblem } from '../src/lib/api.js';
import { solvePlain } from './helpers/solvePlain.js';

// 1.55.0: requests in words (period, amplitude, tangent line, inverse,
// degrees ↔ radians), and the October 24 display gaps.

test('the period of a trig function is stated exactly, the least common multiple for a sum', async () => {
  for (const [p, answer] of [
    ['find the period of 3sin(2x) + 1', 'The period is π (≈ 3.1416)'],
    ['what is the period of tan(x/2)', 'The period is 2π (≈ 6.2832)'],
    ['period of sin(2x) + cos(3x)', 'The period is 2π (≈ 6.2832)'],
    ['period of -2sin(-3x+1)', 'The period is 2π/3 (≈ 2.0944)'],
    ['period of cos(pi*x/4)', 'The period is 8'],
  ]) {
    const r = await solveProblem(p, 'auto');
    assert.equal(r.status, 'solved', p);
    assert.equal(r.answer, answer, p);
    assert.equal(r.routedTopic, 'trigonometry', p);
  }
  // Proven not periodic (π is irrational); a power of sin is refused, not guessed.
  assert.equal((await solveProblem('period of sin(x) + sin(pi*x)', 'auto')).answer, 'Not periodic: the terms never line up again');
  const sq = await solveProblem('period of sin(x)^2', 'auto');
  assert.equal(sq.status, 'unsupported');
  const r = await solvePlain('period of sin(2x) + cos(3x)', 'trigonometry');
  assert.ok(r.steps.includes('A sum repeats when every term does: the least common multiple of the periods, lcm(π, 2π/3) = 2π.'), r.steps.join(' | '));
});

test('the amplitude of a sine or cosine wave, and none for tan or mixed frequencies', async () => {
  assert.equal((await solveProblem('amplitude of -3cos(2x) + 5', 'auto')).answer, 'The amplitude is 3');
  assert.equal((await solveProblem('find the amplitude of 3sin(x) + 4cos(x)', 'auto')).answer, 'The amplitude is 5');
  assert.equal((await solveProblem('amplitude of sin(2x) + cos(2x)', 'auto')).answer, 'The amplitude is √2 (≈ 1.4142)');
  for (const p of ['amplitude of tan(x)', 'amplitude of 2sin(x) + cos(2x)', 'amplitude of 5']) {
    assert.equal((await solveProblem(p, 'auto')).status, 'unsupported', p);
  }
});

test('the equation of a tangent line: the point, the slope, point–slope form, exact', async () => {
  for (const [p, answer] of [
    ['find the equation of the tangent line to x^2 at x = 3', 'y = 6x - 9'],
    ['tangent line to x^2 at (3, 9)', 'y = 6x - 9'],
    ['tangent line to sin(x) at x = pi', 'y = -x + π'],
    ['tangent line to y = ln(x) at x = e', 'y = x/e'],
    ['tangent line to sqrt(x) at x = 4', 'y = x/4 + 1'],
    ['equation of the tangent to e^(2x) at x = 0', 'y = 2x + 1'],
    ['tangent to x^3 - 2x at x = -1', 'y = x + 2'],
  ]) {
    const r = await solveProblem(p, 'auto');
    assert.equal(r.answer, answer, p);
    assert.equal(r.routedTopic, 'derivatives', p);
  }
  const r = await solvePlain('find the equation of the tangent line to x^2 at x = 3', 'derivatives');
  assert.deepEqual(r.steps, [
    'The point: f(3) = 9, so the line passes through (3, 9).',
    "The slope is the derivative there: f′(x) = 2x, so m = f′(3) = 6.",
    'Point–slope form, y − f(a) = f′(a)(x − a): y − 9 = 6(x − 3).',
    'Solve for y: y = 6x - 9.',
  ]);
  assert.ok(r.graph?.secondaryExpression, 'the line is drawn with the curve');
  // A corner has no tangent; a point off the curve is said to be off it.
  const corner = await solvePlain('tangent line to abs(x) at x = 0', 'auto');
  assert.equal(corner.status, 'unsupported');
  assert.match(corner.steps.join(' '), /no single slope at x = 0/);
  assert.match((await solvePlain('tangent line to x^2 at (3, 8)', 'auto')).steps.join(' '), /\(3, 8\) is not on the curve: f\(3\) = 9/);
});

test('the inverse of a function: undone step by step, swapped, checked; refused when not one-to-one', async () => {
  for (const [p, answer] of [
    ['find the inverse of 2x + 3', 'f⁻¹(x) = (x - 3)/2'],
    ['inverse of (2x+1)/(x-3)', 'f⁻¹(x) = (3x + 1)/(x - 2)'],
    ['inverse of e^x', 'f⁻¹(x) = ln(x)'],
    ['inverse of ln(x - 1)', 'f⁻¹(x) = e^x + 1'],
    ['inverse of sqrt(x-2)', 'f⁻¹(x) = x^2 + 2, for x ≥ 0'],
    ['inverse of 2sqrt(x) + 1', 'f⁻¹(x) = ((x - 1)/2)^2, for x ≥ 1'],
    ['inverse of x^3 + 1', 'f⁻¹(x) = ∛(x - 1)'],
    ['inverse of 5 - x', 'f⁻¹(x) = 5 - x'],
    ['inverse of 4/(x+1)', 'f⁻¹(x) = 4/x - 1'],
    ['inverse of log(x)', 'f⁻¹(x) = 10^x'],
    ['inverse of 2^(x-1)', 'f⁻¹(x) = log_2(x) + 1'],
  ]) {
    const r = await solveProblem(p, 'auto');
    assert.equal(r.status, 'solved', p);
    assert.equal(r.answer, answer, p);
    assert.equal(r.routedTopic, 'functions', p);
  }
  const r = await solvePlain('find the inverse of 2x + 3', 'functions');
  assert.deepEqual(r.steps, [
    'Write y = 2x + 3 and solve for x.',
    'x appears once, so undo what is done to it, the last operation first.',
    'Subtract 3: 2x = y - 3.',
    'Divide by 2: x = (y - 3)/2.',
    'Swap x and y, so the inverse is a function of x: f⁻¹(x) = (x - 3)/2.',
    'Check: f(f⁻¹(x)) = x at sample values ✓',
  ]);
  for (const p of ['inverse of x^2', 'inverse of sin(x)', 'inverse of abs(x)']) {
    assert.equal((await solveProblem(p, 'auto')).answer, 'No inverse: the function is not one-to-one', p);
  }
  // The cubic formula is refused, not shown.
  assert.equal((await solveProblem('inverse of x^3 + x', 'auto')).status, 'unsupported');
});

test('degrees and radians convert exactly, as a multiple of π when they are one', async () => {
  for (const [p, answer] of [
    ['convert 45 degrees to radians', '45° = π/4 (≈ 0.7854) radians'],
    ['135° to radians', '135° = 3π/4 (≈ 2.3562) radians'],
    ['convert 50 degrees to radians', '50° = 5π/18 (≈ 0.8727) radians'],
    ['convert 2pi/3 radians to degrees', '2π/3 radians = 120°'],
    ['convert 2pi/7 radians to degrees', '2π/7 radians = (360/7)° (≈ 51.4286°)'],
    ['1 radian to degrees', '1 radian ≈ 57.2958°'],
  ]) {
    const r = await solveProblem(p, 'auto');
    assert.equal(r.answer, answer, p);
    assert.equal(r.routedTopic, 'trigonometry', p);
  }
});

test('a request under a chosen topic is solved as its own and says so', async () => {
  const r = await solveProblem('the period of 3sin(2x)+1', 'algebra');
  assert.equal(r.answer, 'The period is π (≈ 3.1416)');
  assert.deepEqual(r.routing, { from: 'algebra', to: 'trigonometry', reason: 'the input asks for the period of a function' });
  // An unknown word inside the expression is a parse error, as everywhere.
  assert.equal((await solveProblem('inverse of 2 apples', 'auto')).status, 'parse_error');
});

test('display: complex roots over one denominator, erf with √π, ln(e^2) exact', async () => {
  assert.equal((await solveProblem('2x^2 + 3x + 5 = 0', 'algebra')).answer, 'x = (-3 - i√31)/4  or  x = (-3 + i√31)/4');
  assert.equal((await solveProblem('erf(x)', 'derivatives')).answer, "f'(x) = 2e^(-x^2)/√π");
  const ln = await solvePlain('ln(e^2)', 'other');
  assert.equal(ln.answer, '2');
  assert.match(ln.steps.join(' '), /ln\(e\^2\) asks for the power of e that gives e\^2, which is 2/);
  assert.equal((await solveProblem('ln(e)', 'other')).answer, '1');
  assert.equal((await solveProblem('log(10)', 'other')).answer, '1');
});

test('display: partial fractions read ln(x^2 + 1) without bars and x/2, not 1/2x', async () => {
  const r = await solvePlain('1/(x^3 + x)', 'integrals');
  const text = [r.answer, ...r.steps].join('\n');
  assert.doesNotMatch(text, /ln\|x\^2 \+ 1\||1\/2x/);
  assert.match(r.answer, /ln\(x\^2 \+ 1\)/);
});
