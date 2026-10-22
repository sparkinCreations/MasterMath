import test from 'node:test';
import assert from 'node:assert/strict';
import { solveProblem } from '../src/lib/api.js';
import { splitVariableProducts } from '../src/lib/solvers/implicitDerivativeSolver.js';
import { solvePlain } from './helpers/solvePlain.js';

// October 2026 roadmap, P1 and P2 (1.49.0): implicit differentiation, and
// the 1^∞ limits proved by logarithms instead of sampled.

// --- Implicit differentiation ------------------------------------------------

test('x^2 + y^2 = 25 under Derivatives is differentiated implicitly, not solved for x', async () => {
  const r = await solvePlain('x^2 + y^2 = 25', 'derivatives');
  assert.equal(r.status, 'solved');
  assert.equal(r.answer, 'dy/dx = -x/y');
  const text = r.steps.join('\n');
  assert.doesNotMatch(text, /Solved as Algebra|Isolate x/);
  // The term-by-term working, the collection and the division.
  assert.match(text, /Chain rule: d\/dx\(y\^2\) = 2y·dy\/dx/);
  assert.match(text, /A constant: d\/dx\(25\) = 0/);
  assert.match(text, /So: 2x \+ 2y·dy\/dx = 0/);
  assert.match(text, /2y·dy\/dx = -2x/);
  assert.match(text, /dy\/dx = -2x\/\(2y\) = -x\/y/);
  assert.match(text, /holds wherever y ≠ 0/);
  assert.match(text, /^Check: .* on the curve/m);
  assert.ok(r.tips.some((t) => /chain rule|function of x/.test(t)));
  assert.ok(r.common_mistakes.some((m) => /Forgetting the dy\/dx/.test(m)));
});

test('the roadmap curves: xy = 1, y^3 + x = 2, sin(y) = x, and the folium', async () => {
  const cases = [
    ['x*y = 1', 'dy/dx = -y/x', /Product rule/],
    ['xy = 1', 'dy/dx = -y/x', /Product rule/],
    ['y^3 + x = 2', 'dy/dx = -1/(3y^2)', /Chain rule/],
    ['sin(y) = x', 'dy/dx = 1/cos(y)', /Chain rule/],
    ['x^3 + y^3 = 6xy', 'dy/dx = (2y - x^2)/(-2x + y^2)', /Product rule/],
  ];
  for (const [p, answer, rule] of cases) {
    const r = await solveProblem(p, 'derivatives');
    assert.equal(r.status, 'solved', p);
    assert.equal(r.answer, answer, p);
    assert.match(r.steps.join('\n'), rule, p);
  }
  // A product term earns the product-rule tip and mistake; a sum does not.
  assert.ok((await solveProblem('xy = 1', 'derivatives')).tips.some((t) => /is a product/.test(t)));
  assert.ok(!(await solveProblem('x^2 + y^2 = 25', 'derivatives')).tips.some((t) => /is a product/.test(t)));
});

test('"find dy/dx if …" is an implicit derivative under any topic, not a differential equation', async () => {
  for (const [topic, p] of [
    ['algebra', 'find dy/dx if x^2 + y^2 = 25'],
    ['other', 'differentiate implicitly: x^2 + y^2 = 25'],
    ['trigonometry', 'x^2 + y^2 = 25, find dy/dx'],
    ['functions', 'implicit differentiation x^2 + y^2 = 25'],
    ['derivatives', 'derivative of x^2 + y^2 = 25 with respect to x'],
  ]) {
    const r = await solveProblem(p, topic);
    assert.equal(r.status, 'solved', p);
    assert.equal(r.answer, 'dy/dx = -x/y', p);
    if (topic !== 'derivatives') {
      assert.match(r.steps[0], /^Solved as Derivatives/, p);
      assert.equal(r.routedTopic, 'derivatives', p);
    }
  }
  // Real differential equations stay refused.
  for (const p of ['dy/dx = 2x', 'dy/dx + y = x', "y'' + y = 0", "y' = 2x"]) {
    assert.equal((await solveProblem(p, 'derivatives')).answer, 'Differential equations are not supported', p);
  }
});

