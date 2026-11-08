// Which letter is the variable (1.70.6). d/dx names it; otherwise x, when
// the problem has one, and every other letter is a constant. Found while
// checking whether "nx" could be read as n*x: "d/dx a*x^2" answered
// f'(a) = x^2. Answers are checked by value where they could be written in
// more than one way.
import test from 'node:test';
import assert from 'node:assert/strict';
import { solvePlain } from './helpers/solvePlain.js';

const cases = [
  ['d/dx a*x^2', "f'(x) = 2a*x"],
  ['d/dx sin(n*x)', "f'(x) = n*cos(n*x)"],
  ['d/dt a*t^2', "f'(t) = 2a*t"],
  ['derivative of a*x^2 with respect to a', "f'(a) = x^2"],
  ['d/dx a*x^2 at x = 1', "f'(1) = 2a"],
  ['second derivative of a*x^3 at x = 2', "f''(2) = 12a"],
  ['d/dx sin(k*x) at x = 0', "f'(0) = k"],
  ['a*x + b = 0', 'x = -b/a'],
  ['2xy + y = 3', 'y = 3/(2x + 1)'],
  ['factor a^2 - b^2', '(a + b)(a - b)'],
  ['factor x^2 - a^2', '(x + a)(x - a)'],
  ['factor a^2*b - a*b^2', 'a*b(a - b)'],
  ['expand (x + a)^2', 'x^2 + 2a*x + a^2'],
  // Descending lexicographic order: x first when there is one, then the
  // other letters alphabetically.
  ['expand (a + b)^2', 'a^2 + 2a*b + b^2'],
  ['expand (a + b)^3', 'a^3 + 3a^2*b + 3a*b^2 + b^3'],
  ['expand (a + b + c)^2', 'a^2 + 2a*b + 2a*c + b^2 + 2b*c + c^2'],
  ['expand (1 - x)^3', '-x^3 + 3x^2 - 3x + 1'],
  // With no x the letters go alphabetically, whatever order they were typed
  // in; an expansion already in order stays as it is.
  ['expand (b + a)^2', 'a^2 + 2a*b + b^2'],
  ['expand (c + b + a)^2', 'a^2 + 2a*b + 2a*c + b^2 + 2b*c + c^2'],
  ['expand a^2 + 2a*b + b^2', 'a^2 + 2a*b + b^2'],
  ['expand (b + x)^2', 'x^2 + 2b*x + b^2'],
  ['sin(y) = x', 'x = sin(y)'],
];
for (const [problem, answer] of cases) {
  test(`${problem} → ${answer}`, async () => {
    const r = await solvePlain(problem, 'auto');
    assert.equal(r.status, 'solved', `${problem}: ${r.answer}`);
    assert.equal(r.answer, answer);
  });
}

test('what had one letter before still does', async () => {
  for (const [p, t, a] of [['t^2 + 3t', 'derivatives', "f'(t) = 2t + 3"], ['d/dx x^3', 'auto', "f'(x) = 3x^2"], ['d/dx ln(x) at x = -1', 'auto', "f'(-1) does not exist: x = -1 is outside the domain of f"], ['factor x^2 + 1', 'auto', 'x^2 + 1 (no simpler factors over the integers)']]) {
    assert.equal((await solvePlain(p, t)).answer, a, p);
  }
});

test('a relation in two unknowns is not called a numeric scan', async () => {
  const r = await solvePlain('sin(y) = x', 'auto');
  assert.ok(!r.steps.some((s) => /solved numerically|roots nearest zero/.test(s)), r.steps.join(' | '));
});
