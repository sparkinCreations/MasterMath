import test from 'node:test';
import assert from 'node:assert/strict';

import { solveProblem } from '../src/lib/api.js';
import { solvePlain } from './helpers/solvePlain.js';

// 1.56.1, from the October 27 tips audit (338 problems): every tip and
// mistake is about the problem on screen — the value, the method the steps
// used, the operation typed — never another problem's.

const guidance = async (problem, topic) => {
  const r = await solvePlain(problem, topic);
  return { ...r, all: [...r.tips, ...r.common_mistakes].join('\n') };
};

test('trig equations: the guidance is about this value and this function', async () => {
  const once = await guidance('sin(2x) = 1', 'trigonometry');
  assert.match(once.all, /sin reaches 1 only once in each period/);
  assert.doesNotMatch(once.all, /both quadrants/);
  assert.match(once.all, /Forgetting to divide by 2: the families found are for 2x/);
  const bottom = await guidance('cos(x) = -1', 'trigonometry');
  assert.match(bottom.all, /cos reaches -1 only once in each period, at the bottom of the wave/);
  assert.doesNotMatch(bottom.all, /divide by k/);
  const zero = await guidance('sin(x) = 0', 'trigonometry');
  assert.match(zero.all, /sin is 0 where its graph crosses the axis — twice in each period/);
  assert.match(zero.all, /Listing x = 0 alone and missing the second crossing, x = π/);
  const tan = await guidance('tan(x) = 1', 'trigonometry');
  assert.match(tan.all, /arctan\(1\) = π\/4 and missing π\/4 \+ π/);
  assert.doesNotMatch(tan.all, /arcsin/);
  const cosine = await guidance('2cos(x) - 1 = 0', 'trigonometry');
  assert.match(cosine.all, /arccos\(1\/2\) = π\/3/);
  // A periodic inequality names its own zeros.
  const ineq = await guidance('cos(x) > 0', 'algebra');
  assert.match(ineq.all, /the expression is 0 at π\/2 and at 3π\/2/);
  assert.doesNotMatch(ineq.all, /sin\(x\) = 1\/2/);
});

test('trig values: sec warns about sec, a π input gets no degree warning, no library is named', async () => {
  const sec = await guidance('sec(pi/3)', 'trigonometry');
  assert.match(sec.all, /sec\(90°\) is undefined \(cos\(90°\) = 0\)/);
  assert.doesNotMatch(sec.all, /tan\(90°\)/);
  assert.doesNotMatch(sec.all, /Mixing up radians and degrees/);
  const asymptote = await guidance('tan(pi/2)', 'trigonometry');
  assert.doesNotMatch(asymptote.all, /math\.js/);
  assert.match(asymptote.all, /Angles are read in radians unless the angle unit is set to degrees/);
  // A bare number is still warned about.
  assert.match((await guidance('sin(30)', 'trigonometry')).all, /radians and degrees/);
});

test('functions: corners and cusps, products with an exponential, sine curves, non-polynomials', async () => {
  const corner = await guidance('abs(x)', 'functions');
  assert.match(corner.all, /A corner or cusp is a critical point where f′\(x\) does not exist/);
  assert.match(corner.all, /An absolute value is piecewise/);
  assert.doesNotMatch(corner.all, /leading term decides the ends|polynomial of degree/);
  const cusp = await guidance('x^(2/3)', 'functions');
  assert.match(cusp.all, /x\^\(2\/3\) = \(∛x\)²: the odd root first/);
  const bump = await guidance('x*e^(-x)', 'functions');
  assert.match(bump.all, /the zeros of the product are the zeros of the other factor/);
  assert.doesNotMatch(bump.all, /Giving e\^x an x-intercept/);
  // A pure exponential keeps the exponential list.
  assert.match((await guidance('e^x', 'functions')).all, /Giving e\^x an x-intercept: e\^x = 0 has no solution/);
  assert.match((await guidance('e^(-x^2)', 'functions')).all, /passes through \(0, 1\)/);
  const sine = await guidance('sin(2x)', 'functions');
  assert.match(sine.all, /sin and cos stay between −1 and 1/);
  assert.doesNotMatch(sine.all, /tan\(x\) has a vertical asymptote|period of tan/);
  assert.match((await guidance('tan(x)', 'functions')).all, /tan\(x\) and sec\(x\) have a vertical asymptote/);
  const notPolynomial = await guidance('sin(x^2)', 'functions');
  assert.match(notPolynomial.all, /Domain first, then intercepts/);
  assert.doesNotMatch(notPolynomial.all, /leading term decides the ends/);
  assert.match((await guidance('x^3 - 3x', 'functions')).all, /The leading term decides the ends/);
});

