import test from 'node:test';
import assert from 'node:assert/strict';

import { solveProblem } from '../src/lib/api.js';
import { readCorrect, checkAnswer, practiceKind } from '../src/lib/practice/check.js';
import { practiceCandidate, candidateText, literalRemap, rootRebuild, answerFeatures, POOL_SIZE, MAX_CANDIDATES } from '../src/lib/practice/generate.js';
import { practicable } from '../src/lib/practice/tasks.js';

// Practice mode (1.70.0; docs/future-work/PLAN-PRACTICE-MODE.md).

const correctFor = async (problem, topic = 'auto') => readCorrect(await solveProblem(problem, topic), topic, problem);
const verdicts = (correct, problem, answers) => answers.map((a) => checkAnswer(correct, a, { problem }).verdict);

// The set, as the page builds it: candidates in order, new ones kept.
async function practiceSet(problem, topic = 'auto') {
  const set = [];
  for (let index = 0; index < MAX_CANDIDATES && set.length < POOL_SIZE; index += 1) {
    const r = await practiceCandidate({ problem, topic, index });
    if (!r.practicable) return null;
    if (r.item && !set.some((s) => s.problem === r.item.problem) && r.item.problem !== problem) set.push(r.item);
  }
  return set;
}

test('which answers practice can check, and which it cannot', async () => {
  for (const [p, t, kind] of [
    ['3/4+5/6', 'auto', 'number'], ['x^2-5x+6=0', 'auto', 'solutions'], ['2x^2-3x-2=0', 'algebra', 'solutions'],
    ['d/dx sin(3x^2)', 'auto', 'derivative'], ['x^3 at x = 2', 'derivatives', 'number'], ['∫ x^2 dx', 'auto', 'antiderivative'],
    ['∫_0^1 x^2 dx', 'auto', 'number'], ['lim x->2 (x^2-4)/(x-2)', 'auto', 'number'],
    // Every topic since the widening: values, sets, systems, zeros.
    ['sin(pi/4)', 'trigonometry', 'number'], ['sin(x) = 1/2', 'trigonometry', 'solutions'], ['x^2 - 4 > 0', 'auto', 'intervals'],
    ['x^2 + 1 > 0', 'algebra', 'intervals'], ['2x + 3y = 6; x - y = 4', 'auto', 'system'], ['xy = 6; x + y = 5', 'algebra', 'system'],
    ['x^2 - 4x + 3', 'functions', 'solutions'], ['x^2 + 1', 'functions', 'solutions'],
  ]) {
    assert.equal(practiceKind(await solveProblem(p, t), t, p)?.kind, kind, p);
  }
  // Not checkable from the problem alone, or not one answer: no button.
  for (const [p, t] of [['factor x^2-9', 'auto'], ['simplify 3(x-2)+4', 'auto'], ['sin(x)^2 + cos(x)^2', 'trigonometry'], ['sin(2x)', 'functions'], ['sin(x) = 2', 'trigonometry'], ['lim x->0 1/x', 'auto'], ['hello', 'auto']]) {
    assert.equal(practicable(await solveProblem(p, t), t, p), false, p);
  }
});

