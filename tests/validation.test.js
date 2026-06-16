import test from 'node:test';
import assert from 'node:assert/strict';

import {
  sanitizeInput,
  validateMathInput,
  validateProblemHistory,
  validateTopic,
} from '../src/lib/validation.js';

test('validateMathInput rejects empty input and script payloads', () => {
  assert.deepEqual(validateMathInput(''), {
    isValid: false,
    error: 'Please enter a math problem',
  });
  assert.deepEqual(validateMathInput('<script>alert(1)</script>'), {
    isValid: false,
    error: 'Invalid input detected',
  });
});

test('sanitizeInput strips tags, null bytes, and extra whitespace', () => {
  assert.equal(sanitizeInput('  <b>2x + 1</b>\0  '), '2x + 1');
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
