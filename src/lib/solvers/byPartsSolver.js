// Integration by parts — the walkthrough engine.
//
// Built July 2026 (roadmap item 11). Drives ∫u dv = uv − ∫v du ourselves on top
// of Algebrite's single-step derivative/integral primitives, so we can (a) SHOW
// the u/dv derivation even where Algebrite would just hand back an answer, and
// (b) compute the two families Algebrite fails on outright: repeated by-parts
// (x³·sin x) and cyclic by-parts (eˣ·sin x).
//
// The elegant core is a linear accumulator. We keep the identity
//     I = boundary + coeff · ∫(current) dx
// where I is the integral we want. Each by-parts round rewrites ∫current as
// uv − ∫remaining, so boundary += coeff·uv, coeff flips sign, current←remaining.
// After each round two exits close it:
//   • base case — `current` is directly integrable → I = boundary + coeff·∫current
//   • cyclic    — `current` = k·original → ∫current = k·I → solve I algebraically
// One loop handles both "the polynomial fizzles out" and "the integral comes
// back around." Every result is differentiated and checked before it is trusted.

import { math, beautify, loadAlgebrite, expressionsNumericallyEqual } from './solverUtils.js';

const MAX_ROUNDS = 8;

// LIATE ranks: Logarithmic, Inverse-trig, Algebraic, Trig, Exponential.
// u is the factor with the lowest rank; dv is everything else.
function liateRank(factor, v) {
  const s = String(factor);
  if (!new RegExp(`\\b${v}\\b`).test(s)) return 0; // constant — no variable
  if (/\b(?:log|ln)\s*\(/i.test(s)) return 1;
  if (/\b(?:arcsin|arccos|arctan)\s*\(/i.test(s)) return 2;
  if (/\b(?:sin|cos|tan|sec|csc|cot)\s*\(/i.test(s)) return 4;
  if (/\bexp\s*\(|e\s*\^/i.test(s)) return 5;
  return 3; // algebraic (a power/polynomial in v)
}

// Split a product into its top-level factors (respecting parentheses).
function factorList(term) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of String(term)) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    if (ch === '*' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
  }
  if (cur) parts.push(cur);
  return parts.map((p) => p.trim()).filter(Boolean);
}

// Category flags for an integrand term.
function categories(term, v) {
  const factors = factorList(term);
  let hasLogInv = false;
  let hasTrig = false;
  let hasExp = false;
  let hasAlg = false;
  for (const f of factors) {
    const r = liateRank(f, v);
    if (r === 1 || r === 2) hasLogInv = true;
    else if (r === 4) hasTrig = true;
    else if (r === 5) hasExp = true;
    else if (r === 3) hasAlg = true;
  }
  return { factors, hasLogInv, hasTrig, hasExp, hasAlg };
}

// Does this term call for integration by parts? Poly×{trig,exp}, a lone
// log/inverse-trig, or the cyclic exp×trig. A lone trig/exp/power does NOT.
// Transcendental arguments must be linear in v (sin(x²) is u-substitution, not
// by-parts) — otherwise we decline and let Algebrite try (and honestly fail).
export function needsByParts(term, v) {
  const { hasLogInv, hasTrig, hasExp, hasAlg } = categories(term, v);
  const wants = hasLogInv || (hasTrig && hasAlg) || (hasExp && hasAlg) || (hasTrig && hasExp);
  if (!wants) return false;
  return transcendentalArgsAreLinear(term, v);
}

function transcendentalArgsAreLinear(term, v) {
  const calls = String(term).matchAll(/\b(?:sin|cos|tan|sec|csc|cot|exp|log|ln|arcsin|arccos|arctan)\s*\(([^()]*)\)/gi);
  for (const m of calls) {
    const arg = m[1];
    if (!new RegExp(`\\b${v}\\b`).test(arg)) continue;
    // Linear iff the second derivative is zero — sample a couple of points.
    const d2 = `${arg.replace(new RegExp(v, 'g'), '(x+0.001)')}`;
    try {
      const f = (x) => Number(math.evaluate(arg, { [v]: x }));
      const slope1 = (f(1.001) - f(1)) / 0.001;
      const slope2 = (f(3.001) - f(3)) / 0.001;
      if (Math.abs(slope1 - slope2) > 1e-4) return false; // non-constant slope → nonlinear
    } catch {
      return false;
    }
  }
  return true;
}

// Choose u and dv by LIATE. Returns { u, dv } (dv without the trailing dx),
// or null when the term has no variable factor.
function chooseUDV(term, v) {
  const factors = factorList(term);
  const ranks = factors.map((f) => liateRank(f, v));
  const varRanks = ranks.filter((r) => r > 0);
  if (varRanks.length === 0) return null;
  const minR = Math.min(...varRanks);

  const uParts = [];
  const dvParts = [];
  factors.forEach((f, i) => {
    // The u group is the lowest LIATE rank; constants ride along with u.
    if (ranks[i] === minR || ranks[i] === 0) uParts.push(f);
    else dvParts.push(f);
  });

  const u = uParts.join('*') || '1';
  const dv = dvParts.join('*') || '1';
  return { u, dv };
}

// --- Algebrite wrappers ------------------------------------------------------

function run(Algebrite, code) {
  try {
    const out = String(Algebrite.run(code)).trim();
    return /stop|error|nil/i.test(out) ? null : out;
  } catch {
    return null;
  }
}

const derivative = (A, e, v) => run(A, `d(${e},${v})`);
const antideriv = (A, e, v) => run(A, `integral(${e},${v})`);
const simplify = (A, e) => run(A, `simplify(${e})`) || e;

// Is `current` a constant multiple k of `original`? Returns k (a number) or null.
// Sampled numerically where original ≠ 0.
function constantMultiple(current, original, v) {
  const ratios = [];
  for (const x of [0.4, 0.9, 1.7, 2.3, -1.1, -0.6]) {
    let a;
    let b;
    try {
      a = Number(math.evaluate(current, { [v]: x }));
      b = Number(math.evaluate(original, { [v]: x }));
    } catch {
      continue;
    }
    if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(b) < 1e-9) continue;
    ratios.push(a / b);
  }
  if (ratios.length < 3) return null;
  const mean = ratios.reduce((s, r) => s + r, 0) / ratios.length;
  if (ratios.every((r) => Math.abs(r - mean) < 1e-6 * (1 + Math.abs(mean)))) {
    return Math.abs(mean - Math.round(mean)) < 1e-9 ? Math.round(mean) : mean;
  }
  return null;
}

// --- the engine --------------------------------------------------------------

/**
 * Integrate a single term by parts. Returns { antiderivative, steps, cyclic }
 * or null if it can't (not a by-parts form, Algebrite gap, or the result fails
 * the differentiate-back check).
 */
export async function integrateByParts(term, v) {
  const Algebrite = await loadAlgebrite();
  if (!needsByParts(term, v)) return null;

  const original = simplify(Algebrite, term);
  let boundary = '0';
  let coeff = '1'; // exact rational string, via Algebrite
  let current = original;
  const steps = [];
  let cyclic = false;

  for (let round = 1; round <= MAX_ROUNDS; round += 1) {
    const choice = chooseUDV(current, v);
    if (!choice) return null;
    const { u, dv } = choice;

    const du = derivative(Algebrite, u, v);
    const vAnti = antideriv(Algebrite, dv, v);
    if (du === null || vAnti === null) return null;

    const uv = simplify(Algebrite, `(${u})*(${vAnti})`);
    const remaining = simplify(Algebrite, `(${vAnti})*(${du})`);

    steps.push(...roundStep(round, u, dv, du, vAnti, current, uv, remaining, v));

    // I = boundary + coeff·∫current = (boundary + coeff·uv) + (−coeff)·∫remaining
    boundary = simplify(Algebrite, `(${boundary}) + (${coeff})*(${uv})`);
    coeff = simplify(Algebrite, `-(${coeff})`);
    current = remaining;

    // Exit 1 — cyclic: current = k·original ⇒ ∫current = k·I.
    const k = constantMultiple(current, original, v);
    if (k !== null) {
      // I = boundary + coeff·k·I ⇒ I·(1 − coeff·k) = boundary.
      const denom = simplify(Algebrite, `1 - (${coeff})*(${k})`);
      if (Number(math.evaluate(denom.replace(/pi/g, 'PI'))) === 0) return null;
      const F = simplify(Algebrite, `(${boundary}) / (${denom})`);
      steps.push(...cyclicStep(current, k, denom, boundary, F, v));
      cyclic = true;
      return finalize(Algebrite, F, term, v, steps, cyclic);
    }

    // Exit 2 — base case: current is directly integrable (no more by-parts).
    if (!needsByParts(current, v)) {
      const base = antideriv(Algebrite, current, v);
      if (base === null) return null;
      const F = simplify(Algebrite, `(${boundary}) + (${coeff})*(${base})`);
      steps.push(...baseStep(current, base, F, v));
      return finalize(Algebrite, F, term, v, steps, cyclic);
    }
  }

  return null; // exceeded the round cap
}

// Differentiate the antiderivative and confirm it equals the integrand. This is
// the trust gate: a bad cyclic solve or simplification is caught here.
function finalize(Algebrite, F, term, v, steps, cyclic) {
  const dF = derivative(Algebrite, F, v);
  if (dF === null || !expressionsNumericallyEqual(dF, term, v)) return null;
  return { antiderivative: F, steps, cyclic };
}

// --- step wording ------------------------------------------------------------

function lnify(s) {
  return beautify(s).replace(/\blog\(([^()]+)\)/g, 'ln|$1|');
}

// Each round is emitted as a header plus three "Label: math" lines. The colon
// shape lets the renderer typeset the math tail (KaTeX) and fall back to plain
// text otherwise.
function roundStep(round, u, dv, du, vAnti, current, uv, remaining, v) {
  const header = round === 1
    ? 'Apply integration by parts (∫u dv = uv − ∫v du):'
    : `Apply integration by parts again (round ${round}):`;
  return [
    header,
    `Choose the parts: u = ${lnify(u)}, dv = ${lnify(dv)} d${v}`,
    `Differentiate u and integrate dv: du = ${lnify(du)} d${v}, v = ${lnify(vAnti)}`,
    `This gives: ∫(${lnify(current)}) d${v} = ${lnify(uv)} − ∫(${lnify(remaining)}) d${v}`,
  ];
}

function baseStep(current, base, F, v) {
  return [
    `The remaining integral is direct: ∫(${lnify(current)}) d${v} = ${lnify(base)}`,
    `Collect the pieces: ${lnify(F)}`,
  ];
}

function cyclicStep(current, k, denom, boundary, F, v) {
  const kStr = k === -1 ? '−I' : k === 1 ? 'I' : `${k}·I`;
  return [
    `The original integral reappears (I is the integral we want): ∫(${lnify(current)}) d${v} = ${kStr}`,
    `Move it to the left and solve: (${lnify(denom)})·I = ${lnify(boundary)}`,
    `Therefore: I = ${lnify(F)}`,
  ];
}
