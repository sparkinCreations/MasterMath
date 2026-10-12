// The linear-equation walkthrough and polynomial simplification that replaced
// mathsteps in 1.39.0. mathsteps was unmaintained, once confidently wrong, and
// its bundled mathjs 3 / typed-function build code with `new Function` —
// which the Content-Security-Policy in public/_headers forbids, so it must
// never come back.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { solveLinearEquation } from '../src/lib/solvers/linearEquationSolver.js';
import { solveProblem } from '../src/lib/api.js';

const here = path.dirname(fileURLToPath(import.meta.url));

test('mathsteps is neither a dependency nor imported anywhere in src', () => {
  const pkg = JSON.parse(readFileSync(path.resolve(here, '../package.json'), 'utf8'));
  assert.equal(pkg.dependencies?.mathsteps, undefined);
  assert.equal(pkg.devDependencies?.mathsteps, undefined);
  const walk = (dir) => readdirSync(dir).flatMap((f) => {
    const full = path.join(dir, f);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
  const importers = walk(path.resolve(here, '../src'))
    .filter((f) => /['"]mathsteps['"]/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(importers, []);
});

test('the inverse operations, one per step, in exact arithmetic', () => {
  assert.deepEqual(solveLinearEquation('5*x - 7 = 3*x + 9').steps, [
    'Subtract 3x from both sides: 2x - 7 = 9',
    'Add 7 to both sides: 2x = 16',
    'Divide both sides by 2: x = 16/2 = 8',
  ]);
  const fraction = solveLinearEquation('2*x + 1 = 4');
  assert.equal(fraction.answer, 'x = 3/2');
  assert.deepEqual(fraction.solutions, [1.5]);
  assert.equal(fraction.steps.at(-1), 'Divide both sides by 2: x = 3/2');
});

test('fractions are cleared by the least common denominator first', () => {
  const r = solveLinearEquation('(x+1)/2 = (x-3)/4');
  assert.equal(r.steps[0], 'Multiply both sides by 4 (the least common denominator) to clear the fractions: 2x + 2 = x - 3');
  assert.equal(r.answer, 'x = -5');
  assert.equal(solveLinearEquation('x/3 + 1/2 = 1').answer, 'x = 3/2');
});

test('decimals stay decimals, and are not cleared as fractions', () => {
  assert.deepEqual(solveLinearEquation('0.5*x + 1.5 = 4').steps, [
    'Subtract 1.5 from both sides: 0.5x = 2.5',
    'Divide both sides by 0.5: x = 2.5/0.5 = 5',
  ]);
});

test('variable on the right is swapped over; a lone -x is multiplied by -1', () => {
  assert.equal(solveLinearEquation('7 = 2*x - 3').steps[0], 'Swap the two sides so x is on the left: 2x - 3 = 7');
  assert.equal(solveLinearEquation('10 - x = 4').steps.at(-1), 'Multiply both sides by -1: x = 6');
});

test('like terms on one side are combined before anything moves', () => {
  assert.equal(solveLinearEquation('x + x + x = 12').steps[0], 'Combine like terms on each side: 3x = 12');
});

test('anything that is not linear with a net x term is left to the other paths', () => {
  for (const input of ['x^2 = 4', '1/x = 2', 'x + y = 3', 'sin(x) = 0', 'pi*x = 1', '2*(x+3) = 2*x + 6', '5*x - 7 = 5*x + 2', 'x = 5']) {
    assert.equal(solveLinearEquation(input), null, input);
  }
});

test('identities and contradictions keep their own explanations', async () => {
  assert.match((await solveProblem('2(x+3) = 2x+6', 'algebra')).answer, /All real numbers/);
  assert.match((await solveProblem('5x-7 = 5x+2', 'algebra')).answer, /No solution/);
});

test('factorable monic quadratics are factored; a double root says so', async () => {
  const square = await solveProblem('x^2 + 4x + 4 = 0', 'algebra');
  assert.equal(square.answer, 'x = -2 (repeated root, multiplicity 2)');
  assert.ok(square.steps.includes('Set the factor to zero: x + 2 = 0, so x = -2 (a repeated root).'));
  const common = await solveProblem('x^2 - 3x = 0', 'algebra');
  assert.equal(common.steps[0], 'Factor out the common x: x^2 - 3x = 0 becomes x(x - 3) = 0.');
  // Non-monic: the formula, not a fabricated factor search.
  assert.match((await solveProblem('2x^2 + 3x - 2 = 0', 'algebra')).steps.join('\n'), /Quadratic formula/);
});

test('simplify expands a polynomial and shows the multiplying out, then the combining', async () => {
  const r = await solveProblem('2(x + 3) + 4x', 'algebra');
  assert.equal(r.answer, '6x + 6');
  assert.deepEqual(r.steps, ['Multiply out the parentheses: 2x + 6 + 4x', 'Combine like terms: 6x + 6']);
  assert.equal((await solveProblem('x^2 + 2x + x^2', 'algebra')).answer, '2x^2 + 2x');
  // A rational expression still cancels, written the textbook way.
  assert.equal((await solveProblem('(2x^2 - 8)/(4x)', 'algebra')).answer, 'x/2 - 2/x');
});
