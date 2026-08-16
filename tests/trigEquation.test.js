import test from 'node:test';
import assert from 'node:assert/strict';

import { solveProblem, finalizeResult, isPresentable } from '../src/lib/api.js';
import { solveTrigEquation } from '../src/lib/solvers/trigEquationSolver.js';
import { STATUS } from '../src/lib/solutionEnvelope.js';

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
  assert.match(r.answer, /x = \(π\/6 \+ 2πn\)\/2/);
  const half = solveTrigEquation('tan(x/2)=sqrt(3)');
  assert.equal(solutionsOf(half), '2π/3');
  assert.match(half.answer, /x = 2\(π\/3 \+ πn\)/);
  assert.match(half.steps.join('\n'), /Multiply by 2/);
});

test('non-special values fall back to decimals and still verify', () => {
  const r = solveTrigEquation('sin(x)=0.3');
  assert.equal(r.status ?? STATUS.SOLVED, STATUS.SOLVED);
  assert.match(r.answer, /0\.3047/);
  assert.match(r.answer, /2\.8369/);
});

test('out-of-range sin/cos is "no real solution", not an error', () => {
  const r = solveTrigEquation('sin(x)=2');
  assert.equal(r.status, STATUS.UNDEFINED);
  assert.equal(r.answer, 'No real solution');
});

test('out-of-family equations are refused explicitly, never mis-solved', () => {
  for (const eq of ['sin(x)^2=1/4', 'sin(x)=cos(x)', 'sin(x^2)=0', 'sin(x)+x=1', 'sec(x)=2']) {
    const r = solveTrigEquation(eq);
    assert.equal(r.status, STATUS.UNSUPPORTED, eq);
    assert.match(r.answer, /not supported yet/);
  }
});

test('the graph marks the [0, 2π) solutions and overlays y = c', () => {
  const r = solveTrigEquation('sin(x)=1/2');
  assert.ok(r.graph);
  assert.equal(r.graph.solutions.length, 2);
  assert.ok(Math.abs(r.graph.solutions[0] - Math.PI / 6) < 1e-9);
  assert.equal(r.graph.secondaryLabel, 'y = 1/2');
});
