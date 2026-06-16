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
