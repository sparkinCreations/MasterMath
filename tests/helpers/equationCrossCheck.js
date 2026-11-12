// The seeded cross-check of equation answers: an answer is read back into
// points and intervals and compared with the equation itself on a dense grid.
// The grid is an oracle only, the solver decides nothing from samples, and it
// cannot see a root that touches without crossing or two roots inside one
// grid step: keep exact targeted tests beside it.

import { create, all } from 'mathjs';
import { endpointValue } from './crossCheck.js';

const math = create(all);
const STEP = 1 / 64;

export const value = (text) => endpointValue(String(text)
  .replace(/(\d)\s*(exp\(|e(?![a-z]))/g, '$1*$2')
  .replace(/\)\s*\^/g, ')^'));

const withoutAside = (t) => t.replace(/\s*\((?:≈|=|repeated root|multiplicity)[^()]*\)\s*$/, '').trim();
const IMAGINARY = /(?<![a-z])i(?![a-z])|\di\b/;

// { points, intervals, except } or null for a claim it cannot read.
export function readAnswer(answer) {
  const a = String(answer).trim();
  if (/^No (?:real )?solution/.test(a)) return { points: [], intervals: [] };
  if (/^All real numbers(?: \(identity| satisfy|$)/.test(a)) return { points: [], intervals: [{ lo: -Infinity, hi: Infinity }] };
  const domain = a.match(/^All real numbers with (.+?) \(identity on its domain\)$/);
  if (domain) {
    let lo = -Infinity;
    let hi = Infinity;
    const except = [];
    for (const c of domain[1].split(/\s+and\s+/)) {
      const m = c.match(/^x ([≠><≥≤]) (.+)$/);
      if (!m) return null;
      const v = value(m[2]);
      if (m[1] === '≠') except.push(v);
      else if (m[1] === '>' || m[1] === '≥') lo = Math.max(lo, v);
      else hi = Math.min(hi, v);
    }
    return { points: [], intervals: [{ lo, hi }], except };
  }
  const points = [];
  const intervals = [];
  for (const piece of a.split(/\s{2}or\s{2}/).map((p) => p.trim())) {
    let m;
    // A complex root says nothing about the real line; a long closed form
    // with an i in it may be real, and is left unread.
    if (IMAGINARY.test(piece)) {
      if (piece.length > 40) return null;
      continue;
    }
    try {
      if ((m = piece.match(/^x = ±(.+)$/))) { const v = value(withoutAside(m[1])); points.push({ x: -v, rounded: false }, { x: v, rounded: false }); }
      else if ((m = piece.match(/^x ([=≈]) (.+)$/))) {
        const v = value(withoutAside(m[2]));
        // A root written as a real power of a negative number is complex.
        if (Number.isFinite(v)) points.push({ x: v, rounded: m[1] === '≈' });
      }
      else if ((m = piece.match(/^(.+?) ≤ x ≤ (.+)$/))) intervals.push({ lo: value(m[1]), hi: value(m[2]) });
      else if ((m = piece.match(/^x ≥ (.+)$/))) intervals.push({ lo: value(m[1]), hi: Infinity });
      else if ((m = piece.match(/^x ≤ (.+)$/))) intervals.push({ lo: -Infinity, hi: value(m[1]) });
      else return null;
    } catch { return null; }
  }
  return { points, intervals };
}

// What is wrong with the answer, or null when it agrees with the equation.
export function disagreement({ lhs, rhs, holes = [], corners = [], window = 40 }, claim) {
  const compile = (t) => math.compile(t.replace(/(?<![a-z])ln\(/g, 'log('));
  const [l, r] = [compile(lhs), compile(rhs)];
  const side = (c, x) => {
    try {
      const v = c.evaluate({ x });
      return typeof v === 'number' && Number.isFinite(v) ? v : NaN;
    } catch { return NaN; }
  };
  const F = (x) => side(l, x) - side(r, x);
  const small = (x, tol) => Math.abs(F(x)) <= tol * (1 + Math.abs(side(l, x)) + Math.abs(side(r, x)));
  const nearHole = (x, width = 1e-6) => holes.some((h) => Math.abs(x - h) <= width);
  const excepted = (x) => (claim.except || []).some((e) => Math.abs(x - e) <= 1e-6);
  const inside = (x, width = 0) => claim.intervals.some((I) => x >= I.lo - width && x <= I.hi + width) && !excepted(x);
  const claimedNear = (x, width) => inside(x, width) || claim.points.some((p) => Math.abs(p.x - x) <= width);

  for (const p of claim.points) {
    if (nearHole(p.x, p.rounded ? 1e-3 : 1e-6)) return `x = ${p.x} is claimed, but the equation is undefined there`;
    if (p.rounded) {
      const [a, b] = [F(p.x - 1e-3), F(p.x + 1e-3)];
      if (!(small(p.x, 1e-6) || a * b <= 0)) return `x ≈ ${p.x} is claimed, but the two sides do not balance near it`;
    } else if (!small(p.x, 1e-7)) return `x = ${p.x} is claimed, but the two sides differ by ${F(p.x)}`;
  }
  for (const I of claim.intervals) {
    const open = claim.except || [];
    for (const h of holes) if (h >= I.lo && h <= I.hi && !open.some((e) => Math.abs(e - h) <= 1e-6)) return `the stretch holds x = ${h}, where the equation is undefined`;
    const lo = Math.max(I.lo, -window);
    const hi = Math.min(I.hi, window);
    for (let i = 0; i <= 40; i += 1) {
      const x = lo + ((hi - lo) * (i + 0.37)) / 41;
      if (!excepted(x) && !nearHole(x) && !small(x, 1e-7)) return `x = ${x} lies in the stretch, but the two sides differ by ${F(x)}`;
    }
  }
  // Every sign change and every flat run on the grid is in the answer.
  const xs = Array.from({ length: Math.round((2 * window) / STEP) + 1 }, (_, i) => -window + 0.00123 + i * STEP);
  const ys = xs.map(F);
  for (let i = 1; i < xs.length; i += 1) {
    const [a, b] = [ys[i - 1], ys[i]];
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    if (holes.some((h) => h >= xs[i - 1] - STEP && h <= xs[i] + STEP)) continue;
    if (a * b < 0 && !claimedNear((xs[i - 1] + xs[i]) / 2, STEP)) return `the two sides cross near x = ${xs[i]}, which the answer leaves out`;
    // Past 10^6 a difference of 1 can round away: flat there means nothing.
    if (i >= 2 && Math.abs(a) < 1e-9 && Math.abs(b) < 1e-9 && Math.abs(ys[i - 2]) < 1e-9 && Math.abs(side(l, xs[i - 1])) < 1e6 && !inside(xs[i - 1], STEP)) {
      return `the two sides agree around x = ${xs[i - 1]}, which the answer leaves out`;
    }
  }
  // A solution at a corner need not change sign: |x − 1| + |2x − 2| = 0.
  for (const c of corners) {
    if (Number.isFinite(F(c)) && small(c, 1e-12) && !nearHole(c) && !claimedNear(c, 1e-6)) return `x = ${c} solves the equation, and the answer leaves it out`;
  }
  return null;
}

// What the student types: an oracle may need a different form (cbrt(x), real
// for a negative x, where mathjs reads x^(1/3) as complex).
export const problemOf = (e) => `${e.typed ?? e.lhs} = ${e.typedRhs ?? e.rhs}`;

const NUMERIC_SEARCH = /found numerically|crosses zero/;
const stepsOf = (result) => (result.steps || []).map(String);

// How one case of a family came out: 'refused' is honest and never wrong.
export function judge(result, equation, marker) {
  if (result.status !== 'solved') return { outcome: 'refused' };
  const claim = readAnswer(result.answer);
  if (!claim) return { outcome: 'unread' };
  const wrong = disagreement(equation, claim);
  const steps = stepsOf(result);
  const byMethod = marker ? steps.some((s) => marker.test(s)) : !steps.some((s) => NUMERIC_SEARCH.test(s));
  return { outcome: wrong ? 'wrong' : 'right', wrong, byMethod };
}
