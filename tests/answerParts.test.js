import test from 'node:test';
import assert from 'node:assert/strict';
import { answerParts } from '../src/lib/answerParts.js';

test('a Functions answer: the function as the heading, one fact per line', () => {
  const r = answerParts('f(x) = x^2 - 4x + 3: domain: all real numbers; range: y ≥ -1; y-intercept (0, 3); x-intercepts at x = 1, 3; vertex (2, -1) (minimum), axis x = 2.');
  assert.equal(r.heading, 'f(x) = x^2 - 4x + 3');
  assert.deepEqual(r.parts, ['domain: all real numbers', 'range: y ≥ -1', 'y-intercept (0, 3)', 'x-intercepts at x = 1, 3', 'vertex (2, -1) (minimum), axis x = 2']);
});

test('a quotient in the heading keeps its colon-free parts', () => {
  const r = answerParts('f(x) = (x^2 - 1)/(x - 1): domain: x ≠ 1; y-intercept (0, 1); x-intercept at x = -1; hole at (1, 2).');
  assert.equal(r.heading, 'f(x) = (x^2 - 1)/(x - 1)');
  assert.equal(r.parts.length, 4);
  assert.equal(r.parts[3], 'hole at (1, 2)');
});

test('a trig answer: the general solution, then the solutions on one period', () => {
  const r = answerParts('x = π/6 + 2πn  or  x = 5π/6 + 2πn (n ∈ ℤ);  on [0, 2π): π/6, 5π/6');
  assert.equal(r.heading, null);
  assert.deepEqual(r.parts, ['x = π/6 + 2πn  or  x = 5π/6 + 2πn (n ∈ ℤ)', 'on [0, 2π): π/6, 5π/6']);
});

test('a semicolon inside brackets does not split; one part stays as it is', () => {
  assert.deepEqual(answerParts('x = 1  or  x = 2'), { heading: null, parts: ['x = 1  or  x = 2'] });
  assert.deepEqual(answerParts('{1; 2; 3}'), { heading: null, parts: ['{1; 2; 3}'] });
  assert.deepEqual(answerParts('f(x) = 2x: done.'), { heading: null, parts: ['f(x) = 2x: done.'] });
  assert.deepEqual(answerParts(''), { heading: null, parts: [''] });
});

test('a part splits into a capitalised label and a value typeset on its own', async () => {
  const { labelledPart } = await import('../src/lib/answerParts.js');
  assert.deepEqual(labelledPart('domain: x ≠ 2'), { label: 'Domain', value: 'x ≠ 2' });
  assert.deepEqual(labelledPart('on [0, 2π): π/6, 5π/6'), { label: 'On [0, 2π)', value: 'π/6, 5π/6' });
  assert.deepEqual(labelledPart('vertical asymptote x = 2'), { label: null, value: 'Vertical asymptote x = 2' });
  assert.deepEqual(labelledPart('x-intercepts at x = 1, 3'), { label: null, value: 'x-intercepts at x = 1, 3' });
  assert.deepEqual(labelledPart('no x-intercepts'), { label: null, value: 'No x-intercepts' });
  // An equation is never a label.
  assert.deepEqual(labelledPart('x = 1: double root'), { label: null, value: 'x = 1: double root' });
});
