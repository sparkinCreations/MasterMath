import test from 'node:test';
import assert from 'node:assert/strict';

import { solveProblem } from '../src/lib/api.js';
import { rng, int, nonzero, answerSet, disagreements } from './helpers/crossCheck.js';

// A randomized cross-check of the proof machinery (1.67.1). Seeded, so the
// cases are the same on every run: random inequalities, trig polynomials
// and systems, each answer read back and compared with the values
// themselves on a dense grid (used here only as an oracle; the solvers
// never decide anything from samples). It found that two signs in a row
// ("x^2 + -3x") stopped Algebrite with a syntax error: the inequalities
// were refused and the derivative was "beyond this engine"; and that a
// square root against a polynomial ran out of derivatives (now squared,
// exactly: zeros.js).

const OPS = ['<', '<=', '>', '>='];
const FAMILIES = {
  polynomial: (r) => [Array.from({ length: int(r, 2, 4) }, () => `(x - (${int(r, -6, 6)}))`).join('*') + (r() < 0.5 ? ` + ${int(r, -5, 5)}` : ''), '0'],
  rational: (r) => [`(x - (${int(r, -5, 5)}))*(x - (${int(r, -5, 5)}))/(x - (${int(r, -5, 5)}))`, `${int(r, -3, 3)}`],
  exponential: (r) => [`${nonzero(r, -3, 3)}*e^(${nonzero(r, -2, 2)}*x/${int(r, 1, 4)})`, `${int(r, -3, 3)}*x + ${int(r, -4, 4)}`],
  logarithm: (r) => [`ln(x) + ${nonzero(r, -3, 3)}*x/${int(r, 1, 4)}`, `${int(r, -3, 3)}`],
  'one rate': (r) => [`e^(2*x) + ${int(r, -5, 5)}*e^x`, `${int(r, -6, 6)}`],
  'absolute value': (r) => [`abs(${nonzero(r, -3, 3)}*x + ${int(r, -5, 5)})`, `${int(r, -2, 2)}*x + ${int(r, -3, 6)}`],
  'square root': (r) => [`sqrt(x + ${int(r, -3, 5)})`, `${int(r, -2, 2)}*x + ${int(r, -3, 3)}`],
  'wave and line': (r) => [`${nonzero(r, -3, 3)}*sin(${int(r, 1, 3)}*x)`, `x/${int(r, 1, 5)} + ${int(r, -2, 2)}`],
  periodic: (r) => [`sin(${int(r, 1, 3)}*x) + ${int(r, -2, 2)}*cos(${int(r, 1, 3)}*x)`, `${(int(r, -15, 15) / 10).toFixed(1)}`],
  'a root against a line': (r) => [`sqrt(${int(r, 1, 9)} - x^2)`, `${int(r, -2, 2)}*x + ${int(r, -2, 2)}`],
  'close roots': (r) => { const a = int(r, -3, 3); return [`(x - ${a})*(x - ${a + [0.01, 0.001][int(r, 0, 1)]})`, '0']; },
  'a double root': (r) => [`(x - (${int(r, -4, 4)}))^2*(x - (${int(r, -4, 4)}))`, '0'],
  // f″ = 2 ∓ a·sin(x) (or cos) is ≥ 0 for |a| ≤ 2 and touches 0: still
  // strictly convex, so at most two zeros (refused before 1.67.2).
  'a square against a wave': (r) => ['x^2', `${nonzero(r, -2, 2)}*${['sin', 'cos'][int(r, 0, 1)]}(x) + ${int(r, -1, 2)}`],
};
const PER_FAMILY = 6;

