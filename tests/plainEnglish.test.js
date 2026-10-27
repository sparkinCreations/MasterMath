import test from 'node:test';
import assert from 'node:assert/strict';

import { readPlainEnglish } from '../src/lib/plainEnglish.js';
import { solveProblem } from '../src/lib/api.js';
import { validateMathInput } from '../src/lib/validation.js';

// 1.52.2: "Type it as you would say it". Before it, 7 of 56 everyday
// phrasings solved ("x squared" was '"squared" is not a known function'),
// and the integral, limit and inequality paths read an unknown word as a
// constant and answered it, marked Solved.

test('spoken powers, roots, functions and relations read as notation', () => {
  const cases = [
    ['x squared', 'x^2'], ['x cubed', 'x^3'], ['3x squared + 2x', '3x^2 + 2x'], ['(x+1) squared', '(x+1)^2'],
    ['x to the power of 3', 'x^3'], ['x to the 3rd power', 'x^3'], ['x to the third power', 'x^3'], ['x to the 5', 'x^5'],
    ['x raised to the 4', 'x^4'], ['x raised to the power of 4', 'x^4'], ['e to the x', 'e^x'], ['e to the power of 2x', 'e^(2x)'],
    ['x to the power of 1/2', 'x^(1/2)'], ['x to the n', 'x^n'], ['x**3', 'x^3'], ['2 ** 10', '2 ^ 10'],
    ['sin squared x', 'sin(x)^2'], ['sine of x', 'sin(x)'], ['cosine of 2x', 'cos(2x)'], ['cosine of (2x + 1)', 'cos(2x + 1)'],
    ['the natural log of x squared', 'ln(x^2)'], ['square root of x', 'sqrt(x)'], ['what is the square root of 16', 'what is sqrt(16)'],
    ['cube root of 27', 'cbrt(27)'], ['log base 2 of 8', 'log(8, 2)'], ['absolute value of (x - 3) = 5', 'abs(x - 3) = 5'],
    ['x over 2', 'x / 2'], ['2x plus 3 equals 7', '2x + 3 = 7'], ['2x + 3 is equal to 7', '2x + 3 = 7'],
    ['2x + 1 is greater than 5', '2x + 1 > 5'], ['x is less than or equal to 3', 'x <= 3'], ['2x is at least 6', '2x >= 6'],
    ['negative 3 plus 5', '-3 + 5'], ['20 percent of 50', '20% of 50'], ['half of 10', '(1/2)*10'],
  ];
  for (const [spoken, notation] of cases) assert.equal(readPlainEnglish(spoken), notation, spoken);
});

test('numbers written as words read as numbers', () => {
  const cases = [
    ['two plus one', '2 + 1'], ['three squared', '3^2'], ['two x plus five equals eleven', '2x + 5 = 11'],
    ['twenty one minus seven', '21 - 7'], ['twenty-one', '21'], ['one hundred and five', '105'],
    ['one thousand two hundred and thirty four', '1234'], ['two thousand and one', '2001'],
    ['two point five times four', '2.5 * 4'], ['three point one four', '3.14'],
    ['one half plus one third', '(1/2) + (1/3)'], ['three quarters of twelve', '(3/4)*12'], ['a third of nine', '(1/3)*9'],
    ['limit as x approaches zero of sin(x)/x', 'limit as x approaches 0 of sin(x)/x'], ['ten x squared', '10x^2'],
    // "and" joins a number only after hundred/thousand: elsewhere it is the conjunction.
    ['add two and three', 'add 2 and 3'], ['the sum of seven and eight', 'the sum of 7 and 8'],
    // Two numbers side by side stay two numbers (the solver refuses "2 3" as ambiguous).
    ['two three', '2 3'],
  ];
  for (const [spoken, notation] of cases) assert.equal(readPlainEnglish(spoken), notation, spoken);
  // Ordinals and "one-sided" keep their meaning; words that contain a number do not change.
  for (const s of ['second derivative of x^3', 'one-sided limit as x approaches 0 of 1/x', 'one sided limit', 'x tends to infinity', 'someone', 'none', 'often'])
    assert.equal(readPlainEnglish(s), s, s);
});