test('an answer is checked by its value, in any form a student types', async () => {
  const frac = await correctFor('3/4+5/6');
  assert.deepEqual(verdicts(frac, '3/4+5/6', ['19/12', '1.58', '1.5833', '38/24', '1.6', '2', 'nonsense', '']), ['correct', 'correct', 'correct', 'correct', 'close', 'wrong', 'unreadable', 'empty']);

  const quad = await correctFor('x^2-5x+6=0');
  assert.deepEqual(verdicts(quad, 'x^2-5x+6=0', ['2, 3', '3,2', 'x = 3 or x = 2', 'x=2 and x=3', '2', '2, 3, 4']), ['correct', 'correct', 'correct', 'correct', 'partial', 'wrong']);
  assert.equal(checkAnswer(quad, '4', { problem: 'x^2-5x+6=0' }).message, 'x = 4 does not satisfy the equation: there the left side is 2 and the right side is 0.');
  assert.equal(checkAnswer(quad, '2', { problem: 'x^2-5x+6=0' }).message, 'That one is right, but there is one more solution.');

  const golden = await correctFor('x^2+x-1=0');
  assert.deepEqual(verdicts(golden, 'x^2+x-1=0', ['(-1+√5)/2, (-1-√5)/2', '(-1+sqrt(5))/2, (-1-sqrt(5))/2', '0.618, -1.618', '0.6, -1.6']), ['correct', 'correct', 'correct', 'close']);

  const chain = await correctFor('d/dx sin(3x^2)');
  assert.deepEqual(verdicts(chain, '', ['6x cos(3x^2)', "f'(x) = cos(3x^2)*6x", '6*x*cos(3*x^2)', 'cos(3x^2)', '6y cos(3y^2)']), ['correct', 'correct', 'correct', 'wrong', 'unreadable']);
  assert.match(checkAnswer(chain, 'cos(3x^2)').message, /^Not quite: at x = 0\.37 yours gives 0\.9168, but the derivative is 2\.0354\.$/);

  // An antiderivative: any constant of integration, and log is base 10.
  const ln = await correctFor('∫ 1/x dx');
  assert.deepEqual(verdicts(ln, '', ['ln|x|', 'ln(x) + C', 'ln|x| + 7', 'log(x)', 'x^-2']), ['correct', 'correct', 'correct', 'close', 'wrong']);
  assert.equal(checkAnswer(ln, 'ln|x|').message, 'Correct ✓ (remember the + C)');
  assert.equal(checkAnswer(ln, 'ln|x| + C').message, 'Correct ✓');
  assert.equal(checkAnswer(ln, 'log(x)').message, 'Nearly: in MasterMath log(…) means base 10. For the natural logarithm write ln(…).');
  const parts = await correctFor('∫ x*e^x dx');
  assert.match(checkAnswer(parts, 'e^x(x+1)').message, /^Not quite: differentiate yours and compare\. At x = 0\.37 its derivative is/);

  const exact = await correctFor('2^x=10');
  assert.deepEqual(verdicts(exact, '2^x=10', ['ln(10)/ln(2)', '3.32', 'log2(10)', '3']), ['correct', 'correct', 'correct', 'wrong']);
});

test('trig values and equations, inequalities, systems and x-intercepts are checked by value', async () => {
  const value = await correctFor('sin(pi/4)', 'trigonometry');
  assert.deepEqual(verdicts(value, '', ['√2/2', '1/√2', 'sqrt(2)/2', '0.71', '0.7']), ['correct', 'correct', 'correct', 'correct', 'close']);

  const trig = await correctFor('sin(x) = 1/2', 'trigonometry');
  assert.equal(trig.prompt, 'Give every solution in [0, 2π).');
  assert.deepEqual(verdicts(trig, 'sin(x) = 1/2', ['π/6, 5π/6', 'pi/6, 5pi/6', '0.52, 2.62', 'π/6', 'π/3, 5π/6']), ['correct', 'correct', 'correct', 'partial', 'wrong']);
  assert.equal(checkAnswer(trig, '30, 150').message, 'Those are the right angles in degrees; give them in radians (π/6, not 30).');
  assert.equal(checkAnswer(trig, 'π/3, 5π/6').message, 'x = π/3 does not satisfy the equation: there the left side is 0.866 and the right side is 0.5.');

  const set = await correctFor('x^2 - 4 > 0', 'algebra');
  assert.deepEqual(verdicts(set, '', ['x < -2 or x > 2', '(-∞, -2) ∪ (2, ∞)', '(-inf,-2) U (2,inf)', 'x <= -2 or x >= 2', 'x > 2']), ['correct', 'correct', 'correct', 'close', 'wrong']);
  assert.equal(checkAnswer(set, 'x > 2').message, 'x = -3 satisfies the inequality, but your answer leaves it out.');
  assert.equal(checkAnswer(set, 'x <= -2 or x >= 2').message, 'x = -2 is in your answer, but it does not satisfy the inequality. Check whether each endpoint is included.');
  const closed = await correctFor('abs(x-1) <= 3', 'algebra');
  assert.deepEqual(verdicts(closed, '', ['-2 ≤ x ≤ 4', '[-2, 4]', '(-2, 4)', '[-2, 5]']), ['correct', 'correct', 'close', 'wrong']);
  assert.deepEqual(verdicts(await correctFor('x^2 + 1 > 0', 'algebra'), '', ['all real numbers', '(-∞, ∞)', 'x > 0']), ['correct', 'correct', 'wrong']);
  const empty = await correctFor('x^2 < 0', 'algebra');
  assert.deepEqual(verdicts(empty, '', ['none', 'no solution', 'x < 0']), ['correct', 'correct', 'wrong']);
  assert.equal(checkAnswer(empty, 'x < 0').message, 'x = -1 is in your answer, but it does not satisfy the inequality.');

  const linear = await correctFor('2x + 3y = 6; x - y = 4', 'algebra');
  assert.deepEqual(verdicts(linear, '', ['x = 18/5, y = -2/5', '(18/5, -2/5)', '(3.6, -0.4)', 'y = -0.4, x = 3.6', '(4, 0)']), ['correct', 'correct', 'correct', 'correct', 'wrong']);
  assert.equal(checkAnswer(linear, '(4, 0)').message, '(4, 0) does not satisfy the first equation: there the left side is 8 and the right side is 6.');
  const two = await correctFor('xy = 6; x + y = 5', 'algebra');
  assert.deepEqual(verdicts(two, '', ['(2, 3) or (3, 2)', '(3,2),(2,3)', 'x = 2, y = 3 or x = 3, y = 2', '(2, 3)', '(1, 6)']), ['correct', 'correct', 'correct', 'partial', 'wrong']);

  const zeros = await correctFor('x^2 - 4*x + 3', 'functions');
  assert.equal(zeros.prompt, 'Give every x-intercept (zero). Type none if there is none.');
  assert.deepEqual(verdicts(zeros, '', ['1, 3', 'x = 1 or x = 3', '1', '2', 'none']), ['correct', 'correct', 'partial', 'wrong', 'wrong']);
  assert.equal(checkAnswer(zeros, '2').message, 'x = 2 is not an x-intercept: f(2) = -1, not 0.');
  assert.equal(checkAnswer(zeros, '1').message, 'That one is right, but there is one more x-intercept.');
  assert.deepEqual(verdicts(await correctFor('x^2 + 1', 'functions'), '', ['none', 'no x-intercepts', '1']), ['correct', 'correct', 'wrong']);
});

