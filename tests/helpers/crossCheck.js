// A randomized cross-check of the proof machinery (1.67.1): seeded random
// inequalities and systems, each answer read back into a set and compared
// with a dense scan of the original, used here only as an oracle. The
// solvers prove their zeros (inequalities/zeros.js, trigonometry/circle.js,
// the exact root finder); this checks that the proofs and the answers they
// lead to agree with the values themselves, away from the endpoints.

import { create, all } from 'mathjs';

const math = create(all);

// mulberry32: the same cases on every run.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
export const nonzero = (r, lo, hi) => { let v = 0; while (v === 0) v = int(r, lo, hi); return v; };

// An endpoint as the answer writes it (√2, ∛2, (1 - √5)/2, ln(2), e, π/6 +
// 2πn, 2^(1/4), α) to a number.
export function endpointValue(text, names = {}, n = 0) {
  let t = String(text).trim();
  for (const [k, v] of Object.entries(names)) t = t.split(k).join(`(${v})`);
  t = t
    .replace(/−/g, '-').replace(/·/g, '*')
    .replace(/√\(([^()]*)\)/g, 'sqrt($1)').replace(/√(\d+)/g, 'sqrt($1)')
    .replace(/∛\(([^()]*)\)/g, 'cbrt($1)').replace(/∛(\d+)/g, 'cbrt($1)')
    .replace(/π/g, ' pi ').replace(/(?<![a-z])ln\(/g, 'log(')
    .replace(/(\d)\s*(pi|n|sqrt|cbrt|log|\()/g, '$1*$2')
    .replace(/pi\s*n/g, 'pi*n').replace(/\)\s*\(/g, ')*(').replace(/pi\s*\(/g, 'pi*(');
  const v = math.evaluate(t, { n, e: Math.E });
  return typeof v === 'number' ? v : Number(v);
}

// The answer as a membership test, or { all } / { none } / { refused }.
export function answerSet(answer) {
  let a = String(answer).trim();
  if (/^All real numbers/.test(a)) return { test: () => true, endpoints: [] };
  if (/^No solution/.test(a)) return { test: () => false, endpoints: [] };
  if (/not supported|could not|could only be located|beyond|not proved|Undefined|refused/i.test(a)) return { refused: true };
  const names = {};
  const where = a.match(/, where (.+?) (?:are zeros|is a zero) of .*$/);
  if (where) {
    for (const m of where[1].matchAll(/([α-ω]) ≈ (-?[\d.]+)/g)) names[m[1]] = m[2];
    a = a.slice(0, where.index);
  }
  const periodic = /, for every integer n/.test(a);
  a = a.replace(/, for every integer n.*$/, '');
  // The decimals noted after the set, "  (√2 ≈ 1.4142, ln((3 + √17)/2) ≈ …)":
  // the bracket that closes at the end, found by matching.
  if (/\)\s*$/.test(a)) {
    let depth = 0;
    for (let i = a.trimEnd().length - 1; i >= 0; i -= 1) {
      if (a[i] === ')') depth += 1;
      else if (a[i] === '(') {
        depth -= 1;
        if (depth === 0) {
          if (/\s{2}$/.test(a.slice(0, i)) && /≈/.test(a.slice(i))) a = a.slice(0, i).trimEnd();
          break;
        }
      }
    }
  }
  const pieces = a.split(/\s{2}or\s{2}/).map((p) => p.trim());
  const read = (p) => {
    let m = p.match(/^x = (.+)$/);
    if (m) return { lo: m[1], hi: m[1], loC: true, hiC: true };
    m = p.match(/^x ([<≤]) (.+)$/);
    if (m) return { lo: null, hi: m[2], loC: false, hiC: m[1] === '≤' };
    m = p.match(/^x ([>≥]) (.+)$/);
    if (m) return { lo: m[2], hi: null, loC: m[1] === '≥', hiC: false };
    m = p.match(/^(.+?) ([<≤]) x ([<≤]) (.+)$/);
    if (m) return { lo: m[1], hi: m[4], loC: m[2] === '≤', hiC: m[3] === '≤' };
    throw new Error(`cannot read the piece "${p}" of "${answer}"`);
  };
  const shapes = pieces.map(read);
  // Enough periods to cover any scan window (a period of π/5 needs many).
  const ns = periodic ? Array.from({ length: 161 }, (_, i) => i - 80) : [0];
  const intervals = [];
  for (const k of ns) {
    for (const s of shapes) {
      intervals.push({
        lo: s.lo === null ? -Infinity : endpointValue(s.lo, names, k),
        hi: s.hi === null ? Infinity : endpointValue(s.hi, names, k),
        loC: s.loC,
        hiC: s.hiC,
      });
    }
  }
  return {
    test: (x) => intervals.some((I) => (x > I.lo || (I.loC && x === I.lo)) && (x < I.hi || (I.hiC && x === I.hi))),
    endpoints: intervals.flatMap((I) => [I.lo, I.hi]).filter(Number.isFinite),
  };
}

// Where the answer and the inequality itself disagree on a grid over
// [lo, hi], away from the answer's endpoints and from where the two sides
// are too close to call.
export function disagreements(lhs, rhs, op, set, { lo = -12, hi = 12, steps = 2401 } = {}) {
  const f = math.compile(`(${lhs}) - (${rhs})`);
  const holds = (y) => (op === '<' ? y < 0 : op === '<=' ? y <= 0 : op === '>' ? y > 0 : y >= 0);
  const bad = [];
  for (let i = 0; i < steps; i += 1) {
    const x = lo + ((hi - lo) * i) / (steps - 1) + 1e-7;
    if (set.endpoints.some((e) => Math.abs(e - x) < 2e-3)) continue;
    let y;
    try { y = f.evaluate({ x }); } catch { y = NaN; }
    const defined = typeof y === 'number' && Number.isFinite(y);
    if (defined && Math.abs(y) < 1e-6) continue;
    const truth = defined ? holds(y) : false;
    if (truth !== set.test(x)) bad.push(x);
  }
  return bad;
}