test('dy/dx at a point: exact value, and honest answers off the curve and at a vertical tangent', async () => {
  for (const p of ['x^2 + y^2 = 25 at (3, 4)', 'x^2 + y^2 = 25 at x = 3, y = 4', 'find the slope of x^2 + y^2 = 25 at (3, 4)']) {
    const r = await solvePlain(p, 'derivatives');
    assert.equal(r.status, 'solved', p);
    assert.equal(r.answer, 'dy/dx at (3, 4) = -3/4 ≈ -0.75', p);
    assert.match(r.steps.join('\n'), /slope of the tangent line to the curve at \(3, 4\)/);
  }
  const radical = await solvePlain('x^2 - y^2 = 1 at (sqrt(2), 1)', 'derivatives');
  assert.equal(radical.answer, 'dy/dx at (√2, 1) = √2 ≈ 1.4142');

  const off = await solvePlain('x^2 + y^2 = 25 at (3, 5)', 'derivatives');
  assert.equal(off.status, 'undefined');
  assert.match(off.answer, /\(3, 5\) is not on the curve/);

  const vertical = await solvePlain('x^2 + y^2 = 25 at (5, 0)', 'derivatives');
  assert.equal(vertical.status, 'undefined');
  assert.match(vertical.answer, /tangent at \(5, 0\) is vertical/);

  const cusp = await solvePlain('y^2 = x^3 at (0, 0)', 'derivatives');
  assert.equal(cusp.status, 'undefined');
  assert.match(cusp.answer, /singular point/);

  // x alone does not fix a point on a circle: the general formula, and a
  // step that asks for the whole point.
  const xOnly = await solvePlain('x^2 + y^2 = 25 at x = 3', 'derivatives');
  assert.equal(xOnly.answer, 'dy/dx = -x/y');
  assert.match(xOnly.steps.join('\n'), /give it as \(3, y\)/);
});

test('a curve with no real points is refused, not given an unchecked formula', async () => {
  const r = await solveProblem('x^2 + y^2 = -1', 'derivatives');
  assert.equal(r.status, 'unsupported');
  assert.match(r.steps.join('\n'), /No point on .* could be found/);
});

test('y = f(x) and f(x) = … under Derivatives are differentiated, not "already in simplest form"', async () => {
  // Before 1.49.0 these went to Algebra and came back unchanged, marked Solved.
  assert.equal((await solveProblem('y = x^2', 'derivatives')).answer, "f'(x) = 2x");
  assert.equal((await solveProblem('f(x) = x^3', 'derivatives')).answer, "f'(x) = 3x^2");
  assert.equal((await solveProblem('y = 3x + 2 at x = 1', 'derivatives')).answer, "f'(1) = 3");
  for (const p of ['y = x^2', 'f(x) = x^3', 'x*y = 1']) {
    assert.doesNotMatch((await solveProblem(p, 'derivatives')).steps.join('\n'), /already in simplest form/, p);
  }
});

test('the implicit route leaves the other topics and one-variable equations alone', async () => {
  // Algebra still solves a two-variable equation for x; Functions still reads y = … as a function.
  assert.match((await solveProblem('x^2 + y^2 = 25', 'algebra')).answer, /^x = /);
  assert.match((await solveProblem('y = x^2', 'functions')).answer, /^f\(x\) = x\^2: domain/);
  // One variable under Derivatives is still an equation to solve.
  assert.equal((await solveProblem('x^2 = 4', 'derivatives')).answer, 'x = -2  or  x = 2');
  // f'(x) notation is not an ODE and not an implicit request.
  assert.notEqual((await solveProblem("f'(x) = 2x", 'algebra')).answer, 'Differential equations are not supported');
});

test('splitVariableProducts reads xy as x*y but never touches function names', () => {
  assert.equal(splitVariableProducts('2*xy + y^2', ['x', 'y']), '2*x*y + y^2');
  assert.equal(splitVariableProducts('e^(xy)', ['x', 'y']), 'e^(x*y)');
  assert.equal(splitVariableProducts('sin(y) + exp(x)', ['x', 'y']), 'sin(y) + exp(x)');
});

