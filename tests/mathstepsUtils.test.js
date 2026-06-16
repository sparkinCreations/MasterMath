import test from 'node:test';
import assert from 'node:assert/strict';

import { stepsFromMathstepsResult, formatMathstepsEquation } from '../src/lib/mathstepsUtils.js';

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
