// A parameter in an exponent at ±∞. lim x→∞ e^(a·x) was answered 0 with
// "both signs ✓": taken for a polynomial of degree 0, and every positive a
// overflowed, went unsettled and was skipped by the check.
import test from 'node:test';
import assert from 'node:assert/strict';
import { solvePlain } from './helpers/solvePlain.js';

const SPLIT = [
  ['lim x->inf e^(a*x)', '∞ if a > 0;  0 if a < 0;  1 if a = 0'],
  ['lim x->-inf e^(a*x)', '0 if a > 0;  ∞ if a < 0;  1 if a = 0'],
  ['lim x->inf 2^(a*x)', '∞ if a > 0;  0 if a < 0;  1 if a = 0'],
  ['lim x->inf e^(-a*x)', '∞ if a < 0;  0 if a > 0;  1 if a = 0'],
  ['lim x->inf (1/2)^(a*x)', '0 if a > 0;  ∞ if a < 0;  1 if a = 0'],
];

for (const [problem, cases] of SPLIT) {
  test(`${problem}: split by the sign of the parameter`, async () => {
    const r = await solvePlain(problem, 'limits');
    assert.equal(r.status, 'solved');
    assert.ok(r.answer.endsWith(`= ${cases}`), r.answer);
  });
}

for (const problem of ['lim x->inf a^x', 'lim x->inf e^(a*x)/x', 'lim x->inf x/e^(a*x)', 'lim x->inf 3*e^(a*x)']) {
  test(`${problem}: refused, never 0`, async () => {
    const r = await solvePlain(problem, 'limits');
    assert.equal(r.status, 'unsupported', r.answer);
  });
}

test('the check claims both signs only when both were compared', async () => {
  const both = await solvePlain('lim x->inf (a*x+1)/(x+2)', 'limits');
  assert.match(both.steps.join('\n'), /both signs ✓/);
  const oneSign = await solvePlain('lim x->1 ln(a*x)', 'limits');
  assert.match(oneSign.answer, /for a > 0/);
  assert.doesNotMatch(oneSign.steps.join('\n'), /both signs/);
});

test('limits with a parameter that were right stay right', async () => {
  const cases = [
    ['lim x->inf (a*x+1)/(x+2)', /= a$/],
    ['lim x->0 e^(a*x)', /= 1$/],
    ['lim x->0 sin(a*x)/x', /= a$/],
    ['lim x->a (x^2-a^2)/(x-a)', /= 2a$/],
  ];
  for (const [problem, expected] of cases) {
    const r = await solvePlain(problem, 'limits');
    assert.match(r.answer, expected, problem);
  }
});
