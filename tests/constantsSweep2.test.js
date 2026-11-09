// The rest of the systematic stress test with constants (1.74.0): simplify,
// equations with the unknown inside a function or a denominator,
// inequalities, systems and limits with a parameter. Each answer says when
// it holds; each was refused or echoed before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { solvePlain } from './helpers/solvePlain.js';

const answers = async (pairs) => {
  for (const [p, answer] of pairs) {
    const r = await solvePlain(p, 'auto');
    assert.equal(r.status, 'solved', `${p}: ${r.answer}`);
    assert.equal(r.answer, answer, p);
  }
};

test('simplify with constants: checked in every letter, a cancelled factor stated', async () => {
  await answers([
    ['simplify (a*x + a)/a', 'x + 1, for a ≠ 0'],
    ['simplify (x^2 - a^2)/(x - a)', 'x + a, for x ≠ a'],
    ['simplify a*x + b*x', '(a + b)x'],
    ['simplify (a + b)^2 - (a - b)^2', '4ab'],
    ['simplify (a^2*x)/(a*x)', 'a, for a ≠ 0 and x ≠ 0'],
    // Both conditions, a ≠ 0 and b ≠ 0, even though neither factor cancels.
    ['simplify x/a + x/b', '(a + b)x/(ab), for a ≠ 0 and b ≠ 0'],
    ['simplify (x+a)^2 - x^2', '2ax + a^2'],
    ['simplify (2a*x)/(4a)', 'x/2, for a ≠ 0'],
  ]);
  // A product is not multiplied out: that is expanding.
  assert.equal((await solvePlain('(a+b)c', 'auto')).answer, '(a + b)*c');
});

test('the unknown inside a function: undone, with the condition that allows it', async () => {
  await answers([
    ['ln(x) = a', 'x = e^a'],
    ['ln(x + a) = b', 'x = e^b - a'],
    ['ln(a*x) = b', 'x = e^b/a, for a ≠ 0'],
    ['log(x) = a', 'x = 10^a'],
    ['sqrt(x) = a', 'x = a^2, for a ≥ 0'],
    ['sqrt(x + a) = b', 'x = b^2 - a, for b ≥ 0'],
    ['sqrt(x) = 3 - a', 'x = (3 - a)^2, for a ≤ 3'],
    ['sqrt(a*x) = 2', 'x = 4/a, for a ≠ 0'],
    ['abs(x - a) = b', 'x = a + b  or  x = a - b, for b ≥ 0'],
    ['2^x = a', 'x = ln(a)/ln(2), for a > 0'],
    ['a^x = b', 'x = ln(b)/ln(a), for a > 0 and a ≠ 1 and b > 0'],
    ['sin(x) = a', 'x = arcsin(a) + 2πn  or  x = π - arcsin(a) + 2πn (n ∈ ℤ), for -1 ≤ a ≤ 1'],
    ['tan(x) = a', 'x = arctan(a) + πn (n ∈ ℤ)'],
    ['cos(a*x) = 0', 'x = (π/2 + πn)/a (n ∈ ℤ), for a ≠ 0'],
    ['sin(a*x) = 1/2', 'x = (π/6 + 2πn)/a  or  x = (5π/6 + 2πn)/a (n ∈ ℤ), for a ≠ 0'],
    ['sin(2x + a) = 1', 'x = (π/2 + 2πn - a)/2 (n ∈ ℤ)'],
    ['2sin(x) + a = 0', 'x = arcsin(-a/2) + 2πn  or  x = π - arcsin(-a/2) + 2πn (n ∈ ℤ), for -2 ≤ a ≤ 2'],
    ['sqrt(x^2 + a) = 2', 'x = ±√(4 - a), for a ≤ 4'],
  ]);
  const r = await solvePlain('sin(a*x) = 1/2', 'auto');
  assert.ok(r.steps.includes('If a = 0, the equation is 0 = 1/2, with no x in it, and it is false: there is no solution.'), r.steps.join('\n'));
});