test('variations keep exponents and 0, keep squares with their roots, and are the same every time', () => {
  const rng = () => 0.42;
  assert.equal(literalRemap('x^2 + 3x = 0', rng)?.includes('x^2'), true);
  assert.match(literalRemap('lim x->2 (x^2-4)/(x-2)', () => 0.5), /^lim x->(\d+) \(x\^2-(\d+)\)\/\(x-\1\)$/);
  const lim = literalRemap('lim x->2 (x^2-4)/(x-2)', () => 0.5).match(/^lim x->(\d+) \(x\^2-(\d+)\)\/\(x-\1\)$/);
  assert.equal(Number(lim[2]), Number(lim[1]) ** 2);
  assert.equal(literalRemap('lim x->0 sin(3x)/x', () => 0.5).startsWith('lim x->0 '), true);
  // Bounds of a definite integral change; its exponent does not.
  assert.match(literalRemap('∫_0^1 x^2 dx', () => 0.9), /^∫_0\^\d+ x\^2 dx$/);
  // Root rebuild keeps a quadratic factorable, in standard form.
  assert.equal(rootRebuild('x^2-5x+6=0', () => 0.5, { kind: 'solutions', variable: 'x', values: [2, 3] }), 'x^2 - 11x + 30 = 0'); // roots 5 and 6
  // Deterministic: candidate i is the same text on every run.
  assert.equal(candidateText('2x+5=11', 'algebra', 3, null), candidateText('2x+5=11', 'algebra', 3, null));
  assert.deepEqual([...answerFeatures('x = (-1 - √5)/2  or  x = (-1 + √5)/2')].sort(), ['fraction', 'root']);
  assert.ok(answerFeatures('∫(1/(x^4 - 1)) dx = 1/4*ln|x - 1| - 1/2*arctan(x) + C').has('fn:arctan'));
  assert.ok(answerFeatures('-168', 'number').has('negative'));
});

