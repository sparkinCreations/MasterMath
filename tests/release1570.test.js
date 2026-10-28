// 1.57.0: Calculus II integrals from the October 28 outside review — trig
// powers and reduction formulas, form-changing substitutions, x⁴ + a⁴, a
// numerical value when no antiderivative is found, methods named.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveProblem } from '../src/lib/api.js';
import { stripMathMarkers } from '../src/lib/mathMarkers.js';

const solve = (p) => solveProblem(p, 'integrals');
const plain = (r) => r.steps.map(stripMathMarkers).join('\n');

test('odd-power products of sin and cos are worked by the split and a substitution', async () => {
  const r = await solve('sin(x)^2*cos(x)^3');
  assert.equal(r.answer, '∫(sin(x)^2*cos(x)^3) dx = 1/3*sin(x)^3 - 1/5*sin(x)^5 + C');
  assert.match(plain(r), /The power of cos is odd: keep one factor of cos\(x\)/);
  assert.match(plain(r), /Let u = sin\(x\), so du = cos\(x\) dx/);
  const cubed = await solve('sin(x)^3');
  assert.equal(cubed.answer, '∫(sin(x)^3) dx = -cos(x) + 1/3*cos(x)^3 + C');
  assert.match(plain(cubed), /Let u = cos\(x\)/);
  assert.equal((await solve('cos(x)^5')).answer, '∫(cos(x)^5) dx = -2/3*sin(x)^3 + 1/5*sin(x)^5 + sin(x) + C');
  assert.equal((await solve('sin(2x)^3*cos(2x)^2')).answer, '∫(sin(2x)^3*cos(2x)^2) dx = -1/6*cos(2x)^3 + 1/10*cos(2x)^5 + C');
  assert.equal((await solve('3*sin(x)^3*cos(x)')).answer, '∫(3sin(x)^3*cos(x)) dx = 3/4*sin(x)^4 + C');
  assert.match(stripMathMarkers(r.tips[0]), /odd power, keep one factor/);
});

test('sec^n and csc^n: even by u = tan, odd by the reduction formula', async () => {
  const r = await solve('sec(x)^3');
  assert.equal(r.answer, '∫(sec(x)^3) dx = 1/2*sec(x)*tan(x) + 1/2*ln|sec(x) + tan(x)| + C');
  const text = plain(r);
  assert.match(text, /Integrate by parts with u = sec\(θ\), dv = sec²\(θ\) dθ/);
  assert.match(text, /the integral reappears: I_3 = sec\(θ\)tan\(θ\) − I_3 \+ I_1/);
  assert.match(text, /reduction formula I_3 = sec\(θ\)tan\(θ\)\/2 \+ \(1\/2\)·I_1/);
  assert.match(stripMathMarkers(r.tips[0]), /reduction formula lowers a power by two/);
  assert.equal((await solve('sec(x)^5')).answer, '∫(sec(x)^5) dx = 1/4*sec(x)^3*tan(x) + 3/8*sec(x)*tan(x) + 3/8*ln|sec(x) + tan(x)| + C');
  assert.equal((await solve('csc(x)^3')).answer, '∫(csc(x)^3) dx = -1/2*csc(x)*cot(x) + 1/2*ln|csc(x) - cot(x)| + C');
  assert.equal((await solve('2*sec(3x)^3')).answer, '∫(2sec(3x)^3) dx = 1/3*sec(3x)*tan(3x) + 1/3*ln|sec(3x) + tan(3x)| + C');
  assert.equal((await solve('sec(x)^4')).answer, '∫(sec(x)^4) dx = 1/3*tan(x)^3 + tan(x) + C');
  assert.equal((await solve('tan(x)^3*sec(x)')).answer, '∫(tan(x)^3*sec(x)) dx = 1/3*sec(x)^3 - sec(x) + C');
  assert.equal((await solve('tan(x)^2*sec(x)^4')).answer, '∫(tan(x)^2*sec(x)^4) dx = 1/3*tan(x)^3 + 1/5*tan(x)^5 + C');
  assert.equal((await solve('tan(x)^2')).answer, '∫(tan(x)^2) dx = tan(x) - x + C');
  assert.equal((await solve('tan(x)^3')).answer, '∫(tan(x)^3) dx = 1/2*tan(x)^2 + ln|cos(x)| + C');
  assert.equal((await solve('cot(x)^4')).answer, '∫(cot(x)^4) dx = -1/3*cot(x)^3 + cot(x) + x + C');
});

