// Wrong answers the registered cross-check found (tests/equationCrossCheck.test.js),
// each stated exactly: a scan shows an answer disagrees, this says what is right.
import test from 'node:test';
import assert from 'node:assert/strict';
import { solvePlain } from './helpers/solvePlain.js';

test('the two sides being the same product is an identity on its domain', async () => {
  assert.equal((await solvePlain('(x-1)*(x-2) = (x-1)*(x-2)', 'algebra')).answer, 'All real numbers (identity — true for every x)');
  assert.equal((await solvePlain('(x-2)*(x+2)*(x-3) = (x-2)*(x+2)*(x-3)', 'algebra')).answer, 'All real numbers (identity — true for every x)');
  const root = await solvePlain('(x-2)*sqrt(x+2) = (x-2)*sqrt(x+2)', 'algebra');
  assert.doesNotMatch(root.answer, /^x = /);
  // A real common factor still splits.
  assert.equal((await solvePlain('x*ln(x) = x', 'algebra')).answer.includes('e'), true);
});

test('a decimal inside an absolute value is solved, never typed back', async () => {
  for (const [p, answer] of [
    ['2*abs(3*x - 0.3) = 0.3', 'x = 1/20  or  x = 3/20'],
    ['abs(x-0.3) = 0.3', 'x = 0  or  x = 3/5'],
    ['abs(-1*x - 0.5) = -2*x - 0.2', 'x = -7/30'],
  ]) {
    const r = await solvePlain(p, 'algebra');
    assert.equal(r.status, 'solved', p);
    assert.equal(r.answer, answer, p);
  }
});

test('decimals made fractions read without extra brackets', async () => {
  for (const [p, shown] of [['abs(x-0.3) = 0.3', '|x - 3/10|'], ['abs(x-0.1) + abs(x-0.3) = 1', '|x - 1/10|']]) {
    const r = await solvePlain(p, 'algebra');
    assert.ok(r.steps.some((s) => s.includes(shown)), r.steps.join('\n'));
    assert.ok(!r.steps.some((s) => /\(\d+\/\d+\)/.test(s)), r.steps.join('\n'));
  }
  // Kept where it changes the meaning.
  assert.equal((await solvePlain('abs(x/0.5) + abs(x-1) = 4', 'algebra')).answer, 'x = -1  or  x = 5/3');
});

test('an equation that cannot be worked is refused, not typed back as solved', async () => {
  const { solveAlgebra } = await import('../src/lib/solvers/algebraSolver.js');
  const r = await solveAlgebra('x + 1 = sin(');
  assert.notEqual(r.status ?? 'solved', 'solved');
});

test('a negative root under a fractional power is found by the search', async () => {
  const r = await solvePlain('x^(2/3) - 0.3*x^(1/3) - 0.4 = 0', 'algebra');
  assert.match(r.answer, /-0\.125|-1\/8/);
  assert.match(r.answer, /0\.512/);
});

test('a rounded root stays rounded when another candidate is rejected', async () => {
  const r = await solvePlain('x^3 - 4*x - 3 + (x+4)/(x+4) = 1', 'algebra');
  assert.match(r.answer, /x ≈ -1\.3028/);
  assert.doesNotMatch(r.answer, /x = -1\.3028/);
  const cubic = await solvePlain('x^3 - 2*x - 3 + (x-1)/(x-1) = 1', 'algebra');
  assert.equal(cubic.answer, 'x ≈ 1.8933');
});

test('a cubic with an irrational coefficient comes back as decimals, not Cardano', async () => {
  for (const [p, real] of [
    ['x^3 - 2*pi*x + 4*pi = 0', 1], // Δ < 0
    ['x^3 - 6*sqrt(2)*x + 1 = 0', 3], // Δ > 0
    ['x^3 - 6*e*x - 2*e = 0', 3],
  ]) {
    const r = await solvePlain(p, 'algebra');
    assert.equal(r.status, 'solved', p);
    assert.ok(r.answer.length < 90, `${p}: ${r.answer}`);
    assert.doesNotMatch(r.answer, /\^\(1\/2\)|√/, p);
    const reals = r.answer.split(/\s{2}or\s{2}/).filter((t) => !/i\b/.test(t));
    assert.equal(reals.length, real, r.answer);
    assert.ok(reals.every((t) => t.includes('≈')), r.answer);
    assert.ok(r.steps.some((s) => s.includes('discriminant')), r.steps.join('\n'));
  }
  // A cubic in form only, and a repeated root, keep their own routes.
  const form = await solvePlain('(e^x)^3 = 8', 'algebra');
  assert.match(form.answer, /0\.6931/);
  assert.ok(!form.steps.some((s) => s.includes('discriminant')), form.steps.join('\n'));
  assert.match((await solvePlain('(x-pi)^2*(x+1) = 0', 'algebra')).answer, /π|pi/);
});

