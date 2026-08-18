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

test('a bare function name is a parse error with a hint, not an engine error', async () => {
  for (const [p, t] of [['sin^2', 'trigonometry'], ['ln + 3', 'functions'], ['2sin', 'derivatives']]) {
    const r = await solveProblem(p, t);
    assert.equal(r.status, 'parse_error', p);
    assert.match(r.answer, /needs an argument in parentheses/, p);
  }
});

test('"sin x", "cos 30", "2 sin(x)": spaced function arguments', async () => {
  assert.equal((await solveProblem('sin 30', 'trigonometry')).answer, '1/2 (≈ 0.5)');
  assert.match((await solveProblem('sin x = 1/2', 'trigonometry')).answer, /^x = π\/6 \+ 2πn/);
  assert.equal((await solveProblem('2 sin x', 'derivatives')).answer, "f'(x) = 2cos(x)");
  assert.equal((await solveProblem('2 sin(x)', 'derivatives')).answer, "f'(x) = 2cos(x)"); // was f'(s) = 0
});

test('derivative output writes ln and e^ rather than log and exp', async () => {
  assert.equal((await solveProblem('ln^2(x)', 'derivatives')).answer, "f'(x) = 2ln(x)/x");
  assert.equal((await solveProblem('e^x', 'derivatives')).answer, "f'(x) = e^x");
  assert.equal((await solveProblem('e^(2x)', 'derivatives')).answer, "f'(x) = 2e^(2x)");
});

test('domain wording does not repeat a point an interval already excludes', async () => {
  const r = await solveProblem('log^2(x)', 'functions');
  assert.match(r.answer, /domain: x > 0;/);
  const s = await solveProblem('sqrt(x)/(x-1)', 'functions');
  assert.match(s.answer, /domain: x ≥ 0 and x ≠ 1/);
});

// ── Edge-case sweep on v1.24.1 (pass 6).
test('edge: parser reads π, ·, ∛, vulgar fractions, thousands separators, log bases', async () => {
  assert.equal((await solveProblem('2π', 'other')).answer, '2π ≈ 6.2832');
  assert.equal((await solveProblem('sin(π/2)', 'trigonometry')).answer, '1');
  assert.equal((await solveProblem('∛27', 'other')).answer, '3');
  assert.equal((await solveProblem('½ + ¼', 'other')).answer, '3/4 (= 0.75)');
  assert.equal((await solveProblem('2·3', 'other')).answer, '6');
  assert.equal((await solveProblem('1,000,000/4', 'other')).answer, '250000');
  assert.equal((await solveProblem('log10(100)', 'other')).answer, '2');
  assert.equal((await solveProblem('log(8, 2)', 'other')).answer, '3');
  assert.equal((await solveProblem('log10(x)', 'derivatives')).answer, "f'(x) = 1/(x*ln(10))");
});

test('edge: ln(x) = -1 has the root 1/e (was "No real solution")', async () => {
  assert.equal((await solveProblem('ln(x) = -1', 'algebra')).answer, 'x = 0.3679');
  assert.equal((await solveProblem('x! = 24', 'algebra')).answer, 'x = 4');
});

test('edge: arithmetic — ln(0) undefined, 0^-1 undefined, 0^0 by convention, "2 3" refused, complex formatted', async () => {
  assert.equal((await solveProblem('ln(0)', 'other')).status, 'undefined');
  assert.equal((await solveProblem('0^-1', 'other')).status, 'undefined');
  assert.equal((await solveProblem('0^0', 'other')).answer, '1 (by convention)');
  assert.equal((await solveProblem('2 3', 'other')).status, 'parse_error');
  assert.equal((await solveProblem('ln(-1)', 'other')).answer, 'πi');
  assert.equal((await solveProblem('sqrt(-4)', 'other')).answer, '2i');
  const s = await solveProblem('sqrt(-1)', 'other');
  assert.ok(s.steps.filter((x) => /Work inside/.test(x)).length <= 1, 'no repeated paren steps');
});

