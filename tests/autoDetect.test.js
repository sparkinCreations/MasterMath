import test from 'node:test';
import assert from 'node:assert/strict';

import { detectTopic, solveProblem } from '../src/lib/api.js';
import { expressionNudge } from '../src/lib/solverPrefs.js';
import { validateTopic } from '../src/lib/validation.js';

// 1.53.0: Auto-detect, the default topic for a new visitor. The input's own
// signals decide; a bare expression is Algebra (simplified, factored where it
// can be) with the offer to differentiate, integrate or analyse it.

test('the topic is read from the input', () => {
  const cases = [
    ['d/dx x^3', 'derivatives'], ['derivative of x^3', 'derivatives'], ['∫_0^1 x^2 dx', 'integrals'],
    ['integral of 2x+1', 'integrals'], ['lim x->0 (sin(x)/x)', 'limits'],
    ['2*x + 5 = 11', 'algebra'], ['x^2 - 4 > 0', 'algebra'], ['2x + 3y = 6; x - y = 4', 'algebra'],
    ['factor x^2-5x+6', 'algebra'], ['expand (x+1)^2', 'algebra'], ['solve x^2 = 4', 'algebra'],
    ['simplify tan(x)*cos(x)', 'trigonometry'], ['sin(pi/4)', 'trigonometry'], ['sin x', 'trigonometry'],
    ['sin(x) = 1/2', 'trigonometry'], ['90°', 'trigonometry'],
    ['f(x) = x^2 - 4x + 3', 'functions'], ['y = x^2', 'functions'],
    // y on both sides is an equation, not a definition.
    ['y = 2y + 3', 'algebra'],
    ['(5 + 3) * 4 - 2^3', 'other'], ['2/0', 'other'], ['sqrt(16)', 'other'], ['3!', 'other'],
    // Words that say how to combine numbers are not variables.
    ['2 plus 1', 'other'], ['add 2 and 3', 'other'], ['what is 20% of 50', 'other'], ['10 divided by 4', 'other'],
    ['x^2 + 3x', 'algebra'], ['3 times x', 'algebra'], ['cost + 1', 'algebra'],
  ];
  for (const [p, topic] of cases) assert.equal(detectTopic(p).topic, topic, p);
  assert.equal(validateTopic('auto').isValid, true);
});

test('an auto-detected solve says what it detected, and files under that topic', async () => {
  const cases = [
    ['derivative of x^3', 'derivatives', 'Detected as Derivatives: your input uses derivative notation.', "f'(x) = 3x^2"],
    ['2x plus 3 equals 7', 'algebra', 'Detected as Algebra: your input is an equation.', 'x = 2'],
    ['two plus one', 'other', 'Detected as Arithmetic: your input is a calculation with numbers.', '3'],
    ['factor x^2-5x+6', 'algebra', 'Detected as Algebra: your input asks to factor it.', '(x - 3)(x - 2)'],
    ['y = 2y + 3', 'algebra', 'Detected as Algebra: your input is an equation.', 'y = -3'],
    ['x^2 + 3x', 'algebra', null, 'x^2 + 3x = x(x + 3)'],
  ];
  for (const [p, topic, first, answer] of cases) {
    const r = await solveProblem(p, 'auto');
    assert.equal(r.status, 'solved', `${p}: ${r.answer}`);
    assert.equal(r.routedTopic, topic, p);
    assert.equal(r.routing.from, 'auto', p);
    assert.equal(r.routing.to, topic, p);
    assert.match(r.steps[0], /^Detected as /, p);
    if (first) assert.equal(r.steps[0], first, p);
    assert.equal(r.answer, answer, p);
    // Exactly one notice: a solver's own routing line is replaced, not stacked.
    assert.equal(r.steps.filter((s) => /^(?:Detected|Solved) as /.test(s)).length, 1, p);
  }
});

test('a constant that divides by zero is detected as Arithmetic and stays undefined', async () => {
  const r = await solveProblem('2/0', 'auto');
  assert.equal(r.status, 'undefined');
  assert.equal(r.routedTopic, 'other');
});

test('a parse error under Auto-detect carries no "Detected as" notice', async () => {
  const r = await solveProblem('cost + 1', 'auto');
  assert.equal(r.status, 'parse_error');
  assert.equal(r.routing, undefined);
  assert.ok(!r.steps.some((s) => /^Detected as /.test(s)));
});

test('the bare-expression nudge appears under Auto-detect for an expression, and not for a detected topic', async () => {
  const expression = await solveProblem('x^2 + 3x', 'auto');
  assert.ok(expressionNudge('x^2 + 3x', 'auto', expression));
  const derivative = await solveProblem('derivative of x^3', 'auto');
  assert.equal(expressionNudge('derivative of x^3', 'auto', derivative), null);
  const trig = await solveProblem('sin(pi/4)', 'auto');
  assert.equal(expressionNudge('sin(pi/4)', 'auto', trig), null);
});
