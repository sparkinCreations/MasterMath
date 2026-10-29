// 1.58.0: the October 28 review round — superscript powers on a function in
// an integral (two confidently wrong answers), sec^3(x) refused, statuses that
// disagreed, x/0 = 1, abs in a limit's answer, textbook antiderivative forms,
// solve-for-y, an exact y-intercept, √ of a negative, the trig substitution
// worked in θ, how x⁴ + 4 factors, no eval in the trig-power solver.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { solveProblem } from '../src/lib/api.js';
import { parseMathExpression } from '../src/lib/mathParser.js';
import { stripMathMarkers } from '../src/lib/mathMarkers.js';
import { STATUS } from '../src/lib/solutionEnvelope.js';

const plain = (r) => r.steps.map(stripMathMarkers).join('\n');

test('a superscript on a function name is a power of the function', () => {
  assert.equal(parseMathExpression('sec³x'), '(sec(x))^3');
  assert.equal(parseMathExpression('sin²x + cos²x'), '(sin(x))^2+(cos(x))^2');
  assert.equal(parseMathExpression('2sin²(x)'), '2*(sin(x))^2');
  assert.equal(parseMathExpression('ln²x'), '(ln(x))^2');
  // Two textbook powers side by side are a product, not ^2(…).
  assert.equal(parseMathExpression('sin^2(x) cos^3(x)'), '(sin(x))^2*(cos(x))^3');
});

test('∫ sec³x and ∫ cos³x are integrated, not read as sec·x and cos(cos(1))·x', async () => {
  const sec = await solveProblem('∫ sec³x dx', 'auto');
  assert.equal(sec.status, STATUS.SOLVED);
  assert.equal(sec.answer, '∫((sec(x))^3) dx = 1/2*sec(x)*tan(x) + 1/2*ln|sec(x) + tan(x)| + C');
  const cos = await solveProblem('∫ cos³x dx', 'auto');
  assert.equal(cos.answer, '∫((cos(x))^3) dx = -1/3*sin(x)^3 + sin(x) + C');
});

test('a function with no argument is refused on the integral and limit paths', async () => {
  for (const p of ['∫ sec dx', '∫_0^1 sin dx', 'integral of cos from 0 to 1', 'lim x->0 sin/x']) {
    const r = await solveProblem(p, 'auto');
    assert.equal(r.status, STATUS.PARSE_ERROR, p);
    assert.match(r.answer, /needs an argument in parentheses/, p);
  }
});

test('the trig-power methods take the textbook notations', async () => {
  const want = '1/2*sec(x)*tan(x) + 1/2*ln|sec(x) + tan(x)| + C';
  for (const p of ['∫ sec^3(x) dx', '∫ sec^3 x dx', 'integrate sec^3(x)']) {
    const r = await solveProblem(p, 'auto');
    assert.ok(r.answer.endsWith(want), `${p}: ${r.answer}`);
    assert.match(plain(r), /reduction formula/, p);
  }
  assert.match((await solveProblem('∫ cos^5 x dx', 'auto')).answer, /= -2\/3\*sin\(x\)\^3 \+ 1\/5\*sin\(x\)\^5 \+ sin\(x\) \+ C$/);
  assert.match((await solveProblem('∫ sin^2(x) cos^3(x) dx', 'auto')).answer, /= 1\/3\*sin\(x\)\^3 - 1\/5\*sin\(x\)\^5 \+ C$/);
  // ∫ sin³x now takes the worked odd-power route: −cos x + cos³x/3.
  assert.match((await solveProblem('∫ sin^3(x) dx', 'auto')).answer, /= -cos\(x\) \+ 1\/3\*cos\(x\)\^3 \+ C$/);
});

test('a fraction coefficient stays a fraction, and the trig-power solver never evals', async () => {
  assert.equal((await solveProblem('∫ 1/2 sec(x)^3 dx', 'auto')).answer, '∫(1/2*sec(x)^3) dx = 1/4*sec(x)*tan(x) + 1/4*ln|sec(x) + tan(x)| + C');
  // The CSP has no 'unsafe-eval': no eval and no new Function anywhere in src.
  const files = [];
  const walk = (dir) => { for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) walk(p); else if (/\.jsx?$/.test(f)) files.push(p); } };
  walk('src');
  for (const f of files) {
    const code = readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(code, /(?<![.\w])eval\s*\(|new\s+Function\s*\(/, f);
  }
});

