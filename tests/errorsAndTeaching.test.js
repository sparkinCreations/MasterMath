import test from 'node:test';
import assert from 'node:assert/strict';

import { solveProblem } from '../src/lib/api.js';
import { solvePlain } from './helpers/solvePlain.js';
import { syntaxProblem, plainSyntaxHint, isEngineMessage } from '../src/lib/syntaxCheck.js';

// 1.56.0, from the October 26 review: errors shown once and all at once,
// malformed input refused the same way on every path, the substitution
// algebra in a system, and f′ in the function analysis.

const TOPICS = ['auto', 'other', 'algebra', 'derivatives', 'integrals', 'limits', 'functions', 'trigonometry'];

test('syntaxProblem names what is wrong with the typing, in words', () => {
  for (const [input, hint] of [
    ['2+*', '"+*" — two operators in a row. Put a value between them, or remove one.'],
    ['2*/3', '"*/" — two operators in a row. Put a value between them, or remove one.'],
    ['x^^2', '"^^" — two operators in a row. Put a value between them, or remove one.'],
    ['3+', 'The input ends with "+" — something is missing after it.'],
    ['x^2 +', 'The input ends with "+" — something is missing after it.'],
    ['2^', 'The input ends with "^" — something is missing after it.'],
    ['*5', 'The input starts with "*" — something is missing before it.'],
    ['(2+3', 'Unbalanced parentheses: 1 opening "(" and 0 closing ")".'],
    ['2+3)', 'Unbalanced parentheses: 0 opening "(" and 1 closing ")".'],
    ['()', 'Empty parentheses "()" — put an expression inside them, or leave them out.'],
    ['sin()', '"sin()" has nothing inside it — sin needs an argument: "sin(x)", "sin(30)".'],
    ['d/dx (x^2 +)', '"+)" — the "+" has nothing after it inside the brackets.'],
    ['2..5', 'Two decimal points in one number — a number has one, as in "2.5".'],
    ['3,,4', 'Two commas in a row — something is missing between them.'],
    ['2 + = 3', '"+ =" — the "+" has nothing after it.'],
    ['x - = 1', '"− =" — the "−" has nothing after it.'],
    ['= 5', 'An equation needs an expression on both sides of "=".'],
    ['x =', 'An equation needs an expression on both sides of "=".'],
    ['x = = 2', 'Two "=" signs in a row — one goes between the two sides.'],
    ['2x + 3 >', 'An inequality needs an expression on both sides of ">".'],
    ['x < < 3', 'Two "<" signs in a row — one goes between the two sides.'],
    ['x == 2', 'Use a single "=" for an equation: "x = 2".'],
    ['x := 2', 'Use "=" alone for an equation: "x = 2".'],
    ['3:4', 'A ratio such as "3:4" is the fraction 3/4 — type it that way.'],
    ['x;y', '";" separates the equations of a system, and there is no equation here. For one expression, leave it out.'],
    ['3!!', 'The double factorial "n!!" is not supported. "5!" is 5·4·3·2·1 = 120; for 5!! = 5·3·1, type "5*3*1".'],
    ['|x', 'An absolute value needs a bar on each side: |x - 3|.'],
    ['||', 'Empty absolute value bars "| |" — put an expression between them.'],
    ['[1,2', 'Unbalanced brackets: 1 opening "[" and 0 closing "]".'],
    ['{x}', 'Curly braces are not used here — group with parentheses: (x + 1)^2.'],
    ['2 # 3', '"#" is not a math symbol.'],
    ['x$2', '"$" is not a math symbol.'],
    ['@', '"@" is not a math symbol.'],
  ]) {
    assert.equal(syntaxProblem(input)?.hint, hint, input);
  }
  // Well-formed input of every kind passes: one-sided limits, arrows,
  // subscript braces, intervals, ratios in words, signs after operators.
  for (const ok of ['2*x + 1', '5 - -3', '2*-3', 'e^-x', 'x^(-1/2)', '-x', '+5', 'lim x->0+ 1/x', '1/x as x -> 0-', 'lim x→0⁺ 1/x',
    'lim_{x->0} sin(x)/x', '∫_{0}^{1} x^2 dx', '∫_0^1 x^2 dx', 'd/dx(x^3)', "f'(x) where f(x) = x^3", 'x^2 + y^2 = 25 at (3, 4)',
    'average value of x^2 on [0, 3]', 'solve for x: 2x = 4', 'x + y = 3; x - y = 1', '2x + 3y = 6, x - y = 4', 'C(5,2)', '5C2', '1.5e3 * 2',
    '2 < x < 5', 'x^2 - 4 >= 0', 'x ≥ −2', '|x - 3| = 5', 'sin(30°)', '50% of 80', '7 mod 3', '5!', 'x! = 24', '(x+1)(x-1)', '3 + 4i',
    'What is 5 + 3?', 'x->0', 'round 2.675 to 2 dp', 'is 97 prime', '1,000 + 2', 'log_2(8)', 'sin⁻¹(1/2)', 'y = mx + b', "y'' + y = 0"]) {
    assert.equal(syntaxProblem(ok), null, ok);
  }
});