test('edge: words, unbalanced parens, empty calls are parse errors', async () => {
  for (const [p, t] of [['hello', 'algebra'], ['help me', 'derivatives'], ['sin(x', 'trigonometry'], ['sin(x))', 'trigonometry'], ['sin()', 'trigonometry']]) {
    assert.equal((await solveProblem(p, t)).status, 'parse_error', p);
  }
  assert.equal((await solveProblem('sqrt(-4)', 'algebra')).answer, '2i');
  assert.match((await solveProblem('x^100 = 1', 'algebra')).answer, /^x = -1\s+or\s+x = 1;\s+plus 98 complex solutions/);
});

test('edge: implicit products with spaces — x e^x, e^x sin(x), sin 30°', async () => {
  assert.equal((await solveProblem('∫ x e^x dx', 'integrals')).answer, '∫(x*e^x) dx = exp(x)*(x - 1) + C');
  assert.equal((await solveProblem('∫ e^x sin(x) dx', 'integrals')).status, 'solved');
  assert.match((await solveProblem('sin 30°', 'trigonometry')).answer, /^1\/2/);
  assert.match((await solveProblem('sin(-30)', 'trigonometry')).answer, /^-1\/2/);
  assert.equal((await solveProblem('cosec(30)', 'trigonometry')).answer, '2');
});

test('edge: limits — named constants, converging slowly, and a symbolic parameter', async () => {
  assert.match((await solveProblem('lim x→∞ (1 + 2/x)^x', 'limits')).answer, /= e\^2 \(≈ 7\.3891\)$/);
  assert.match((await solveProblem('lim n->infinity (1+1/n)^n', 'limits')).answer, /= e \(≈ 2\.7183\)$/);
  assert.match((await solveProblem('lim h->0 ((x+h)^2 - x^2)/h', 'limits')).answer, /= 2x$/);
  assert.equal((await solveProblem('lim h->0 (sin(x+h)-sin(x))/h', 'limits')).status, 'unsupported');
});

test('edge: derivatives — order, with respect to, ln|x|, asymptote at the point, symbolic point', async () => {
  assert.equal((await solveProblem('second derivative of x^3', 'derivatives')).answer, "f''(x) = 6x");
  assert.equal((await solveProblem('d^2/dx^2 x^3', 'derivatives')).answer, "f''(x) = 6x");
  assert.equal((await solveProblem("f''(x) where f(x) = x^3", 'derivatives')).answer, "f''(x) = 6x");
  assert.equal((await solveProblem('derivative of x*y with respect to y', 'derivatives')).answer, "f'(y) = x");
  assert.equal((await solveProblem('ln|x|', 'derivatives')).answer, "f'(x) = 1/x");
  assert.equal((await solveProblem('tan(x) at x = pi/2', 'derivatives')).answer, "f'(pi/2) is undefined");
  assert.equal((await solveProblem('x^2 at x = a', 'derivatives')).answer, "f'(a) = 2a");
  assert.match((await solveProblem('x^x', 'derivatives')).steps[1], /Logarithmic differentiation/);
  assert.match((await solveProblem('1/x', 'derivatives')).steps[1], /negative exponent/);
  assert.match((await solveProblem('e^(x^2)', 'derivatives')).steps[1], /Chain rule/);
});

test('edge: integrals — variable from d<var>, empty integrand is 1', async () => {
  assert.equal((await solveProblem('integrate x^2 dy', 'integrals')).answer, '∫(x^2) dy = x^2*y + C');
  assert.equal((await solveProblem('∫ dx', 'integrals')).answer, '∫(1) dx = x + C');
  assert.equal((await solveProblem('∫_0^1 dx', 'integrals')).answer, '∫_0^1 (1) dx = 1');
});

test('edge: functions — x^x domain and no phantom intercept at an isolated point', async () => {
  const r = await solveProblem('x^x', 'functions');
  assert.match(r.answer, /domain: x ≥ 0 \(plus isolated points/);
  assert.match(r.answer, /no x-intercepts/);
});

test('an Algebrite error in one problem does not poison the next (x/0 = 1, then x^3 = 8)', async () => {
  await solveProblem('x/0 = 1', 'algebra');
  const r = await solveProblem('x^3 = 8', 'algebra');
  assert.equal(r.answer, 'x = 2  or  x = -1 - 1.7321i  or  x = -1 + 1.7321i');
  const s = await solveProblem('x^2 = 2', 'algebra');
  assert.equal(s.answer, 'x = -2^(1/2)  or  x = 2^(1/2)');
});
