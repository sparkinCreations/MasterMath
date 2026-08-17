import test from 'node:test';
import assert from 'node:assert/strict';

import { solveProblem } from '../src/lib/api.js';
import { integrateAbsLinear, derivativeMatchesNumerically } from '../src/lib/solvers/substitutionSolver.js';
import { isAlgebriteFailure, expressionsNumericallyEqual } from '../src/lib/solvers/solverUtils.js';
import { STATUS } from '../src/lib/solutionEnvelope.js';

const antiderivativeOf = (r) => r.answer.split(' = ')[1].replace(/ \+ C$/, '');

// ── QA report (High): x·cos(x²) was "non-elementary or beyond the engine".

test('∫ x·cos(x²) dx = ½ sin(x²) + C, by u-substitution with a worked walkthrough', async () => {
  const r = await solveProblem('x*cos(x^2)', 'integrals');
  assert.equal(r.status, STATUS.SOLVED);
  assert.equal(antiderivativeOf(r), '1/2*sin(x^2)');
  const s = r.steps.join('\n');
  assert.match(s, /Let u = x\^2/);
  assert.match(s, /du = 2x dx/);
  assert.match(s, /∫\(1\/2\*cos\(u\)\) du/);
  assert.match(s, /Substitute back u = x\^2/);
  assert.match(s, /Check by differentiating/);
});

test('u-substitution family: inner arguments, trig calls, logs, roots', async () => {
  const cases = [
    ['2*x*e^(x^2)', 'exp(x^2)'],
    ['sin(x)^2*cos(x)', '1/3*sin(x)^3'],
    ['cos(x)/sin(x)', 'ln|sin(x)|'],
    ['ln(x)/x', '1/2*ln|x|^2'],
    ['1/(x*ln(x))', 'ln|ln(x)|'],
  ];
  for (const [input, expected] of cases) {
    const r = await solveProblem(input, 'integrals');
    assert.equal(r.status, STATUS.SOLVED, input);
    assert.equal(antiderivativeOf(r), expected, input);
  }
});

test('every substitution result differentiates back to its integrand', async () => {
  for (const f of ['x*cos(x^2)', 'sin(x)^2*cos(x)', 'ln(x)/x', 'x*e^(x^2)']) {
    const r = await solveProblem(f, 'integrals');
    const F = antiderivativeOf(r).replace(/ln\|([^|]+)\|/g, 'log($1)');
    assert.ok(derivativeMatchesNumerically(F, f, 'x'), `${F} is not an antiderivative of ${f}`);
  }
});

test('products that are substitutions in disguise no longer go by parts via erf(ix)', async () => {
  const r = await solveProblem('2*x*e^(x^2)', 'integrals');
  assert.doesNotMatch(r.steps.join('\n'), /erf/);
  assert.match(r.steps.join('\n'), /Let u = x\^2/);
});

test('genuinely non-elementary integrands are still refused, not mis-solved', async () => {
  // (e^(-x^2) is not in this list: Algebrite integrates it to (√π/2)·erf(x),
  // a correct antiderivative in terms of a special function, and did so
  // before substitution support existed.)
  for (const f of ['sin(x^2)', 'sin(x)/x']) {
    const r = await solveProblem(f, 'integrals');
    assert.equal(r.status, STATUS.UNSUPPORTED, f);
    assert.match(r.answer, /non-elementary/);
  }
});

// ── QA report (High): ∫|x| dx.

test('∫ |x| dx = x·|x|/2 + C, with the piecewise reasoning', async () => {
  const r = await solveProblem('abs(x)', 'integrals');
  assert.equal(r.status, STATUS.SOLVED);
  assert.equal(antiderivativeOf(r), '1/2*x*abs(x)');
  const s = r.steps.join('\n');
  assert.match(s, /not differentiable at x = 0/);
  assert.match(s, /Split at the corner/);
  assert.match(s, /sgn\(x\)/);
});

test('|ax + b| and constant multiples, exact coefficients, verified', () => {
  const check = (term, expectedCoefTimes) => {
    const out = integrateAbsLinear(term, 'x');
    assert.ok(out, term);
    assert.ok(derivativeMatchesNumerically(out.antiderivative, term, 'x'), term);
    assert.match(out.antiderivative, expectedCoefTimes);
    assert.doesNotMatch(out.antiderivative, /0\.\d/, 'coefficient must be an exact fraction');
  };
  check('abs(x)', /^x\*abs\(x\)\/2$/);
  check('3*abs(x)', /^3\*x\*abs\(x\)\/2$/);
  check('-abs(x)', /^-x\*abs\(x\)\/2$/);
  check('abs(x)/2', /^x\*abs\(x\)\/4$/);
  check('abs(2*x-3)', /^\(2x - 3\)\*abs\(2x - 3\)\/4$/);
  check('abs(x-1)', /^\(x - 1\)\*abs\(x - 1\)\/2$/);
});

test('abs of a non-linear argument is not claimed by the linear formula', () => {
  assert.equal(integrateAbsLinear('abs(x^2-1)', 'x'), null);
  assert.equal(integrateAbsLinear('x*abs(x)', 'x'), null);
});

test('mixed sums integrate term by term with exact coefficients throughout', async () => {
  const r = await solveProblem('x*e^(x^2)+abs(x)', 'integrals');
  assert.equal(r.status, STATUS.SOLVED);
  assert.doesNotMatch(r.answer, /\d\.\d|x\^2\.0/, 'no float leakage from the abs coefficient');
  assert.ok(expressionsNumericallyEqual(
    antiderivativeOf(r).replace(/ln\|([^|]+)\|/g, 'log($1)'),
    '(exp(x^2) + x*abs(x))/2', 'x'));
});

// ── The bug found on the way: Algebrite returns some failures as text.

test('isAlgebriteFailure recognises returned (not thrown) failure text', () => {
  assert.equal(isAlgebriteFailure('Unsupported function abs'), true);
  assert.equal(isAlgebriteFailure('Stop: integral: sorry, could not find a solution'), true);
  assert.equal(isAlgebriteFailure('nil'), true);
  assert.equal(isAlgebriteFailure(''), true);
  assert.equal(isAlgebriteFailure('1/2*sin(x^2)'), false);
  assert.equal(isAlgebriteFailure('x*abs(x)'), false);
  assert.equal(isAlgebriteFailure('exp(x)*(x - 1)'), false);
});