test('the unknown in a denominator: fractions cleared, a root that would divide by 0 excluded', async () => {
  await answers([
    ['1/x = a', 'x = 1/a, for a ≠ 0'],
    ['a/x + b = 0', 'x = -a/b, for a ≠ 0 and b ≠ 0'],
    ['1/(x - a) = b', 'x = a + 1/b, for b ≠ 0'],
    ['(x + a)/(x - b) = 0', 'x = -a, for a ≠ -b'],
    ['x/(x + a) = b', 'x = a*b/(1 - b), for a ≠ 0 and b ≠ 1'],
    ['1/x + 1/a = 1', 'x = a/(a - 1), for a ≠ 0 and a ≠ 1'],
    ['x/a + x/b = 1', 'x = a*b/(a + b), for a ≠ -b and a ≠ 0 and b ≠ 0'],
    // A root that is a denominator's zero is rejected; one that is for some
    // value of the constants keeps the condition.
    ['(x^2 - a^2)/(x - a) = 0', 'x = -a, for a ≠ 0'],
    ['(x - a)*(x - b)/(x - a) = 0', 'x = b, for a ≠ b'],
  ]);
  const r = await solvePlain('(x^2 - a^2)/(x - a) = 0', 'auto');
  assert.ok(r.steps.includes('x = a makes a denominator 0, so it is rejected.'), r.steps.join('\n'));
});

test('a cubic in letters that factors: each factor solved, the root for every value said', async () => {
  await answers([
    ['x^3 - a*x = 0', 'x = 0  or  x = ±√a, for a ≥ 0'],
    ['x^3 - (a+b)*x^2 + a*b*x = 0', 'x = 0  or  x = a  or  x = b'],
  ]);
  const r = await solvePlain('x^3 - a*x = 0', 'auto');
  assert.ok(r.steps.includes('If a < 0, the square root is not real, and x = 0 is the only real solution.'), r.steps.join('\n'));
});

test('an equation in x and y keeps its own rearrangement', async () => {
  assert.equal((await solvePlain('sin(y) = x', 'auto')).answer, 'x = sin(y)');
  assert.equal((await solvePlain('x/y = 2', 'auto')).answer, 'x = 2y');
});

test('inequalities with constants: case by case on the sign of the divisor or the constant', async () => {
  await answers([
    ['a*x > b', 'x > b/a if a > 0;  x < b/a if a < 0;  if a = 0: every x when b < 0, no x otherwise'],
    ['x + a > b', 'x > b - a'],
    ['-2x + a >= b', 'x ≤ (a - b)/2'],
    ['a*x + 1 <= 3', 'x ≤ 2/a if a > 0;  x ≥ 2/a if a < 0;  if a = 0: every x'],
    ['(a-1)*x < 2', 'x < 2/(a - 1) if a > 1;  x > 2/(a - 1) if a < 1;  if a = 1: every x'],
    ['x^2 < a', '-√a < x < √a if a > 0;  no solution if a ≤ 0'],
    ['x^2 - a > 0', 'x < -√a or x > √a if a ≥ 0;  every x if a < 0'],
    ['x^2 >= a', 'x ≤ -√a or x ≥ √a if a > 0;  every x if a ≤ 0'],
    ['3 - x^2 > a', '-√(3 - a) < x < √(3 - a) if a < 3;  no solution if a ≥ 3'],
    ['x - a*x > 1', 'x > 1/(1 - a) if a < 1;  x < 1/(1 - a) if a > 1;  if a = 1: no x'],
    ['x^2 + 1 > a', 'x < -√(a - 1) or x > √(a - 1) if a ≥ 1;  every x if a < 1'],
  ]);
  // Two variables are still a region of the plane.
  assert.equal((await solvePlain('x + y > 2', 'auto')).status, 'unsupported');
  const cubic = await solvePlain('x^3 > a', 'auto');
  assert.equal(cubic.status, 'unsupported');
  assert.match(cubic.answer, /linear in x/);
});

