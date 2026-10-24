import test from 'node:test';
import assert from 'node:assert/strict';

import { solveProblem } from '../src/lib/api.js';
import { collapseRepeats, problemKey } from '../src/lib/problemHistory.js';
import { solvePlain } from './helpers/solvePlain.js';

// 1.54.0: the October 2026 deeper review. Exact roots, logarithms in their
// own notation, tips by method, word problems refused as such, one history
// entry per problem.

test('a root of a whole number is given in simplest radical form', async () => {
  for (const [p, answer] of [
    ['sqrt(50)', '5√2 (≈ 7.0711)'], // was 7.0711, beside a tip to pull out perfect squares
    ['√50', '5√2 (≈ 7.0711)'], ['sqrt(3+5)', '2√2 (≈ 2.8284)'], ['cbrt(54)', '3∛2 (≈ 3.7798)'],
    ['sqrt(2)', '√2 (≈ 1.4142)'], ['5^(1/2)', '√5 (≈ 2.2361)'], ['sqrt(49)', '7'],
  ]) {
    assert.equal((await solveProblem(p, 'other')).answer, answer, p);
  }
  const r = await solvePlain('sqrt(50)', 'other');
  assert.ok(r.steps.includes('Simplify the root: pull out the largest perfect square factor, 50 = 25 × 2, so √50 = √25·√2 = 5√2.'), r.steps.join(' | '));
});

test('a logarithm is worked in the notation typed, as the power it asks for', async () => {
  // The steps showed "(log(8)/log(10))" and "log(8) = 2.0794": the natural
  // log under a base-10 name, over the parser's internal rewrite.
  const r = await solvePlain('log(8)', 'other');
  assert.equal(r.answer, '0.9031');
  assert.equal(r.steps[0], 'Evaluate: log(8)');
  assert.equal(r.steps[1], 'log(8) asks for the power of 10 that gives 8: 10^0.9031 ≈ 8, so log(8) ≈ 0.9031.');
  assert.doesNotMatch(r.steps.join('\n'), /2\.0794|log\(10\)/);
  // An exact logarithm says why: 2^3 = 8.
  const b = await solvePlain('log(8,2)', 'other');
  assert.equal(b.answer, '3');
  assert.equal(b.steps[1], 'log_2(8) asks for the power of 2 that gives 8: 2^3 = 8, so log_2(8) = 3.');
  assert.equal((await solveProblem('log(4, 8)', 'other')).answer, '2/3 (≈ 0.6667)');
  assert.equal((await solveProblem('log(0.01)', 'other')).answer, '-2');
  // A base with no exact answer: the change of base, in ln.
  assert.match((await solvePlain('log(10, 2)', 'other')).steps[1], /change of base: log_2\(10\) = ln\(10\)\/ln\(2\) = 2\.3026\/0\.6931 ≈ 3\.3219/);
  assert.match((await solvePlain('ln(8)', 'other')).steps[1], /^ln\(8\) asks for the power of e that gives 8/);
});

test('tips follow the method: logarithms, cancelling a factor', async () => {
  for (const p of ['log(8)', 'ln(8)', 'log(8,2)']) {
    const r = await solvePlain(p, 'other');
    assert.ok(r.tips.some((t) => /asks for the power of b that gives a/.test(t)), p);
    assert.doesNotMatch(r.tips.join('\n'), /PEMDAS/, p);
  }
  const c = await solvePlain('(x^2-1)/(x-1)', 'algebra');
  assert.match(c.tips[0], /Factor the numerator and the denominator completely/);
  assert.doesNotMatch([...c.tips, ...c.common_mistakes].join('\n'), /like terms/);
  // The cancellation is shown, not just named.
  assert.deepEqual(c.steps.slice(1, 4), ['Factor the numerator: x^2 - 1 = (x - 1)(x + 1).', 'The denominator x - 1 is already factored.', 'Cancel the common factor (x - 1) from the top and the bottom.']);
  assert.match((await solvePlain('(x^3-x)/(x^2-1)', 'algebra')).steps.join('\n'), /Cancel the common factors \(x - 1\)\(x \+ 1\)/);
  // A polynomial keeps the like-terms advice.
  assert.match((await solvePlain('3(x-2)+4', 'algebra')).tips[0], /collect like terms/);
});

