// The solution-envelope contract (docs/future-work/MATH-STATE-SEMANTICS.md,
// Component 1): every result that leaves solveProblem() carries a valid
// typed `status`, green is reserved for real solves, and failure results
// say what actually went wrong instead of announcing success.
//
// The failing inputs below are the July 2026 black-box review's cases
// (D7, I7, T10, F7, I5, M1, M2) turned into permanent regressions.

import test from 'node:test';
import assert from 'node:assert/strict';

import { solveProblem } from '../src/lib/api.js';
import {
  STATUS,
  ALL_STATUSES,
  isValidStatus,
  isFailureStatus,
  statusLabel,
  solved,
  parseError,
  unsupported,
  undefinedValue,
  indeterminate,
  overflow,
} from '../src/lib/solutionEnvelope.js';

// --- constructor contract ----------------------------------------------------

test('every constructor produces its own valid status', () => {
  assert.equal(solved({ answer: '4', steps: ['2+2'] }).status, STATUS.SOLVED);
  assert.equal(parseError({ input: '(2+3' }).status, STATUS.PARSE_ERROR);
  assert.equal(unsupported({ input: 'sin(x^2)' }).status, STATUS.UNSUPPORTED);
  assert.equal(undefinedValue({ input: '1/0' }).status, STATUS.UNDEFINED);
  assert.equal(indeterminate({ input: '0/0', form: '0/0' }).status, STATUS.INDETERMINATE);
  assert.equal(overflow({ input: '1e308*10' }).status, STATUS.OVERFLOW);
  for (const status of ALL_STATUSES) {
    assert.ok(isValidStatus(status));
    assert.ok(statusLabel(status).length > 0);
  }
});

test('solved() refuses to exist without an answer', () => {
  assert.throws(() => solved({ steps: ['no answer here'] }));
});

test('parseError carries the specific hint, not generic advice', () => {
  const result = parseError({ input: '(2+3', hint: 'Unmatched opening parenthesis.' });
  assert.match(result.steps.join(' '), /Unmatched opening parenthesis/);
  assert.match(result.answer, /Unmatched opening parenthesis/);
});

test('unsupported never blames formatting', () => {
  const result = unsupported({ input: 'sin(x^2)' });
  const text = [result.answer, ...result.steps, ...result.tips].join(' ').toLowerCase();
  assert.ok(!text.includes('formatting'), 'unsupported must not mention formatting');
  assert.ok(!text.includes('check your'), 'unsupported must not tell the user to check input');
});

// --- pipeline contract: every result leaving solveProblem has a status -------

const CONTRACT_CASES = [
  // [problem, topic, expected status]
  ['2 + 2', 'other', STATUS.SOLVED],
  ['(5 + 3) * 4 - 2^3', 'other', STATUS.SOLVED],
  ['x^2 + 3*x', 'derivatives', STATUS.SOLVED],
  ['2*x + 1', 'integrals', STATUS.SOLVED],
  ['lim x->0 (sin(x)/x)', 'limits', STATUS.SOLVED],
  ['sin(pi/4)', 'trigonometry', STATUS.SOLVED],
  ['2*x + 5 = 11', 'algebra', STATUS.SOLVED],
  ['x^2 - 4*x + 3', 'functions', STATUS.SOLVED],

  // Review D7: derivative of x^^2 announced "Problem solved successfully!"
  ['x^^2', 'derivatives', STATUS.PARSE_ERROR],
  // Review I7: same input under Integrals
  ['x^^2', 'integrals', STATUS.PARSE_ERROR],
  // Review F7: Functions echoed f(x)=x^^2 with a success state
  ['x^^2', 'functions', STATUS.PARSE_ERROR],
  // Review T10: sin() with no argument
  ['sin()', 'trigonometry', STATUS.PARSE_ERROR],
  // Cousin of review #14: unreadable input under Limits used to sample NaN
  // everywhere and claim "the one-sided limits disagree" as a solved DNE
  ['x^^2', 'limits', STATUS.PARSE_ERROR],
  // Review M2: unmatched parenthesis
  ['(2+3', 'other', STATUS.PARSE_ERROR],
  // Review M1: unknown symbol
  ['abc', 'other', STATUS.PARSE_ERROR],
];

for (const [problem, topic, expected] of CONTRACT_CASES) {
  test(`solveProblem(${JSON.stringify(problem)}, ${topic}) → ${expected}`, async () => {
    const result = await solveProblem(problem, topic);
    assert.ok(isValidStatus(result.status), `invalid status: ${result.status}`);
    assert.equal(result.status, expected);
    // Structural invariants regardless of outcome.
    assert.ok(Array.isArray(result.steps));
    assert.ok(result.answer);
    assert.ok(Array.isArray(result.tips));
    assert.ok(Array.isArray(result.common_mistakes));
  });
}

// Review I5: sin(x^2) is VALID input with a non-elementary antiderivative.
// It must be unsupported (not a parse error) and must name the honest reason.
test('integral of sin(x^2) is unsupported with the Fresnel explanation', async () => {
  const result = await solveProblem('sin(x^2)', 'integrals');
  assert.equal(result.status, STATUS.UNSUPPORTED);
  assert.match(result.answer + result.steps.join(' '), /Fresnel/i);
  const text = [result.answer, ...result.steps, ...result.tips].join(' ').toLowerCase();
  assert.ok(!text.includes('formatting'), 'valid input must not be blamed on formatting');
});

// Improper definite integrals refuse with an honest unsupported status.
test('definite integral across a discontinuity is unsupported, not solved', async () => {
  const result = await solveProblem('∫_-1^1 1/x dx', 'integrals');
  assert.ok(isFailureStatus(result.status), `got status: ${result.status}`);
  assert.equal(result.status, STATUS.UNSUPPORTED);
});

// Systems and inequalities refusals carry statuses too.
test('three-equation system refuses as unsupported', async () => {
  const result = await solveProblem('x + y = 1; x - y = 2; 2x + y = 3', 'algebra');
  assert.equal(result.status, STATUS.UNSUPPORTED);
});

test('compound inequality refuses with a failure status', async () => {
  const result = await solveProblem('1 < x < 5', 'algebra');
  assert.ok(isFailureStatus(result.status), `got status: ${result.status}`);
});