test('instructions and notation are left alone', () => {
  for (const s of [
    'find the tangent line to x^2 at x = 1', 'limit as x approaches 0 from the right of 1/x',
    'integrate x^2 over the interval from 0 to 1', 'derivative of x^3 with respect to x', 'solve for x: 3x = 9',
    'e^x + x^2', 'x^2 - 4 = 0', '15% of 80', 'what is 2 + 3', 'lim x->0 (sin(x)/x)', '∫_0^1 x^2 dx',
  ]) assert.equal(readPlainEnglish(s), s, s);
});

test('plain-English problems solve, under every topic they belong to', async () => {
  const cases = [
    ['x squared', 'derivatives', "f'(x) = 2x"],
    ['x to the power of 3', 'derivatives', "f'(x) = 3x^2"],
    ['e to the x times sin x', 'derivatives', /e\^x/],
    ['x squared - 4 = 0', 'algebra', 'x = -2  or  x = 2'],
    ['x**2 - 4 = 0', 'algebra', 'x = -2  or  x = 2'],
    ['2**10', 'other', /1024/],
    ['5 squared', 'other', /25/],
    ['the square root of 16', 'other', /\b4\b/],
    ['2x plus 3 equals 7', 'algebra', 'x = 2'],
    ['2x + 1 is greater than 5', 'algebra', 'x > 2'],
    ['natural log of x', 'derivatives', /1\/x/],
    ['integrate x squared from 0 to 1', 'integrals', /1\/3/],
    ['the integral of x squared', 'integrals', /1\/3\*x\^3/],
    ['lim x approaches 2 of x squared', 'limits', /= 4$/],
    ['what is 20 percent of 50', 'other', /\b10\b/],
    ['two plus one', 'other', '3'],
    ['two x plus five equals eleven', 'algebra', 'x = 3'],
    ['one half plus one third', 'other', /^5\/6/],
    ['three quarters of twelve', 'other', '9'],
    ['add two and three', 'other', '5'],
    ['limit as x approaches zero of sin(x)/x', 'limits', /= 1$/],
    ['second derivative of x cubed', 'derivatives', "f''(x) = 6x"],
  ];
  for (const [p, topic, answer] of cases) {
    const r = await solveProblem(p, topic);
    assert.equal(r.status, 'solved', `${p}: ${r.answer}`);
    if (typeof answer === 'string') assert.equal(r.answer, answer, p);
    else assert.match(r.answer, answer, p);
  }
});

test('an unknown word is refused on every path, never read as a constant', async () => {
  for (const [p, topic] of [
    ['integral of x apples', 'integrals'], ['∫_0^1 x apples dx', 'integrals'], ['lim x->2 x apples', 'limits'],
    ['x apples > 2', 'algebra'], ['x + y = 2; x apples = 1', 'algebra'], ['derivative of x dogs', 'derivatives'],
    ['x apples = 4', 'algebra'], ['x apples', 'functions'],
  ]) {
    const r = await solveProblem(p, topic);
    assert.equal(r.status, 'parse_error', `${p}: ${r.status} ${r.answer}`);
    assert.match(r.answer, /"(apples|dogs)" is not a known function/, p);
  }
});

test('the input check reads number words too, so the page sends them to the solver', () => {
  // Until 1.53.0 "two plus one" was "Please enter a valid math problem" on
  // the page (no digit, operator or x in it), although the solver answers it.
  for (const s of ['two plus one', 'ten minus four', 'one half plus one third']) assert.equal(validateMathInput(s).isValid, true, s);
  assert.equal(validateMathInput('hello world').isValid, false);
});
