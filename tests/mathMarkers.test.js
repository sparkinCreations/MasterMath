import test from 'node:test';
import assert from 'node:assert/strict';

import { segmentMathText } from '../src/lib/latex.js';
import { mark, stripMathMarkers, hasMathMarkers } from '../src/lib/mathMarkers.js';
import { pdfSafe, exportSolutionAsMarkdown, exportSolutionAsJSON } from '../src/lib/exportUtils.js';
import { sanitizeInput } from '../src/lib/validation.js';
import { finalizeResult } from '../src/lib/api.js';

// October 2026 roadmap P1: explicit math markers. The renderer typesets
// exactly what a solver marks; unmarked text keeps the heuristics; markers
// never reach an answer, a tip, an export or the input.

test('a marked step typesets exactly the marked math and nothing else', () => {
  const step = `Let ${mark('u = x^3')} (the inside), so the outer function is ${mark('sin(u)')}.`;
  assert.deepEqual(segmentMathText(step), [
    { type: 'text', value: 'Let ' },
    { type: 'math', value: 'u = x^3' },
    { type: 'text', value: ' (the inside), so the outer function is ' },
    { type: 'math', value: 'sin(u)' },
    { type: 'text', value: '.' },
  ]);
  // The roadmap's example: words and math interleaved, which no heuristic splits.
  const coeffs = segmentMathText(`write the coefficients ${mark('1, (−6), 11, (−6)')}; bring down ${mark('1')}`);
  assert.deepEqual(coeffs.filter((s) => s.type === 'math').map((s) => s.value), ['1, (−6), 11, (−6)', '1']);
  // A wholly marked step is one math run.
  assert.deepEqual(segmentMathText(mark("f'(x) = 2x + 3")), [{ type: 'math', value: "f'(x) = 2x + 3" }]);
  // Words that the heuristics would read as math stay prose when unmarked.
  assert.deepEqual(segmentMathText(`So ${mark('x = 2')} is the root`).map((s) => s.type), ['text', 'math', 'text']);
});

test('unmarked text keeps the heuristic segmentation', () => {
  assert.deepEqual(segmentMathText("f'(x) = 2x + 3"), [{ type: 'math', value: "f'(x) = 2x + 3" }]);
  assert.deepEqual(segmentMathText('Add the term derivatives and simplify: x^2 + 1').map((s) => s.type), ['text', 'math']);
  assert.deepEqual(segmentMathText('Plain prose with no maths.'), [{ type: 'text', value: 'Plain prose with no maths.' }]);
});

test('malformed markers are dropped and the plain text goes to the heuristics', () => {
  for (const broken of ['Let ⟦u = x^3 (the inside)', 'Let u = x^3⟧ (the inside)', '⟦a ⟦b⟧ c⟧', '⟧x = 1⟦']) {
    const segs = segmentMathText(broken);
    assert.ok(segs.every((s) => !hasMathMarkers(s.value)), `${broken} → ${JSON.stringify(segs)}`);
    assert.equal(segs.map((s) => s.value).join('').replace(/\s+/g, ''), stripMathMarkers(broken).replace(/\s+/g, ''));
  }
  // An empty pair adds nothing.
  assert.deepEqual(segmentMathText('Done⟦⟧.'), [{ type: 'text', value: 'Done' }, { type: 'text', value: '.' }]);
});

test('markers never reach an answer or a warning; steps, tips and mistakes keep them', () => {
  const r = finalizeResult({
    status: 'solved',
    steps: [`Let ${mark('u = 2x')}.`],
    answer: mark('x = 2'),
    tips: [`Check ${mark('x = 2')}.`],
    common_mistakes: [`Forgetting ${mark('dx')}.`],
    warnings: [`Read as ${mark('(8/2)·4')}.`],
  }, 'x');
  assert.equal(r.answer, 'x = 2');
  assert.equal(r.warnings[0], 'Read as (8/2)·4.');
  // Steps, tips and mistakes keep them: they are what the renderer reads
  // (tips and mistakes in 'marked' mode since 1.53.0).
  assert.equal(r.steps[0], 'Let ⟦u = 2x⟧.');
  assert.equal(r.tips[0], 'Check ⟦x = 2⟧.');
  assert.equal(r.common_mistakes[0], 'Forgetting ⟦dx⟧.');
});

test('markers never reach an export or the input', () => {
  assert.equal(pdfSafe(`Let ${mark('u = x')}.`), 'Let u = x.');
  assert.equal(sanitizeInput('⟦x^2⟧ + 1'), 'x^2 + 1');

  // Capture what the download helper writes.
  const written = [];
  const saved = { Blob: globalThis.Blob, URL: globalThis.URL, document: globalThis.document };
  globalThis.Blob = class { constructor(parts) { written.push(parts.join('')); } };
  globalThis.URL = { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} };
  globalThis.document = { createElement: () => ({ click() {} }), body: { appendChild() {}, removeChild() {} } };
  try {
    const solution = { status: 'solved', steps: [`Let ${mark('u = x^2')}.`, mark('∫ cos(u) du')], answer: 'x', tips: [], common_mistakes: [] };
    exportSolutionAsMarkdown('x*cos(x^2)', 'integrals', solution, { integrals: 'Integrals' });
    exportSolutionAsJSON('x*cos(x^2)', 'integrals', solution);
  } finally {
    Object.assign(globalThis, saved);
  }
  assert.equal(written.length, 2);
  for (const file of written) {
    assert.ok(!hasMathMarkers(file), file);
    assert.match(file, /Let u = x\^2\./);
  }
});