test('"no real solution" is solved for every equation; tan(π/2) is undefined, as 1/0 is', async () => {
  for (const p of ['sin(x) = 2', 'e^x = -1', 'sec(x) = 1/2']) {
    const r = await solveProblem(p, 'auto');
    assert.equal(r.status, STATUS.SOLVED, p);
    assert.match(r.answer, /^No real solution/, p);
  }
  assert.equal((await solveProblem('sin(x) = 2', 'auto')).answer, 'No real solution (sin(θ) is never outside [−1, 1])');
  const tan = await solveProblem('tan(pi/2)', 'auto');
  assert.equal(tan.status, STATUS.UNDEFINED);
  assert.equal(tan.answer, 'Undefined — cos(π/2) = 0');
  assert.equal((await solveProblem('1/0', 'auto')).status, STATUS.UNDEFINED);
});

test('an equation that divides by a constant zero is undefined, as 1/0 is, and says why', async () => {
  const r = await solveProblem('x/0 = 1', 'auto');
  assert.equal(r.status, STATUS.UNDEFINED);
  assert.equal(r.answer, 'Undefined — x/0 divides by zero, so no value satisfies the equation');
  assert.equal((await solveProblem('(x+1)/(2-2) = 3', 'auto')).answer, 'Undefined — (x + 1)/(2 - 2) divides by zero, so no value satisfies the equation');
  assert.equal((await solveProblem('x/(1/2) = 4', 'auto')).answer, 'x = 2');
});

test('a limit\'s answer writes |x|, not abs(x)', async () => {
  assert.equal((await solveProblem('lim x->0 |x|/x', 'auto')).answer, 'lim (x→0) |x|/x does not exist');
});

test('ln antiderivatives read as a textbook writes them', async () => {
  const ln = await solveProblem('∫ ln(x) dx', 'auto');
  assert.equal(ln.answer, '∫(ln(x)) dx = x*ln(x) - x + C');
  assert.match(plain(ln), /u = ln\(x\)/);
  assert.doesNotMatch(plain(ln), /ln\|x\|/);
  assert.equal((await solveProblem('∫ x ln(x) dx', 'auto')).answer, '∫(x*ln(x)) dx = 1/2*x^2*ln(x) - 1/4*x^2 + C');
  assert.equal((await solveProblem('∫ ln(x)/x dx', 'auto')).answer, '∫(ln(x)/x) dx = 1/2*ln(x)^2 + C');
  // 1/x keeps its bars: it is defined for x < 0 too.
  assert.equal((await solveProblem('∫ 1/x dx', 'auto')).answer, '∫(1/x) dx = ln|x| + C');
});

test('one equation in x and y is solved for y unless another letter is asked for', async () => {
  assert.equal((await solveProblem('2x + 3y = 6', 'auto')).answer, 'y = -2/3*x + 2');
  assert.equal((await solveProblem('x^2 + y^2 = 25', 'auto')).answer, 'y = ±√(25 - x^2)');
  for (const p of ['solve for x: 2x + 3y = 6', 'solve 2x + 3y = 6 for x', '2x + 3y = 6, solve for x', '2x + 3y = 6 solve for x']) {
    assert.equal((await solveProblem(p, 'auto')).answer, 'x = -3/2*y + 3', p);
  }
});

test('the y-intercept is exact, as the extrema are', async () => {
  const r = await solveProblem('f(x) = (x^2-1)/(x^2-4)', 'functions');
  assert.match(r.answer, /y-intercept \(0, 1\/4\);/);
  assert.match(r.answer, /local maximum \(0, 1\/4\)/);
  assert.match((await solveProblem('f(x) = sqrt(x+2)', 'functions')).answer, /y-intercept \(0, √2\)/);
});

test('the square root of a negative number is exact, with tips about i', async () => {
  const four = await solveProblem('sqrt(-4)', 'auto');
  assert.equal(four.answer, '2i');
  const tips = four.tips.map(stripMathMarkers).join(' ');
  assert.match(tips, /i = √\(−1\)/);
  assert.doesNotMatch(tips, /irrational/);
  const eight = await solveProblem('sqrt(-8)', 'auto');
  assert.equal(eight.answer, '2√2·i (≈ 2.8284i)');
  assert.match(plain(eight), /√\(−8\) = √8·i = 2√2·i/);
});

