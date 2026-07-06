import test from 'node:test';
import assert from 'node:assert/strict';

import { solveArithmetic } from '../src/lib/solvers/arithmeticSolver.js';
import { solveAlgebra } from '../src/lib/solvers/algebraSolver.js';
import { solveDerivative } from '../src/lib/solvers/derivativesSolver.js';
import { solveIntegral } from '../src/lib/solvers/integralsSolver.js';
import {
  solveFunctions,
  solveLimit,
  solveTrigonometry,
} from '../src/lib/solvers/otherSolvers.js';

function extractNumericAnswer(answer) {
  const match = String(answer).match(/=\s*(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)/i);
  return match ? Number(match[1]) : Number.NaN;
}

test('solveArithmetic evaluates PEMDAS-style expressions', () => {
  const result = solveArithmetic('(5 + 3) * 4 - 2^3');
  assert.equal(result.answer, '24');
  assert.match(result.steps.at(-1), /24/);
});

test('solveAlgebra solves a simple linear equation with mathsteps steps', async () => {
  const result = await solveAlgebra('2*x + 5 = 11');
  assert.match(result.answer, /x\s*=\s*3/);
  assert.ok(result.steps.some((step) => /subtract from both sides/i.test(step)));
});

test('solveAlgebra returns exact roots for quadratics mathsteps cannot finish', async () => {
  const irrational = await solveAlgebra('x^2 = 2');
  // Radical roots are kept exact, not collapsed to decimals.
  assert.match(irrational.answer, /2\^\(1\/2\)/);

  const complex = await solveAlgebra('x^2 + 1 = 0');
  assert.match(complex.answer, /\bi\b/);
});

test('solveDerivative shows worked, term-by-term steps', async () => {
  const result = await solveDerivative('x^2 + 3*x');
  assert.match(result.answer.replace(/\s+/g, ''), /f'\(x\)=2x\+3/);
  // The intermediate derivative of each term is shown, not just the final answer.
  assert.ok(result.steps.some((step) => /d\/dx\(x\^2\)\s*=\s*2x/.test(step)));
  assert.ok(result.graph?.points?.length > 0);
  assert.ok(result.graph?.secondaryPoints?.length > 0);
});

test('solveIntegral shows worked steps and the constant of integration', async () => {
  const result = await solveIntegral('2*x + 1');
  assert.match(result.answer, /\+ C$/);
  assert.ok(result.steps.some((step) => step.includes('constant of integration')));
  // Each term is integrated on its own line.
  assert.ok(result.steps.some((step) => /∫\(2x\)\s*d?x?\s*=\s*x\^2/.test(step)));
  assert.ok(result.graph?.secondaryPoints?.length > 0);
});

test('solveLimit supports symbolic approach values like pi/2', () => {
  const result = solveLimit('lim x->pi/2 sin(x)');
  const numericAnswer = extractNumericAnswer(result.answer);

  assert.ok(Number.isFinite(numericAnswer));
  assert.ok(Math.abs(numericAnswer - 1) < 1e-3);
  assert.ok(result.graph?.points?.length > 0);
});

test('solveTrigonometry recognizes special-angle values', () => {
  const result = solveTrigonometry('sin(pi/4)');
  assert.match(result.answer, /0\.7071/);
  assert.ok(result.tips.length > 0);
});

test('solveLimit evaluates limits at infinity', () => {
  const result = solveLimit('lim x->infinity 1/x');
  assert.match(result.answer, /=\s*0$/);
  assert.ok(result.steps.some((step) => /large/i.test(step)));
});

test('solveLimit reports indeterminate 0/0 forms via both sides', () => {
  const result = solveLimit('lim x->2 (x^2 - 4)/(x - 2)');
  assert.match(result.answer, /=\s*4$/);
  assert.ok(result.steps.some((step) => /indeterminate/i.test(step)));
});

test('solveFunctions returns graphable function analysis', () => {
  const result = solveFunctions('x^2 - 4*x + 3');
  assert.match(result.answer.replace(/\s+/g, ''), /f\(x\)=x\^2-4x\+3/);
  assert.ok(result.graph?.points?.length > 0);
});
