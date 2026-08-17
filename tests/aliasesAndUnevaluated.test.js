import test from 'node:test';
import assert from 'node:assert/strict';

import { parseMathExpression, extractVariable } from '../src/lib/mathParser.js';
import { isUnevaluatedOperator } from '../src/lib/solvers/solverUtils.js';
import { solveProblem } from '../src/lib/api.js';
import { STATUS } from '../src/lib/solutionEnvelope.js';

// ── QA report: inverse-trig aliases were inconsistent. arcsin worked;
// asin came back as the unevaluated operator d(asin(x),x), marked Solved.

test('asin/acos/atan normalise to arcsin/arccos/arctan in the parser', () => {
  assert.equal(parseMathExpression('asin(x)'), 'arcsin(x)');
  assert.equal(parseMathExpression('acos(x)+atan(x)'), 'arccos(x)+arctan(x)');
  assert.equal(parseMathExpression('ASIN(x)'), 'arcsin(x)');
  assert.equal(parseMathExpression('2*asin(x)'), '2*arcsin(x)');
});

test('sin^-1 / sin⁻¹ notation normalises too; hyperbolic and powers are untouched', () => {
  assert.equal(parseMathExpression('sin^-1(x)'), 'arcsin(x)');
  assert.equal(parseMathExpression('sin^(-1)(x)'), 'arcsin(x)');
  assert.equal(parseMathExpression('sin⁻¹(x)'), 'arcsin(x)');
  assert.equal(parseMathExpression('tan^-1(2x)'), 'arctan(2*x)');
  assert.equal(parseMathExpression('asinh(x)'), 'asinh(x)');
  assert.equal(parseMathExpression('x^-1'), 'x^-1');
  assert.equal(parseMathExpression('arcsin(x)'), 'arcsin(x)');
});

test('the aliases behave identically to the long forms across topics', async () => {
  const pairs = [
    ['asin(x)', 'arcsin(x)', 'derivatives'],
    ['acos(x)', 'arccos(x)', 'derivatives'],
    ['atan(x)', 'arctan(x)', 'derivatives'],
    ['atan(x)', 'arctan(x)', 'integrals'],
    ['atan(x)', 'arctan(x)', 'functions'],
  ];
  for (const [alias, canonical, topic] of pairs) {
    const a = await solveProblem(alias, topic);
    const c = await solveProblem(canonical, topic);
    assert.equal(a.status, STATUS.SOLVED, `${alias} ${topic}`);
    assert.equal(a.answer, c.answer, `${alias} vs ${canonical} under ${topic}`);
    assert.doesNotMatch(a.answer, /\bd\(|\bintegral\(/, `${alias} ${topic} came back unevaluated`);
  }
  // Correct values, not just consistency.
  const d = await solveProblem('asin(x)', 'derivatives');
  assert.match(d.answer, /1\/\(\(-x\^2 \+ 1\)\^\(1\/2\)\)/);
  const t = await solveProblem('atan(x)', 'derivatives');
  assert.match(t.answer, /1\/\(x\^2 \+ 1\)/);
});

// ── QA report: an unchanged symbolic operator must not receive "Solved".

test('isUnevaluatedOperator recognises Algebrite handing the operator back', () => {
  assert.equal(isUnevaluatedOperator('d(asin(x),x)'), true);
  assert.equal(isUnevaluatedOperator('integral(foo(x),x)'), true);
  assert.equal(isUnevaluatedOperator('2*d(g(x),x)+1'), true);
  assert.equal(isUnevaluatedOperator('defint(f(x),x,0,1)'), true);
  assert.equal(isUnevaluatedOperator('2*x + 3'), false);
  assert.equal(isUnevaluatedOperator('exp(x)*(x - 1)'), false);
  assert.equal(isUnevaluatedOperator('d'), false);          // bare letter is a variable
  assert.equal(isUnevaluatedOperator('2*d + 1'), false);
});

test('an unknown function is refused as unsupported, never reported as solved', async () => {
  const d = await solveProblem('foo(x)', 'derivatives');
  assert.equal(d.status, STATUS.UNSUPPORTED);
  assert.doesNotMatch(d.answer, /\bd\(/);
  const i = await solveProblem('gamma(x)', 'integrals');
  assert.equal(i.status, STATUS.UNSUPPORTED);
  assert.doesNotMatch(i.answer, /\bintegral\(/);
});

// ── Found while probing the above: the variable extractor took the first
// letter of an unknown function name, so erf(x) differentiated as f'(f) = 0.

test('extractVariable ignores unknown function names, keeps implicit multiplication', () => {
  assert.equal(extractVariable('erf(x)'), 'x');
  assert.equal(extractVariable('gamma(y)*y'), 'y');
  assert.equal(extractVariable('foo(z)+1'), 'z');
  assert.equal(extractVariable('x(x+1)'), 'x');   // implicit multiplication, x is the variable
  assert.equal(extractVariable('t^2+3t'), 't');
  assert.equal(extractVariable('arcsin(x)'), 'x');
});

test('erf(x) differentiates with respect to x (Algebrite knows erf)', async () => {
  const r = await solveProblem('erf(x)', 'derivatives');
  assert.equal(r.status, STATUS.SOLVED);
  assert.match(r.answer, /^f'\(x\) =/);
  assert.match(r.answer, /e\^\(-x\^2\)/);
});
