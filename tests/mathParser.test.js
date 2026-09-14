import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseMathExpression,
  extractFunctionFromProblem,
  extractVariable,
  isEquation,
} from '../src/lib/mathParser.js';

test('parseMathExpression normalizes common math notation', () => {
  assert.equal(parseMathExpression('2x + √x + y²'), '2*x+sqrt(x)+y^2');
});

test('extractFunctionFromProblem pulls math from natural language prompts', () => {
  assert.equal(
    extractFunctionFromProblem('Find the derivative of x^2 + 3x.'),
    'x^2+3*x'
  );
});

test('extractVariable ignores built-in function names', () => {
  assert.equal(extractVariable('sin(t) + t^2'), 't');
});

test('isEquation only matches standalone equals signs', () => {
  assert.equal(isEquation('x = 2'), true);
  assert.equal(isEquation('x >= 2'), false);
  assert.equal(isEquation('x != 2'), false);
});

test('rewriteWordArithmetic turns spoken operations into symbols, with precedence-safe operands', async () => {
  const { rewriteWordArithmetic } = await import('../src/lib/mathParser.js');
  assert.equal(rewriteWordArithmetic('add 1/3 and 1/7'), '(1/3) + (1/7)');
  assert.equal(rewriteWordArithmetic('add 2 to 3'), '2 + 3');
  assert.equal(rewriteWordArithmetic('subtract 2 from 9'), '9 - 2');
  assert.equal(rewriteWordArithmetic('the quotient of 1/2 and 3/4'), '(1/2) / (3/4)');
  assert.equal(rewriteWordArithmetic('what is the sum of 2 and 3'), 'what is 2 + 3');
  assert.equal(rewriteWordArithmetic('8 divided by 2'), '8 / 2');
  assert.equal(rewriteWordArithmetic('x^2 + 3x'), 'x^2 + 3x');
  assert.equal(extractFunctionFromProblem('add 1/3 and 1/7'), '(1/3)+(1/7)');
});