test('an engine message is put into words, never shown raw', () => {
  assert.ok(isEngineMessage('Value expected (char 3)'));
  assert.ok(isEngineMessage('2+* ? \nStop: syntax error'));
  assert.ok(!isEngineMessage('There is no expression to take the limit of.'));
  assert.equal(plainSyntaxHint('Value expected (char 3)', '2+*'), '"+*" — two operators in a row. Put a value between them, or remove one.');
  assert.equal(plainSyntaxHint('Undefined symbol foo', 'foo + 1'), '"foo" is not a known function, constant or variable.');
  assert.equal(plainSyntaxHint('Unexpected end of expression (char 3)', 'x y'), 'The expression ends too soon — something is missing at the end.');
  assert.equal(plainSyntaxHint('(2+3 ? \nStop: ) expected', 'sin x'), 'A closing ")" is missing.');
  assert.equal(plainSyntaxHint('Colon : expected after object key.', 'x'), 'The input could not be read as a math expression.');
});

test('malformed input is refused the same way under every topic, and never marked Solved', async () => {
  for (const [p, hint] of [
    ['2+*', '"+*" — two operators in a row. Put a value between them, or remove one.'],
    ['2+3)', 'Unbalanced parentheses: 0 opening "(" and 1 closing ")".'], // was ∫(2 + 3)) dx = 5x + C
    ['sin()', '"sin()" has nothing inside it — sin needs an argument: "sin(x)", "sin(30)".'], // was sin(nil)·x + C
    ['2..5', 'Two decimal points in one number — a number has one, as in "2.5".'], // was f'(x) = 0
    ['x^2 +', 'The input ends with "+" — something is missing after it.'], // was echoed as the answer under Trigonometry
    ['2 # 3', '"#" is not a math symbol.'], // was 2
    ['3!!', 'The double factorial "n!!" is not supported. "5!" is 5·4·3·2·1 = 120; for 5!! = 5·3·1, type "5*3*1".'], // was 6
    ['x +* 2 = 3', '"+*" — two operators in a row. Put a value between them, or remove one.'], // was "beyond this solver", "valid mathematical input"
    ['x = = 2', 'Two "=" signs in a row — one goes between the two sides.'],
    ['x;y', '";" separates the equations of a system, and there is no equation here. For one expression, leave it out.'],
    ['{x}', 'Curly braces are not used here — group with parentheses: (x + 1)^2.'],
  ]) {
    for (const topic of TOPICS) {
      const r = await solveProblem(p, topic);
      assert.equal(r.status, 'parse_error', `${p} [${topic}]`);
      assert.equal(r.answer, hint, `${p} [${topic}]`);
      // Said once: the step names the input, the box the reason; no tip repeats it.
      assert.deepEqual(r.steps, [`Could not read "${p}" as a math expression.`], `${p} [${topic}]`);
      assert.ok(!r.tips.includes(hint), `${p} [${topic}]: the hint is not also a tip`);
      assert.equal(r.routing, undefined, `${p} [${topic}]: a parse error is not routed`);
    }
  }
});

