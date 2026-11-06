import test from 'node:test';
import assert from 'node:assert/strict';

import { solvePlain } from './helpers/solvePlain.js';

// 1.69.1 (the November 6 roadmap check): three integrals that were answered
// in one unexplained line, in an expanded form, or not at all.
const solve = (p) => solvePlain(p, 'integrals');

test('a polynomial times a root of a linear inside, by u = the inside, in powers of it', async () => {
  for (const [p, answer] of [
    ['x*sqrt(x+1)', '∫(x*sqrt(x + 1)) dx = 2/5*(x + 1)^(5/2) - 2/3*(x + 1)^(3/2) + C'], // was 2/5·(x − 2/3)·√(x³ + 3x² + 3x + 1)
    ['x*(2x+1)^(3/2)', '∫(x*(2x + 1)^(3/2)) dx = 1/14*(2x + 1)^(7/2) - 1/10*(2x + 1)^(5/2) + C'], // was refused
    ['x*cbrt(x+2)', '∫(x*cbrt(x + 2)) dx = 3/7*(x + 2)^(7/3) - 3/2*(x + 2)^(4/3) + C'], // was refused
    ['x^2/sqrt(1-x)', '∫(x^2/sqrt(1 - x)) dx = -2/5*(1 - x)^(5/2) + 4/3*(1 - x)^(3/2) - 2√(1 - x) + C'],
    ['x/(x+1)^(3/2)', '∫(x/(x + 1)^(3/2)) dx = 2√(x + 1) + 2/√(x + 1) + C'],
  ]) {
    assert.equal((await solve(p)).answer, answer, p);
  }
  const r = await solve('x*sqrt(3-2x)');
  assert.ok(r.steps.includes('The root\'s inside 3 - 2x is linear, so substitute for it: let u = 3 - 2x. Then du = −2 dx, so dx = du/(−2), and the rest of the integrand is written in u too: x = (3 − u)/2.'), r.steps.join('\n'));
  assert.ok(r.steps.includes('Multiply out, so each term is a single power of u: ∫(1/4·u^(3/2) − 3/4·u^(1/2)) du.'));
  assert.match(r.tips[0], /^A polynomial times a root of a linear inside/);
  assert.match(r.tips[1], /^Here: u = 3 - 2x, x = \(3 − u\)\/2 and the integral becomes ∫/);
  // A root of x alone stays the power rule; a power of a linear alone, its own form.
  assert.equal((await solve('x^2*sqrt(x)')).answer, '∫(x^2*sqrt(x)) dx = 2/7*x^(7/2) + C');
  assert.equal((await solve('sqrt(2x+1)')).answer, '∫(sqrt(2x + 1)) dx = 1/3*(2x + 1)^(3/2) + C');
  assert.equal((await solve('∫_0^3 x/sqrt(x+1) dx')).answer, '∫_0^3 (x/sqrt(x + 1)) dx = 8/3 (≈ 2.6667)');
});

test('even powers of sin and cos are lowered step by step', async () => {
  for (const [p, answer] of [
    ['sin(x)^2*cos(x)^2', '∫(sin(x)^2*cos(x)^2) dx = 1/8*x - 1/32*sin(4x) + C'],
    ['sin(x)^4', '∫(sin(x)^4) dx = 3/8*x - 1/4*sin(2x) + 1/32*sin(4x) + C'],
    ['sin(x)^4*cos(x)^2', '∫(sin(x)^4*cos(x)^2) dx = 1/16*x - 1/64*sin(2x) - 1/64*sin(4x) + 1/192*sin(6x) + C'], // was refused
    ['sin(x)^4*cos(x)^4', '∫(sin(x)^4*cos(x)^4) dx = 3/128*x - 1/128*sin(4x) + 1/1024*sin(8x) + C'],
    ['cos(2x)^4', '∫(cos(2x)^4) dx = 3/8*x + 1/8*sin(4x) + 1/64*sin(8x) + C'],
  ]) {
    assert.equal((await solve(p)).answer, answer, p);
  }
  const r = await solve('sin(x)^2*cos(x)^2');
  assert.ok(r.steps.includes('Both powers are even, so there is no odd factor to save for du: lower them with the half-angle identities sin²(x) = (1 − cos(2x))/2 and cos²(x) = (1 + cos(2x))/2: sin²(x)·cos²(x) = 1/4·(1 − cos(2x))(1 + cos(2x)).'), r.steps.join('\n'));
  assert.ok(r.steps.includes('Lower each power of cos(2x) the same way: cos²(2x) = 1/2 + 1/2·cos(4x). Collect: sin²(x)·cos²(x) = 1/8 − 1/8·cos(4x).'));
  assert.match(r.tips[0], /^Even powers of sin and cos leave no factor to save for du/);
  assert.equal(r.tips[1], 'Here: the integrand lowers to 1/8 − 1/8·cos(4x), so ∫(sin(x)^2*cos(x)^2) dx = 1/8*x - 1/32*sin(4x) + C.');
  // A lone sin² keeps its own walkthrough; an odd power its substitution.
  assert.match((await solve('sin(x)^2')).steps.join('\n'), /power-reduction \(half-angle\) identity/);
  assert.match((await solve('sin(x)^3')).steps.join('\n'), /The power of sin is odd/);
  assert.equal((await solve('∫_0^pi sin(x)^2*cos(x)^2 dx')).answer, '∫_0^π (sin(x)^2*cos(x)^2) dx = 1/8*π (≈ 0.3927)');
});

test('a repeated factor that splits only over the reals: one partial fraction per power', async () => {
  const r = await solve('1/(x^2-2)^2');
  assert.equal(r.answer, '∫(1/(x^2 - 2)^2) dx = √2/16·ln|x + √2| − 1/(8(x + √2)) − √2/16·ln|x − √2| − 1/(8(x − √2)) + C');
  assert.ok(r.steps.some((s) => s.includes('1/(x^2 - 2)^2 = √2/(16(x + √2)) + 1/(8(x + √2)²) − √2/(16(x − √2)) + 1/(8(x − √2)²)')), r.steps.join('\n'));
  // There is no radical in it: the old step called it a trig substitution.
  assert.doesNotMatch(r.steps.join('\n'), /Trigonometric substitution|radical/);
  assert.equal((await solve('1/(x^2-2)^3')).answer, '∫(1/(x^2 - 2)^3) dx = −3√2/128·ln|x + √2| + 3/(64(x + √2)) + √2/(64(x + √2)²) + 3√2/128·ln|x − √2| + 3/(64(x − √2)) − √2/(64(x − √2)²) + C'); // was refused
  assert.equal((await solve('1/((x^2-2)^2*(x^2+1))')).answer, '∫(1/((x^2 - 2)^2*(x^2 + 1))) dx = 7√2/144·ln|x + √2| − 1/(24(x + √2)) − 7√2/144·ln|x − √2| − 1/(24(x − √2)) + 1/9·arctan(x) + C');
  // Simple roots keep the residue path and its answers.
  assert.match((await solve('1/(x^5+1)')).answer, /^∫\(1\/\(x\^5 \+ 1\)\) dx = 1\/5·ln\|x \+ 1\| \+ \(√5 − 1\)\/20·ln/);
  // A real radical keeps the trig substitution.
  assert.match((await solve('1/(x^2*sqrt(x^2+9))')).steps.join('\n'), /substitute x = 3tan θ/);
});
