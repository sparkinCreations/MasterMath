import test from 'node:test';
import assert from 'node:assert/strict';

import { solveProblem } from '../src/lib/api.js';
import { extractFunctionFromProblem } from '../src/lib/mathParser.js';
import { STATUS } from '../src/lib/solutionEnvelope.js';

// Findings from the fourth black-box pass: routing by the input's own intent,
// natural-language wrappers, degenerate input, and the export round-trip.

// ── The dropdown is no longer trusted over the input.
test('calculus notation routes to the calculus solver under any topic, and says so', async () => {
  const cases = [
    ['algebra', 'd/dx x^3', /f'\(x\) = 3x\^2/],
    ['algebra', 'derivative of sin(x)', /cos\(x\)/],
    ['algebra', 'integrate x^2', /1\/3\*x\^3 \+ C/],
    ['algebra', 'lim x->0 sin(x)/x', /= 1$/],
    ['derivatives', 'integrate x^2', /1\/3\*x\^3 \+ C/],
    ['integrals', 'd/dx x^2', /f'\(x\) = 2x/],
    ['functions', 'd/dx x^2', /f'\(x\) = 2x/],
    ['trigonometry', 'd/dx sin(x)', /f'\(x\) = cos\(x\)/],
    ['other', 'derivative of x^2', /f'\(x\) = 2x/],
    ['other', 'lim x->0 sin(x)/x', /= 1$/],
  ];
  for (const [topic, input, re] of cases) {
    const r = await solveProblem(input, topic);
    assert.equal(r.status, STATUS.SOLVED, `${topic}: ${input}`);
    assert.match(r.answer, re, `${topic}: ${input}`);
    assert.match(r.steps[0], /^Solved as (Derivatives|Integrals|Limits) \(you chose/, `${topic}: ${input}`);
  }
});

test('an equation in one unknown routes to Algebra under any topic (except where the topic owns equations)', async () => {
  for (const topic of ['derivatives', 'integrals', 'limits', 'functions', 'trigonometry', 'other']) {
    const r = await solveProblem('x^2 = 4', topic);
    assert.equal(r.answer, 'x = -2  or  x = 2', topic);
    assert.match(r.steps[0], /^Solved as Algebra/);
  }
  // Was: ∫(x^2=4) dx = nil*x + C  and  f'(x) = 0
  // Trig equations stay in Trigonometry; f(x)=… / y=… stay in Functions
  const t = await solveProblem('sin(x)=1/2', 'trigonometry');
  assert.match(t.answer, /π\/6/);
  assert.doesNotMatch(t.steps[0], /^Solved as/);
  const f = await solveProblem('y = x^2 - 1', 'functions');
  assert.match(f.answer, /vertex \(0, -1\)/);
  assert.doesNotMatch(f.steps[0], /^Solved as/);
});

test('a variable expression under Arithmetic goes to Algebra; "2 x 3" stays arithmetic', async () => {
  const r = await solveProblem('x^2 + 3x', 'other');
  assert.equal(r.answer, 'x^2 + 3x');
  assert.match(r.steps[0], /^Solved as Algebra/);
  assert.equal((await solveProblem('2 x 3', 'other')).answer, '6');
});

// ── The extractor.
test('d/dx keeps the closing parenthesis of a function call', () => {
  // Was: "sin(x" — the pattern's optional trailing \)? ate it.
  assert.equal(extractFunctionFromProblem('d/dx sin(x)'), 'sin(x)');
  assert.equal(extractFunctionFromProblem('d/dx sin(x)*cos(x)'), 'sin(x)*cos(x)');
  assert.equal(extractFunctionFromProblem('d/dx (x^3)'), 'x^3');
});

test('"y = …" is a definition only when y stands alone', () => {
  // Was: "2x + 3y = 6" → "6" (the y=… pattern grabbed "3y = 6").
  assert.equal(extractFunctionFromProblem('2x + 3y = 6'), '2*x+3*y=6');
  assert.equal(extractFunctionFromProblem('y = x^2'), 'x^2');
  assert.equal(extractFunctionFromProblem('y - 3 = 2x (solve for y)'), 'y-3=2*x');
});

// ── Natural-language wrappers.
test('"What is x if …", "What is the limit of …", "solve for y" are read', async () => {
  // Was: x = 6/xif2
  assert.equal((await solveProblem('What is x if 2x + 5 = 11?', 'algebra')).answer, 'x = 3');
  const l = await solveProblem('What is the limit of sin(x)/x as x approaches 0?', 'limits');
  assert.match(l.answer, /= 1$/);
  assert.doesNotMatch(l.answer, /Whatis/);
  assert.equal((await solveProblem('y - 3 = 2x (solve for y)', 'algebra')).answer, 'y = 2x + 3');
  assert.equal((await solveProblem('solve for y: 2x + 3y = 6', 'algebra')).answer, 'y = -2/3*x + 2');
});

// ── Two unknowns.
test('one equation in two unknowns is solved for one in terms of the other, and explained', async () => {
  // Was: "6".
  const r = await solveProblem('2x + 3y = 6', 'algebra');
  assert.equal(r.answer, 'x = -3/2*y + 3');
  assert.match(r.steps[0], /infinitely many solutions/);
  assert.equal((await solveProblem('a*b = 12', 'algebra')).answer, 'a = 12/b');
  // real form for radicals
  assert.equal((await solveProblem('x^2 + y^2 = 25', 'algebra')).answer, 'x = -(-y^2+25)^(1/2)  or  x = (-y^2+25)^(1/2)');
});

// ── Degenerate input.
test('degenerate input gets a parse error with a hint, not a fake result', async () => {
  for (const eq of ['=', 'x =', '= 5']) {
    const r = await solveProblem(eq, 'algebra');
    assert.equal(r.status, STATUS.PARSE_ERROR, eq);
    assert.match(r.answer + r.steps.join(' '), /both sides/);
  }
  const lim = await solveProblem('lim', 'limits');
  assert.equal(lim.status, STATUS.PARSE_ERROR);
  const bare = await solveProblem('x^2 + 1', 'limits'); // no approach point → ask
  assert.equal(bare.status, STATUS.PARSE_ERROR);
  assert.match(bare.answer + bare.steps.join(' '), /approach point/);
  const tp = await solveProblem('tan(pi/2)', 'limits'); // constant on an asymptote still speaks
  assert.equal(tp.answer, 'Undefined');
  const emptyInt = await solveProblem('∫', 'integrals');
  assert.equal(emptyInt.status, STATUS.PARSE_ERROR);
});

test('a constant under Functions is a constant, not "periodic" with an "asymptote"', async () => {
  const r = await solveProblem('sin(pi/4)', 'functions');
  assert.match(r.answer, /a constant function, equal to 0\.7071/);
  assert.doesNotMatch(r.answer, /periodic|asymptote/);
});

test('expand; overflow is an overflow', async () => {
  assert.equal((await solveProblem('expand (x+1)^2', 'algebra')).answer, 'x^2 + 2x + 1');
  const o = await solveProblem('9999999999^9999', 'other');
  assert.equal(o.status, STATUS.OVERFLOW);
});
