import test from 'node:test';
import assert from 'node:assert/strict';
import { solveProblem } from '../src/lib/api.js';
import { structuralPeriod, definedEverywhere, linearCoefficients, trigUndefinedPoints } from '../src/lib/solvers/solverUtils.js';
import { tameWindow } from '../src/lib/graphSampling.js';
import { segmentMathText } from '../src/lib/latex.js';
import { validateMathInput } from '../src/lib/validation.js';
import { solvePlain } from './helpers/solvePlain.js';

// Third outside review (October 2026): every claim reproduced, then fixed.

test('periodicity is proved from the structure, not read off a sin', () => {
  assert.equal(structuralPeriod('sin(x^2)*e^x', 'x'), null);
  assert.equal(structuralPeriod('sin(x)*e^x', 'x'), null);
  assert.equal(structuralPeriod('x + sin(x)', 'x'), null);
  assert.equal(structuralPeriod('sin(x) + sin(pi*x)', 'x'), null, 'incommensurate periods are not periodic');
  assert.ok(Math.abs(structuralPeriod('sin(2*x) + cos(3*x)', 'x') - 2 * Math.PI) < 1e-9);
  assert.ok(Math.abs(structuralPeriod('tan(x)', 'x') - Math.PI) < 1e-9);
  assert.ok(structuralPeriod('exp(sin(x))', 'x') > 0);
  assert.equal(structuralPeriod('sin(pi/4)', 'x'), 0);
});

