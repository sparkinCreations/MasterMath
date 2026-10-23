import test from 'node:test';
import assert from 'node:assert/strict';

import { toLatex, isMathFragment, segmentMathText } from '../src/lib/latex.js';

test('toLatex converts exponents, roots, and d/dx notation', () => {
  assert.equal(toLatex('x^2'), 'x^{2}');
  assert.equal(toLatex('x^(1/2)'), 'x^{\\frac{1}{2}}');
  assert.match(toLatex('sqrt(x - 3)'), /\\sqrt\{x - 3\}/);
  assert.match(toLatex('d/dx(x^2) = 2x'), /\\frac\{d\}\{dx\}/);
  assert.match(toLatex('abs(x)'), /\\left\|x\\right\|/);
});

test('toLatex converts integrals, limits, and unicode operators', () => {
  assert.match(toLatex('∫(2x + 1) dx = x^2 + x + C'), /\\int 2x \+ 1 \\, dx/);
  assert.match(toLatex('lim (x→0) sin(x)/x = 1'), /\\lim_\{x \\to 0\}/);
  assert.match(toLatex('n·x^(n-1)'), /\\cdot/);
  assert.match(toLatex('ln|x| + C'), /\\left\|x\\right\|/);
  assert.match(toLatex('x = -2 ± i'), /\\pm/);
});

test('toLatex converts definite integrals with bounds', () => {
  assert.match(toLatex('∫_0^1 (x^2) dx = 1/3'), /\\int_\{0\}\^\{1\}/);
  // Typed pi is π (1.53.0; it was the italic letters p·i).
  assert.match(toLatex('∫_0^pi (sin(x)) dx = 2'), /\\int_\{0\}\^\{\\pi\} \\sin/);
  assert.match(toLatex('∫_-2^2 (x^3) dx = 0'), /\\int_\{-2\}\^\{2\}/);
});

test('toLatex converts one-sided limit markers to proper superscripts', () => {
  assert.match(toLatex('lim (x→0⁺) 1/x = ∞'), /\\lim_\{x \\to 0\^\{\+\}\}/);
  assert.match(toLatex('lim (x→0⁻) 1/x = -∞'), /0\^\{-\}/);
});

test('toLatex names trig and log functions', () => {
  assert.match(toLatex('sin(x)^2 + cos(x)^2'), /\\sin/);
  assert.match(toLatex('sin(x)^2 + cos(x)^2'), /\\cos/);
  assert.match(toLatex('arctan(x)'), /\\arctan/);
});

test('isMathFragment separates math from prose', () => {
  assert.equal(isMathFragment("f'(x) = 2x + 3"), true);
  assert.equal(isMathFragment('x = 2  or  x = 3'), true);
  assert.equal(isMathFragment('∫(2x) dx = x^2'), true);
  assert.equal(isMathFragment('Apply the sum rule: integrate each term separately'), false);
  assert.equal(isMathFragment('Definite integrals are not supported yet'), false);
  assert.equal(isMathFragment('Does not exist'), false);
});

test('segmentMathText splits prose-with-math-tail steps', () => {
  const segs = segmentMathText('Add the term derivatives and simplify: f\'(x) = 2x + 3');
  assert.equal(segs.length, 2);
  assert.equal(segs[0].type, 'text');
  assert.equal(segs[1].type, 'math');
  assert.equal(segs[1].value, "f'(x) = 2x + 3");
});

test('segmentMathText keeps pure prose as one text segment', () => {
  const segs = segmentMathText('This is a periodic function — its pattern of zeros and extrema repeats forever.');
  assert.equal(segs.length, 1);
  assert.equal(segs[0].type, 'text');
});

test('segmentMathText handles the "Label — math." shape', () => {
  const segs = segmentMathText('Power rule — d/dx(x^n) = n·x^(n-1).');
  assert.equal(segs[0].type, 'text');
  assert.equal(segs[1].type, 'math');
  assert.match(segs[1].value, /d\/dx/);
});

test('katex renders converted solver answers without throwing', async () => {
  const katex = (await import('katex')).default;
  const samples = [
    "f'(x) = 2x + 3",
    '∫(2x + 1) dx = x^2 + x + C',
    'lim (x→0) sin(x)/x = 1',
    'x = -1.5 - 2.5981i  or  x = 2',
    'ln|x^2 + 4| + C',
    'f(x) = x^2 - 4x + 3',
    'x = 2^(1/2)',
    'lim (x→0⁺) 1/x = ∞',
    '5√2 (≈ 7.0711)',
    '∫_0^1 (x^2) dx = 1/3 (≈ 0.3333)',
    '∫_0^π (sin(x)) dx = 2',
  ];
  for (const s of samples) {
    assert.doesNotThrow(() => katex.renderToString(toLatex(s), { throwOnError: true }), `failed on: ${s}`);
  }
});