test('u = e^x and x = u² change the form; the integral in u is worked with its steps', async () => {
  const r = await solve('1/(1+e^x)');
  assert.equal(r.answer, '∫(1/(1 + e^x)) dx = x - ln(1 + e^x) + C');
  assert.match(plain(r), /substitute u = e\^x, so du = e\^x dx and dx = du\/u/);
  assert.match(plain(r), /∫\(1\/\(u\*\(1 \+ u\)\)\) du/);
  assert.match(plain(r), /Partial fractions: 1\/\(u\*\(1 \+ u\)\)/);
  assert.equal((await solve('e^x/(1+e^(2x))')).answer, '∫(e^x/(1 + e^(2x))) dx = arctan(e^x) + C');
  assert.equal((await solve('1/(e^x+e^(-x))')).answer, '∫(1/(e^x + e^(-x))) dx = arctan(e^x) + C');
  const root = await solve('sqrt(x)/(1+x)');
  assert.equal(root.answer, '∫(sqrt(x)/(1 + x)) dx = -2arctan(√x) + 2√x + C');
  assert.match(plain(root), /substitute x = u² \(so u = √x ≥ 0\), then dx = 2u du/);
  assert.match(plain(root), /divide first: 2u\^2\/\(1 \+ u\^2\) = 2 \+ \(-2\)\/\(1 \+ u\^2\)/);
  assert.match(stripMathMarkers(root.tips[0]), /substitute for that piece and change dx with it/);
});

test('1/(x⁴ + a⁴) factors over a surd; the improper integral is exact', async () => {
  const r = await solve('1/(x^4+1)');
  assert.equal(r.status, 'solved');
  assert.match(r.answer, /^∫\(1\/\(x\^4 \+ 1\)\) dx = 1\/\(4√2\)\*\(ln\|x\^2 \+ √2\*x \+ 1\| - ln\|x\^2 - √2\*x \+ 1\|\) \+ 1\/\(2√2\)\*\(arctan\(√2\*x \+ 1\) \+ arctan\(√2\*x - 1\)\) \+ C$/);
  assert.match(plain(r), /x⁴ \+ 1 = \(x² \+ √2x \+ 1\)\(x² − √2x \+ 1\)/);
  assert.match(plain(r), /Partial fractions with those two irreducible quadratics/);
  const improper = await solve('∫_0^∞ 1/(x^4+1) dx');
  assert.equal(improper.answer, '∫_0^∞ (1/(x^4 + 1)) dx = π/(2*√2) (≈ 1.1107)');
  assert.match((await solve('3/(x^4+9)')).answer, /^∫\(3\/\(x\^4 \+ 9\)\) dx = 1\/\(4√6\)/);
  // x⁴ + 4 factors over the rationals and keeps its worked decomposition.
  assert.match((await solve('1/(x^4+4)')).answer, /arctan\(\(x - 1\)\)/);
});

