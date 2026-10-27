// 1.56.3: plain English on every path (October 2026 review). "two x plus
// five equals eleven" solved as an equation but the page's nudge called it
// "an expression"; "plus" and "minus" were refused on the inequality and
// systems paths; a bare "is" between two sides of maths was not "=".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveProblem } from '../src/lib/api.js';
import { expressionNudge } from '../src/lib/solverPrefs.js';
import { readPlainEnglish } from '../src/lib/plainEnglish.js';

test('the bare-expression nudge reads the problem as the solver does', async () => {
  for (const problem of ['two x plus five equals eleven', 'x squared minus four equals zero', 'two x plus five is eleven']) {
    const result = await solveProblem(problem, 'auto');
    assert.equal(result.status, 'solved', problem);
    assert.equal(expressionNudge(problem, 'auto', result), null, problem);
    assert.equal(expressionNudge(problem, 'algebra', await solveProblem(problem, 'algebra')), null, problem);
  }
  // A bare expression in words is still nudged.
  const bare = await solveProblem('x squared plus three x', 'auto');
  assert.ok(expressionNudge('x squared plus three x', 'auto', bare));
});

test('plus, minus, times and divided by are read on every path', async () => {
  assert.equal(readPlainEnglish('2x plus 5 > 11'), '2x + 5 > 11');
  assert.equal(readPlainEnglish('x plus y = 2; x minus y = 0'), 'x + y = 2; x - y = 0');
  assert.equal(readPlainEnglish('5 times 4 divided by 2'), '5 * 4 / 2');
  assert.equal((await solveProblem('2x plus 5 > 11', 'auto')).answer, 'x > 3');
  assert.equal((await solveProblem('two x plus five is less than or equal to eleven', 'auto')).answer, 'x ≤ 3');
  assert.equal((await solveProblem('x plus y equals 2; x minus y equals 0', 'auto')).answer, 'x = 1,  y = 1');
  assert.equal((await solveProblem('5 times 4 divided by 2', 'auto')).answer, '10');
  // The spoken-arithmetic phrases keep their meaning.
  assert.equal((await solveProblem('add two and three', 'auto')).answer, '5');
  assert.equal((await solveProblem('subtract 3 from 10', 'auto')).answer, '7');
});

test('a bare "is" between two sides of maths is "="', async () => {
  assert.equal(readPlainEnglish('2x + 5 is 11'), '2x + 5 = 11');
  assert.equal(readPlainEnglish('x squared minus 4 is zero'), 'x^2 - 4 = 0');
  assert.equal(readPlainEnglish('sin of x is 1/2'), 'sin(x) = 1/2');
  assert.equal(readPlainEnglish('e to the x is 5'), 'e^x = 5');
  assert.equal((await solveProblem('two x plus five is eleven', 'auto')).answer, 'x = 3');
  assert.equal((await solveProblem('x squared minus 4 is zero', 'auto')).answer, 'x = -2  or  x = 2');
  // "is" with any other word on either side is left alone: questions and
  // relations already read stay as they are.
  assert.equal(readPlainEnglish('what is 2 plus 2'), 'what is 2 + 2');
  assert.equal(readPlainEnglish('what is the derivative of x squared'), 'what is the derivative of x^2');
  assert.equal(readPlainEnglish('2x + 5 is greater than 11'), '2x + 5 > 11');
  assert.equal(readPlainEnglish('x is at least 3'), 'x >= 3');
  assert.equal((await solveProblem('what is 2 plus 2', 'auto')).answer, '4');
  assert.equal((await solveProblem('what is the derivative of x squared', 'auto')).answer, "f'(x) = 2x");
});