test('cross-check: inequality answers agree with the inequality on a dense grid', async () => {
  const r = rng(20261102);
  const report = [];
  for (const [family, make] of Object.entries(FAMILIES)) {
    let solved = 0;
    for (let i = 0; i < PER_FAMILY; i += 1) {
      const [lhs, rhs] = make(r);
      const op = OPS[int(r, 0, 3)];
      const problem = `${lhs} ${op} ${rhs}`;
      const result = await solveProblem(problem, 'algebra');
      if (result.status !== 'solved') continue; // an honest refusal is never wrong
      const set = answerSet(result.answer);
      if (set.refused) continue;
      solved += 1;
      const wide = family === 'periodic' ? 20 : 12;
      const bad = disagreements(lhs.replace(/\bln\(/g, 'log('), rhs, op, set, { lo: -wide, hi: wide });
      assert.equal(bad.length, 0, `${problem} → ${result.answer}: disagrees with the inequality at x ≈ ${bad[0]?.toFixed(4)} (${bad.length} grid points)`);
    }
    report.push(`${family} ${solved}/${PER_FAMILY}`);
    // A family the solver proves should mostly be answered, not refused.
    assert.ok(solved >= PER_FAMILY * 0.8, `${family}: only ${solved} of ${PER_FAMILY} answered`);
  }
});

test('cross-check: every zero of a trig polynomial on one turn, against a dense scan', async () => {
  const { circleZeros } = await import('../src/lib/solvers/trigonometry/circle.js');
  const roots = await import('../src/lib/solvers/polynomialRoots.js');
  const r = rng(7);
  let compared = 0;
  for (let i = 0; i < 60; i += 1) {
    const terms = [`${int(r, -3, 3)}`];
    const ks = [];
    for (let k = 1; k <= 3; k += 1) {
      if (r() < 0.6) { terms.push(`${nonzero(r, -3, 3)}*sin(${k}*x)`); ks.push(k); }
      if (r() < 0.6) { terms.push(`${nonzero(r, -3, 3)}*cos(${k}*x)`); ks.push(k); }
    }
    if (terms.length === 1) continue;
    // circleZeros works on one turn of θ = g·x, g the gcd of the multiples:
    // x in (−π/g, π/g]; the periodic solver repeats them from there.
    const gcd = (p, q) => (q ? gcd(q, p % q) : p);
    const g = ks.reduce(gcd, 0);
    const expr = terms.join(' + ');
    const f = new Function('x', `return ${expr.replace(/sin/g, 'Math.sin').replace(/cos/g, 'Math.cos')};`);
    // The scan: sign changes on (−π, π], where the polynomial in tan(θ/2)
    // has a root for each; a near-touch the grid cannot resolve skips the case.
    const N = 100000;
    let changes = 0;
    let nearTouch = false;
    const ys = Array.from({ length: N + 1 }, (_, j) => f((-Math.PI + 1e-9 + (2 * Math.PI * j) / N) / g));
    for (let j = 1; j <= N; j += 1) {
      if (Math.sign(ys[j]) !== Math.sign(ys[j - 1]) && ys[j] !== 0 && ys[j - 1] !== 0) changes += 1;
      // A touch: |f| at a local minimum, near 0, with no sign change around it.
      if (j < N && Math.abs(ys[j]) <= Math.abs(ys[j - 1]) && Math.abs(ys[j]) <= Math.abs(ys[j + 1]) && Math.abs(ys[j]) < 1e-3 && Math.sign(ys[j - 1]) === Math.sign(ys[j + 1])) nearTouch = true;
    }
    if (nearTouch) continue;
    const found = circleZeros(expr, 'x', roots);
    assert.ok(found, `${expr}: no answer`);
    const crossing = found.filter((z) => Math.sign(f(z - 1e-6)) !== Math.sign(f(z + 1e-6)));
    assert.equal(crossing.length, changes, `${expr}: ${crossing.length} sign-changing zeros found, the scan sees ${changes}`);
    for (const z of found) assert.ok(Math.abs(f(z)) < 1e-8, `${expr}: f(${z}) = ${f(z)} is not 0`);
    compared += 1;
  }
  assert.ok(compared >= 35, `only ${compared} cases compared`);
});

test('cross-check: a line meets a parabola or a circle exactly where the discriminant says', async () => {
  const r = rng(11);
  for (let i = 0; i < 30; i += 1) {
    const [a, b] = [int(r, -3, 3), int(r, -5, 5)];
    const circle = r() < 0.5;
    const [c, d, e] = [nonzero(r, -2, 2), int(r, -3, 3), int(r, -5, 5)];
    const R2 = int(r, 1, 30);
    const problem = circle ? `y = ${a}x + ${b}; x^2 + y^2 = ${R2}` : `y = ${a}x + ${b}; y = ${c}x^2 + ${d}x + ${e}`;
    // Substituted: circle (1 + a²)x² + 2abx + b² − R² = 0; parabola cx² + (d − a)x + (e − b) = 0.
    const [A, B, C] = circle ? [1 + a * a, 2 * a * b, b * b - R2] : [c, d - a, e - b];
    const disc = B * B - 4 * A * C;
    const expected = disc > 0 ? 2 : disc === 0 ? 1 : 0;
    const result = await solveProblem(problem, 'algebra');
    const pairs = /^\(x, y\) = /.test(String(result.answer)) ? String(result.answer).replace(/^\(x, y\) = /, '').split(/\s{2}or\s{2}/) : [];
    if (expected === 0) {
      assert.match(String(result.answer), /No real solution|do not intersect|never meet/, `${problem} → ${result.answer}`);
      continue;
    }
    assert.equal(pairs.length, expected, `${problem} → ${result.answer}: expected ${expected} intersection(s)`);
  }
});

test('two signs in a row are one sign, on every path', async () => {
  const { parseMathExpression } = await import('../src/lib/mathParser.js');
  assert.equal(parseMathExpression('x^2 + -3x'), 'x^2-3*x');
  assert.equal(parseMathExpression('x - -3'), 'x+3');
  assert.equal(parseMathExpression('5 - - - 2'), '5-2');
  assert.equal((await solveProblem('x^2 + -3x', 'derivatives')).answer, "f'(x) = 2x - 3"); // was "beyond what this engine can compute"
  assert.equal((await solveProblem('ln(x) + -1*x/4 <= 0', 'algebra')).status, 'solved'); // was refused
  // A root against a line, solved by squaring and kept where it holds.
  assert.equal((await solveProblem('sqrt(9 - x^2) >= 2x', 'algebra')).answer, '-3 ≤ x ≤ 3√5/5  (3√5/5 ≈ 1.3416)');
});

// --- Known answers (1.67.1) ---------------------------------------------------
//
// Problems built from answers chosen first, so the check is exact, not a
// scan: the endpoints must come back as exactly those values, the pairs of
// a system exactly those points.

const close = (a, b) => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b));
const endpointsOf = (answer) => answerSet(answer).endpoints;

