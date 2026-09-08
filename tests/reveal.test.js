// revealElement decides when the Solver page should jump: after "Solve" to
// the solution, after "Try an example" back to the textarea. On a desktop
// both targets are already on screen and nothing must move; on a phone they
// are off-screen and the page scrolls (smoothly unless reduced motion).

import test from 'node:test';
import assert from 'node:assert/strict';

import { revealElement } from '../src/lib/reveal.js';

function fakeElement(top) {
  const calls = [];
  return {
    calls,
    getBoundingClientRect: () => ({ top }),
    scrollIntoView: (opts) => calls.push(['scroll', opts]),
    focus: (opts) => calls.push(['focus', opts]),
  };
}
const env = (innerHeight, reduce = false) => ({ innerHeight, matchMedia: () => ({ matches: reduce }) });

test('an element already in the upper part of the viewport is left alone (desktop layout)', () => {
  const el = fakeElement(120);
  const r = revealElement(el, {}, env(800));
  assert.deepEqual(r, { scrolled: false, focused: false });
  assert.deepEqual(el.calls, []);
});

test('an element below the fold scrolls into view smoothly (solution on a phone)', () => {
  const el = fakeElement(1400);
  const r = revealElement(el, { focus: true }, env(800));
  assert.deepEqual(r, { scrolled: true, focused: true });
  assert.deepEqual(el.calls, [['scroll', { behavior: 'smooth', block: 'start' }], ['focus', { preventScroll: true }]]);
});

test('an element scrolled off the top comes back (textarea after tapping an example)', () => {
  const el = fakeElement(-300);
  const r = revealElement(el, { focus: true }, env(800));
  assert.equal(r.scrolled, true);
  assert.equal(el.calls[0][0], 'scroll');
});

test('reduced motion means an instant jump, never a smooth scroll', () => {
  const el = fakeElement(1400);
  revealElement(el, {}, env(800, true));
  assert.deepEqual(el.calls, [['scroll', { behavior: 'auto', block: 'start' }]]);
});

test('focus alone is honoured when no scroll is needed', () => {
  const el = fakeElement(50);
  const r = revealElement(el, { focus: true }, env(800));
  assert.deepEqual(r, { scrolled: false, focused: true });
  assert.deepEqual(el.calls, [['focus', { preventScroll: true }]]);
});

test('a missing element or unknown viewport is a no-op, never a throw', () => {
  assert.deepEqual(revealElement(null, { focus: true }, env(800)), { scrolled: false, focused: false });
  const el = fakeElement(1400);
  revealElement(el, {}, { innerHeight: 0 });
  assert.equal(el.calls[0][0], 'scroll', 'an unknown viewport height errs on the side of scrolling');
});