test('a word problem is refused as one', async () => {
  // Its words were glued together: "itsspeed" is not a known function.
  for (const p of ['A train travels 120 miles in 2 hours. What is its speed?', 'John has 5 apples and gives away 2. How many are left?', 'If a rectangle has length 5 and width 3, what is its area?']) {
    for (const topic of ['auto', 'algebra', 'other']) {
      const r = await solveProblem(p, topic);
      assert.equal(r.status, 'unsupported', `${p} {${topic}}`);
      assert.equal(r.answer, 'Word problems are not supported');
    }
  }
  // Maths in words still solves.
  for (const [p, topic, answer] of [
    ['find the second derivative of x^3', 'auto', "f''(x) = 6x"], ['what is 20% of 50', 'auto', '10'], ['two plus one', 'auto', '3'],
    ['solve for x: 2x + 5 = 11', 'auto', 'x = 3'], ['find dy/dx if x^2 + y^2 = 25', 'auto', 'dy/dx = -x/y'],
  ]) {
    assert.equal((await solveProblem(p, topic)).answer, answer, p);
  }
  // One unknown word is still named as such.
  assert.match((await solveProblem('x apples > 2', 'algebra')).answer, /^"apples" is not a known function/);
});

test('"area under the curve" is the definite integral, with the net-area caveat', async () => {
  const r = await solveProblem('area under the curve x^2 from 0 to 1', 'auto');
  assert.equal(r.answer, '∫_0^1 (x^2) dx = 1/3 (≈ 0.3333)');
  assert.match(r.tips[0], /net area/);
  assert.equal((await solveProblem('find the area under y = x^2 from 0 to 2', 'algebra')).answer, '∫_0^2 (x^2) dx = 8/3 (≈ 2.6667)');
});

test('history keeps one entry per problem, counting the solves', () => {
  const at = (d) => `2026-10-${d}T10:00:00.000Z`;
  const rows = [
    { id: 5, problem: '2x + 5 = 11', topic: 'algebra', createdAt: at(24), solution: { answer: 'x = 3' } },
    { id: 4, problem: 'sqrt(50)', topic: 'other', createdAt: at(23), solution: { answer: '5√2' } },
    { id: 3, problem: '2x+5=11', topic: 'algebra', createdAt: at(22), solution: { answer: 'x = 3' } }, // spacing aside, the same problem
    { id: 2, problem: '2x + 5 = 11', topic: 'other', createdAt: at(21), solution: { answer: 'x = 3' } }, // another topic: its own entry
    { id: 1, problem: '2x + 5 = 11', topic: 'algebra', createdAt: at(20), solveCount: 2, solution: { answer: 'x = 3' } },
  ];
  const merged = collapseRepeats(rows);
  assert.deepEqual(merged.map((p) => p.id), [5, 4, 2]);
  assert.equal(merged[0].solveCount, 4);
  assert.equal(merged[0].firstSolvedAt, at(20));
  assert.equal(merged[1].solveCount, 1);
  assert.equal(problemKey(rows[0]), problemKey(rows[2]));
  assert.notEqual(problemKey(rows[0]), problemKey(rows[3]));
});

test('found in the sweep: request phrases around the maths are read, not glued to it', async () => {
  for (const [p, answer] of [
    // Was "theexpression(x^2 - 1)/(x - 1)", marked Solved.
    ['simplify the expression (x^2-1)/(x-1)', 'x + 1, for x ≠ 1'],
    // Was refused as an improper integral.
    ['calculate the definite integral of x^2 from 0 to 3', '∫_0^3 (x^2) dx = 9'],
    ['solve the quadratic equation x^2 - 5x + 6 = 0', 'x = 2  or  x = 3'],
    ['factor completely x^4 - 16', '(x - 2)(x + 2)(x^2 + 4)'],
    ['find the zeros of x^2 - 5x + 6', 'x = 2  or  x = 3'],
    ['what is the slope of the tangent line to x^2 at x = 3', "f'(3) = 6"],
    ['find the gcd of 12 and 18', '6'], ['find the lcm of 4 and 6', '12'],
  ]) {
    assert.equal((await solveProblem(p, 'auto')).answer, answer, p);
  }
  // A feature of a function is its analysis, under Functions.
  const c = await solveProblem('find the critical points of x^3 - 3x', 'auto');
  assert.equal(c.routedTopic, 'functions');
  assert.match(c.answer, /x-intercepts at x = -√3, 0, √3; local maximum \(-1, 2\); local minimum \(1, -2\)/);
  assert.match((await solveProblem('find the vertex of the parabola y = x^2 - 4x', 'auto')).answer, /vertex \(2, -4\)/);
  // Words still not understood are said to be words, not "a function".
  assert.match((await solveProblem('find the period of sin(2x)', 'auto')).answer, /^The words in this problem could not be read as maths/);
  assert.match((await solveProblem('x apples > 2', 'algebra')).answer, /^"apples" is not a known function/);
});
