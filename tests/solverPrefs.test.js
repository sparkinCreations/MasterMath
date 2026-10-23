import test from 'node:test';
import assert from 'node:assert/strict';
import { readSolutionMode, writeSolutionMode, readLastTopic, writeLastTopic, expressionNudge } from '../src/lib/solverPrefs.js';
import { solveProblem } from '../src/lib/api.js';

const memory = () => { const d = {}; return { getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = String(v); }, d }; };

test('step-through is the default solution mode and the choice is remembered', () => {
  const s = memory();
  assert.equal(readSolutionMode(s), 'step');
  writeSolutionMode(s, 'all');
  assert.equal(readSolutionMode(s), 'all');
  writeSolutionMode(s, 'step');
  assert.equal(readSolutionMode(s), 'step');
  assert.equal(readSolutionMode(null), 'step');
  assert.equal(readSolutionMode({ getItem: () => { throw new Error('blocked'); } }), 'step');
});

test('the solver opens on the last topic used, else Auto-detect, and ignores junk', () => {
  const s = memory();
  assert.equal(readLastTopic(s), 'auto');
  writeLastTopic(s, 'integrals');
  assert.equal(readLastTopic(s), 'integrals');
  writeLastTopic(s, 'nonsense');
  assert.equal(readLastTopic(s), 'integrals');
  s.setItem('lastTopic', 'garbage');
  assert.equal(readLastTopic(s), 'auto');
  writeLastTopic(s, 'auto');
  assert.equal(readLastTopic(s), 'auto');
});

test('the bare-expression nudge fires for an expression under Algebra or Arithmetic and nowhere else', async () => {
  const solved = { status: 'solved' };
  assert.ok(expressionNudge('x^2 + 3x', 'algebra', solved));
  assert.ok(expressionNudge('sin(x)*e^x', 'other', solved));
  assert.deepEqual(expressionNudge('x^2', 'algebra', solved).options.map((o) => o.topic), ['derivatives', 'integrals', 'functions']);
  // Equations, inequalities, systems, calculus notation, verbs, numbers: no nudge.
  assert.equal(expressionNudge('2x + 5 = 11', 'algebra', solved), null);
  assert.equal(expressionNudge('x^2 - 4 > 0', 'algebra', solved), null);
  assert.equal(expressionNudge('2x + 3y = 6; x - y = 4', 'algebra', solved), null);
  assert.equal(expressionNudge('factor x^2 - 4', 'algebra', solved), null);
  assert.equal(expressionNudge('simplify 2x + 3x', 'algebra', solved), null);
  assert.equal(expressionNudge('∫ x^2 dx', 'algebra', solved), null);
  assert.equal(expressionNudge('d/dx(x^3)', 'algebra', solved), null);
  assert.equal(expressionNudge('(5 + 3) * 4', 'other', solved), null);
  assert.equal(expressionNudge('sin(pi/4)', 'other', solved), null);
  assert.equal(expressionNudge('x^2 + 3x', 'derivatives', solved), null);
  assert.equal(expressionNudge('x^2 + 3x', 'algebra', { status: 'solved', routedTopic: 'derivatives' }), null);
  assert.equal(expressionNudge('x^2 + 3x', 'algebra', { status: 'unsupported' }), null);
  // Against the real solver: the echoed expression gets the nudge, the equation does not.
  const echo = await solveProblem('x^2 + 3x', 'algebra');
  assert.ok(expressionNudge('x^2 + 3x', 'algebra', echo));
  const eq = await solveProblem('2x + 5 = 11', 'algebra');
  assert.equal(expressionNudge('2x + 5 = 11', 'algebra', eq), null);
});
