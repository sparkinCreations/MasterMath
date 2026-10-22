import test from 'node:test';
import assert from 'node:assert/strict';

import { paginate } from '../src/lib/pdfTypeset.js';
import { graphPalette, lightGraphSvg } from '../src/lib/graphPalette.js';
import { mathTextToHtml, renderMathSegments } from '../src/lib/mathRender.js';
import { mark } from '../src/lib/mathMarkers.js';

// October 2026 roadmap P2 (1.52.0): the PDF is the typeset solution and the
// graph. The capture itself runs in the browser (e2e/smoke.spec.js opens the
// PDF); these are the pure parts.

test('pages break between blocks, never through one', () => {
  assert.deepEqual(paginate([100, 100, 100], 250), [[0, 1], [2]]);
  assert.deepEqual(paginate([100, 150, 100], 250), [[0, 1], [2]]);
  // A block taller than a page gets a page of its own (it is scaled to fit).
  assert.deepEqual(paginate([100, 400, 50], 250), [[0], [1], [2]]);
  assert.deepEqual(paginate([400], 250), [[0]]);
  assert.deepEqual(paginate([], 250), []);
});

test('a dark-mode graph is recoloured to the light palette, and only its theme colours change', () => {
  const dark = graphPalette(true);
  const light = graphPalette(false);
  const svg = `<svg><line stroke="${dark.grid}"/><text fill="${dark.axis}">1</text><circle fill="${dark.extremum}" stroke="${dark.markerStroke}"/>`
    + `<line stroke="${dark.asymptote}"/><stop stop-color="${dark.gradientFrom}"/><stop style="stop-color: ${dark.gradientTo};"/>`
    + `<circle fill="#10b981"/><path d="M0 0" stroke="${dark.axisLine}"/><rect fill="${dark.tooltipBg}"/></svg>`;
  const out = lightGraphSvg(svg);
  for (const role of ['grid', 'axis', 'extremum', 'markerStroke', 'asymptote', 'gradientFrom', 'gradientTo', 'axisLine', 'tooltipBg']) {
    assert.ok(!out.includes(dark[role]), `${role} still dark`);
    assert.ok(out.includes(light[role]), `${role} not light`);
  }
  assert.ok(out.includes('#10b981'), 'the intercept green is the same in both themes');
  // A longer hex that merely starts with a palette colour is left alone.
  assert.equal(lightGraphSvg(`<g data-x="${dark.grid}ff"/>`), `<g data-x="${dark.grid}ff"/>`);
  // A light graph passes through unchanged.
  const lightSvg = `<line stroke="${light.grid}"/>`;
  assert.equal(lightGraphSvg(lightSvg), lightSvg);
});

test('the PDF sheet typesets the marked math and escapes the prose', () => {
  const html = mathTextToHtml(`Let ${mark('u = 3x^2')} (the inside) <b>bold</b> & more`);
  assert.match(html, /class="katex"/);
  assert.match(html, /&lt;b&gt;bold&lt;\/b&gt; &amp; more/);
  assert.doesNotMatch(html, /<b>/);
  // Raw input reaches step text (a parse error quotes it): KaTeX's HTML
  // extensions stay off, so a marked \href is never a live link.
  const link = mathTextToHtml(mark('\\href{javascript:alert(1)}{x}'));
  // (KaTeX quotes the source in its <annotation>, as inert text.)
  assert.doesNotMatch(link, /<a\b|\bhref=/);
  // The screen and the PDF share one renderer.
  assert.deepEqual(renderMathSegments('plain words').map((s) => s.type), ['text']);
});