test('known answers: inequalities return exactly the endpoints they were built from', async () => {
  const r = rng(424242);
  for (let i = 0; i < 25; i += 1) {
    // Rational roots n/d and m/e: (d·x − n)(e·x − m), and a sign chosen.
    const [n, d, m, e] = [int(r, -9, 9), int(r, 1, 4), int(r, -9, 9), int(r, 1, 4)];
    if (n * e === m * d) continue;
    const op = OPS[int(r, 0, 3)];
    const problem = `(${d}*x - (${n}))*(${e}*x - (${m})) ${op} 0`;
    const result = await solveProblem(problem, 'algebra');
    const ends = endpointsOf(result.answer);
    const want = [n / d, m / e];
    for (const w of want) assert.ok(ends.some((x) => close(x, w)), `${problem} → ${result.answer}: missing the endpoint ${w}`);
    assert.ok(ends.every((x) => want.some((w) => close(x, w))), `${problem} → ${result.answer}: an endpoint it was not built from`);
    assert.doesNotMatch(result.answer, /≈ [-\d.]+ (?:is|are) (?:a )?zero/, `${problem}: a rational endpoint written as a decimal`);
  }
  // A double root: (x − a)² ≥ 0 everywhere, > 0 everywhere but a, ≤ 0 only at a, < 0 nowhere.
  for (const a of [-3, 0, 2.5]) {
    assert.equal((await solveProblem(`(x - (${a}))^2 >= 0`, 'algebra')).answer, 'All real numbers satisfy the inequality');
    assert.equal(endpointsOf((await solveProblem(`(x - (${a}))^2 > 0`, 'algebra')).answer).filter((x) => close(x, a)).length, 2);
    assert.ok(endpointsOf((await solveProblem(`(x - (${a}))^2 <= 0`, 'algebra')).answer).every((x) => close(x, a)));
    assert.match((await solveProblem(`(x - (${a}))^2 < 0`, 'algebra')).answer, /^No solution/);
  }
  // A cancelled factor: (x − a)/(x − a) > 0 everywhere but a.
  for (const a of [-2, 0, 3]) {
    const set = answerSet((await solveProblem(`(x - (${a}))/(x - (${a})) > 0`, 'algebra')).answer);
    assert.ok(!set.test(a) && set.test(a + 0.5) && set.test(a - 0.5), `(x − ${a})/(x − ${a}) > 0`);
  }
  // A square root's edge: √(x − a) ≤ 0 is x = a; √(x − a) < b is a ≤ x < a + b².
  for (const [a, b] of [[1, 3], [-2, 2], [0, 1]]) {
    assert.equal((await solveProblem(`sqrt(x - (${a})) <= 0`, 'algebra')).answer, `x = ${a}`);
    const set = answerSet((await solveProblem(`sqrt(x - (${a})) < ${b}`, 'algebra')).answer);
    assert.ok(set.test(a) && !set.test(a + b * b) && set.test(a + b * b - 1e-6) && !set.test(a - 1e-6), `√(x − ${a}) < ${b}`);
  }
  // A zero far out: e^(x/k) > x has its second zero past 50 for k ≥ 12.
  for (const k of [12, 20, 30]) {
    const ends = endpointsOf((await solveProblem(`e^(x/${k}) > x`, 'algebra')).answer);
    assert.equal(ends.length, 2, `e^(x/${k}) > x`);
    for (const x of ends) assert.ok(Math.abs(Math.exp(x / k) - x) < 1e-3 * Math.max(1, x), `e^(x/${k}) > x: ${x} is not a zero`);
  }
  // Close periodic zeros: sin(nx) > c with c near 1, each period's two zeros
  // 2·arccos(c)/n apart, as arcsin(c) and π − arcsin(c), divided by n.
  for (const [n, c] of [[1, 0.9999], [2, 0.99999], [3, -0.9999]]) {
    const result = await solveProblem(`sin(${n}x) > ${c}`, 'algebra');
    const ends = endpointsOf(result.answer);
    const z1 = Math.asin(c) / n;
    const z2 = (Math.PI - Math.asin(c)) / n;
    const T = (2 * Math.PI) / n;
    // The named endpoints' decimals are rounded to the decimal places shown.
    const onGrid = (z) => ends.some((x) => Math.abs((x - z) - T * Math.round((x - z) / T)) < 1e-4);
    assert.ok(onGrid(z1) && onGrid(z2), `sin(${n}x) > ${c} → ${result.answer}`);
  }
});

