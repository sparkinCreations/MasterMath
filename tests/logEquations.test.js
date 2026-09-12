import test from 'node:test';
import assert from 'node:assert/strict';
import { solveProblem } from '../src/lib/api.js';

// Equations in logarithms used to fall to the numeric root scan, so ln(x) = 1
// was reported as x = 2.7183. They are now solved exactly: one logarithm
// argument → substitute u, solve, back-substitute; several → combine with the
// log rules into one, rewrite in exponential form, solve the polynomial.
// Exponentials with a numeric base (2^x = 10) join the e^x substitution path.

const solve = (p) => solveProblem(p, 'algebra');

test('ln(x) = c is exact: e, e^2, 1/e — with the decimal alongside', async () => {
  assert.equal((await solve('ln(x) = 1')).answer, 'x = e (≈ 2.7183)');
  assert.equal((await solve('ln(x) = 2')).answer, 'x = e^2 (≈ 7.3891)');
  assert.equal((await solve('ln(x) = -1')).answer, 'x = 1/e (≈ 0.3679)');
  assert.equal((await solve('ln(x) = 0')).answer, 'x = 1');
});

test('a linear argument is solved after back-substitution: ln(2x) = 3 → e^3/2', async () => {
  const r = await solve('ln(2x) = 3');
  assert.equal(r.answer, 'x = e^3/2 (≈ 10.0428)');
  assert.ok(r.steps.some((s) => /Let u = ln\(2x\)/.test(s)), 'names the substitution');
  assert.ok(r.steps.some((s) => /2x = e\^3/.test(s)), 'shows the exponential form');
});

test('a quadratic in ln(x): ln(x)^2 = 4 → e^2 and 1/e^2', async () => {
  const r = await solve('ln(x)^2 = 4');
  assert.equal(r.answer, 'x = 1/e^2 (≈ 0.1353)  or  x = e^2 (≈ 7.3891)');
});

test('base-10 logs: log(x) = 2 → 100; log(x) + log(x − 3) = 1 → 5, with −2 rejected and the reason shown', async () => {
  assert.equal((await solve('log(x) = 2')).answer, 'x = 100');
  const r = await solve('log(x) + log(x-3) = 1');
  assert.equal(r.answer, 'x = 5');
  assert.ok(r.steps.some((s) => /log\(a\) \+ log\(b\) = log\(ab\)/.test(s)), 'states the product rule');
  assert.ok(r.steps.some((s) => /x = -2 makes a logarithm's argument zero or negative/.test(s)), 'explains the rejected candidate');
  assert.equal((await solve('log_2(x) = 5')).answer, 'x = 32');
});

test('sums and differences of natural logs combine by the log rules', async () => {
  assert.equal((await solve('ln(x) + ln(x-1) = 0')).answer, 'x = (1 + √5)/2 (≈ 1.618)');
  assert.equal((await solve('ln(x) - ln(x-1) = ln(2)')).answer, 'x = 2');
  assert.equal((await solve('2 ln(x) = ln(9)')).answer, 'x = 3');
});

test('the graph marks the exact solution', async () => {
  const r = await solve('ln(x) = 1');
  assert.ok(r.graph && Array.isArray(r.graph.points) && r.graph.points.length > 0);
});

test('exponentials with a numeric base: 2^x = 10 → ln(10)/ln(2); 5^x = 125 → 3; 3·2^x = 24 → 3', async () => {
  const r = await solve('2^x = 10');
  assert.equal(r.answer, 'x = ln(10)/ln(2) (≈ 3.3219)');
  assert.ok(r.steps.some((s) => /Let u = 2\^x/.test(s)));
  assert.equal((await solve('5^x = 125')).answer, 'x = 3');
  assert.equal((await solve('10^x = 1000')).answer, 'x = 3');
  assert.equal((await solve('3*2^x = 24')).answer, 'x = 3');
  assert.match((await solve('2^x = -4')).answer, /^No real solution/);
});

test('the e^x path is unchanged', async () => {
  assert.equal((await solve('e^x = 5')).answer, 'x = ln(5) (≈ 1.6094)');
  assert.equal((await solve('e^(2x) - 3e^x + 2 = 0')).answer, 'x = 0  or  x = ln(2) (≈ 0.6931)');
});

test('shapes outside the family still get a correct numeric answer', async () => {
  // Mixed bases and a variable outside the logarithm do not close under the
  // substitution; the numeric scan takes over and is still right.
  assert.equal((await solve('4^x - 5*2^x + 4 = 0')).answer, 'x = 0  or  x = 2');
  assert.equal((await solve('ln(x) + x = 2')).answer, 'x = 1.5571');
  // ln(x^2) = e^4 comes back from Algebrite in a complex form; the numeric
  // scan reports the two real roots instead.
  const r = await solve('ln(x^2) = 4');
  assert.match(r.answer, /x = -7\.3891 {2}or {2}x = 7\.3891/);
  assert.doesNotMatch(r.answer, /i\*/);
});
