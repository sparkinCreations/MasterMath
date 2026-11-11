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
  assert.match((await solvePlain('(x-pi)^2*(x+1) = 0', 'algebra')).answer, /^x = -1 {2}or {2}x = pi\b/);
  assert.match((await solvePlain(expanded('sqrt(2)', 'sqrt(2)', 'sqrt(2)'), 'algebra')).answer, /^x = √2\b/);
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