test('known answers: systems return exactly the points they were built from', async () => {
  const r = rng(99);
  for (let i = 0; i < 15; i += 1) {
    // A line through (p, f(p)) and (q, f(q)) on the parabola y = c(x − p)(x − q) + line.
    const [p, q] = [int(r, -5, 5), int(r, -5, 5)];
    if (p === q) continue;
    const [a, b, c] = [int(r, -3, 3), int(r, -5, 5), nonzero(r, -2, 2)];
    const line = (x) => a * x + b;
    const problem = `y = ${a}x + ${b}; y = ${c}*(x - (${p}))*(x - (${q})) + ${a}x + ${b}`;
    const result = await solveProblem(problem, 'algebra');
    const want = [[p, line(p)], [q, line(q)]].sort((u, v) => u[0] - v[0]);
    assert.equal(result.answer, `(x, y) = (${want[0][0]}, ${want[0][1]})  or  (${want[1][0]}, ${want[1][1]})`, problem);
  }
  for (let i = 0; i < 15; i += 1) {
    // A 3×3 system from a chosen solution and an invertible integer matrix.
    const sol = [int(r, -5, 5), int(r, -5, 5), int(r, -5, 5)];
    const M = Array.from({ length: 3 }, () => [int(r, -4, 4), int(r, -4, 4), int(r, -4, 4)]);
    const det = M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
    if (det === 0 || M.some((row) => row.every((v) => v === 0))) continue;
    const eq = (row) => `${row[0]}x + ${row[1]}y + ${row[2]}z = ${row[0] * sol[0] + row[1] * sol[1] + row[2] * sol[2]}`;
    const problem = M.map(eq).join('; ');
    const result = await solveProblem(problem, 'algebra');
    assert.equal(result.answer, `x = ${sol[0]},  y = ${sol[1]},  z = ${sol[2]}`, problem);
  }
});