test('systems with constants: Cramer\'s rule, D ≠ 0, and what happens where D = 0', async () => {
  await answers([
    ['x + y = a; x - y = b', 'x = (a + b)/2,  y = (a - b)/2'],
    ['a*x + y = 1; x - y = 0', 'x = 1/(a + 1),  y = 1/(a + 1), for a ≠ -1'],
    ['x + a*y = 2; a*x + y = 2', 'x = 2/(a + 1),  y = 2/(a + 1), for a ≠ -1 and a ≠ 1'],
    ['x + y + z = a; x - y = 0; y - z = b', 'x = (a + b)/3,  y = (a + b)/3,  z = (a - 2b)/3'],
  ]);
  const r = await solvePlain('x + a*y = 2; a*x + y = 2', 'auto');
  assert.ok(r.steps.includes('If a = -1, D = 0: the system is x - y = 2;  -x + y = 2, and there is no solution.'), r.steps.join('\n'));
  assert.ok(r.steps.includes('If a = 1, D = 0: the system is x + y = 2;  x + y = 2, and there are infinitely many solutions.'), r.steps.join('\n'));
  // Letters alone are the unknowns, as before.
  assert.equal((await solvePlain('a + b = 3; a - b = 1', 'auto')).answer, 'a = 2,  b = 1');
});

test('limits with a parameter: worked in it, compared with the function at several values', async () => {
  await answers([
    ['lim x->0 sin(a*x)/x', 'lim (x→0) sin(a*x)/x = a'],
    ['lim x->inf (a*x + 1)/(x + 2)', 'lim (x→∞) (a*x + 1)/(x + 2) = a'],
    ['lim x->a (x^2 - a^2)/(x - a)', 'lim (x→a) (x^2 - a^2)/(x - a) = 2a'],
    ['lim x->0 (1 + a*x)^(1/x)', 'lim (x→0) (1 + a*x)^(1/x) = e^a'],
    ['lim x->0 (e^(k*x) - 1)/x', 'lim (x→0) (e^(k*x) - 1)/x = k'],
    ['lim x->3 (x + a)/(x - a)', 'lim (x→3) (x + a)/(x - a) = (3 + a)/(3 - a), for a ≠ 3'],
    ['lim x->0 (1-cos(a*x))/x^2', 'lim (x→0) (1 - cos(a*x))/x^2 = a^2/2'],
    ['lim x->inf a*x^2/(x + 1)', 'lim (x→∞) a*x^2/(x + 1) = ∞ if a > 0;  -∞ if a < 0;  0 if a = 0'],
    ['lim x->2 a^x', 'lim (x→2) a^x = a^2, for a > 0'],
    ['lim x->1 ln(a*x)', 'lim (x→1) ln(a*x) = ln(a), for a > 0'],
    ['lim h->0 (sqrt(x+h) - sqrt(x))/h', 'lim (h→0) (sqrt(x + h) - sqrt(x))/h = 1/(2√x), for x > 0'],
    ['lim x->0 sin(a*x)/sin(b*x)', 'lim (x→0) sin(a*x)/sin(b*x) = a/b, for b ≠ 0'],
  ]);
  // A pole at the point for some value of the parameter is not substituted,
  // nor a power x^a at x = 0 (it was "0^a").
  assert.equal((await solvePlain('lim x->1 tan(a*x)', 'auto')).status, 'unsupported');
  assert.equal((await solvePlain('lim x->0 x^a', 'auto')).status, 'unsupported');
  assert.equal((await solvePlain('lim x->2 x^a', 'auto')).answer, 'lim (x→2) x^a = 2^a');
});

// Review of PR #70: i is the imaginary unit, never a real constant or
// parameter. Sampled as a real number, it "verified" lim x→0 sin(i·x)/x = i.
test('i is never a constant or a parameter in the paths with constants', async () => {
  for (const p of ['lim x->0 sin(i*x)/x', 'lim x->0 (e^(i*x) - 1)/x', 'lim x->0 (1 + i*x)^(1/x)', 'lim x->inf (i*x + 1)/(x + 2)', 'x + i > 2', 'x + y = i; x - y = 1', 'ln(x) = i']) {
    const r = await solvePlain(p, 'auto');
    assert.notEqual(r.status, 'solved', `${p}: ${r.answer}`);
  }
  // A limit at i is complex-valued, refused as such (1.73.1).
  assert.equal((await solvePlain('lim x->i x^2', 'auto')).answer, "Complex-valued limits aren't supported");
});
