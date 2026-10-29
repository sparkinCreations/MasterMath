// Solution sets as lists of intervals: intersected, joined, tested against
// all reals, and written as inequalities or in interval notation.

import { beautify, formatNumber } from '../solverUtils.js';
import { labelKey } from './roots.js';

export const ALL_REALS = { lo: -Infinity, hi: Infinity, loC: false, hiC: false };

export function intersectPieces(a, b) {
  const out = [];
  for (const p of a) {
    for (const q of b) {
      let lo; let loC;
      if (p.lo > q.lo) { lo = p.lo; loC = p.loC; } else if (q.lo > p.lo) { lo = q.lo; loC = q.loC; } else { lo = p.lo; loC = p.loC && q.loC; }
      let hi; let hiC;
      if (p.hi < q.hi) { hi = p.hi; hiC = p.hiC; } else if (q.hi < p.hi) { hi = q.hi; hiC = q.hiC; } else { hi = p.hi; hiC = p.hiC && q.hiC; }
      if (lo < hi - 1e-12 || (Number.isFinite(lo) && Math.abs(lo - hi) < 1e-12 && loC && hiC)) out.push({ lo, hi, loC, hiC });
    }
  }
  return coalesce(out);
}

export function unionPieces(a, b) {
  const all = [...a, ...b].map((p) => ({ ...p })).sort((x, y) => x.lo - y.lo || x.hi - y.hi);
  const out = [];
  for (const p of all) {
    const last = out[out.length - 1];
    if (last && (p.lo < last.hi - 1e-12 || (Math.abs(p.lo - last.hi) < 1e-12 && (last.hiC || p.loC)))) {
      if (p.hi > last.hi + 1e-12) { last.hi = p.hi; last.hiC = p.hiC; } else if (Math.abs(p.hi - last.hi) < 1e-12) last.hiC = last.hiC || p.hiC;
      if (Math.abs(p.lo - last.lo) < 1e-12) last.loC = last.loC || p.loC;
    } else {
      out.push(p);
    }
  }
  return out;
}

// Merge pieces of a partition that touch at a shared, included endpoint.
export function coalesce(pieces) {
  const sorted = pieces.slice().sort((a, b) => a.lo - b.lo || a.hi - b.hi);
  const out = [];
  for (const p of sorted) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.hi - p.lo) < 1e-9 && (last.hiC || p.loC)) {
      last.hi = p.hi;
      last.hiC = p.hiC;
    } else if (last && p.lo < last.hi - 1e-9) {
      // overlap (shouldn't happen from a partition, but be safe)
      if (p.hi > last.hi) { last.hi = p.hi; last.hiC = p.hiC; }
    } else {
      out.push({ ...p });
    }
  }
  return out;
}

export function isAllReals(sol) {
  return sol.length === 1 && !Number.isFinite(sol[0].lo) && !Number.isFinite(sol[0].hi);
}

// An endpoint as text: its exact form when one is known, else the decimal.
export const endpoint = (x, labels) => labels?.get(labelKey(x)) ?? formatNumber(x);

// "x > ln(2)" → "x > ln(2) (≈ 0.6931)": every irrational or fractional
// endpoint in the answer gets its decimal alongside, once.
export function withApproximations(answer, pieces, labels) {
  if (!labels?.size) return answer;
  const notes = [];
  for (const x of pieces.flatMap((p) => [p.lo, p.hi]).filter(Number.isFinite)) {
    const label = labels.get(labelKey(x));
    if (!label || /^-?\d+$/.test(label)) continue;
    // 1/2 is 0.5 exactly: a note only where the decimal is rounded.
    if (/^-?\d+\/\d+$/.test(label) && Math.abs(Number(formatNumber(x)) - x) < 1e-12) continue;
    // −√2 and √2: one note, for √2.
    const shown = label.startsWith('-') && labels.get(labelKey(-x)) === label.slice(1) ? label.slice(1) : label;
    const note = `${shown} ≈ ${formatNumber(shown === label ? x : -x)}`;
    if (!notes.includes(note)) notes.push(note);
  }
  return notes.length ? `${answer}  (${notes.join(', ')})` : answer;
}

export function rhsIsPositiveNumber(rhs) {
  const t = beautify(rhs).trim();
  return /^\d+(?:\.\d+)?$/.test(t) && Number(t) > 0;
}

export function pieceToInequality(p, v, labels) {
  const lo = endpoint(p.lo, labels);
  const hi = endpoint(p.hi, labels);
  if (Math.abs(p.lo - p.hi) < 1e-12 && p.loC && p.hiC) return `${v} = ${lo}`;
  if (!Number.isFinite(p.lo)) return `${v} ${p.hiC ? '≤' : '<'} ${hi}`;
  if (!Number.isFinite(p.hi)) return `${v} ${p.loC ? '≥' : '>'} ${lo}`;
  return `${lo} ${p.loC ? '≤' : '<'} ${v} ${p.hiC ? '≤' : '<'} ${hi}`;
}

export function pieceToInterval(p, labels) {
  const left = !Number.isFinite(p.lo) ? '(-∞' : `${p.loC ? '[' : '('}${endpoint(p.lo, labels)}`;
  const right = !Number.isFinite(p.hi) ? '∞)' : `${endpoint(p.hi, labels)}${p.hiC ? ']' : ')'}`;
  return `${left}, ${right}`;
}

export function compare(a, b, op) {
  if (op === '<') return a < b;
  if (op === '>') return a > b;
  if (op === '<=') return a <= b;
  return a >= b;
}

export function intervalLabel(lo, hi, labels) {
  const l = !Number.isFinite(lo) ? '(-∞' : `(${endpoint(lo, labels)}`;
  const r = !Number.isFinite(hi) ? '∞)' : `${endpoint(hi, labels)})`;
  return `${l}, ${r}`;
}