test('a denominator that factors only over the reals: surd coefficients, or decimals marked ≈', async () => {
  const r = await solve('1/(x^5+1)');
  assert.equal(r.status, 'solved');
  assert.equal(r.answer, '∫(1/(x^5 + 1)) dx = 1/5·ln|x + 1| + (√5 − 1)/20·ln(x² + (√5 − 1)/2x + 1) + (5 + √5)/(5√(10 + 2√5))·arctan((4x + √5 − 1)/√(10 + 2√5)) − (1 + √5)/20·ln(x² − (1 + √5)/2x + 1) + (5 − √5)/(5√(10 − 2√5))·arctan((4x − 1 + √5)/√(10 − 2√5)) + C');
  assert.equal((await solve('1/(x^6+1)')).answer, '∫(1/(x^6 + 1)) dx = √3/12·ln(x² + √3x + 1) + 1/6·arctan(2x + √3) + 1/3·arctan(x) − √3/12·ln(x² − √3x + 1) + 1/6·arctan(2x − √3) + C');
  assert.equal((await solve('1/((x^2+2)*(x^2-3))')).answer, '∫(1/((x^2 + 2)*(x^2 - 3))) dx = −√3/30·ln|x + √3| + √3/30·ln|x − √3| − 1/(5√2)·arctan(x/√2) + C');
  const text = plain(r);
  assert.match(text, /x\^5 \+ 1 = \(x \+ 1\)\(x² \+ \(√5 − 1\)\/2x \+ 1\)\(x² − \(1 \+ √5\)\/2x \+ 1\) \(the coefficients involve √5\)/);
  assert.match(text, /1\/\(x\^5 \+ 1\) = 1\/\(5\(x \+ 1\)\) \+ \(\(√5 − 1\)\/10·x \+ 2\/5\)\//);
  assert.match(text, /complete the square, x² \+ \(√5 − 1\)\/2x \+ 1 = \(x \+ \(√5 − 1\)\/4\)² \+ \(5 \+ √5\)\/8/);
  // A cube root has no closed form in square roots: full precision inside, rounded on screen, the answer marked ≈.
  const cube = await solve('1/(x^3-2)');
  assert.equal(cube.answer, '∫(1/(x^3 - 2)) dx ≈ 0.21·ln|x − 1.2599| − 0.105·ln(x² + 1.2599x + 1.5874) − 0.3637·arctan((x + 0.63)/1.0911) + C');
  assert.match(plain(cube), /kept to full precision and shown rounded/);
  assert.equal((await solve('∫_0^1 1/(x^5+1) dx')).answer, '∫_0^1 (1/(x^5 + 1)) dx ≈ 0.8883');
  assert.equal((await solve('∫_0^∞ 1/(x^5+1) dx')).answer, '∫_0^∞ (1/(x^5 + 1)) dx ≈ 1.069');
  assert.match((await solve('x^2/(x^5+1)')).answer, /^∫\(x\^2\/\(x\^5 \+ 1\)\) dx = 1\/5·ln\|x \+ 1\| − \(1 \+ √5\)\/20·ln/);
  // Rational factorisations keep their own path and wording.
  assert.match(plain(await solve('1/(x^3+1)')), /Factor the denominator: x\^3 \+ 1 = \(x \+ 1\)\(x\^2 - 1x \+ 1\)/);
});

test('a definite integral with no antiderivative is estimated numerically, and says so', async () => {
  const proper = await solve('∫_0^1 sqrt(1+x^4) dx');
  assert.equal(proper.status, 'solved');
  assert.equal(proper.answer, '∫_0^1 (sqrt(1 + x^4)) dx ≈ 1.0894 (numerical)');
  assert.match(plain(proper), /No antiderivative of sqrt\(1 \+ x\^4\) was found/);
  assert.match(plain(proper), /Simpson's rule: with 2000 subintervals ≈ 1\.08942941, with 4000 ≈ 1\.0894294/);
  assert.match(stripMathMarkers(proper.common_mistakes[0]), /Writing the estimate as an exact value/);
  const improper = await solve('∫_0^∞ e^(-x^2)/(1+x^2) dx');
  assert.equal(improper.answer, '∫_0^∞ (e^(-x^2)/(1 + x^2)) dx ≈ 0.6716 (numerical)');
  assert.match(plain(improper), /Integrating from 0 to t: t = 100 gives ≈ 0\.671647, 1000 gives ≈ 0\.671647/);
  assert.match(plain(improper), /maps the infinite range onto \[0, 1\)/);
  // A slow tail is still refused — the estimates do not settle.
  const slow = await solve('∫_1^∞ 1/x^1.1 dx');
  assert.equal(slow.status, 'unsupported');
  assert.match(plain(slow), /do not settle/);
  // Famous non-elementary integrands say which special function, never "may have an elementary answer".
  assert.match((await solve('e^x/x')).answer, /exponential integral Ei\(x\)/);
  assert.match((await solve('e^(-x)/x')).answer, /exponential integral −Ei\(−x\)/);
  assert.match((await solve('cos(x)/x')).answer, /cosine integral Ci\(x\)/);
  assert.match((await solve('1/ln(x)')).answer, /logarithmic integral li\(x\)/);
  assert.equal((await solve('∫_1^2 e^x/x dx')).answer, '∫_1^2 (e^x/x) dx ≈ 3.0591 (numerical)');
  // The indefinite path's tip is now true of its own example.
  const indefinite = await solve('sqrt(1+x^4)');
  assert.equal(indefinite.status, 'unsupported');
  assert.match(stripMathMarkers(indefinite.tips.join('\n')), /A definite version is estimated numerically: give the bounds/);
  assert.doesNotMatch(JSON.stringify(indefinite), /\bI (could|was|am)\b/);
});

test('one-line table steps name and derive their method', async () => {
  const tan = await solve('tan(x)');
  assert.equal(tan.answer, '∫(tan(x)) dx = -ln|cos(x)| + C');
  assert.match(plain(tan), /Write tan as a quotient: tan\(x\) = sin\(x\)\/cos\(x\)/);
  assert.match(plain(tan), /let u = cos\(x\), du = −sin\(x\) dx/);
  const sec = await solve('sec(x)');
  assert.equal(sec.answer, '∫(sec(x)) dx = ln|sec(x) + tan(x)| + C');
  assert.match(plain(sec), /Multiply by \(sec\(x\) \+ tan\(x\)\)\/\(sec\(x\) \+ tan\(x\)\)/);
  const radical = await solve('1/(x^2*sqrt(x^2+9))');
  assert.equal(radical.answer, '∫(1/(x^2*sqrt(x^2 + 9))) dx = -√(x^2 + 9)/(9x) + C');
  assert.match(plain(radical), /Trigonometric substitution: the radical √\(x² \+ a²\) with a = 3 calls for x = 3·tan θ/);
  assert.doesNotMatch(plain(radical), /u-substitution/);
  assert.match(plain(await solve('cos(x)^4')), /Trigonometric identity: even powers/);
  assert.match(plain(await solve('sin(x)^2*cos(x)^2')), /Trigonometric identity/);
  assert.doesNotMatch(plain(await solve('sin(x)^2*cos(x)^2')), /Integration by parts/);
  const divided = await solve('x^3/(x-1)');
  assert.equal(divided.answer, '∫(x^3/(x - 1)) dx = 1/3*x^3 + 1/2*x^2 + x + ln|x - 1| + C');
  assert.match(plain(divided), /divide first: x\^3\/\(x - 1\) = x\^2 \+ x \+ 1 \+ \(1\)\/\(x - 1\)/);
});

test('the reviewer\'s 26 solved integrals still solve, with the same answers', async () => {
  const pinned = [
    ['x*e^x', '∫(x*e^x) dx = e^x*(x - 1) + C'],
    ['e^x*sin(x)', '∫(e^x*sin(x)) dx = 1/2*e^x*(-cos(x) + sin(x)) + C'],
    ['sqrt(1-x^2)', '∫(sqrt(1 - x^2)) dx = 1/2*arcsin(x) + 1/2*x*√(1 - x^2) + C'],
    ['1/(x^3+1)', '∫(1/(x^3 + 1)) dx = 1/3*ln|x + 1| - 1/6*ln|x^2 - x + 1| + 1/3*√3*arctan((2x - 1)/√3) + C'],
    ['(x+1)/((x-1)^2*(x^2+1))', '∫((x + 1)/((x - 1)^2*(x^2 + 1))) dx = -1/2*ln|x - 1| - 1/(x - 1) + 1/4*ln(x^2 + 1) - 1/2*arctan(x) + C'],
    ['1/(x^2+2x+5)', '∫(1/(x^2 + 2x + 5)) dx = 1/2*arctan((x + 1)/2) + C'],
    ['x^2/(x^2+1)', '∫(x^2/(x^2 + 1)) dx = x - arctan(x) + C'],
    ['∫_1^∞ 1/x^2 dx', '∫_1^∞ (1/x^2) dx = 1'],
    ['∫_0^1 ln(x) dx', '∫_0^1 (ln(x)) dx = -1'],
    ['sin(x)^2', '∫(sin(x)^2) dx = 1/2*(x - 1/2*sin(2x)) + C'],
    ['sec(x)^2*tan(x)', '∫(sec(x)^2*tan(x)) dx = 1/2*tan(x)^2 + C'],
    ['∫_0^(pi/2) sin(x)^3 dx', '∫_0^(π/2) (sin(x)^3) dx = 2/3 (≈ 0.6667)'],
  ];
  for (const [problem, answer] of pinned) assert.equal((await solve(problem)).answer, answer, problem);
  assert.equal((await solve('∫_1^∞ 1/x dx')).status, 'diverges');
  assert.match((await solve('∫_0^1 e^(-x^2) dx')).answer, /erf\(1\) \(≈ 0\.7468\)/);
});
