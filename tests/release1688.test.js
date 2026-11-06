import test from 'node:test';
import assert from 'node:assert/strict';

import { solvePlain } from './helpers/solvePlain.js';

// 1.68.8 (outside review, November 2026, items 1–4 after the speed release):
// input that was not read, refusals that quoted glued words, limits left to
// estimates or refusals, and two displays.

test('variables side by side are a product under every topic, as implicit differentiation read them', async () => {
  assert.equal((await solvePlain('xy = 6; x + y = 5', 'algebra')).answer, '(x, y) = (2, 3)  or  (3, 2)');
  assert.equal((await solvePlain('xy = 6', 'algebra')).answer, 'y = 6/x');
  assert.equal((await solvePlain('xy = 1', 'derivatives')).answer, 'dy/dx = -y/x');
  // A repeated letter keeps its hint; function names are never split.
  assert.match((await solvePlain('xx + 1 = 2', 'algebra')).answer, /two variables side by side/);
  assert.match((await solvePlain('exp(x) = 2', 'algebra')).answer, /^x = ln\(2\)/);
});

test('a definite integral with its bounds after the verb', async () => {
  for (const p of ['integrate 0 to 1 x^2 dx', 'integrate from 0 to 1 x^2 dx', 'integral 0 to 1 of x^2']) {
    const r = await solvePlain(p, 'integrals');
    assert.equal(r.answer, '∫_0^1 (x^2) dx = 1/3 (≈ 0.3333)', p);
  }
  assert.equal((await solvePlain('integrate 0 to inf e^(-x) dx', 'integrals')).answer, '∫_0^∞ (e^(-x)) dx = 1');
  assert.equal((await solvePlain('integrate x^2 dx', 'integrals')).answer, '∫(x^2) dx = 1/3*x^3 + C');
});

test('a refusal quotes the word as typed, and names statistics and geometry', async () => {
  // "meanof", "areaofa": the expression reader had dropped the spaces.
  assert.match((await solvePlain('density of x^2', 'algebra')).answer, /^"density" is not a known function/);
  const mean = await solvePlain('mean of 1, 2, 3, 4', 'auto');
  assert.equal(mean.status, 'unsupported');
  assert.equal(mean.answer, 'Statistics is not supported');
  assert.equal((await solvePlain('area of a circle with radius 2', 'auto')).answer, 'Geometry formulas are not supported');
  // The average value of a function is still a request it answers.
  assert.equal((await solvePlain('the average value of x^2 on [0, 3]', 'auto')).answer, 'The average value is 3');
});

test('log(x)/(x − 1) at 1 is proved by series about 1, written in powers of x − 1', async () => {
  const r = await solvePlain('lim x->1 log(x)/(x-1)', 'limits');
  assert.equal(r.answer, 'lim (x→1) log(x)/(x - 1) = 1/ln(10) (≈ 0.4343)');
  assert.ok(r.steps.includes('Numerator ≈ (x - 1)/ln(10) - (x - 1)^2/(2ln(10)) + (x - 1)^3/(3ln(10)) + …; denominator ≈ (x - 1).'));
  assert.equal(r.tips[1], 'Here: the numerator starts (x - 1)/ln(10) and the denominator (x - 1); after cancelling, the limit is 1/ln(10).');
  // Where L'Hôpital's rule worked it still does.
  assert.match((await solvePlain('lim x->1 ln(x)/(x^2-1)', 'limits')).tips[1], /^Here: after one round the bottom is 2x/);
});

test('sin of a power of x has no limit, by two sequences', async () => {
  for (const [p, x] of [
    ['lim x->inf sin(x^2)', 'x_n = √(π/2 + 2πn)'],
    ['lim x->inf sin(sqrt(x))', 'x_n = (π/2 + 2πn)^2'],
    ['lim x->0 sin(1/x^2)', 'x_n = 1/√(π/2 + 2πn)'],
  ]) {
    const r = await solvePlain(p, 'limits');
    assert.match(r.answer, /does not exist$/, p);
    assert.ok(r.steps.some((s) => s.includes(`Along ${x}`)), `${p}\n${r.steps.join('\n')}`);
  }
});

test('a power of a linear inside is integrated in its own form', async () => {
  for (const [p, answer] of [
    ['sqrt(2x+1)', '∫(sqrt(2x + 1)) dx = 1/3*(2x + 1)^(3/2) + C'], // was 1/3·√(8x^3 + …)
    ['(2x+1)^5', '∫((2x + 1)^5) dx = 1/12*(2x + 1)^6 + C'], // was expanded
    ['cbrt(1-x)', '∫(cbrt(1 - x)) dx = -3/4*(1 - x)^(4/3) + C'],
    ['1/(3x+2)^2', '∫(1/(3x + 2)^2) dx = -1/(3(3x + 2)) + C'], // was −1/(9(x + 2/3))
    ['(x+1)^(-3/2)', '∫((x + 1)^(-3/2)) dx = -2/√(x + 1) + C'],
  ]) {
    assert.equal((await solvePlain(p, 'integrals')).answer, answer, p);
  }
  const r = await solvePlain('sqrt(2x+1)', 'integrals');
  assert.ok(r.steps.includes('The inside 2x + 1 is linear, so its derivative is a constant. Let u = 2x + 1. Then du = 2 dx, so dx = du/2.'));
  assert.equal((await solvePlain('∫_0^4 sqrt(2x+1) dx', 'integrals')).answer, '∫_0^4 (sqrt(2x + 1)) dx = 26/3 (≈ 8.6667)');
});

test('"y = x^3 + 2" under Algebra is a function, as Auto-detect reads it', async () => {
  const r = await solvePlain('y = x^3 + 2', 'algebra');
  assert.equal(r.routing?.to, 'functions');
  assert.match(r.answer, /^f\(x\) = x\^3 \+ 2: domain: all real numbers/);
  // Equations stay equations.
  assert.equal((await solvePlain('y = 2y + 3', 'algebra')).answer, 'y = -3');
  assert.equal((await solvePlain('x^2 + y = 4', 'algebra')).answer, 'y = -x^2 + 4');
});