test('the Functions solver no longer calls sin(x²)·eˣ periodic, and lists the features near the origin', async () => {
  const r = await solveProblem('sin(x^2)*e^x', 'functions');
  assert.doesNotMatch(r.answer, /periodic/);
  assert.ok(!r.steps.some((s) => /periodic/.test(s)));
  assert.match(r.answer, /x-intercepts at x = -3\.07, -2\.5066, -1\.7725, 0, 1\.7725, 2\.5066/);
  assert.match(r.answer, /local maximum \(1\.3847, 3\.7561\)/);
  assert.ok(!r.steps.some((s) => /\(-9\./.test(s)), 'no cluster of extrema at the left edge of the window');
  // Periodic claims that are true survive.
  assert.match((await solveProblem('sin(2*x)', 'functions')).answer, /periodic/);
});

test('domain: proved everywhere from the structure, or honestly "no restrictions found"', async () => {
  assert.equal(definedEverywhere('sin(x^2)*e^x', 'x'), true);
  assert.equal(definedEverywhere('x^(1/3)', 'x'), true);
  assert.equal(definedEverywhere('x^(2/3)', 'x'), true);
  assert.equal(definedEverywhere('1/(x^2+1)', 'x'), false);
  assert.equal(definedEverywhere('sqrt(x)', 'x'), false);
  const r = await solveProblem('sin(x^2)*e^x', 'functions');
  const domain = r.steps.find((s) => /^Domain/.test(s));
  assert.match(domain, /^Domain: all real numbers — /);
  assert.doesNotMatch(domain, /analyzed window/);
  const h = await solveProblem('1/(x^2+1)', 'functions');
  assert.match(h.steps.find((s) => /^Domain/.test(s)), /no restrictions found/);
  assert.match(h.answer, /domain: no restrictions found/);
  // A real restriction is still reported as before.
  assert.match((await solveProblem('1/(x-2)', 'functions')).answer, /domain: x ≠ 2/);
});

test('tameWindow shrinks a window where the curve explodes at an edge, and leaves others alone', () => {
  const tamed = tameWindow('sin(x^2)*e^x', 'x', { xMin: -12.95, xMax: 12.87 });
  assert.ok(tamed.xMax - tamed.xMin <= 6, `still ${tamed.xMax - tamed.xMin} wide`);
  assert.ok(tamed.xMax - tamed.xMin >= 4);
  assert.deepEqual(tameWindow('x^3 - 3*x', 'x', { xMin: -3, xMax: 3 }), { xMin: -3, xMax: 3 });
  assert.deepEqual(tameWindow('sin(x)', 'x', { xMin: -6.28, xMax: 6.28 }), { xMin: -6.28, xMax: 6.28 });
  assert.deepEqual(tameWindow('x^2', 'x', { xMin: -10, xMax: 10 }), { xMin: -10, xMax: 10 });
  const ex = tameWindow('e^x', 'x', { xMin: -10, xMax: 10 });
  assert.ok(ex.xMax < 5 && ex.xMax > 2);
  assert.deepEqual(tameWindow('garbage((', 'x', { xMin: -1, xMax: 1 }), { xMin: -1, xMax: 1 });
});

test('a prose step with several math clauses typesets each clause', () => {
  const segs = segmentMathText('Then u′ = 2x*cos(x^2) and w′ = e^x.');
  assert.deepEqual(segs.map((s) => s.type), ['text', 'math', 'text', 'math', 'text']);
  assert.equal(segs[1].value, 'u′ = 2x*cos(x^2)');
  assert.equal(segs[3].value, 'w′ = e^x');
  const check = segmentMathText('Test the candidates in p(x) = x^3 - 6x^2 + 11x - 6: p(1) = 0 ✓ — so x = 1 is a root and (x − 1) is a factor.');
  assert.ok(check.some((s) => s.type === 'math' && s.value === 'p(1) = 0'));
  assert.ok(check.some((s) => s.type === 'text' && /✓/.test(s.value)), 'the tick stays prose');
  // Pure prose is untouched, and the older shapes still split as before.
  assert.equal(segmentMathText('Plot the points and sketch the graph using these features.').length, 1);
  assert.deepEqual(segmentMathText('Solution: x = 1  or  x = 2  or  x = 3').map((s) => s.type), ['text', 'math']);
});

test('a cubic solved by the Rational Root Theorem gets tips about that method', async () => {
  const r = await solveProblem('x^3 - 6x^2 + 11x - 6 = 0', 'algebra');
  assert.match(r.tips.join('\n'), /Rational Root Theorem/);
  assert.match(r.tips.join('\n'), /synthetic division/i);
  assert.doesNotMatch(r.tips.join('\n'), /A quadratic has up to two solutions/);
  assert.match(r.common_mistakes.join('\n'), /negatives are on the list/);
  // A plain quadratic keeps the quadratic advice.
  assert.match((await solveProblem('x^2 - 5x + 6 = 0', 'algebra')).tips.join('\n'), /A quadratic has up to two solutions/);
});

test('ln(sin x) is a chain rule, shown as one, with the answer written as cot x', async () => {
  const r = await solvePlain('ln(sin(x))', 'derivatives');
  assert.equal(r.answer, "f'(x) = cot(x)");
  assert.match(r.steps.join('\n'), /Chain rule/);
  assert.match(r.steps.join('\n'), /Let u = sin\(x\) \(the inside\), so the outer function is ln\(u\)/);
  assert.match(r.steps.join('\n'), /Inner derivative: u′ = d\/dx\[sin\(x\)\] = cos\(x\)/);
  assert.doesNotMatch(r.steps.join('\n'), /Trig rule/);
  const c = await solvePlain('ln(cos(x))', 'derivatives');
  assert.equal(c.answer, "f'(x) = -tan(x)");
  // The graph still samples: cot is in the maths instance.
  assert.equal(r.graph.secondaryExpression, 'cot(x)');
});

test('a trig identity excludes the points where tan or sec is undefined', async () => {
  assert.deepEqual(trigUndefinedPoints('tan(x) - sin(x)/cos(x)', 'x').map((p) => p.text), ['x = π/2 + nπ', 'x = π/2 + nπ']);
  assert.deepEqual(trigUndefinedPoints('cot(2*x)', 'x').map((p) => p.text), ['x = n·π/2']);
  assert.deepEqual(linearCoefficients('2*x + pi/4', 'x'), { k: 2, d: Math.PI / 4 });
  const r = await solveProblem('tan(x) = sin(x)/cos(x)', 'trigonometry');
  assert.match(r.answer, /^All real numbers except x = π\/2 \+ nπ, n any integer \(identity on its domain/);
  assert.match(r.steps[0], /identity, not an equation with particular solutions/);
  assert.doesNotMatch(r.steps.join('\n'), /solved numerically/);
  const p = await solveProblem('tan^2(x) + 1 = sec^2(x)', 'trigonometry');
  assert.match(p.answer, /except x = π\/2 \+ nπ/);
  // An identity in sin and cos alone is still true everywhere.
  const s = await solveProblem('sin(x)^2 + cos(x)^2 = 1', 'trigonometry');
  assert.match(s.answer, /^All real numbers/);
  assert.doesNotMatch(s.answer, /except/);
});

test('LaTeX commands get a message that says what to type instead', () => {
  const r = validateMathInput('\\int x^2 dx');
  assert.equal(r.isValid, false);
  assert.match(r.error, /LaTeX commands such as \\int are not supported/);
  assert.match(r.error, /∫_0\^1 x\^2 dx/);
  assert.match(validateMathInput('\\frac{1}{2}x + 3 = 5').error, /\\frac/);
  assert.equal(validateMathInput('x^2 + 1').isValid, true);
});
