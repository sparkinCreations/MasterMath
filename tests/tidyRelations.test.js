// 1.71.1: a relation solved for one letter reads as a textbook writes it,
// and an equation in x with constants is solved with the constants held
// fixed. Answers are checked by value where they could be written more than
// one way.
import test from 'node:test';
import assert from 'node:assert/strict';
import { solvePlain } from './helpers/solvePlain.js';
import { expressionsEqualInAllLetters } from '../src/lib/solvers/solverUtils.js';

test('a fraction inside a fraction is cleared', async () => {
  for (const [p, answer] of [
    ['3xy + y = 6', 'y = 6/(3x + 1)'], // was y = 2/(x + 1/3)
    ['6xy = 3y + 2', 'y = 2/(6x - 3)'], // was y = 1/(3(x - 1/2))
    ['2xy + y = 3', 'y = 3/(2x + 1)'],
    ['x*y + 2y = 4', 'y = 4/(x + 2)'],
  ]) {
    const r = await solvePlain(p, 'auto');
    assert.equal(r.answer, answer, p);
  }
});

test('an exponential with constants is solved by logarithms, written ln', async () => {
  // Was "Infinitely many solutions — one equation cannot fix 3 unknowns".
  for (const [p, answer] of [
    ['e^(a*x) = b', 'x = ln(b)/a'],
    ['e^(ax) = b', 'x = ln(b)/a'],
    ['3e^(kx) = c', 'x = ln(c/3)/k'],
    ['b = e^(x/a)', 'x = a*ln(b)'],
    ['a*e^x + b = c', 'x = ln((c - b)/a)'],
  ]) {
    const r = await solvePlain(p, 'auto');
    assert.equal(r.status, 'solved', p);
    assert.equal(r.answer, answer, p);
    assert.ok(r.steps.some((s) => /natural logarithm of both sides/.test(s)), p);
    assert.ok(r.tips.some((t) => /positive argument/.test(t)), p);
  }
  const shifted = await solvePlain('e^(2x + a) = b', 'auto');
  assert.ok(expressionsEqualInAllLetters(shifted.answer.replace(/^x = /, '').replace(/ln/g, 'log'), '(log(b) - a)/2'), shifted.answer);
});

test('e^x as a textbook writes it, not exp(x)', async () => {
  const r = await solvePlain('e^x = y', 'auto');
  assert.equal(r.answer, 'y = e^x');
});

test('constants are called constants, not unknowns', async () => {
  for (const p of ['a*x + b = 0', 'e^(a*x) = b']) {
    const r = await solvePlain(p, 'auto');
    assert.match(r.steps.join(' '), /The letters a and b are constants/, p);
    assert.doesNotMatch(r.steps.join(' ') + r.answer, /unknowns/, p);
  }
  const one = await solvePlain('k*x = 5', 'auto');
  assert.match(one.steps.join(' '), /The letter k is a constant/);
  // x with y is still a relation between two unknowns.
  const xy = await solvePlain('3xy + y = 6', 'auto');
  assert.match(xy.steps.join(' '), /one equation in 2 unknowns/);
  // A refusal says what it could not do, in the singular where it is one.
  const r = await solvePlain('x^5 + a*x + 1 = 0', 'auto');
  assert.equal(r.status, 'unsupported');
  assert.equal(r.answer, 'Solving for x with the constant a left as a letter is not supported for this equation');
});