test('integrals: the method the steps used', async () => {
  const half = await guidance('sin(x)^2', 'integrals');
  assert.match(half.all, /half-angle identities: sin²\(x\) = \(1 − cos\(2x\)\)\/2/);
  assert.match(half.all, /Applying the power rule to sin²\(x\): sin³\(x\)\/3 is not its antiderivative/);
  assert.doesNotMatch(half.all, /Power rule: ∫x\^n/);
  assert.match((await guidance('cos(2x)', 'integrals')).all, /let u = ax \+ b, so du = a dx and a factor 1\/a comes out/);
  assert.match((await guidance('tan(x)', 'integrals')).all, /∫tan = −ln\|cos\|/);
  assert.match((await guidance('(x+1)/(x^2+1)', 'integrals')).all, /splits in two: the part that is the denominator's derivative integrates to a logarithm, the constant part to an arctan/);
  const divide = await guidance('(x^4+1)/(x^2+1)', 'integrals');
  assert.match(divide.all, /divide first: the quotient integrates term by term/);
  assert.match((await guidance('1/(x^3 + x)', 'integrals')).all, /a linear factor gives a logarithm, an irreducible quadratic a logarithm, an arctan or both \(depending on its numerator\), and a repeated factor one term per power/);
  assert.doesNotMatch((await guidance('1/((x^2+1)^2)', 'integrals')).all, /splits in two/);
});

test('equations: power, no solution, located root, identity and contradiction, LCD, squares', async () => {
  const power = await guidance('x^(2/3) = 4', 'algebra');
  // 1.62.0: taught through the root (an outside review), in lowest terms.
  assert.match(power.all, /Read x\^\(p\/q\) as a root, then a power, with p\/q in lowest terms/);
  assert.doesNotMatch(power.all, /Undo the operations in reverse order/);
  const never = await guidance('1/x = 0', 'algebra');
  // 1.62.0: the no-solution lists say why first (a fraction's numerator).
  assert.match(never.all, /A fraction is 0 only when its numerator is/);
  assert.match((await guidance('e^x = -2', 'algebra')).all, /Taking a logarithm of a negative number to "solve" it/);
  assert.doesNotMatch((await guidance('e^x = -2', 'algebra')).all, /is solved by taking a logarithm of both sides/);
  // Clearing denominators keeps its own guidance.
  assert.match((await guidance('x/(x-1) = 1', 'algebra')).all, /Clear the denominators by multiplying both sides by them/);
  const located = await guidance('x*e^x = 1', 'algebra');
  assert.match(located.all, /the root is located where the two sides cross/);
  assert.match(located.all, /Treating a located root as exact/);
  const contradiction = await guidance('5x - 7 = 5x + 2', 'algebra');
  assert.match(contradiction.all, /When the variable terms cancel/);
  assert.match(contradiction.all, /A contradiction has no solution/);
  const identity = await guidance('2(x+3) = 2x+6', 'algebra');
  assert.match(identity.all, /An identity holds for every real number/);
  assert.match(identity.all, /Writing x = 0 for an identity/);
  const lcd = await guidance('x/3 + 1/2 = 5/6', 'algebra');
  assert.match(lcd.all, /multiply every term on both sides by the least common denominator/);
  assert.match(lcd.all, /x\/3 \+ 1\/2 = 5\/6 times 6 is 2x \+ 3 = 5/);
  // The square-root and factoring lists no longer warn about x = 0 where there is none.
  assert.doesNotMatch((await guidance('x^2 = 9', 'algebra')).all, /losing the x = 0 solution/);
  assert.doesNotMatch((await guidance('x^2 - 5x + 6 = 0', 'algebra')).all, /losing the x = 0 solution/);
  assert.match((await guidance('x^2 - 4x = 0', 'algebra')).all, /losing the x = 0 solution/);
  // A linear equation without parentheses is not told to distribute.
  assert.doesNotMatch((await guidance('2*x + 5 = 11', 'algebra')).all, /distribute/);
  assert.match((await guidance('3(x - 2) = 2x + 4', 'algebra')).all, /distribute/);
});

test('arithmetic: one operation gets that operation\'s guidance', async () => {
  const minus = await guidance('-3^2', 'other');
  assert.match(minus.all, /The exponent binds before the minus sign: −3\^2 is −\(3\^2\) = −9/);
  assert.doesNotMatch(minus.all, /PEMDAS/);
  assert.match((await guidance('17 mod 5', 'other')).all, /a mod b is the remainder when a is divided by b: 17 = 3 × 5 \+ 2/);
  assert.match((await guidance('2^10', 'other')).all, /Multiplying the base by the exponent: 2\^10 is 1024, not 20/);
  assert.match((await guidance('(1/2)^3', 'other')).all, /A power of a fraction raises top and bottom/);
  assert.match((await guidance('2^0.5', 'other')).all, /A power of 0\.5 is a square root/);
  assert.match((await guidance('5 - 8', 'other')).all, /When the number subtracted is the larger one, the result is negative/);
  assert.match((await guidance('0.1 + 0.2', 'other')).all, /0\.1 \+ 0\.2 = 0\.3 exactly/);
  assert.match((await guidance('100 / 8', 'other')).all, /A division is a fraction: 100\/8 = 25\/2/);
  const squares = await guidance('sqrt(16) + sqrt(9)', 'other');
  assert.match(squares.all, /√16 = 4 because 4² = 16/);
  assert.doesNotMatch(squares.all, /√2 is irrational/);
  const odd = await guidance('(-8)^(1/3)', 'other');
  assert.match(odd.all, /An odd root of a negative number is real: ∛\(−8\) = −2/);
  assert.doesNotMatch(odd.all, /Reporting ±√a/);
  const gcd = await guidance('the gcd of 12 and 18', 'auto');
  assert.match(gcd.all, /The gcd is the largest number dividing both/);
  assert.doesNotMatch(gcd.all, /PEMDAS/);
  assert.match((await guidance('lcm of 4 and 6', 'auto')).all, /The lcm is the smallest number both divide into/);
  // A percent is taught as a percent, not as a product of fractions.
  const percent = await guidance('15% of 80', 'other');
  assert.match(percent.all, /"Per cent" means per hundred/);
  assert.doesNotMatch(percent.all, /common denominator/);
  // Mixed expressions keep the order-of-operations list.
  assert.match((await guidance('(5 + 3) * 4 - 2^3', 'other')).all, /PEMDAS/);
});

test('complex numbers: guidance by operation', async () => {
  assert.match((await guidance('abs(3+4i)', 'other')).all, /The modulus \|a \+ bi\| = √\(a² \+ b²\)/);
  assert.match((await guidance('(2+3i)+(1-i)', 'other')).all, /Add or subtract complex numbers part by part/);
  assert.match((await guidance('(3+4i)/(1-2i)', 'other')).all, /multiply the top and the bottom by the conjugate/);
  const power = await guidance('i^10', 'other');
  assert.match(power.all, /divide the exponent by 4 and keep the remainder: i\^10 = i\^2 = −1/);
  assert.doesNotMatch(power.all, /Dividing the real and imaginary parts separately/);
  assert.match((await guidance('(2+3i)*(1-i)', 'other')).all, /\(a \+ bi\)\(c \+ di\) = \(ac − bd\) \+ \(ad \+ bc\)i/);
});

test('rounding to a place; the derivative of arctan(2x) reads 2/(4x² + 1)', async () => {
  const place = await guidance('round 1250 to the nearest hundred', 'auto');
  assert.match(place.all, /keeps the hundreds digit and turns every place after it into a zero/);
  assert.doesNotMatch(place.all, /2\.996/);
  assert.match((await guidance('round 3.14159 to 2 decimal places', 'auto')).all, /2\.996 to 2 decimal places is 3\.00/);
  const r = await solvePlain('arctan(2x)', 'derivatives');
  assert.equal(r.answer, "f'(x) = 2/(4x^2 + 1)");
  assert.ok(r.steps.some((s) => s.includes('d/dx(arctan(2x)) = 2/(4x^2 + 1)')), r.steps.join(' | '));
  assert.equal((await solveProblem('arctan(x/2)', 'derivatives')).answer, "f'(x) = 2/(x^2 + 4)");
});
