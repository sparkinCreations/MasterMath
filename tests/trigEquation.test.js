import test from 'node:test';
import assert from 'node:assert/strict';

import { solveProblem, finalizeResult, isPresentable } from '../src/lib/api.js';
import { solveTrigEquation as solveTrigMarked } from '../src/lib/solvers/trigEquationSolver.js';
import { plain } from './helpers/solvePlain.js';
import { STATUS } from '../src/lib/solutionEnvelope.js';

// Step wording is checked on the text a reader sees, without the ⟦…⟧ math markers.
const solveTrigEquation = (input) => plain(solveTrigMarked(input));
const CODE = /\bfunction\b\s*[\w$]*\s*\([^)]*\)\s*\{|=>|\[native code\]|\[object \w+\]/;
const textOf = (r) => [r.answer, ...r.steps, ...(r.tips || []), ...(r.common_mistakes || [])].join('\n');

// ── The critical finding: an equation under Trigonometry must never expose
// engine internals. mathjs parses "sin(x) = 1/2" as a function definition and
// returns the function; the old path stringified it into the answer.
test('sin(x)=1/2 under Trigonometry never exposes function source', async () => {
  const r = await solveProblem('sin(x)=1/2', 'trigonometry');
  assert.doesNotMatch(textOf(r), CODE);
  assert.equal(r.status, STATUS.SOLVED);
  assert.match(r.answer, /π\/6/);
  assert.match(r.answer, /5π\/6/);
});

// ── The result gate, independent of any solver.
test('finalizeResult refuses non-presentable answers and steps', () => {
  const fn = function theTypedFn(arg0, arg1) { return arg0 + arg1; };
  const cases = [
    { answer: fn, steps: ['ok'] },
    { answer: 'x = 2', steps: [fn] },
    { answer: { value: 3 }, steps: ['ok'] },
    { answer: [1, 2], steps: ['ok'] },
    { answer: String(fn), steps: ['ok'] },                       // stringified source
    { answer: 'x = (a) => a * 2', steps: ['ok'] },               // arrow with body
    { answer: '[object Object]', steps: ['ok'] },
  ];
  for (const c of cases) {
    const r = finalizeResult({ ...c }, 'sin(x)=1/2');
    assert.equal(r.status, STATUS.UNSUPPORTED, `should be refused: ${String(c.answer).slice(0, 40)}`);
    assert.doesNotMatch(textOf(r), CODE);
    assert.notEqual(r.status, STATUS.SOLVED);
  }
});

test('finalizeResult keeps ordinary maths and prose, and stringifies numbers', () => {
  const ok = [
    'x = 2',
    'Return to the original variable: u = x^2 + 1',   // prose "return" is fine
    'The arguments of the trig functions must match.', // prose "arguments" is fine
    'd/dx(x^2) = 2x',
    'f(x) = 3x + 1',
    '∫ x dx = x^2/2 + C',
  ];
  for (const s of ok) assert.equal(isPresentable(s), true, s);
  const r = finalizeResult({ answer: 42, steps: ['a', 7] }, '6*7');
  assert.equal(r.answer, '42');
  assert.deepEqual(r.steps, ['a', '7']);
  assert.equal(r.status, STATUS.SOLVED);
});

// ── The trig equation solver's mathematics.
const solutionsOf = (r) => r.answer.split('on [0, 2π):')[1].trim();

test('sin(x) = c: two solutions per period, exact special angles', () => {
  assert.equal(solutionsOf(solveTrigEquation('sin(x)=1/2')), 'π/6, 5π/6');
  assert.equal(solutionsOf(solveTrigEquation('sin(x)=sqrt(3)/2')), 'π/3, 2π/3');
  assert.equal(solutionsOf(solveTrigEquation('sin(x)=-1/2')), '7π/6, 11π/6');
  assert.equal(solutionsOf(solveTrigEquation('sin(x)=1')), 'π/2');
  assert.equal(solutionsOf(solveTrigEquation('sin(x)=0')), '0, π');
  assert.match(solveTrigEquation('sin(x)=0').answer, /^x = πn/);
});

test('cos(x) = c: ± reference angle', () => {
  assert.equal(solutionsOf(solveTrigEquation('cos(x)=1/2')), 'π/3, 5π/3');
  assert.equal(solutionsOf(solveTrigEquation('cos(x)=-1/2')), '2π/3, 4π/3');
  assert.equal(solutionsOf(solveTrigEquation('cos(x)=0')), 'π/2, 3π/2');
  assert.match(solveTrigEquation('cos(x)=0').answer, /^x = π\/2 \+ πn/);
  assert.equal(solutionsOf(solveTrigEquation('cos(x)=-1')), 'π');
});

test('tan(x) = c: period π', () => {
  assert.equal(solutionsOf(solveTrigEquation('tan(x)=1')), 'π/4, 5π/4');
  assert.equal(solutionsOf(solveTrigEquation('tan(x)=sqrt(3)')), 'π/3, 4π/3');
  assert.match(solveTrigEquation('tan(x)=1').answer, /^x = π\/4 \+ πn/);
});

test('linear wrapping is isolated first: A·f(x) + B = C and f on the right', () => {
  const r = solveTrigEquation('2*cos(x)-1=0');
  assert.match(r.steps.join('\n'), /Isolate the trig function: cos\(x\) = 1\/2/);
  assert.equal(solutionsOf(r), 'π/3, 5π/3');
  const r2 = solveTrigEquation('sqrt(3)=2*sin(x)');
  assert.match(r2.steps.join('\n'), /sin\(x\) = √3\/2/);
  assert.equal(solutionsOf(r2), 'π/3, 2π/3');
});

test('argument kx: divide (or multiply) through, and list every solution in [0, 2π)', () => {
  const r = solveTrigEquation('sin(2x)=1/2');
  assert.equal(solutionsOf(r), 'π/12, 5π/12, 13π/12, 17π/12');
  // 1.65.0: the families divided through: π/12 + πn, not (π/6 + 2πn)/2.
  assert.match(r.answer, /x = π\/12 \+ πn  or  x = 5π\/12 \+ πn/);
  const half = solveTrigEquation('tan(x/2)=sqrt(3)');
  assert.equal(solutionsOf(half), '2π/3');
  assert.match(half.answer, /x = 2π\/3 \+ 2πn/);
  assert.match(half.steps.join('\n'), /Multiply by 2/);
});

test('non-special values fall back to decimals and still verify', () => {
  const r = solveTrigEquation('sin(x)=0.3');
  assert.equal(r.status ?? STATUS.SOLVED, STATUS.SOLVED);
  assert.match(r.answer, /0\.3047/);
  assert.match(r.answer, /2\.8369/);
});

test('out-of-range sin/cos is "no real solution", not an error', () => {
  // Solved, with the reason, as the algebra solver reports e^x = −1 (1.58.0).
  const r = solveTrigEquation('sin(x)=2');
  assert.equal(r.status, STATUS.SOLVED);
  assert.equal(r.answer, 'No real solution (sin(θ) is never outside [−1, 1])');
});

test('out-of-family equations are refused explicitly, never mis-solved', () => {
  // (sin(x)^2 = 1/4 and sin(x) = cos(x) are reducible now — see below.)
  // (sin(x) = sin(2x) and sin(x) + cos(x) = 1 are solved now — see below.)
  for (const eq of ['sin(x)*cos(2x)=1/3', 'sin(x^2)=0', 'sin(x)+x=1', 'sin(x)*tan(x)=1']) {
    const r = solveTrigEquation(eq);
    assert.equal(r.status, STATUS.UNSUPPORTED, eq);
    assert.match(r.answer, /no exact reduction/);
  }
});

// The refusal message is the solver's stated contract. Roadmap 2026-09 item 2:
// it once claimed squared trig terms and two-function equations were unsolved
// long after both shipped. Every example the message cites is checked here,
// so the text cannot drift from the solver again.
test('the refusal message names only shapes the solver really does or does not reduce', () => {
  const refusal = solveTrigEquation('sin(x^2) = 0');
  const text = [refusal.reason, ...refusal.tips].join('\n');
  assert.doesNotMatch(text, /not solved yet|not supported yet/);

  const solvedExactly = ['sin(x) = 1/2', '2cos(x) - 1 = 0', 'tan(2x) = 1', 'sec(x) = 2', '2sin(x)^2 - sin(x) - 1 = 0',
    'sin(x)^2 + cos(x) = 1', 'sin(x) + cos(x) = 1', 'sin(x)cos(x) = 1/4', 'sin(x) = sin(2x)', 'sin(2x) = cos(x)'];
  for (const eq of solvedExactly) {
    const r = solveTrigEquation(eq);
    assert.notEqual(r.status, STATUS.UNSUPPORTED, `${eq} is cited as solved exactly but was refused`);
    assert.ok(Array.isArray(r.steps) && r.steps.length > 1, `${eq} produced no worked steps`);
  }

  const noReduction = ['sin(x^2) = 0', 'sin(x) + x = 1', 'sin(x)*cos(2x) = 1/3', 'sin(x)^3 = 1/8', 'sin(x) + cos(2x) = 1'];
  for (const eq of noReduction) {
    assert.equal(solveTrigEquation(eq).status, STATUS.UNSUPPORTED, `${eq} is cited as unreduced but was solved`);
  }
});

test('the graph marks the [0, 2π) solutions and overlays y = c', () => {
  const r = solveTrigEquation('sin(x)=1/2');
  assert.ok(r.graph);
  assert.equal(r.graph.solutions.length, 2);
  assert.ok(Math.abs(r.graph.solutions[0] - Math.PI / 6) < 1e-9);
  assert.equal(r.graph.secondaryLabel, 'y = 1/2');
});

test('reducible equations: quadratic in one function, sin = cos, Pythagorean rewrite', () => {
  const q = solveTrigEquation('2sin(x)^2 - sin(x) - 1 = 0');
  // 1.65.0: the cases in the order of their first solution.
  assert.equal(q.answer, 'x = π/2 + 2πn  or  x = 7π/6 + 2πn  or  x = 11π/6 + 2πn (n ∈ ℤ);  on [0, 2π): π/2, 7π/6, 11π/6');
  assert.ok(q.steps.some((s) => /Let u = sin\(x\): 2u² − u − 1 = 0/.test(s)));
  assert.equal(solveTrigEquation('sin(x)^2 = 1/4').answer.split('on [0, 2π): ')[1], 'π/6, 5π/6, 7π/6, 11π/6');
  assert.match(solveTrigEquation('tan(x)^2 = 3').answer, /on \[0, 2π\): π\/3, 2π\/3, 4π\/3, 5π\/3/);
  assert.match(solveTrigEquation('sin(x) = cos(x)').answer, /^x = π\/4 \+ πn/);
  assert.match(solveTrigEquation('sin(x)^2 + cos(x) = 1').answer, /on \[0, 2π\): 0, π\/2, 3π\/2/);
  assert.match(solveTrigEquation('2cos(x)^2 + sin(x) = 1').answer, /on \[0, 2π\): π\/2, 7π\/6, 11π\/6/);
  assert.equal(solveTrigEquation('sin(x)^2 = 2').status, STATUS.SOLVED);
  assert.match(solveTrigEquation('2sin(2x)^2 = 1').answer, /on \[0, 2π\): π\/8, 3π\/8, 5π\/8, 7π\/8, 9π\/8, 11π\/8, 13π\/8, 15π\/8/);
});

test('auxiliary angle and equal-argument equations', () => {
  assert.equal(solveTrigEquation('sin(x) + cos(x) = 1').answer, 'x = 2πn  or  x = π/2 + 2πn (n ∈ ℤ);  on [0, 2π): 0, π/2');
  assert.match(solveTrigEquation('sin(x) + sqrt(3)cos(x) = 1').answer, /on \[0, 2π\): π\/2, 11π\/6/);
  assert.equal(solveTrigEquation('sin(x) + cos(x) = 2').status, STATUS.SOLVED);
  assert.equal(solveTrigEquation('sin(x) = sin(2x)').answer, 'x = 2πn  or  x = π/3 + (2π/3)n (n ∈ ℤ);  on [0, 2π): 0, π/3, π, 5π/3');
  assert.match(solveTrigEquation('cos(3x) = cos(x)').answer, /on \[0, 2π\): 0, π\/2, π, 3π\/2/);
  assert.match(solveTrigEquation('sin(2x) = cos(x)').answer, /on \[0, 2π\): π\/6, π\/2, 5π\/6, 3π\/2/);
  assert.equal(solveTrigEquation('sin(x) = sin(x)').answer, 'All real numbers (identity)');
});

test('reciprocal functions and sin·cos products reduce exactly; the rest fall to the numeric scan under Trigonometry', async () => {
  assert.equal(solveTrigEquation('sec(x) = 2').answer, 'x = π/3 + 2πn  or  x = 5π/3 + 2πn (n ∈ ℤ);  on [0, 2π): π/3, 5π/3');
  assert.equal(solveTrigEquation('sec(x) = 1/2').status, STATUS.SOLVED);
  assert.match(solveTrigEquation('sin(x)*cos(x) = 1/4').answer, /on \[0, 2π\): π\/12, 5π\/12, 13π\/12, 17π\/12/);
  assert.match(solveTrigEquation('sin(x)cos(x) = 0').answer, /^x = \(π\/2\)n/);
  const { solveProblem } = await import('../src/lib/api.js');
  const numeric = await solveProblem('sin(x)*cos(2x) = 1/3', 'trigonometry');
  assert.equal(numeric.status, 'solved');
  assert.match(numeric.steps[0], /solved numerically/);
  assert.match(numeric.answer, /x ≈ -0\.9904/); // located numerically: ≈ (1.53.2)
});

// ── Written in sine and cosine, cleared and factored (1.67.3): tan(x) = sin(x)
// was five numeric roots, two of them wrong in the third decimal.
test('mixed functions of one angle: written in sin and cos, factored, solved exactly', async () => {
  const cases = [
    ['tan(x) = sin(x)', 'x = πn (n ∈ ℤ);  on [0, 2π): 0, π'],
    ['2*sin(x)*cos(x) = sin(x)', 'x = πn  or  x = π/3 + 2πn  or  x = 5π/3 + 2πn (n ∈ ℤ);  on [0, 2π): 0, π/3, π, 5π/3'],
    ['csc(x) - sin(x) = cos(x)', 'x = π/4 + πn  or  x = π/2 + πn (n ∈ ℤ);  on [0, 2π): π/4, π/2, 5π/4, 3π/2'],
    ['sec(x)^2 = 2*tan(x)', 'x = π/4 + πn (n ∈ ℤ);  on [0, 2π): π/4, 5π/4'],
    ['tan(2x) = sin(2x)', 'x = (π/2)n (n ∈ ℤ);  on [0, 2π): 0, π/2, π, 3π/2'],
    ['sin(x)*cos(x)*tan(x) = 1/4', 'x = π/6 + πn  or  x = 5π/6 + πn (n ∈ ℤ);  on [0, 2π): π/6, 5π/6, 7π/6, 11π/6'],
  ];
  for (const [problem, answer] of cases) {
    const r = await solveProblem(problem, 'trigonometry');
    assert.equal(r.answer, answer, problem);
  }
  const steps = (await solveProblem('tan(x) = sin(x)', 'trigonometry')).steps.map((t) => t.replace(/⟦|⟧/g, '')).join('\n');
  assert.match(steps, /tan\(x\) = sin\(x\)\/cos\(x\)/);
  assert.match(steps, /Factor: sin\(x\)·\(1 - cos\(x\)\) = 0/);
  // Under Algebra too, not the numeric scan.
  assert.equal((await solveProblem('tan(x) = sin(x)', 'algebra')).answer, 'x = πn (n ∈ ℤ);  on [0, 2π): 0, π');
});

test('an angle where tan, sec, cot or csc is undefined is removed, never listed', async () => {
  // sin(x) = 1 only at π/2 + 2πn, where tan is undefined: 1.67.2 listed them.
  const none = await solveProblem('tan(x)*cos(x) = 1', 'trigonometry');
  assert.equal(none.answer, 'No real solution');
  assert.ok(none.steps.some((t) => /Remove the excluded angles/.test(t)));
  // cos·tan = cos is tan(x) = 1 where cos(x) ≠ 0: cos(x) = 0 is not a solution.
  assert.equal((await solveProblem('cos(x)*tan(x) = cos(x)', 'trigonometry')).answer, 'x = π/4 + πn (n ∈ ℤ);  on [0, 2π): π/4, 5π/4');
});

test('a factor that only squaring solves: its roots kept, the false sign never added', async () => {
  // Algebrite's float() printed six digits and the true roots failed
  // sin² + cos² = 1: this was "No real solution". Squaring also admits the
  // other sign of sin at each root, x ≈ 5.7951 (2π − 0.4881), where
  // sin(x) + tan(x) = −1: sin is taken from the unsquared factor, so it is
  // never listed.
  const r = await solveProblem('sin(x) + tan(x) = 1', 'trigonometry');
  assert.equal(r.answer, 'x ≈ 0.4881 + 2πn  or  x ≈ 4.2242 + 2πn (n ∈ ℤ);  on [0, 2π): x ≈ 0.4881, 4.2242');
  // sec(x) + tan(x) = 1: squaring gives cos(x) = 0 or 1; cos = 0 is excluded
  // (sec and tan undefined), so only x = 2πn.
  assert.equal((await solveProblem('sec(x) + tan(x) = 1', 'trigonometry')).answer, 'x = 2πn (n ∈ ℤ);  on [0, 2π): 0');
});

test('a factor the root finder cannot finish is refused, never read as having no roots', async () => {
  // Squaring gives degree 120, beyond the exact root finder: no exact family
  // is claimed, and the numeric path says its list is partial.
  const r = await solveProblem('tan(x) = sin(x)^60 + 2', 'trigonometry');
  assert.doesNotMatch(r.answer, /\(n ∈ ℤ\)/);
  assert.match(r.answer, /^Infinitely many solutions, repeating every 2π; the 5 nearest 0 are/);
});

test('degrees: a family through 0 is written 180°n, not 0° + 180°n', () => {
  const r = solveTrigMarked('sin(x) = 0', 'x', { angleUnit: 'degrees' });
  assert.match(r.answer, /^x = 180°n \(n ∈ ℤ\)/);
});

// ── Degrees divide through by k as radians do (1.68.1): tan(2x) = 1 was
// "x = (45° + 180°n)/2". Each general solution is checked on its own: its
// members for n = −3…3 satisfy the equation, and over one turn it gives
// exactly the listed angles, no more and no fewer.
test('degrees: the general solution is divided through by k, and each family is checked', () => {
  const cases = [
    ['cos(4x) = 1', 'x = 90°n'],
    ['tan(2x) = 1', 'x = 22.5° + 90°n'],
    ['sin(3x) = 1/2', 'x = 10° + 120°n  or  x = 50° + 120°n'],
    ['tan(3x) = -1', 'x = 45° + 60°n'],
    ['sin(x/2) = 1/2', 'x = 60° + 720°n  or  x = 300° + 720°n'],
  ];
  for (const [problem, general] of cases) {
    const r = solveTrigMarked(problem, 'x', { angleUnit: 'degrees' });
    const [gen, list] = r.answer.split(' (n ∈ ℤ);  on [0°, 360°): ');
    assert.equal(gen, general, problem);
    const [lhs, rhs] = problem.split('=');
    const f = (deg) => {
      const x = (deg * Math.PI) / 180;
      const sides = [lhs, rhs].map((side) => Function('x', `return ${side.replace(/(\d)x/g, '$1*x').replace(/(sin|cos|tan)\(/g, 'Math.$1(')};`)(x));
      return sides[0] - sides[1];
    };
    const fams = gen.split('  or  ').map((t) => {
      const m = t.match(/^x = (?:(-?[\d.]+)° \+ )?([\d.]+)°n$/);
      return { base: m[1] ? Number(m[1]) : 0, period: Number(m[2]) };
    });
    const turn = new Set();
    for (const { base, period } of fams) {
      for (let n = -3; n <= 3; n += 1) assert.ok(Math.abs(f(base + period * n)) < 1e-9, `${problem}: ${base} + ${period}·${n}`);
      for (let x = base; x < 360 - 1e-9; x += period) turn.add(Math.round(x * 1e6) / 1e6);
    }
    const listed = list.split(', ').map((t) => Number(t.replace('°', '')));
    assert.deepEqual([...turn].sort((p, q) => p - q), listed, `${problem}: the families give exactly the listed angles`);
  }
  // A value that is no whole decimal number of degrees keeps the undivided
  // form, as radians does: 90°/7 would be rounded.
  assert.match(solveTrigMarked('sin(7x) = 1', 'x', { angleUnit: 'degrees' }).answer, /^x = \(90° \+ 360°n\)\/7/);
});
