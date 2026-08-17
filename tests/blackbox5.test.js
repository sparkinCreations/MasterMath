// Fifth black-box pass: do the solvers honour Settings (angle unit, decimal
// places), "at x = a" evaluation, and the routed-topic bookkeeping.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// settings.js reads localStorage; give node one so saveSettings takes effect.
const store = {};
globalThis.localStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = v; },
  removeItem: (k) => { delete store[k]; },
};

const { solveProblem } = await import('../src/lib/api.js');
const { saveSettings, resetSettings } = await import('../src/lib/settings.js');

test('degree symbol inside a trig call is read, not a syntax error', async () => {
  resetSettings();
  const r = await solveProblem('sin(30°)', 'trigonometry');
  assert.equal(r.status, 'solved');
  assert.match(r.answer, /^1\/2/);
  const s = await solveProblem('sin(30°) + cos(60°)', 'trigonometry');
  assert.equal(s.answer, '1');
});

test('angle unit = degrees applies to decimal arguments too', async () => {
  resetSettings(); saveSettings({ angleUnit: 'degrees' });
  const r = await solveProblem('sin(0.5)', 'trigonometry');
  assert.equal(r.answer, '0.0087'); // sin(0.5°)
  const t = await solveProblem('tan(1.5)', 'trigonometry');
  assert.equal(t.answer, '0.0262'); // tan(1.5°)
  resetSettings();
  const u = await solveProblem('sin(0.5)', 'trigonometry');
  assert.equal(u.answer, '0.4794'); // radians by default
});

test('inverse trig reports its angle in the chosen unit', async () => {
  resetSettings(); saveSettings({ angleUnit: 'degrees' });
  assert.equal((await solveProblem('arcsin(0.3)', 'trigonometry')).answer, '17.4576°');
  assert.equal((await solveProblem('arcsin(1/2)', 'trigonometry')).answer, '30°');
  assert.equal((await solveProblem('arctan(1)', 'trigonometry')).answer, '45°');
  resetSettings();
  const r = await solveProblem('arcsin(1/2)', 'trigonometry');
  assert.match(r.answer, /^π\/6/);
  assert.ok(r.steps.some((s) => /= 30°/.test(s)), 'radians mode still notes the degree value');
});

test('trig equations report solutions in degrees when the angle unit is degrees', async () => {
  resetSettings(); saveSettings({ angleUnit: 'degrees' });
  const r = await solveProblem('sin(x) = 1/2', 'trigonometry');
  assert.equal(r.answer, 'x = 30° + 360°n  or  x = 150° + 360°n (n ∈ ℤ);  on [0°, 360°): 30°, 150°');
  const t = await solveProblem('tan(2x) = 1', 'trigonometry');
  assert.match(t.answer, /on \[0°, 360°\): 22\.5°, 112\.5°, 202\.5°, 292\.5°/);
  assert.equal(t.graph.initialWindow.xMin, -360);
  resetSettings();
  const u = await solveProblem('sin(x) = 1/2', 'trigonometry');
  assert.match(u.answer, /^x = π\/6 \+ 2πn/);
});

test('decimal places setting flows through the numeric answers', async () => {
  resetSettings(); saveSettings({ decimalPlaces: 2 });
  assert.equal((await solveProblem('sqrt(2)', 'other')).answer, '1.41');
  assert.equal((await solveProblem('cos(1)', 'trigonometry')).answer, '0.54');
  assert.match((await solveProblem('x^2 - 3 > 0', 'algebra')).answer, /1\.73/);
  saveSettings({ decimalPlaces: 6 });
  assert.equal((await solveProblem('sqrt(2)', 'other')).answer, '1.414214');
  assert.match((await solveProblem('∫_0^1 sin(x) dx', 'integrals')).answer, /0\.459698/);
  resetSettings();
});

test('a coefficient-prefixed trig equation stays with the trig equation solver', async () => {
  resetSettings();
  for (const topic of ['trigonometry', 'algebra']) {
    const r = await solveProblem('2cos(x) - 1 = 0', topic);
    assert.equal(r.answer, 'x = π/3 + 2πn  or  x = 5π/3 + 2πn (n ∈ ℤ);  on [0, 2π): π/3, 5π/3', topic);
  }
});

test('"derivative … at x = a" evaluates the derivative at the point', async () => {
  resetSettings();
  const r = await solveProblem('derivative of sin(x) at x=1', 'derivatives');
  assert.equal(r.answer, "f'(1) = cos(1) ≈ 0.5403");
  assert.ok(r.steps.some((s) => /slope of the tangent line/.test(s)));
  const s = await solveProblem('x^2 at x=1.5', 'derivatives');
  assert.equal(s.answer, "f'(1.5) = 3");
  const t = await solveProblem('derivative of x^3 - 2x at x = 2', 'algebra');
  assert.equal(t.answer, "f'(2) = 10");
  assert.equal(t.routedTopic, 'derivatives');
  const u = await solveProblem('d/dx ln(x) at x = e', 'derivatives');
  assert.equal(u.answer, "f'(e) = 1/e ≈ 0.3679");
  const v = await solveProblem('1/x at x = 0', 'derivatives');
  assert.equal(v.answer, "f'(0) is undefined");
});

test('"expression at x = a" under a non-calculus topic evaluates the expression', async () => {
  const r = await solveProblem('x^2 + 1 at x = 3', 'algebra');
  assert.equal(r.answer, 'f(3) = 10');
  const s = await solveProblem('2x+1 when x = 4', 'functions');
  assert.equal(s.answer, 'f(4) = 9');
  // An equation is still an equation.
  const t = await solveProblem('x^2 - 4 = 0', 'algebra');
  assert.match(t.answer, /x = -2\s+or\s+x = 2/);
});

test('routed results carry the topic they were solved as', async () => {
  const r = await solveProblem('d/dx x^3', 'algebra');
  assert.equal(r.routedTopic, 'derivatives');
  const s = await solveProblem('x^2 = 4', 'integrals');
  assert.equal(s.routedTopic, 'algebra');
  const t = await solveProblem('x^2 = 4', 'algebra');
  assert.equal(t.routedTopic, undefined);
});

test('touch roots between grid points are found (squared factors)', async () => {
  resetSettings();
  const r = await solveProblem('sin^2(3x) + 1 = 1', 'algebra');
  assert.match(r.answer, /x = -1\.0472\s+or\s+x = 0\s+or\s+x = 1\.0472/);
  const s = await solveProblem('cos(x)^2 = 0', 'algebra');
  assert.match(s.answer, /x = -1\.5708\s+or\s+x = 1\.5708/);
  // A decaying tail is still not a root.
  assert.equal((await solveProblem('e^(-x^2) = 0', 'algebra')).answer, 'No real solution found');
  assert.equal((await solveProblem('1/(x-2)^2 = 0', 'algebra')).answer, 'No real solution found');
});

test('a mod 0 is undefined, not the dividend', async () => {
  const r = await solveProblem('5 mod 0', 'other');
  assert.equal(r.status, 'undefined');
  assert.equal((await solveProblem('7 mod 3', 'other')).answer, '1');
});