test('the trig substitution is worked in θ and turned back with the triangle', async () => {
  const r = await solveProblem('∫ 1/(x^2*sqrt(x^2+9)) dx', 'auto');
  assert.equal(r.answer, '∫(1/(x^2*sqrt(x^2 + 9))) dx = -√(x^2 + 9)/(9x) + C');
  const s = plain(r);
  assert.match(s, /substitute x = 3tan θ/);
  assert.match(s, /= 1\/9·∫sec θ\/tan²θ dθ/);
  assert.match(s, /∫cos θ\/sin²θ dθ = -1\/sin θ/);
  assert.match(s, /sin θ = x\/√\(x² \+ 9\)/);
  const cases = [
    ['∫ sqrt(x^2+4) dx', '2ln|x + √(x^2 + 4)| + 1/2*x*√(x^2 + 4) + C', /4·∫sec³θ dθ/],
    ['∫ x^2/sqrt(9-x^2) dx', '1/2*(9arcsin(1/3*x) - x*√(9 - x^2)) + C', /substitute x = 3sin θ/],
    ['∫ 1/(x^2+9)^(3/2) dx', 'x/(9√(x^2 + 9)) + C', /1\/9·∫1\/sec θ dθ/],
    ['∫ sqrt(x^2-4)/x dx', '-2arctan(1/2*√(x^2 - 4)) + √(x^2 - 4) + C', /substitute x = 2sec θ/],
    ['∫ 1/sqrt(x^2-9) dx', 'ln|x + √(x^2 - 9)| + C', /the constant −ln 3 joins C/],
  ];
  for (const [p, answer, step] of cases) {
    const c = await solveProblem(p, 'auto');
    assert.ok(c.answer.endsWith(`= ${answer}`), `${p}: ${c.answer}`);
    assert.match(plain(c), step, p);
  }
});

test('x⁴ + 4 is shown factoring as a difference of squares', async () => {
  const r = await solveProblem('∫ 1/(x^4+4) dx', 'auto');
  assert.match(plain(r), /x⁴ \+ 4 = \(x⁴ \+ 4x² \+ 4\) − 4x² = \(x² \+ 2\)² − \(2x\)² = \(x² − 2x \+ 2\)\(x² \+ 2x \+ 2\)/);
  assert.match(r.answer, /1\/8\*arctan\(x - 1\)/);
  assert.doesNotMatch(r.answer, /arctan\(\(/);
});

test('parametric and polar curves are refused, not answered f\'(x) = 0', async () => {
  for (const p of ['derivative of x = t^2, y = t^3', 'x = cos(t), y = sin(t)']) {
    const r = await solveProblem(p, 'auto');
    assert.equal(r.status, STATUS.UNSUPPORTED, p);
    assert.equal(r.answer, 'Parametric curves are not supported yet', p);
  }
  assert.equal((await solveProblem('r = 2cos(theta)', 'auto')).answer, 'Polar curves are not supported yet');
  // Not parametric: a system, a point, an equation in x and y.
  assert.equal((await solveProblem('x + y = 1, x - y = 3', 'auto')).status, STATUS.SOLVED);
  assert.equal((await solveProblem('x = 2, y = 3', 'auto')).status, STATUS.SOLVED);
  assert.equal((await solveProblem('find dy/dx if x^2 + y^2 = 25', 'auto')).answer, 'dy/dx = -x/y');
});

test('integrals and derivatives say what they read, before any step', async () => {
  assert.equal((await solveProblem('∫ sec³x dx', 'auto')).readAs, '∫ sec^3(x) dx');
  assert.equal((await solveProblem('∫_0^1 x^2 dx', 'auto')).readAs, '∫_0^1 x^2 dx');
  assert.equal((await solveProblem('d/dx x^2 sin(x)', 'auto')).readAs, 'd/dx (x^2*sin(x))');
  assert.equal((await solveProblem('second derivative of x*e^x', 'auto')).readAs, 'd^2/dx^2 (x*e^x)');
  // Nothing to show for input that could not be read.
  assert.equal((await solveProblem('∫ sec dx', 'auto')).readAs, undefined);
});

test('the whole-Algebrite fallback is verified too, with other letters as constants', async () => {
  // These reach the fallback (1.57.3 showed sec·x + C from it, unchecked).
  // The check gives every other letter a fixed value, so a correct answer
  // with constants in it still passes and is shown.
  assert.equal((await solveProblem('∫ x^2 dy', 'auto')).answer, '∫(x^2) dy = x^2*y + C');
  assert.equal((await solveProblem('∫ sin(k*t) dt', 'auto')).answer, '∫(sin(k*t)) dt = -cos(k*t)/k + C');
  const src = readFileSync('src/lib/solvers/integralsSolver.js', 'utf8');
  const fallback = src.slice(src.indexOf('fall back to whole-Algebrite'));
  assert.match(fallback.slice(0, 2000), /if \(!fallbackTrusted\) throw/);
});