test('a sign that changes infinitely often is refused with the reason, not as unproved zeros', async () => {
  for (const [problem, end] of [['e^x > cos(x)', '−∞'], ['e^(-x) > sin(x)', '∞'], ['1/x > sin(x)', '−∞']]) {
    const result = await solveProblem(problem, 'algebra');
    assert.equal(result.status, 'unsupported', problem);
    assert.match(result.answer, new RegExp(`changes sign infinitely often: as x → ${end}`), problem);
  }
  // A wave that settles inside the band of a term that grows has finitely
  // many zeros: solved, not refused.
  const solved = await solveProblem('x^2 > 2*sin(x) + 1', 'algebra');
  assert.equal(solved.status, 'solved');
  const [a, b] = endpointsOf(solved.answer);
  for (const x of [a, b]) assert.ok(Math.abs(x * x - 2 * Math.sin(x) - 1) < 1e-3, `${x} is a zero`);
});

test('a numeric root list cut short says so in the answer, not only in a step', async () => {
  const endless = await solveProblem('e^x - cos(x) = 0', 'trigonometry');
  assert.match(endless.answer, /^Infinitely many solutions; the 5 nearest 0 are /);
  assert.ok(endless.steps.some((t) => /changes sign in every period/.test(t)));
  const more = await solveProblem('x*sin(x) = 1', 'trigonometry');
  assert.match(more.answer, /\(the 5 solutions nearest 0; there are more\)$/);
});

test('tan and cot against a line: a root on every branch, the nearest ones found', async () => {
  const numbers = (a) => [...String(a).matchAll(/x [≈=] (-?[\d.]+)/g)].map((m) => Number(m[1]));
  const cases = [
    ['tan(x) = x', /^Infinitely many solutions, exactly one between/, [-7.7253, -4.4934, 0, 4.4934, 7.7253]],
    ['tan(x) = -x', /^Infinitely many solutions, exactly one between/, [-4.9132, -2.0288, 0, 2.0288, 4.9132]],
    ['cot(x) = x', /^Infinitely many solutions, exactly one between/, [-3.4256, -0.8603, 0.8603, 3.4256]],
    ['tan(x) = 2x + 1', /^Infinitely many solutions, one or three between/, [-4.5908, 1.2998, 4.6149]],
  ];
  for (const [problem, shape, expected] of cases) {
    const result = await solveProblem(problem, 'trigonometry');
    assert.match(result.answer, shape, problem);
    const got = numbers(result.answer);
    for (const x of expected) assert.ok(got.some((y) => Math.abs(y - x) < 1e-4), `${problem}: ${x} missing from ${result.answer}`);
  }
  // sec and csc against a line: two or none per branch, by convexity; the
  // scan listed −33.017 and skipped 4.9172, 7.7242 and −7.9796.
  for (const [problem, expected] of [['sec(x) = x', [-7.9796, -4.4877, -2.0739, 4.9172, 7.7242]], ['csc(x) = x + 2', [0.425, 2.9377]]]) {
    const result = await solveProblem(problem, 'trigonometry');
    assert.match(result.answer, /^Infinitely many solutions, two or none between/, problem);
    const got = numbers(result.answer);
    for (const x of expected) assert.ok(got.some((y) => Math.abs(y - x) < 1e-4), `${problem}: ${x} missing from ${result.answer}`);
  }
  // No proof (sec against a parabola): the list says it may be incomplete.
  const sec = await solveProblem('sec(x) = x^2', 'trigonometry');
  assert.match(sec.answer, /there may be more\)$/);
  // A root 0.0067 from an exact zero of a neighbour is not moved onto it.
  const near = await solveProblem('tan(x) = x + 0.0000001', 'trigonometry');
  assert.match(near.answer, /x ≈ 0\.0067/);
});