test('an instruction with nothing after it, an unknown function, a vector', async () => {
  for (const topic of TOPICS) {
    assert.equal((await solveProblem('limit of', topic)).answer, 'There is no expression to take the limit of.', topic); // was "lim (o→0) of does not exist"
    assert.equal((await solveProblem('integral of', topic)).answer, 'There is nothing to integrate — the integrand is empty.', topic); // was ∫(of) do = o*of + C
    assert.equal((await solveProblem('derivative of', topic)).answer, 'There is nothing to differentiate — write the function after d/dx: "d/dx (x^3)", or just "x^3".', topic);
    assert.equal((await solveProblem('d/dx', topic)).answer, 'There is nothing to differentiate — write the function after d/dx: "d/dx (x^3)", or just "x^3".', topic);
    const foo = await solveProblem('foo(x)', topic); // was "already in simplest form", "domain: no real numbers"
    assert.equal(foo.status, 'parse_error', topic);
    assert.match(foo.answer, /^"foo" is not a known function\. The functions are sin, cos/, topic);
    const vector = await solveProblem('[1,2]', topic); // was echoed, and integrated to [x, 2x] + C
    assert.equal(vector.status, 'unsupported', topic);
    assert.equal(vector.answer, 'Vectors and matrices are not supported yet', topic);
    assert.equal((await solveProblem('50% of 80', topic)).answer, '40', topic); // was ∫(50%of80) do = 50o + C under Integrals
    assert.equal((await solveProblem('the gcd of 12 and 18', topic)).answer, '6', topic); // was f'(x) = 0 under Derivatives
  }
  // Known functions the engines evaluate are not "unknown".
  assert.equal((await solveProblem('gcd(12, 18)', 'other')).answer, '6');
  assert.equal((await solveProblem('max(3, 7)', 'other')).answer, '7');
});

test('the graphing verbs go to Functions; a negated exponent reaches Algebrite', async () => {
  for (const p of ['sketch x^3', 'graph x^3', 'plot x^3', 'analyze x^3', 'analyse x^3']) {
    const r = await solveProblem(p, 'auto');
    assert.equal(r.routedTopic, 'functions', p);
    assert.match(r.answer, /^f\(x\) = x\^3: domain: all real numbers/, p);
  }
  // The phrasings around the verb ("graph of y = x^2" was refused as the unknown word "ofy").
  for (const p of ['graph of y = x^2', 'sketch the graph of x^2', 'graph f(x) = x^2', 'analyze the function x^2', 'plot y = x^2']) {
    const r = await solveProblem(p, 'auto');
    assert.equal(r.routedTopic, 'functions', p);
    assert.match(r.answer, /^f\(x\) = x\^2: domain: all real numbers; range: y ≥ 0/, p);
  }
  const under = await solveProblem('sketch x^3', 'algebra'); // was simplified to x^3
  assert.equal(under.routing?.to, 'functions');
  assert.equal(under.routing?.reason, 'the input asks to sketch it');
  // e^-x was "beyond what this engine can compute" under Derivatives and Integrals.
  assert.equal((await solveProblem('e^-x', 'derivatives')).answer, "f'(x) = -e^(-x)");
  assert.equal((await solveProblem('x^-2', 'derivatives')).answer, "f'(x) = -2/(x^3), x ≠ 0");
  assert.equal((await solveProblem('∫ e^-x dx', 'integrals')).answer, '∫(e^(-x)) dx = -e^(-x) + C');
  assert.equal((await solveProblem('2^-x', 'derivatives')).answer, "f'(x) = -ln(2)/(2^x)");
});

test('a linear system shows the substitution algebra, with the numbers in place', async () => {
  const r = await solvePlain('2x + 3y = 12, x - y = 1', 'algebra');
  assert.equal(r.answer, 'x = 3,  y = 2');
  assert.deepEqual(r.steps, [
    'Write the system: 2x + 3y = 12;  x - y = 1.',
    'From equation 1, solve for x: move the y term across, 2x = 12 - 3y, so x = (12 - 3y)/2.',
    'Substitute that into equation 2 in place of x: (12 - 3y)/2 - y = 1.',
    'Multiply both sides by 2 to clear the fraction: (12 - 3y) - 2y = 2.',
    'Expand: 12 - 3y - 2y = 2. Collect the y terms and move the constant across: -5y = 2 - 12 = -10.',
    'Divide by -5: y = -10/(-5) = 2.',
    'Back-substitute y = 2 into x = (12 - 3y)/2: x = (12 - 3·2)/2 = 6/2 = 3.',
    'Check in both equations: 2·3 + 3·2 = 12 ✓ and 3 - 2 = 1 ✓.',
  ]);
  // A unit coefficient isolates in one move; no "(5 − 1·y) / 1".
  const unit = await solvePlain('x + y = 5; 2x - y = 1', 'algebra');
  assert.equal(unit.steps[1], 'From equation 1, solve for x: move the y term across, x = 5 - y.');
  assert.equal(unit.steps[2], 'Substitute that into equation 2 in place of x: 2(5 - y) - y = 1.');
  assert.equal(unit.steps[5], 'Back-substitute y = 3 into x = 5 - y: x = 5 - 3 = 2.');
  // A negative leading coefficient, and a negative value substituted.
  assert.equal((await solvePlain('-x + 2y = 3; 3x + y = 5', 'algebra')).steps[1], 'From equation 1, solve for x: move the y term across, -x = 3 - 2y, so x = -3 + 2y.');
  assert.equal((await solvePlain('x + y = 0; x - y = 2', 'algebra')).steps[5], 'Back-substitute y = -1 into x = -y: x = -(-1) = 1.');
  // An equation in one unknown gives it directly.
  const direct = await solvePlain('2y = 6; x + y = 5', 'algebra');
  assert.equal(direct.steps[1], 'Equation 1 has no x term: 2y = 6 gives y = 6/2 = 3 directly.');
  assert.equal(direct.steps[2], 'Substitute y = 3 into equation 2: x + 3 = 5, so x = 5 - 3 = 2.');
  // Fractional coefficients are cleared first — and read exactly: this was
  // answered x = 1333333/833333, y = 500000/833333.
  const fractions = await solvePlain('x/2 + y/3 = 1; x - y = 1', 'algebra');
  assert.equal(fractions.answer, 'x = 8/5,  y = 3/5');
  assert.equal(fractions.steps[1], 'Multiply equation 1 by 6 to clear its fractions: 3x + 2y = 6.');
  assert.equal(fractions.steps[7], 'Back-substitute y = 3/5 into x = (6 - 2y)/3: x = (6 - 2·(3/5))/3 = (24/5)/3 = 8/5.');
  assert.equal(fractions.steps[8], 'Check in both equations: (1/2)·(8/5) + (1/3)·(3/5) = 1 ✓ and 8/5 - 3/5 = 1 ✓.');
});

