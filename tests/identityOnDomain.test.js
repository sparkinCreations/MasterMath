// An identity with values excluded: the answer, and the advice under it,
// say which values. x/x = 1 had the right answer and "every x is a solution"
// below it; (3x − 1)/(3x − 1) = 1 lost x = 1/3 between grid points.
import test from 'node:test';
import assert from 'node:assert/strict';
import { solvePlain } from './helpers/solvePlain.js';

const ANSWERS = [
  ['x/x = 1', 'x ≠ 0'],
  ['(3x-1)/(3x-1) = 1', 'x ≠ 1/3'],
  ['(1-3x)/(1-3x) = 1', 'x ≠ 1/3'],
  ['(3x+1)/(3x+1) = 1', 'x ≠ -1/3'],
  ['x/(x*(x-1)) = 1/(x-1)', 'x ≠ 0 and x ≠ 1'],
  ['x^0 = 1', 'x ≠ 0'],
  ['(x-2)^0 = 1', 'x ≠ 2'],
  ['(x^2-1)^0 = 1', 'x ≠ -1 and x ≠ 1'],
  ['0^x = 0', 'x > 0'],
  ['e^ln(x) = x', 'x > 0'],
  ['ln(x^2) = 2*ln(x)', 'x > 0'],
  ['sqrt(x)^2 = x', 'x ≥ 0'],
];

for (const [problem, condition] of ANSWERS) {
  test(`${problem}: holds for ${condition}`, async () => {
    const { answer } = await solvePlain(problem, 'algebra');
    assert.equal(answer, `All real numbers with ${condition} (identity on its domain)`);
  });
}

// An excluded value proved from the form of the divisor, shown exactly.
const EXACT = [
  ['(x^2-2)/(x^2-2) = 1', 'x ≠ -√2 and x ≠ √2'],
  ['(x^2+x-1)/(x^2+x-1) = 1', 'x ≠ (-1 - √5)/2 and x ≠ (-1 + √5)/2'],
  ['(2x^2-1)/(2x^2-1) = 1', 'x ≠ -√2/2 and x ≠ √2/2'],
  ['(e^x-2)/(e^x-2) = 1', 'x ≠ ln(2)'],
  ['(e^(2x)-3)/(e^(2x)-3) = 1', 'x ≠ ln(3)/2'],
  ['(2^x-8)/(2^x-8) = 1', 'x ≠ ln(8)/ln(2)'],
  ['(e^x-1)/(e^x-1) = 1', 'x ≠ 0'],
  ['sqrt(3x-1)^2 = 3x-1', 'x ≥ 1/3'],
];
for (const [problem, condition] of EXACT) {
  test(`${problem}: excludes exactly, ${condition}`, async () => {
    const { answer } = await solvePlain(problem, 'algebra');
    assert.equal(answer, `All real numbers with ${condition} (identity on its domain)`);
  });
}

test('a cubic with an irrational zero keeps the condition on the divisor', async () => {
  const { answer } = await solvePlain('(x^3-2)/(x^3-2) = 1', 'algebra');
  assert.match(answer, /^All real numbers with x(\^3|³) [−-] 2 ≠ 0/);
});

test('an exponential divisor that is never zero excludes nothing', async () => {
  const { answer } = await solvePlain('(e^x+2)/(e^x+2) = 1', 'algebra');
  assert.match(answer, /^All real numbers \(identity/);
});

test('a wave that cannot reach 0 excludes nothing', async () => {
  const { answer } = await solvePlain('1/(sin(x)+2) = 1/(sin(x)+2)', 'algebra');
  assert.match(answer, /^All real numbers \(identity/);
});

test('tan(x) = tan(x) excludes tan\'s undefined points', async () => {
  const { answer } = await solvePlain('tan(x) = tan(x)', 'algebra');
  assert.match(answer, /^All real numbers except x = π\/2 \+ nπ/);
});

test('other exclusions and a lattice are both named', async () => {
  const { answer, tips } = await solvePlain('1/x + tan(x) = 1/x + tan(x)', 'algebra');
  assert.equal(answer, 'All real numbers with x ≠ 0 and x ≠ π/2 + nπ, n any integer (identity on its domain)');
  assert.match(tips[1], /Excluded: x = 0 and x = π\/2 \+ nπ, where the original equation is undefined, with n any integer\./);
});

test('a point on a lattice is the lattice', async () => {
  const { answer } = await solvePlain('sin(x)/sin(x) = 1', 'algebra');
  assert.match(answer, /^All real numbers except x = nπ, n any integer/);
});

const REFUSED = ['(sin(x)+1/2)/(sin(x)+1/2) = 1', '(ln(x)-1)/(ln(x)-1) = 1', 'tan(x^2) = tan(x^2)', 'sqrt(x^2-2)^2 = x^2-2', '1/(e^x-x-2) = 1/(e^x-x-2)'];
for (const problem of REFUSED) {
  test(`${problem}: refused, its domain not proved`, async () => {
    const r = await solvePlain(problem, 'algebra');
    assert.equal(r.status, 'unsupported');
    assert.match(r.answer, /cannot yet determine every value where they are defined/);
  });
}

test('a divisor that is never zero excludes nothing', async () => {
  const { answer } = await solvePlain('(x^2+1)/(x^2+1) = 1', 'algebra');
  assert.match(answer, /^All real numbers \(identity/);
});

const RESTRICTED = ['x/x = 1', '(x^2-1)/(x-1) = x+1', 'sqrt(x)^2 = x', 'ln(x)-ln(x) = 0', '1/x = 1/x', 'tan(x) = sin(x)/cos(x)', 'x^0 = 1'];

for (const problem of RESTRICTED) {
  test(`${problem}: the advice never says every number works`, async () => {
    const { tips, common_mistakes } = await solvePlain(problem, 'algebra');
    for (const line of [...tips, ...common_mistakes]) {
      assert.doesNotMatch(line, /every x is a solution|every real number —|holds for every real number|every number works|For a linear equation/, line);
    }
  });
}

test('the second insight names what is allowed and what is excluded', async () => {
  const { tips } = await solvePlain('x/x = 1', 'algebra');
  assert.equal(tips[1], 'Here the two sides agree wherever both are defined: every real number with x ≠ 0 is a solution. Excluded: x = 0, where the original equation is undefined.');
});

test('a periodic restriction is named with its integer', async () => {
  const { tips } = await solvePlain('tan(x) = sin(x)/cos(x)', 'algebra');
  assert.match(tips[1], /every real number except x = π\/2 \+ nπ, with n any integer, is a solution/);
});

test('an identity true everywhere keeps its own advice', async () => {
  const { tips, common_mistakes } = await solvePlain('2(x+3) = 2x+6', 'algebra');
  assert.ok(tips.includes('Here the x terms cancel and the two sides are the same expression: every x is a solution.'));
  assert.ok(common_mistakes.some((line) => /every number works/.test(line)));
});
