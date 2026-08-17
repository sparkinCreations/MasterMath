import test from 'node:test';
import assert from 'node:assert/strict';
import { pdfSafe } from '../src/lib/exportUtils.js';

// jsPDF's standard fonts are Latin-1 only; a non-Latin-1 character in
// doc.text() is emitted as garbage glyphs (jsPDF switches to a UTF-16
// encoding the standard fonts can't render). Every string handed to jsPDF
// goes through pdfSafe, which must yield pure Latin-1 that still reads.

test('pdfSafe transliterates the symbols solver output actually contains', () => {
  const cases = [
    ['∫(x*cos(x^2)) dx = 1/2*sin(x^2) + C', 'integral (x*cos(x^2)) dx = 1/2*sin(x^2) + C'],
    ['x = π/6 + 2πn or x = 5π/6 + 2πn (n ∈ ℤ)', 'x = pi/6 + 2pin or x = 5pi/6 + 2pin (n in Z)'],
    ['sin(π/4) → √2/2 (≈ 0.7071)', 'sin(pi/4) -> sqrt2/2 (~= 0.7071)'],
    ['domain: x ≠ 1; f′(x) does not exist — cusp', "domain: x != 1; f'(x) does not exist  -  cusp"],
    ['x ≤ −2 or x ≥ 2', 'x <= -2 or x >= 2'],
    ['−3 ≤ x ≤ 3', '-3 <= x <= 3'],
    ['x² + 3x, sin⁻¹(x), ½·sin(1), θ, ∞, ✓', "x^2 + 3x, sin^-1(x), 1/2*sin(1), theta, infinity, (checked)"],
  ];
  for (const [input, expected] of cases) {
    assert.equal(pdfSafe(input), expected);
  }
});

test('pdfSafe output is always Latin-1', () => {
  const samples = ['∫ π √ ≈ ≠ ≤ ≥ ′ θ ∈ ℤ → − · ² ∞ ✓ … “quotes” ± ° ½ ⅓', 'plain ascii', 'accented é ü ñ (Latin-1, kept)', '汉字 (outside Latin-1 → ?)'];
  for (const s of samples) {
    const out = pdfSafe(s);
    assert.ok(/^[\x00-\xFF]*$/.test(out), `not Latin-1: ${out}`);
  }
  assert.equal(pdfSafe('accented é ü ñ'), 'accented é ü ñ');
  assert.equal(pdfSafe('汉字'), '??');
});

test('a rendered PDF page contains no UTF-16-encoded text runs', async () => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const lines = [
    '∫(x*cos(x^2)) dx = 1/2*sin(x^2) + C',
    'x = π/6 + 2πn or x = 5π/6 + 2πn (n ∈ ℤ); on [0, 2π): π/6, 5π/6',
    'Local minimum at (0, 0) — at a corner/cusp: f′(x) does not exist there',
    'domain: −3 ≤ x ≤ 3; absolute minimum (2, 0) at the domain endpoint',
  ];
  lines.forEach((l, i) => doc.text(pdfSafe(l), 20, 20 + i * 10));
  const raw = doc.output();
  // A UTF-16 fallback shows up as NUL bytes inside the (...) Tj strings.
  // Text runs are "(…) Tj"; jsPDF escapes parentheses inside as \( \).
  const shows = raw.match(/\((?:[^()\\]|\\.)*\)\s*Tj/g) || [];
  assert.ok(shows.length >= 4, `expected text runs in the page stream, got ${shows.length}`);
  const NUL = String.fromCharCode(0);
  for (const s of shows) assert.ok(!s.includes(NUL), `UTF-16 fallback in: ${JSON.stringify(s.slice(0, 60))}`);
  assert.ok(!raw.includes(NUL), 'no UTF-16 fallback anywhere in the document');
  assert.match(raw, /integral \\\(x\*cos/); // "(" is escaped as "\(" in the stream
  assert.match(raw, /pi\/6 \+ 2pin/);
});