test('the function analysis differentiates, solves f′ = 0, and gives exact values', async () => {
  const cubic = await solvePlain('x^3 - 3x', 'functions');
  assert.ok(cubic.steps.includes('Differentiate: f′(x) = 3x^2 - 3. Set f′(x) = 0: 3x^2 - 3 = 0 at x = -1, 1.'), cubic.steps.join(' | '));
  assert.ok(cubic.steps.includes('Local maximum at (-1, 2): f′(x) changes from positive to negative there.'));
  assert.ok(cubic.steps.includes('Local minimum at (1, -2): f′(x) changes from negative to positive there.'));
  // Exact values: 1/e, not 0.3679; π/2, not 1.5708.
  const bump = await solvePlain('x*e^(-x)', 'functions');
  assert.ok(bump.steps.includes('Differentiate: f′(x) = e^(-x) - x*e^(-x). f′(x) is 0 at x = 1 (found where the slope changes sign).'), bump.steps.join(' | '));
  assert.ok(bump.steps.includes('Local maximum at (1, 1/e): f′(x) changes from positive to negative there.'));
  assert.match(bump.answer, /local maximum \(1, 1\/e\)/);
  const sine = await solvePlain('sin(x)', 'functions');
  assert.ok(sine.steps.includes('Local maximum at (π/2, 1): f′(x) changes from positive to negative there.'), sine.steps.join(' | '));
  // A zero of f′ that is not an extremum is named.
  const flat = await solvePlain('x^3', 'functions');
  assert.ok(flat.steps.includes('Differentiate: f′(x) = 3x^2. Set f′(x) = 0: 3x^2 = 0 at x = 0.'));
  assert.ok(flat.steps.includes('At x = 0 f′(x) is 0 but does not change sign, so there is no extremum there: the graph flattens and carries on.'));
  // "Never 0" is a proof, in place of "No local extrema found in the analyzed window".
  const pole = await solvePlain('1/(x-2)', 'functions');
  assert.ok(pole.steps.includes('Differentiate: f′(x) = -1/(x - 2)^2. f′(x) is never 0 (a fraction is 0 only when its numerator is, and this numerator never is), so there are no stationary points.'), pole.steps.join(' | '));
  assert.ok(!pole.steps.some((s) => /analyzed window/.test(s)));
  const exp = await solvePlain('e^x', 'functions');
  assert.ok(exp.steps.includes('Differentiate: f′(x) = e^x. f′(x) is never 0 (a positive base to any power is positive), so there are no stationary points: f is strictly increasing.'), exp.steps.join(' | '));
  // A cusp is not a stationary point; the derivative is still shown.
  const cusp = await solvePlain('x^(2/3)', 'functions');
  assert.ok(cusp.steps.includes('Differentiate: f′(x) = 2/(3∛x).'), cusp.steps.join(' | '));
  assert.ok(cusp.steps.some((s) => s.startsWith('Local minimum at (0, 0) — at a corner/cusp')));
});
