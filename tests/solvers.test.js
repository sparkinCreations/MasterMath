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

test('solveLimit supports symbolic approach values like pi/2', async () => {
  const result = await solveLimit('lim x->pi/2 sin(x)');
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

test('solveTrigonometry returns Undefined at the tan(pi/2) asymptote', () => {
  const result = solveTrigonometry('tan(pi/2)');
  assert.equal(result.answer, 'Undefined');
  assert.ok(result.steps.some((step) => /vertical asymptote/i.test(step)));
  assert.ok(result.steps.some((step) => /cos\(pi\/2\) = 0/.test(step)));
  assert.ok(result.common_mistakes.some((mistake) => /cos\(x\) = 0/.test(mistake)));
  // The reference tan graph should still render (asymptotes are capped).
  assert.ok(result.graph?.points?.length > 0);
});

test('solveTrigonometry returns Undefined for other odd multiples of pi/2', () => {
  assert.equal(solveTrigonometry('tan(3*pi/2)').answer, 'Undefined');
  assert.equal(solveTrigonometry('sec(pi/2)').answer, 'Undefined');
});

test('solveTrigonometry returns Undefined for tan(90) via degree detection', () => {
  const result = solveTrigonometry('tan(90)');
  assert.equal(result.answer, 'Undefined');
  assert.ok(result.steps.some((step) => /degrees/i.test(step)));
  assert.ok(result.steps.some((step) => /vertical asymptote/i.test(step)));
});

test('solveTrigonometry still evaluates tan(pi/4) normally', () => {
  const result = solveTrigonometry('tan(pi/4)');
  assert.equal(result.answer, '1');
});

test('solveLimit returns Undefined when the expression itself sits on an asymptote', async () => {
  // e.g. the user typed tan(pi/2) with the Limits topic selected.
  const result = await solveLimit('tan(pi/2)');
  assert.equal(result.answer, 'Undefined');
  assert.ok(result.steps.some((step) => /vertical asymptote/i.test(step)));
});

test('solveLimit reports divergence at a vertical asymptote instead of a huge float', async () => {
  const twoSided = await solveLimit('lim x->pi/2 tan(x)');
  assert.match(twoSided.answer, /Does not exist$/);
  assert.ok(twoSided.steps.some((step) => /diverges to ∞/.test(step)));
  assert.ok(twoSided.steps.some((step) => /diverges to -∞/.test(step)));

  const infinite = await solveLimit('lim x->0 1/x^2');
  assert.match(infinite.answer, /=\s*∞$/);
});

test('solveLimit evaluates limits at infinity', async () => {
  const result = await solveLimit('lim x->infinity 1/x');
  assert.match(result.answer, /=\s*0$/);
  assert.ok(result.steps.some((step) => /large/i.test(step)));
});

test('solveLimit reports indeterminate 0/0 forms via both sides', async () => {
  const result = await solveLimit('lim x->2 (x^2 - 4)/(x - 2)');
  assert.match(result.answer, /=\s*4$/);
  assert.ok(result.steps.some((step) => /indeterminate/i.test(step)));
});

test('solveFunctions returns graphable function analysis', async () => {
  const result = await solveFunctions('x^2 - 4*x + 3');
  assert.match(result.answer.replace(/\s+/g, ''), /f\(x\)=x\^2-4x\+3/);
  assert.ok(result.graph?.points?.length > 0);
  // Wave 2: quadratic insights are exact, not sampled.
  assert.ok(result.steps.some((s) => /axis of symmetry/i.test(s) && /= 2/.test(s)));
  assert.ok(result.steps.some((s) => /opens upward/i.test(s)));
  assert.ok(result.steps.some((s) => /vertex/i.test(s) && /\(2, -1\)/.test(s)));
});