// --- 1^∞ limits --------------------------------------------------------------

test('(1 + 1/x)^x → e by logarithms and ln(1 + u)/u → 1, never by sampling', async () => {
  const r = await solvePlain('lim x->inf (1 + 1/x)^x', 'limits');
  assert.equal(r.status, 'solved');
  assert.equal(r.answer, 'lim (x→∞) (1 + 1/x)^x = e (≈ 2.7183)');
  const text = r.steps.join('\n');
  assert.match(text, /indeterminate form 1\^∞/);
  assert.match(text, /ln L is the limit of ln\(B\^E\) = E·ln\(B\)/);
  assert.match(text, /ln\(1 \+ u\)\/u → 1/);
  assert.match(text, /So ln L = 1, and L = e\^1 = e/);
  assert.doesNotMatch(text, /increasingly large|Samples:|settle toward/);
  assert.ok(r.tips.some((t) => /1\^∞ is indeterminate/.test(t)));
  assert.ok(r.common_mistakes.some((m) => /1\^∞ = 1/.test(m)));
});

test('the 1^∞ family: e, e², e^(−1), √e, e^(ab) at 0, and the base x/(x + 1)', async () => {
  const cases = [
    ['lim x->inf (1 + 2/x)^x', 'e^2 (≈ 7.3891)'],
    ['lim x->inf (1 - 1/x)^x', '1/e (≈ 0.3679)'],
    ['lim x->inf (1 + 1/(2x))^x', '√e (≈ 1.6487)'],
    ['lim x->inf (1 + 1/x)^(2x + 3)', 'e^2 (≈ 7.3891)'],
    ['lim x->inf (x/(x+1))^x', '1/e (≈ 0.3679)'],
    ['lim x->inf ((x+2)/(x-1))^(3x)', 'e^9 (≈ 8103.0839)'],
    ['lim x->-inf (1 + 3/x)^x', 'e^3 (≈ 20.0855)'],
    ['lim x->0 (1 + x)^(1/x)', 'e (≈ 2.7183)'],
    ['lim x->0 (1 + 2x)^(1/x)', 'e^2 (≈ 7.3891)'],
    ['lim x->0 (1 - 3x)^(2/x)', 'e^(-6) (≈ 0.0025)'],
    ['lim x->inf (1 + 1/x^2)^x', '1'],
  ];
  for (const [p, value] of cases) {
    const r = await solvePlain(p, 'limits');
    assert.equal(r.status, 'solved', p);
    assert.ok(r.answer.endsWith(`= ${value}`), `${p} → ${r.answer}`);
    assert.match(r.steps.join('\n'), /indeterminate form 1\^∞/, p);
    assert.doesNotMatch(r.steps.join('\n'), /Samples:|From the left/, p);
  }
});

test('powers that are not 1^∞ are left to the rest of the ladder', async () => {
  // Base → 2: the limit is ∞, not an e-power.
  assert.match((await solveProblem('lim x->inf (2 + 1/x)^x', 'limits')).answer, /= ∞$/);
  // E·u → ∞: no finite c, so no e^c is claimed.
  assert.doesNotMatch((await solveProblem('lim x->inf (1 + 1/x)^(x^2)', 'limits')).steps.join('\n'), /ln L =/);
});

// --- Two-variable inequalities -----------------------------------------------

test('an inequality in two variables is refused, never answered "No solution"', async () => {
  for (const p of ['x^2 + y^2 <= 25', 'x + y > 2', 'y > x^2']) {
    const r = await solveProblem(p, 'algebra');
    assert.equal(r.status, 'unsupported', p);
    assert.match(r.answer, /more than one variable/, p);
    assert.doesNotMatch(r.answer, /No solution/, p);
  }
  assert.equal((await solveProblem('x^2 - 4 > 0', 'algebra')).answer, 'x < -2  or  x > 2');
  assert.equal((await solveProblem('t^2 < 9', 'algebra')).answer, '-3 < t < 3');
});