const numbers = (answer) => answer.split(/\s{2}or\s{2}/).filter((t) => !/\di\b|(?<![a-z])i(?![a-z])/.test(t)).map((t) => Number(t.replace(/^x [≈=] /, '').replace(/ \(.*$/, '')));
const near = (got, want, tol = 1e-3) => got.length === want.length && [...got].sort((p, q) => p - q).every((x, i) => Math.abs(x - want[i]) <= tol);

test('a decimal mixed with an irrational coefficient does not lose a root', async () => {
  for (const [p, want] of [
    ['(x-pi)*(x-pi-0.01)*(x+1) = 0', [-1, Math.PI, Math.PI + 0.01]],
    ['(x-pi)*(x-pi-0.25)*(x+1) = 0', [-1, Math.PI, Math.PI + 0.25]],
    ['x^3 - 0.5*pi*x^2 - x + 0.5*pi = 0', [-1, 1, Math.PI / 2]],
    ['(x-0.5*sqrt(2))*(x+1.5)*(x-3) = 0', [-1.5, Math.SQRT2 / 2, 3]],
  ]) {
    const r = await solvePlain(p, 'algebra');
    assert.equal(r.status, 'solved', p);
    assert.ok(near(numbers(r.answer).map(Number), want), `${p} → ${r.answer}`);
  }
});

test('an answer that divides by 0 is refused, never shown as solved', async () => {
  const cubic = (gap) => `x^3 - (sqrt(2) + (sqrt(2) + 1/${gap}) + 3)*x^2 + (sqrt(2)*(sqrt(2) + 1/${gap}) + 3*sqrt(2) + 3*(sqrt(2) + 1/${gap}))*x - 3*sqrt(2)*(sqrt(2) + 1/${gap}) = 0`;
  for (const gap of [1e8, 1e10, 1e13]) {
    const r = await solvePlain(cubic(gap), 'algebra');
    assert.doesNotMatch(String(r.answer), /\/0(?![\d.])/, r.answer);
    assert.notEqual(r.status, 'solved', r.answer);
  }
  const { finalizeResult } = await import('../src/lib/api/finalize.js');
  const shown = finalizeResult({ status: 'solved', answer: 'x = 3  or  x = 1/0 + √2', steps: ['Solution'], tips: [], common_mistakes: [] }, 'x = 3');
  assert.notEqual(shown.status, 'solved');
  // 1/0.5 is an ordinary number.
  assert.equal(finalizeResult({ status: 'solved', answer: 'x = 1/0.5', steps: ['Solution'], tips: [], common_mistakes: [] }, 'x').status, 'solved');
});

test('a cubic with an irrational coefficient, at every multiplicity', async () => {
  const pi = Math.PI;
  const r2 = Math.SQRT2;
  const expanded = (a, b, c) => `x^3 - (${a} + ${b} + ${c})*x^2 + ((${a})*(${b}) + (${b})*(${c}) + (${a})*(${c}))*x - (${a})*(${b})*(${c}) = 0`;
  // Three distinct real roots, all approximate.
  for (const [p, want] of [
    [expanded('pi', '1', '-sqrt(2)'), [-r2, 1, pi]],
    [expanded('e', 'pi', '-2'), [-2, Math.E, pi]],
  ]) {
    const r = await solvePlain(p, 'algebra');
    assert.ok(near(numbers(r.answer), want), `${p} → ${r.answer}`);
    assert.ok(r.answer.split(/\s{2}or\s{2}/).every((t) => t.includes('≈')), r.answer);
  }
  // Double and triple roots, and two roots 10⁻⁶ apart, stay on the exact route.
  assert.equal((await solvePlain('(x-pi)^2*(x+1) = 0', 'algebra')).answer, 'x = -1  or  x = pi (repeated root, multiplicity 2)');
  assert.equal((await solvePlain(expanded('sqrt(2)', 'sqrt(2)', 'sqrt(2)'), 'algebra')).answer, 'x = √2 (repeated root, multiplicity 3)');
  const apart = await solvePlain(expanded('sqrt(2)', '(sqrt(2) + 1/1000000)', '3'), 'algebra');
  assert.equal(apart.answer.split(/\s{2}or\s{2}/).length, 3, apart.answer);
  // A rational cubic stays exact.
  assert.equal((await solvePlain('x^3 - 6*x^2 + 11*x - 6 = 0', 'algebra')).answer, 'x = 1  or  x = 2  or  x = 3');
  assert.equal((await solvePlain('x^3 - 3*x + 2 = 0', 'algebra')).answer, 'x = -2  or  x = 1 (multiplicity 2)');
});

test('complex roots of an irrational cubic balance the equation', async () => {
  const r = await solvePlain('x^3 + e*x^2 + pi*x + sqrt(2) = 0', 'algebra');
  const parts = r.answer.split(/\s{2}or\s{2}/);
  assert.equal(parts.length, 3, r.answer);
  const m = parts.map((t) => t.match(/≈ (-?[\d.]+)(?: ([+-]) ([\d.]+)i)?/));
  for (const [, re, sign, im] of m) {
    const z = [Number(re), sign ? (sign === '-' ? -1 : 1) * Number(im) : 0];
    const times = ([a, b], [c, d]) => [a * c - b * d, a * d + b * c];
    let v = [1, 0];
    for (const k of [Math.E, Math.PI, Math.SQRT2]) { v = times(v, z); v = [v[0] + k, v[1]]; }
    assert.ok(Math.hypot(...v) < 2e-3, `${re} ${im}: ${Math.hypot(...v)}`);
  }
});

test('a real root from the exact route that does not balance stops the answer', async () => {
  const { rootsBalance } = await import('../src/lib/solvers/algebra/polynomial.js');
  assert.equal(rootsBalance('[1,2]', 'x^2 - 3*x + 2', 'x'), true);
  assert.equal(rootsBalance('[1,5]', 'x^2 - 3*x + 2', 'x'), false, 'a root that does not balance');
  assert.equal(rootsBalance('[3,1/0+2^(1/2)]', 'x^2 - 3*x + 2', 'x'), false, 'a root that is not a number');
  // A complex pair says nothing about the real roots.
  assert.equal(rootsBalance('[-i,i]', 'x^2 + 1', 'x'), true);
  // A large root is judged against the size of its terms.
  assert.equal(rootsBalance('[1000000]', 'x^3 - 1000000000000000000', 'x'), true);
  // The refusal says what happened, in place of the division by 0.
  const gap = 1e9;
  const r = await solvePlain(`x^3 - (sqrt(2) + (sqrt(2) + 1/${gap}) + 3)*x^2 + (sqrt(2)*(sqrt(2) + 1/${gap}) + 3*sqrt(2) + 3*(sqrt(2) + 1/${gap}))*x - 3*sqrt(2)*(sqrt(2) + 1/${gap}) = 0`, 'algebra');
  assert.notEqual(r.status, 'solved', r.answer);
});

test('the substitution check is sized by the terms of the equation', async () => {
  const { rootsBalance } = await import('../src/lib/solvers/algebra/polynomial.js');
  // Very large coefficients: correct exact roots are not refused.
  assert.equal((await solvePlain('10000000000000*x^2 = 20000000000000', 'algebra')).answer, 'x = -√2  or  x = √2');
  // Solving this one takes Algebrite a minute, so its roots are checked directly.
  assert.equal(rootsBalance('[-3/2-1/2*13^(1/2),-3/2+1/2*13^(1/2)]', '1000000000000000*x^2 + 3000000000000000*x - 1000000000000000', 'x'), true);
  assert.equal(rootsBalance('[2^(1/2),-2^(1/2)]', '10000000000000*x^2 - 20000000000000', 'x'), true);
  // Very small coefficients: a wrong root does not slip under the tolerance.
  assert.equal(rootsBalance('[1.5]', '0.000001*x^2 - 0.000002', 'x'), false);
  assert.equal(rootsBalance('[3,-3]', '0.0000001*x^2 - 0.0000002', 'x'), false);
  assert.equal(rootsBalance('[2^(1/2),-2^(1/2)]', '0.000001*x^2 - 0.000002', 'x'), true);
});

test('roots are checked in the original equation, complex ones too', async () => {
  const { rootsBalance } = await import('../src/lib/solvers/algebra/polynomial.js');
  assert.equal(rootsBalance('[1,-1]', 'x^2 - 1', 'x', 'x^2 = 1'), true);
  assert.equal(rootsBalance('[1,-1]', 'x^2 - 1', 'x', 'x^2 = 2'), false, 'balances the working polynomial, not the equation');
  assert.equal(rootsBalance('[i,-i]', 'x^2 + 1', 'x'), true);
  assert.equal(rootsBalance('[1+i,1-i]', 'x^2 + 1', 'x'), false, 'a complex root that does not balance');
  assert.equal(rootsBalance('[0.150000...]', 'x - 0.15', 'x'), false, 'a root nothing can read');
});

test('a root at a zero of a denominator is rejected on the exact route', async () => {
  for (const [p, answer] of [
    ['x^2/(x-1-sqrt(2)) = (1+sqrt(2))^2/(x-1-sqrt(2))', /^x ≈ -2\.4142$/],
    ['(x^2-2)/(x-sqrt(2)) = 0', /^x ≈ -1\.4142$/],
  ]) {
    const r = await solvePlain(p, 'algebra');
    assert.match(r.answer, answer, `${p} → ${r.answer}`);
    assert.ok(r.steps.some((s) => /undefined/.test(s)), r.steps.join('\n'));
  }
  // A real root beside a denominator stays.
  assert.equal((await solvePlain('(x^2-4)/(x-3) = 0', 'algebra')).answer, 'x = -2  or  x = 2');
});

// The pieces of an answer as [re, im], read back from the text shown.
const shownRoots = (answer) => answer.split(/\s{2}or\s{2}/).map((t) => {
  assert.match(t, /^x ≈ /, `${t}: a decimal replacement is always ≈`);
  const m = t.match(/^x ≈ (-?[\d.]+)(?: ([+-]) ([\d.]*)i)?$/);
  assert.ok(m, `cannot read "${t}"`);
  return [Number(m[1]), m[2] ? (m[2] === '-' ? -1 : 1) * Number(m[3] || 1) : 0];
});

test('a complex root written without i is shown as a decimal with i', async () => {
  // x² + bx + c with b² < 4c: −b/2 ± i√(4c − b²)/2, worked out here on its own.
  for (const [p, b, c] of [
    ['x^2 + pi*x + 10 = 0', Math.PI, 10],
    ['x^2 + e*x + 10 = 0', Math.E, 10],
    ['x^2 + sqrt(pi)*x + 3 = 0', Math.sqrt(Math.PI), 3],
    ['x^2 + 0.5*pi*x + 10 = 0', 0.5 * Math.PI, 10],
  ]) {
    const r = await solvePlain(p, 'algebra');
    assert.equal(r.status, 'solved', p);
    const got = shownRoots(r.answer).sort((u, v) => u[1] - v[1]);
    const im = Math.sqrt(4 * c - b * b) / 2;
    assert.equal(got.length, 2, r.answer);
    assert.ok(Math.abs(got[0][0] + b / 2) < 1e-4 && Math.abs(got[1][0] + b / 2) < 1e-4, r.answer);
    assert.ok(Math.abs(got[0][1] + im) < 1e-4 && Math.abs(got[1][1] - im) < 1e-4, `the conjugate pair: ${r.answer}`);
    // The number displayed balances the equation to the rounding it carries.
    for (const [re, y] of got) assert.ok(Math.hypot(re * re - y * y + b * re + c, 2 * re * y + b * y) < 0.05, r.answer);
    assert.ok(r.steps.some((t) => /complex/.test(t)), r.steps.join('\n'));
  }
});

test('a real root written with i is shown as a real decimal', async () => {
  // No exact root in a + b√n for these, so the decimal is what is left.
  for (const [p, value, shown] of [['x^2 = 1 + sqrt(2)', Math.sqrt(1 + Math.SQRT2), '1.5538'], ['x^2 = 3 + sqrt(5)', Math.sqrt(3 + Math.sqrt(5)), '2.2882']]) {
    const r = await solvePlain(p, 'algebra');
    const got = shownRoots(r.answer).sort((u, v) => u[0] - v[0]);
    assert.ok(got.every(([, y]) => y === 0), r.answer);
    assert.ok(Math.abs(got[0][0] + value) < 1e-4 && Math.abs(got[1][0] - value) < 1e-4, r.answer);
    // The check in the steps says ≈ of a rounded root too.
    assert.ok(r.steps.some((t) => t.includes(`x ≈ ${shown} gives`)), r.steps.join('\n'));
    assert.ok(!r.steps.some((t) => t.includes(`x = ${shown}`)), r.steps.join('\n'));
  }
});

test('an exact form that says what it is stays exact', async () => {
  assert.equal((await solvePlain('x^2 + x + 1 = 0', 'algebra')).answer, 'x = (-1 - i√3)/2  or  x = (-1 + i√3)/2');
  assert.equal((await solvePlain('x^2 + 2 = 0', 'algebra')).answer, 'x = -i√2  or  x = i√2');
  assert.match((await solvePlain('x^2 + sqrt(2)*x + 3 = 0', 'algebra')).answer, /^x = .*i/);
  assert.match((await solvePlain('x^2 + pi*x + 1 = 0', 'algebra')).answer, /^x = /);
  // An imaginary part that is only rounding noise is not a complex root.
  const { writtenFormMisleads } = await import('../src/lib/solvers/algebra/polynomial.js');
  assert.equal(writtenFormMisleads('1 + 0.00000000000001*i'), true, 'written with i, equal to a real number');
  assert.equal(writtenFormMisleads('2^(1/2)'), false);
  assert.equal(writtenFormMisleads('1 + 2*i'), false);
  assert.equal(writtenFormMisleads('(-40 + pi^2)^(1/2)'), true);
});

test('roots in a + b√n are worked exactly, with a nested root undone', async () => {
  for (const [p, answer] of [
    ['x^2 = 3 + 2*sqrt(2)', 'x = -1 - √2  or  x = 1 + √2'],
    ['x^2 = (1+sqrt(2))^2', 'x = -1 - √2  or  x = 1 + √2'],
    ['x^2 = 3 - 2*sqrt(2)', 'x = 1 - √2  or  x = -1 + √2'],
    ['x^2 = 7 + 4*sqrt(3)', 'x = -2 - √3  or  x = 2 + √3'],
    ['x^3 - (sqrt(2) + sqrt(2) + 3)*x^2 + (sqrt(2)*sqrt(2) + sqrt(2)*3 + 3*sqrt(2))*x - sqrt(2)*sqrt(2)*3 = 0', 'x = √2 (repeated root, multiplicity 2)  or  x = 3'],
  ]) {
    const r = await solvePlain(p, 'algebra');
    assert.equal(r.status, 'solved', p);
    assert.equal(r.answer, answer, p);
    assert.ok(r.steps.some((t) => /a \+ b√/.test(t)), r.steps.join('\n'));
  }
  // Not a perfect square in that field: decimals stay, nothing is invented.
  assert.equal((await solvePlain('x^2 = 1 + sqrt(2)', 'algebra')).answer, 'x ≈ -1.5538  or  x ≈ 1.5538');
  assert.equal((await solvePlain('x^2 = 3 + sqrt(5)', 'algebra')).answer, 'x ≈ -2.2882  or  x ≈ 2.2882');
});

test('the field arithmetic proves what it returns', async () => {
  const { exactSurdRoots } = await import('../src/lib/solvers/algebra/surdRoots.js');
  const shown = (t) => exactSurdRoots(t, 'x')?.roots.map((r) => [r.text, r.multiplicity]);
  assert.deepEqual(shown('x^2 - 3 - 2*sqrt(2)'), [['-1 - √2', 1], ['1 + √2', 1]]);
  assert.deepEqual(shown('(x - sqrt(2))^2*(x - 3)'), [['√2', 2], ['3', 1]]);
  assert.deepEqual(shown('(x - sqrt(2))^3'), [['√2', 3]]);
  assert.equal(exactSurdRoots('x^2 - sqrt(2) - sqrt(3)', 'x'), null, 'two different radicals');
  assert.equal(exactSurdRoots('x^2 - pi', 'x'), null, 'π is not in the field');
  assert.equal(exactSurdRoots('x^2 - 1 - sqrt(2)', 'x'), null, 'no square root in the field');
  assert.equal(exactSurdRoots('x^3 - sqrt(2)*x + 1', 'x'), null, 'a cubic with no repeated root');
});

test('a quadratic with very large coefficients does not wait on Algebrite', async () => {
  for (const [p, answer] of [
    ['100000000000*x^2 + 300000000000*x - 100000000000 = 0', 'x = (-3 - √13)/2  or  x = (-3 + √13)/2'],
    ['1000000000000000*x^2 + 3000000000000000*x - 1000000000000000 = 0', 'x = (-3 - √13)/2  or  x = (-3 + √13)/2'],
    ['100000000000*x^2 - 500000000000*x + 600000000000 = 0', 'x = 2  or  x = 3'],
    ['100000000007*x^2 - 100000000007*x - 200000000014 = 0', 'x = -1  or  x = 2'],
    ['1000000007*x^2 + 1000000009*x + 3 = 0', null],
    ['1000000000000*x^2 + 1000000000000*x + 1000000000000 = 0', 'x = (-1 - i√3)/2  or  x = (-1 + i√3)/2'],
  ]) {
    const start = Date.now();
    const r = await solvePlain(p, 'algebra');
    assert.equal(r.status, 'solved', p);
    assert.ok(Date.now() - start < 8000, `${p}: ${Date.now() - start} ms`);
    if (answer) assert.equal(r.answer, answer, p);
  }
  // A common factor is divided out and said so.
  const common = await solvePlain('100000000000*x^2 + 300000000000*x - 100000000000 = 0', 'algebra');
  assert.ok(common.steps.some((t) => t.includes('Divide every term by the common factor 100000000000')), common.steps.join('\n'));
  // No common factor to remove: the formula, each root compared by value.
  const { endpointValue } = await import('./helpers/crossCheck.js');
  for (const [a, b, c] of [[1000000007, 3000000019, 1000000021], [1000000007, -5000000029, 2000000011]]) {
    const r = await solvePlain(`${a}*x^2 ${b < 0 ? '-' : '+'} ${Math.abs(b)}*x + ${c} = 0`, 'algebra');
    const got = r.answer.split(/\s{2}or\s{2}/).map((t) => endpointValue(t.replace(/^x = /, ''))).sort((u, v) => u - v);
    const want = [-1, 1].map((sign) => (-b + sign * Math.sqrt(b * b - 4 * a * c)) / (2 * a)).sort((u, v) => u - v);
    assert.ok(got.length === 2 && got.every((x, i) => Math.abs(x - want[i]) < 1e-6), `${r.answer}: wanted ${want}`);
  }
});

test('an unreadable closed form becomes decimals', async () => {
  const r = await solvePlain('x^4 + pi*x + 1 = 0', 'algebra');
  assert.equal(r.status, 'solved');
  const parts = r.answer.split(/\s{2}or\s{2}/);
  assert.equal(parts.length, 4, r.answer);
  assert.ok(parts.every((t) => t.length < 40 && t.includes('≈')), r.answer);
});

test('brackets round a whole equation are not part of either side', async () => {
  for (const [p, answer] of [
    ['(x^2 = 4)', 'x = -2  or  x = 2'],
    ['((2*x + 1 = 5))', 'x = 2'],
    ['( x + 1 = (2) )', 'x = 1'],
  ]) assert.equal((await solvePlain(p, 'auto')).answer, answer, p);
  // Brackets that belong to each side stay where they are.
  for (const [p, answer] of [
    ['(x+1)*(x-1) = (x+1)', 'x = -1  or  x = 2'],
    ['(x+1) = (x-1)*2', 'x = 3'],
    ['(x+1)/(x-1) = (2)', 'x = 3'],
  ]) assert.equal((await solvePlain(p, 'auto')).answer, answer, p);
  // An unbalanced bracket is still a typing slip.
  assert.notEqual((await solvePlain('(x^2 = 4', 'auto')).status, 'solved');
});

// The rule is tested on root lists directly: no equation with more than
// eight such roots solves on the Algebrite route inside the time budget.
test('a misleading form in a long list of roots is refused, a short one shown as decimals', async () => {
  const { rootListAnswer, MAX_DECIMAL_ROOTS } = await import('../src/lib/solvers/algebra/polynomial.js');
  const { create, all } = await import('mathjs');
  const m = create(all);
  const hiding = '(-40+pi^2)^(1/2)'; // complex, written with no i
  const list = (n, last) => `[${[...Array(n - 1)].map((_, k) => k + 1).concat(last).join(',')}]`;

  // One past the limit: refused, never shown as written.
  const long = rootListAnswer(list(MAX_DECIMAL_ROOTS + 1, hiding), 'x', new Map(), 'AS WRITTEN');
  assert.match(long.refuse ?? '', /too many to list as decimals/, JSON.stringify(long));

  // At the limit: every root shown, the hiding one as a decimal with i, each
  // shown value one of the list's values.
  const raw = list(MAX_DECIMAL_ROOTS, hiding);
  const short = rootListAnswer(raw, 'x', new Map(), 'AS WRITTEN');
  assert.ok(short.answer, JSON.stringify(short));
  assert.doesNotMatch(short.answer, /\^\(1\/2\)|AS WRITTEN/, short.answer);
  const values = raw.slice(1, -1).split(',').map((t) => m.complex(m.evaluate(t)));
  const shown = short.answer.split(/\s{2}or\s{2}/);
  assert.equal(shown.length, MAX_DECIMAL_ROOTS, short.answer);
  for (const piece of shown) {
    const [, sign, text] = piece.match(/^x ([=≈]) (.+)$/);
    const v = m.complex(m.evaluate(text.replace(/(\d)i\b/g, '$1*i')));
    const match = values.findIndex((u) => m.abs(m.subtract(u, v)) <= 1e-3 * (1 + m.abs(u)));
    assert.ok(match >= 0, `${piece} is none of the roots`);
    values.splice(match, 1);
    if (/i/.test(text)) assert.equal(sign, '≈', piece);
  }

  // Past the limit, a form that is only long (not misleading) stays as written.
  const longForm = `(${'1+'.repeat(40)}1)`;
  assert.equal(rootListAnswer(list(MAX_DECIMAL_ROOTS + 1, longForm), 'x', new Map(), 'AS WRITTEN').answer, 'AS WRITTEN');
});

// The solver's use of that rule, on either side of the limit: two complex
// roots written without i, beside six or seven whole ones.
test('the solver refuses nine roots with a misleading form and shows eight', async () => {
  const q = '(x^2 + pi*x + 10)';
  const nine = await solvePlain(`${q}*(x-1)*(x-2)*(x-3)*(x-4)*(x-5)*(x-6)*(x-7) = 0`, 'algebra');
  assert.equal(nine.status, 'unsupported', nine.answer);
  assert.ok(nine.steps.some((s) => /too many to list as decimals/.test(s)), nine.steps.join('\n'));
  const eight = await solvePlain(`${q}*(x-1)*(x-2)*(x-3)*(x-4)*(x-5)*(x-6) = 0`, 'algebra');
  assert.equal(eight.answer, 'x = 1  or  x = 2  or  x = 3  or  x = 4  or  x = 5  or  x = 6  or  x ≈ -1.5708 - 2.7446i  or  x ≈ -1.5708 + 2.7446i');
});

const quartic = (a, b, c, d) => {
  const pairs = [[a, b], [a, c], [a, d], [b, c], [b, d], [c, d]].map(([u, v]) => `(${u})*(${v})`).join(' + ');
  const triples = [[a, b, c], [a, b, d], [a, c, d], [b, c, d]].map((t) => t.map((u) => `(${u})`).join('*')).join(' + ');
  return `x^4 - (${a} + ${b} + ${c} + ${d})*x^3 + (${pairs})*x^2 - (${triples})*x + (${a})*(${b})*(${c})*(${d}) = 0`;
};
const pieces = (answer) => answer.split(/\s{2}or\s{2}/);

test('a quartic with an irrational coefficient accounts for all four roots', async () => {
  for (const [p, reals, complex] of [
    [quartic('pi', '1', '-sqrt(2)', '3'), [-Math.SQRT2, 1, 3, Math.PI], 0],
    ['x^4 + pi*x + 1 = 0', [-1.3378, -0.3217], 2],
    ['x^4 + e*x^2 + pi*x + 1 = 0', [], 4],
  ]) {
    const start = Date.now();
    const r = await solvePlain(p, 'algebra');
    assert.equal(r.status, 'solved', p);
    assert.ok(Date.now() - start < 4000, `${p}: ${Date.now() - start} ms`);
    const parts = pieces(r.answer);
    assert.equal(parts.length, 4, r.answer);
    assert.ok(parts.every((t) => t.startsWith('x ≈ ')), r.answer);
    const got = parts.filter((t) => !t.includes('i')).map((t) => Number(t.replace('x ≈ ', '')));
    assert.ok(got.length === reals.length && got.every((x, i) => Math.abs(x - reals[i]) < 1e-3), r.answer);
    assert.equal(parts.filter((t) => t.includes('i')).length, complex, r.answer);
    assert.ok(r.steps.some((t) => /multipl/i.test(t) && /four/.test(t)), r.steps.join('\n'));
  }
});

test('the numeric quartic refuses a list it cannot account for', async () => {
  const { checkedQuarticRoots: check } = await import('../src/lib/solvers/algebra/polynomial.js');
  const c = (re, im = 0) => ({ re, im });
  // x⁴ − 10x² + 9, roots ±1, ±3, coefficients highest first.
  const P = [1, 0, -10, 0, 9];
  assert.ok(check(P, [c(-3), c(-1), c(1), c(3)]));
  assert.equal(check(P, [c(-3), c(-1), c(1)]), null, 'three of four');
  assert.equal(check(P, [c(-3), c(-1), c(1), c(4)]), null, 'does not multiply back');
  // (x² + 1)(x² + 4): two conjugate pairs; one root off its pair is refused.
  const Q = [1, 0, 5, 0, 4];
  assert.ok(check(Q, [c(0, -2), c(0, -1), c(0, 1), c(0, 2)]));
  assert.equal(check(Q, [c(0, -2), c(0.5, 1), c(0, 1.5), c(0, 2)]), null, 'not conjugate pairs');
  // Two roots too close to tell apart are refused, never merged.
  const R = [1, -2.0000001, 1.0000001 - 1, 2.0000001, -1.0000001];
  assert.equal(check(R, [c(-1), c(1), c(1), c(1.0000001)]), null, 'too close');
});

test('multiplicities are proven, never guessed from nearby decimals', async () => {
  const { provenMultiplicities, groupRootLines } = await import('../src/lib/solvers/algebra/polynomial.js');
  const { loadAlgebrite } = await import('../src/lib/solvers/solverUtils.js');
  const Algebrite = await loadAlgebrite();
  const counts = (t, listed) => { const m = provenMultiplicities(Algebrite, t, 'x', listed); return m && Object.fromEntries(m); };
  assert.deepEqual(counts('(x - pi)^2*(x^2 + 1)', ['pi', '-i', 'i']), { pi: 2, '-i': 1, i: 1 });
  assert.deepEqual(counts('(x - 1)^2*(x + 2)', ['1', '1', '-2']), { 1: 2, '-2': 1 });
  assert.equal(counts('(x - pi)^2*(x^2 + 1)', ['pi', 'i']), null, 'a list that cannot reach the degree');
  // Two different roots that round alike are not one repeated root.
  assert.equal(groupRootLines(['(-40+pi^2)^(1/2)', '(-40+pi^2)^(1/2)+0.0000001'], [true, true], [{}, {}], 'x', new Map()), null);
  const r = await solvePlain('(x^2 + pi*x + 10)^2 = 0', 'algebra');
  assert.equal(r.answer, 'x ≈ -1.5708 - 2.7446i (multiplicity 2)  or  x ≈ -1.5708 + 2.7446i (multiplicity 2)');
  assert.equal((await solvePlain('(x - pi)^2*(x^2 + 1) = 0', 'algebra')).answer, 'x = pi (repeated root, multiplicity 2)  or  x = -i  or  x = i');
  // A triple root, and two double roots, in a written-out quartic.
  assert.equal((await solvePlain(quartic('sqrt(2)', 'sqrt(2)', 'sqrt(2)', '3'), 'algebra')).answer, 'x = √2 (repeated root, multiplicity 3)  or  x = 3');
  assert.equal((await solvePlain(quartic('sqrt(3)', 'sqrt(3)', '1', '1'), 'algebra')).answer, 'x = 1 (repeated root, multiplicity 2)  or  x = √3 (repeated root, multiplicity 2)');
  // A repeated root in a written-out quartic stays exact.
  assert.match((await solvePlain(quartic('pi', 'pi', '1', '2'), 'algebra')).answer, /multiplicity 2/);
  // Rational quartics keep their exact route.
  assert.equal((await solvePlain('x^4 - 10*x^2 + 9 = 0', 'algebra')).answer, 'x = -3  or  x = -1  or  x = 1  or  x = 3');
  assert.equal((await solvePlain('x^4 - 10*x^3 + 35*x^2 - 50*x + 24 = 0', 'algebra')).answer, 'x = 1  or  x = 2  or  x = 3  or  x = 4');
});

test('the integer square root is exact around 2^53 and past it', async () => {
  const { isqrt } = await import('../src/lib/solvers/algebra/surdRoots.js');
  for (const n of [0n, 1n, 2n, 3n, 4n, 2n ** 53n - 1n, 2n ** 53n, 2n ** 53n + 1n, 10n ** 40n - 1n]) {
    const r = isqrt(n);
    assert.ok(r * r <= n && (r + 1n) * (r + 1n) > n, String(n));
  }
  const big = (2n ** 53n + 1n) ** 2n;
  assert.equal(isqrt(big), 2n ** 53n + 1n);
  assert.equal(isqrt(big - 1n), 2n ** 53n);
  // (1000000007x + 3)(1000000009x + 5): above 2^53, no common factor, a perfect square inside.
  const r = await solvePlain('1000000016000000063*x^2 + 8000000062*x + 15 = 0', 'algebra');
  assert.equal(r.answer, 'x = -5/1000000009  or  x = -3/1000000007');
});

