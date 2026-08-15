import test from 'node:test';
import assert from 'node:assert/strict';

import {
  sanitizeInput,
  validateMathInput,
  validateProblemHistory,
  validateTopic,
} from '../src/lib/validation.js';

test('validateMathInput rejects empty and over-long input', () => {
  assert.deepEqual(validateMathInput(''), {
    isValid: false,
    error: 'Please enter a math problem',
  });
  assert.deepEqual(validateMathInput('   '), {
    isValid: false,
    error: 'Please enter a math problem',
  });
  assert.deepEqual(validateMathInput(`x + ${'1'.repeat(1000)}`), {
    isValid: false,
    error: 'Input is too long (maximum 1000 characters)',
  });
});

test('validateMathInput accepts maths the old script-pattern check rejected', () => {
  // The removed `/on\w+\s*=/i` "event handler" pattern matched the "on" inside
  // "constant", so this came back as "Invalid input detected".
  assert.deepEqual(validateMathInput('constant = 5'), { isValid: true, error: null });
  assert.deepEqual(validateMathInput('2*x + 5 = 11'), { isValid: true, error: null });
});

test('sanitizeInput removes null bytes and collapses whitespace', () => {
  assert.equal(sanitizeInput('  2x   +\n1\0  '), '2x + 1');
  assert.equal(sanitizeInput(null), '');
});

test('sanitizeInput leaves inequality operators intact', () => {
  // The removed HTML-tag pass deleted everything between a '<' and a later
  // '>', rewriting a valid inequality into a different, solvable problem.
  assert.equal(sanitizeInput('x < 5 and x > 1'), 'x < 5 and x > 1');
  assert.equal(sanitizeInput('x^2 - 4 > 0'), 'x^2 - 4 > 0');
  assert.equal(sanitizeInput('-3 < x < 5'), '-3 < x < 5');
});

test('validateTopic accepts supported topics and rejects unknown values', () => {
  assert.deepEqual(validateTopic('derivatives'), { isValid: true, error: null });
  assert.deepEqual(validateTopic('geometry'), {
    isValid: false,
    error: 'Invalid topic selected',
  });
});

test('validateProblemHistory requires the expected saved shape', () => {
  assert.deepEqual(
    validateProblemHistory({
      problem: 'x^2 + 3*x',
      topic: 'derivatives',
      solution: {
        steps: ['Differentiate each term'],
        answer: "f'(x) = 2*x + 3",
      },
    }),
    { isValid: true, error: null }
  );
});
