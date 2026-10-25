import test from 'node:test';
import assert from 'node:assert/strict';

import { solveProblem } from '../src/lib/api.js';

// 1.55.1: calculus spellings from the October 25 review and its sweep.
// "integral x^2 dx" and "integral of x^2 with respect to x" were answered
// wrongly and marked Solved; "int x^2 dx" and "derivative x^2" were glued
// into unknown words.

test('int is the integral sign: int x^2 dx, int_0^1, int(x^2)', async () => {
  for (const [p, topic, answer] of [
    ['int x^2 dx', 'auto', '∫(x^2) dx = 1/3*x^3 + C'], // was "intx is not a known function"
    ['int x^2 dx', 'integrals', '∫(x^2) dx = 1/3*x^3 + C'],
    ['int x^2', 'integrals', '∫(x^2) dx = 1/3*x^3 + C'],
    ['int_0^1 x^2 dx', 'auto', '∫_0^1 (x^2) dx = 1/3 (≈ 0.3333)'],
    ['int(x^2)', 'auto', '∫(x^2) dx = 1/3*x^3 + C'], // was echoed as "int(x^2)", Solved under Algebra
  ]) {
    const r = await solveProblem(p, topic);
    assert.equal(r.status, 'solved', `${p} {${topic}}`);
    assert.equal(r.answer, answer, `${p} {${topic}}`);
  }
  // A word that only starts with "int" is not the sign.
  assert.notEqual((await solveProblem('find the intercepts of x^2 - 4', 'auto')).routedTopic, 'integrals');
});

test('integral and derivative without "of", and the bounds before the integrand', async () => {
  for (const [p, answer] of [
    ['integral x^2 dx', '∫(x^2) dx = 1/3*x^3 + C'], // was ∫(integralx^2) dx = integralx^2*x + C, Solved
    ['find the integral x^2 dx', '∫(x^2) dx = 1/3*x^3 + C'],
    ['antiderivative x^2', '∫(x^2) dx = 1/3*x^3 + C'],
    ['integral from 0 to 1 of x^2 dx', '∫_0^1 (x^2) dx = 1/3 (≈ 0.3333)'], // was "unable to compute"
    ['the definite integral from 0 to pi of sin(x) dx', '∫_0^π (sin(x)) dx = 2'],
    ['derivative x^2', "f'(x) = 2x"],
    ['deriv of x^2', "f'(x) = 2x"],
    ['diff x^2', "f'(x) = 2x"],
    ['derivative x^2 at x = 2', "f'(2) = 4"],
    ['find the derivative sin(x)', "f'(x) = cos(x)"],
  ]) {
    const r = await solveProblem(p, 'auto');
    assert.equal(r.answer, answer, p);
  }
});

test('"with respect to" names the variable: an integral\'s dx, not a derivative', async () => {
  for (const [p, answer] of [
    ['integral of x^2 with respect to x', '∫(x^2) dx = 1/3*x^3 + C'], // was f'(x) = 0, Solved
    ['integral with respect to x of x^2', '∫(x^2) dx = 1/3*x^3 + C'],
    ['integral of x^2 with respect to x from 0 to 1', '∫_0^1 (x^2) dx = 1/3 (≈ 0.3333)'],
    ['integrate x*y with respect to y', '∫(x*y) dy = 1/2*x*y^2 + C'],
    ['find the integral of t^2 with respect to t', '∫(t^2) dt = 1/3*t^3 + C'],
    ['derivative with respect to x of x^2', "f'(x) = 2x"], // was f'(x) = 0
    ['derivative of x^2*y with respect to y', "f'(y) = x^2"],
  ]) {
    const r = await solveProblem(p, 'auto');
    assert.equal(r.status, 'solved', p);
    assert.equal(r.answer, answer, p);
  }
});

test('a bracketed integrand is shown once: ∫(x^2) dx, not ∫((x^2)) dx', async () => {
  assert.equal((await solveProblem('∫(x^2)', 'auto')).answer, '∫(x^2) dx = 1/3*x^3 + C');
  assert.equal((await solveProblem('integral of (x+1)/(x-1)', 'auto')).answer, '∫((x + 1)/(x - 1)) dx = x + 2ln|x - 1| + C');
});