test('every practice problem is the same kind, solved, and accepted with its own answer', async () => {
  const sets = {
    'x^2-5x+6=0': ['x^2 - 11x + 28 = 0', 'x^2-10x+9=0', 'x^2 - 10x + 24 = 0', 'x^2 - 14x + 45 = 0', 'x^2 - 12x + 35 = 0'],
    'd/dx x^3': ['d/dx x^4', 'd/dx x^2', 'd/dx x^6', 'd/dx x^7', 'd/dx 7x^3'],
    'lim x->0 sin(3x)/x': ['lim x->0 sin(9x)/x', 'lim x->0 sin(4x)/x', 'lim x->0 sin(7x)/x', 'lim x->0 sin(2x)/x', 'lim x->0 sin(6x)/x'],
  };
  for (const [problem, expected] of Object.entries(sets)) {
    const set = await practiceSet(problem);
    assert.deepEqual(set.map((s) => s.problem), expected, problem);
  }
  for (const problem of ['3/4+5/6', '2x+5=11', 'x^2 = 9', '∫ x^2 dx', '∫ x*e^x dx', '∫_0^1 x^2 dx', 'lim x->inf (3x^2+1)/(2x^2-5)']) {
    const original = await solveProblem(problem, 'auto');
    const set = await practiceSet(problem);
    assert.ok(set.length >= 3, `${problem}: ${set.length}`);
    for (const item of set) {
      assert.equal(item.result.status, 'solved', item.problem);
      assert.equal(item.result.tips[0], original.tips[0], `${item.problem}: the same method`);
      // The engine's own answer, typed back, is right.
      const c = item.correct;
      const typed = c.kind === 'solutions' ? c.values.join(', ') : c.kind === 'number' ? String(c.value) : c.shown;
      assert.equal(checkAnswer(c, typed, { problem: item.problem }).verdict, 'correct', `${item.problem}: ${typed}`);
    }
  }
});

// The example buttons under the problem box: each that offers practice has
// a set to practise. lim x → 0 sin(x)/x offered the button and then had
// none: its only number is the 0 it approaches (a number inside the sine
// since 1.70.0).
test('every example that offers practice has problems to practise', async () => {
  const examples = [
    ['other', '(5 + 3) * 4 - 2^3', 5], ['algebra', '2*x + 5 = 11', 4], ['trigonometry', 'sin(pi/4)', 3], ['algebra', 'x^2 - 4 > 0', 5],
    ['functions', 'x^2 - 4*x + 3', 5], ['algebra', '2x + 3y = 6; x - y = 4', 5], ['trigonometry', 'sin(x) = 1/2', 4],
    ['derivatives', 'x^2 + 3*x', 5], ['integrals', '2*x + 1', 5], ['limits', 'lim x->0 (sin(x)/x)', 5], ['integrals', '∫_0^1 x^2 dx', 5],
  ];
  for (const [topic, problem, size] of examples) {
    assert.ok(practicable(await solveProblem(problem, topic), topic, problem), problem);
    const set = await practiceSet(problem, topic);
    assert.equal(set.length, size, problem);
    // Each one's own answer, typed back, is right.
    for (const item of set) {
      const c = item.correct;
      const typed = c.kind === 'solutions' ? (c.values.length ? c.values.join(', ') : 'none')
        : c.kind === 'number' ? String(c.value)
          : c.kind === 'intervals' ? c.intervals.map((i) => `${i.loClosed ? '[' : '('}${Number.isFinite(i.lo) ? i.lo : '-∞'}, ${Number.isFinite(i.hi) ? i.hi : '∞'}${i.hiClosed ? ']' : ')'}`).join(' ∪ ') || 'none'
            : c.kind === 'system' ? c.solutions.map((row) => `(${row.join(', ')})`).join(' or ') : c.shown;
      assert.equal(checkAnswer(c, typed, { problem: item.problem }).verdict, 'correct', `${item.problem}: ${typed}`);
    }
  }
  assert.deepEqual((await practiceSet('lim x->0 (sin(x)/x)', 'limits')).slice(0, 2).map((s) => s.problem), ['lim x->0 (sin(7x)/x)', 'lim x->0 (sin(5x)/x)']);
});

test('no set for a problem practice cannot check', async () => {
  assert.equal(await practiceSet('factor x^2-9'), null);
  assert.equal((await practiceCandidate({ problem: 'sin(2x)', topic: 'functions', index: 0 })).practicable, false);
});
