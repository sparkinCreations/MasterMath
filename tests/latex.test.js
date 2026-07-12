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
  ];
  for (const s of samples) {
    assert.doesNotThrow(() => katex.renderToString(toLatex(s), { throwOnError: true }), `failed on: ${s}`);
  }
});
