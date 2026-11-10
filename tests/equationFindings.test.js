// Wrong answers the registered cross-check found (tests/equationCrossCheck.test.js),
// each stated exactly: a scan shows an answer disagrees, this says what is right.
import test from 'node:test';
import assert from 'node:assert/strict';
import { solvePlain } from './helpers/solvePlain.js';

test('the two sides being the same product is an identity on its domain', async () => {
  assert.equal((await solvePlain('(x-1)*(x-2) = (x-1)*(x-2)', 'algebra')).answer, 'All real numbers (identity — true for every x)');
  assert.equal((await solvePlain('(x-2)*(x+2)*(x-3) = (x-2)*(x+2)*(x-3)', 'algebra')).answer, 'All real numbers (identity — true for every x)');
  const root = await solvePlain('(x-2)*sqrt(x+2) = (x-2)*sqrt(x+2)', 'algebra');
  assert.doesNotMatch(root.answer, /^x = /);
  // A real common factor still splits.
  assert.equal((await solvePlain('x*ln(x) = x', 'algebra')).answer.includes('e'), true);
});

test('a decimal inside an absolute value is solved, never typed back', async () => {
  for (const [p, answer] of [
    ['2*abs(3*x - 0.3) = 0.3', 'x = 1/20  or  x = 3/20'],
    ['abs(x-0.3) = 0.3', 'x = 0  or  x = 3/5'],
    ['abs(-1*x - 0.5) = -2*x - 0.2', 'x = -7/30'],
  ]) {
    const r = await solvePlain(p, 'algebra');
    assert.equal(r.status, 'solved', p);
    assert.equal(r.answer, answer, p);
  }
});

test('decimals made fractions read without extra brackets', async () => {
  for (const [p, shown] of [['abs(x-0.3) = 0.3', '|x - 3/10|'], ['abs(x-0.1) + abs(x-0.3) = 1', '|x - 1/10|']]) {
    const r = await solvePlain(p, 'algebra');
    assert.ok(r.steps.some((s) => s.includes(shown)), r.steps.join('\n'));
    assert.ok(!r.steps.some((s) => /\(\d+\/\d+\)/.test(s)), r.steps.join('\n'));
  }
  // Kept where it changes the meaning.
  assert.equal((await solvePlain('abs(x/0.5) + abs(x-1) = 4', 'algebra')).answer, 'x = -1  or  x = 5/3');
});

test('an equation that cannot be worked is refused, not typed back as solved', async () => {
  const { solveAlgebra } = await import('../src/lib/solvers/algebraSolver.js');
  const r = await solveAlgebra('x + 1 = sin(');
  assert.notEqual(r.status ?? 'solved', 'solved');
});

test('a negative root under a fractional power is found by the search', async () => {
  const r = await solvePlain('x^(2/3) - 0.3*x^(1/3) - 0.4 = 0', 'algebra');
  assert.match(r.answer, /-0\.125|-1\/8/);
  assert.match(r.answer, /0\.512/);
});

test('a rounded root stays rounded when another candidate is rejected', async () => {
  const r = await solvePlain('x^3 - 4*x - 3 + (x+4)/(x+4) = 1', 'algebra');
  assert.match(r.answer, /x ≈ -1\.3028/);
  assert.doesNotMatch(r.answer, /x = -1\.3028/);
  const cubic = await solvePlain('x^3 - 2*x - 3 + (x-1)/(x-1) = 1', 'algebra');
  assert.equal(cubic.answer, 'x ≈ 1.8933');
});