// The live preview typesets what is typed, so the typed forms must convert:
// "lim x->0 (…)" rendered as "limx−>0(…)" (a minus and a greater-than, and
// math mode drops the spaces).
test('typed limits and arrows convert: lim x->0 and x->2', () => {
  assert.equal(toLatex('lim x->0 (sin(x)/x)'), '\\lim_{x \\to 0} (\\sin(x)/x)');
  assert.equal(toLatex('lim x→0 (sin(x)/x)'), '\\lim_{x \\to 0} (\\sin(x)/x)');
  assert.match(toLatex('lim x->∞ (1/x)'), /^\\lim_\{x \\to \\infty\} /);
  assert.match(toLatex('lim x->-∞ (1/x)'), /^\\lim_\{x \\to -\\infty\} /);
  assert.equal(toLatex('x -> 2'), 'x \\to 2');
  // The solver's own form is unchanged.
  assert.equal(toLatex('lim (x→0) (sin(x)/x) = 1'), '\\lim_{x \\to 0} (\\sin(x)/x) = 1');
});

// 1.53.0: a typed problem (the preview, the example buttons, the history
// list) has no markers, and the step heuristics left "sin(pi/4)", "2*x + 1"
// and the x^3 in "derivative of x^3" plain.
const shown = (text, mode) => segmentMathText(text, { mode }).map((s) => (s.type === 'math' ? `⟦${s.value}⟧` : s.value)).join('');
test('a typed problem typesets its maths and keeps its words as prose', () => {
  for (const [typed, out] of [
    ['sin(pi/4)', '⟦sin(pi/4)⟧'], ['2*x + 1', '⟦2*x + 1⟧'], ['(5 + 3) * 4 - 2^3', '⟦(5 + 3) * 4 - 2^3⟧'],
    ['2x + 3y = 6; x - y = 4', '⟦2x + 3y = 6; x - y = 4⟧'], ['lim x->0 (sin(x)/x)', '⟦lim x->0 (sin(x)/x)⟧'],
    ['derivative of x^3', 'derivative of ⟦x^3⟧'], ['factor x^2-5x+6', 'factor ⟦x^2-5x+6⟧'],
    ['integrate x^2 from 0 to 1', 'integrate ⟦x^2⟧ from ⟦0⟧ to ⟦1⟧'], ['solve for x: 3x = 9', 'solve for ⟦x⟧: ⟦3x = 9⟧'],
    ['what is sqrt(16)?', 'what is ⟦sqrt(16)⟧?'], ['x < -1 or x > 3', '⟦x < -1 or x > 3⟧'],
    ['find dy/dx for x^2 + y^2 = 25 at (3, 4)', 'find ⟦dy/dx⟧ for ⟦x^2 + y^2 = 25⟧ at ⟦(3, 4)⟧'],
    ['x apples = 4', '⟦x⟧ apples ⟦= 4⟧'], ['"hello"', '"hello"'],
  ]) assert.equal(shown(typed, 'input'), out, typed);
});

test('tips and mistakes typeset only their marked runs', () => {
  assert.equal(shown('Reading ⟦(x − 2)(x − 3) = 0⟧ as x = −2 or −3', 'marked'), 'Reading ⟦(x − 2)(x − 3) = 0⟧ as x = −2 or −3');
  // No markers: prose, never guessed at (the step heuristics would typeset "x = 2").
  assert.deepEqual(segmentMathText('Check that x = 2 works.', { mode: 'marked' }), [{ type: 'text', value: 'Check that x = 2 works.' }]);
});

test('typed spellings render as their symbols', () => {
  assert.match(toLatex('sin(pi/4)'), /\\sin\( \\pi \/4\)/);
  assert.match(toLatex('lim x->inf 1/x'), /\\to \\infty/);
  assert.match(toLatex('sin(theta)'), /\\theta/);
  assert.equal(toLatex('cbrt(27)'), '\\sqrt[3]{27}');
  // A number times a letter, function or bracket reads as in a textbook; other products keep the dot.
  assert.equal(toLatex('2*x + 5 = 11'), '2x + 5 = 11');
  assert.equal(toLatex('2*(x+1)'), '2(x+1)');
  assert.equal(toLatex('2*3'), '2 \\cdot 3');
  assert.equal(toLatex('x*e^x'), 'x \\cdot e^{x}');
  // Words that contain the letters are left alone.
  assert.equal(toLatex('spiral'), 'spiral');
});