test('a flat root is located to the digits shown, and = only for the root itself', async () => {
  // tan(x) = sin(x) has a triple root at 2π: bisection stopped at |f| < 10^(−6),
  // x ≈ 6.2813, and the rounded 6.2832 then passed for exact.
  const result = await solveProblem('tan(x) = sin(x)', 'trigonometry');
  assert.match(result.answer, /x ≈ -6\.2832 .* x = 0 .* x ≈ 6\.2832/);
});

test('an inequality with tan, cot, sec or csc of x is never answered as if they were continuous', async () => {
  // Each was answered in 1.67.1: x < −π/2, "No solution", x < π/2, …
  for (const problem of ['tan(x) > x', 'tan(x) + x > 0', 'tan(2x) > x', 'cot(x) > x', 'sec(x) > x', 'csc(x) < x', 'tan(x)/x > 1', 'ln(x) + tan(x) > 0']) {
    const result = await solveProblem(problem, 'algebra');
    assert.equal(result.status, 'unsupported', `${problem} → ${result.answer}`);
  }
  const tan = await solveProblem('tan(x) > x', 'algebra');
  assert.match(tan.answer, /zero at least once between each pair of consecutive poles of tan\(x\)/);
});

test('finalizeResult is idempotent: a finished result passes through it unchanged', async () => {
  const { finalizeResult } = await import('../src/lib/api/finalize.js');
  const problems = [
    ['sin(pi/6)', 'trigonometry'], ['log(8)', 'other'], ['0.333...', 'other'], ['0.1666… + 1/3', 'other'], ['8/2(2+2)', 'other'],
    ['1/7', 'other'], ['x - ln(x) > 2', 'algebra'], ['∫_0^1 x^3 dx', 'integrals'], ['lim x->infinity sqrt(x^2+x)-x', 'limits'],
    ['x^2 - 5x + 6 = 0', 'algebra'], ['2x + 3y = 6; x - y = 4', 'algebra'], ['x^3 - 3x', 'functions'], ['d/dx x^2*sin(x)', 'derivatives'],
    ['log(-1)', 'other'], ['ln(x) < 1', 'algebra'], ['2/0', 'other'],
  ];
  for (const [p, topic] of problems) {
    const once = await solveProblem(p, topic);
    const twice = finalizeResult(structuredClone(once), p);
    assert.deepEqual(twice, once, `${p}: finalizing again changed the result`);
  }
});

test('worked lines found missing or doubled in the browser pass', async () => {
  const { solvePlain } = await import('./helpers/solvePlain.js');
  // A factored expression: the form it became, not the typed one twice.
  assert.equal((await solvePlain('x^2 - 9', 'algebra')).tips[1], 'Here: x^2 - 9 = (x - 3)(x + 3).');
  // A sum of powers, term by term; a single power, its exponent brought down.
  assert.equal((await solvePlain('d/dx 3x^4 - 2x + 7', 'derivatives')).tips[1], 'Here: d/dx(3x^4) = 12x^3, d/dx(-2x) = -2, d/dx(7) = 0, so f′(x) = 12x^3 - 2.');
  assert.equal((await solvePlain('d/dx x^3', 'derivatives')).tips[1], 'Here: d/dx(x^3) = 3x^2: the exponent 3 comes down as a factor, and the power drops to 2.');
});
