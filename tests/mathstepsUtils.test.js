import test from 'node:test';
import assert from 'node:assert/strict';

import {
  stepsFromMathstepsResult,
  formatMathstepsEquation,
  humanizeChangeType,
} from '../src/lib/mathstepsUtils.js';

test('humanizeChangeType maps known change types to plain English', () => {
  assert.equal(humanizeChangeType('SUBTRACT_FROM_BOTH_SIDES'), 'Subtract from both sides');
  assert.equal(humanizeChangeType('FACTOR_SUM_PRODUCT_RULE'), 'Factor using the sum-product method');
  // Unknown types fall back to a readable, de-underscored form.
  assert.equal(humanizeChangeType('SOME_NEW_RULE'), 'some new rule');
});

test('formatMathstepsEquation cleans up spaced implicit multiplication', () => {
  const equation = {
    leftNode: { toString: () => '2 x' },
    rightNode: { toString: () => '6' },
  };
  assert.equal(formatMathstepsEquation(equation), '2x = 6');
});

test('stepsFromMathstepsResult formats mathsteps arrays correctly', () => {
  const mockSteps = [
    {
      changeType: 'SUBTRACT_FROM_BOTH_SIDES',
      newEquation: {
        leftNode: { toString: () => '2 x' },
        rightNode: { toString: () => '6' },
      },
    },
    {
      changeType: 'DIVIDE_FROM_BOTH_SIDES',
      newEquation: {
        leftNode: { toString: () => 'x' },
        rightNode: { toString: () => '3' },
      },
    },
  ];

  const parsed = stepsFromMathstepsResult(mockSteps);

  assert.ok(parsed.steps.length === 2);
  assert.match(parsed.steps[0], /subtract from both sides/i);
  assert.equal(parsed.answer, 'x = 3');
});

test('formatMathstepsEquation renders left and right sides', () => {
  const equation = {
    leftNode: { toString: () => 'x' },
    rightNode: { toString: () => '3' },
  };

  assert.equal(formatMathstepsEquation(equation), 'x = 3');
});
