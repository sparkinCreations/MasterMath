// u-substitution for integrands of the shape  g′(x)·h(g(x)).
//
// Algebrite's integrator has no substitution step of its own: it gives up on
// x·cos(x²) even though ∫x·cos(x²)dx = ½sin(x²) + C is a first-week exercise.
// This module supplies that step, on top of Algebrite's primitives:
//
//   1. Candidate inner functions u = g(x) are the arguments of function calls
//      (sin, cos, exp, ln, sqrt, …), the bases of (…)^n and the exponents of
//      e^(…) — anything the integrand is "built around".
//   2. For each candidate, divide the integrand by g′(x) and rewrite in terms
//      of u. If x has vanished, the integrand really is g′(x)·h(g(x)) with
//      h = that quotient.
//   3. Integrate h(u) du with Algebrite, back-substitute u = g(x), and
//      VERIFY by differentiating — nothing is reported that does not
//      differentiate back to the integrand.
//
// The steps show the substitution the way it is taught: choose u, compute
// du, rewrite, integrate in u, substitute back.

import { math, beautify, isAlgebriteFailure } from './solverUtils.js';

// Does d/dx F numerically equal f at several points? Central differences at
// h = 1e-5; points where either side is undefined are skipped, and at least
// three must be testable for a pass.
export function derivativeMatchesNumerically(F, f, v) {
  let tested = 0;
  for (const x0 of [-2.3, -1.1, -0.4, 0.37, 0.9, 1.7, 2.6]) {
    try {
      const h = 1e-5;
      const f1 = math.evaluate(F, { [v]: x0 + h });
      const f0 = math.evaluate(F, { [v]: x0 - h });
      const g = math.evaluate(f, { [v]: x0 });
      if (![f1, f0, g].every((n) => typeof n === 'number' && Number.isFinite(n))) continue;
      tested += 1;
      if (Math.abs((f1 - f0) / (2 * h) - g) > 1e-4 * (1 + Math.abs(g))) return false;
    } catch { /* skip point */ }
  }
  return tested >= 3;
}

const FN_CALL = /\b(sin|cos|tan|sec|csc|cot|exp|log|ln|sqrt|arcsin|arccos|arctan|sinh|cosh|tanh)\s*\(/g;

function run(A, code) {
  try {
    const out = String(A.run(code)).trim();
    return isAlgebriteFailure(out) ? null : out;
  } catch {
    return null;
  }
}

// Read a balanced parenthesised group starting at index `open` (which must be
// '('); returns the inner text or null.
function readGroup(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i += 1) {
    if (s[i] === '(') depth += 1;
    else if (s[i] === ')') {
      depth -= 1;
      if (depth === 0) return s.slice(open + 1, i);
    }
  }
  return null;
}

// Candidate inner functions, most specific first (longer text = deeper).
function candidateInner(term, variable) {
  const found = new Set();
  const hasVar = (s) => new RegExp(`\\b${variable}\\b`).test(s);

  // Function-call arguments: sin(<arg>), exp(<arg>), … — and the calls
  // themselves: sin(x)²·cos(x) wants u = sin(x); ln(x)/x wants u = ln(x).
  let m;
  FN_CALL.lastIndex = 0;
  while ((m = FN_CALL.exec(term)) !== null) {
    const open = m.index + m[0].length - 1;
    const arg = readGroup(term, open);
    if (arg === null) continue;
    if (hasVar(arg) && arg.trim() !== variable) found.add(arg.trim());
    if (hasVar(arg)) found.add(`${m[1]}(${arg.trim()})`);
  }
  // Power bases: (<base>)^n
  for (let i = 0; i < term.length; i += 1) {
    if (term[i] === '(') {
      const inner = readGroup(term, i);
      if (inner === null) continue;
      const after = i + inner.length + 2;
      if (term[after] === '^' && hasVar(inner) && inner.trim() !== variable) found.add(inner.trim());
    }
  }
  // e^(<exp>) / e^<token>
  const eExp = term.match(/\be\^\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g) || [];
  for (const e of eExp) {
    const inner = e.slice(3, -1);
    if (hasVar(inner) && inner.trim() !== variable) found.add(inner.trim());
  }
  // The denominator of a top-level fraction: (2x+3)/(x²+3x+5) and
  // e^x/(1+e^x) are u = denominator, giving ln|u|.
  const parts = splitTopLevel(term, '/');
  if (parts.length === 2) {
    let den = parts[1].trim();
    if (den.startsWith('(') && readGroup(den, 0) === den.slice(1, -1)) den = den.slice(1, -1).trim();
    if (hasVar(den) && den !== variable) found.add(den);
  }
  // Longer (more nested) candidates first; a shorter one is often a factor of it.
  return [...found].sort((a, b) => b.length - a.length);
}

// Split on a delimiter that appears only at parenthesis depth 0.
function splitTopLevel(str, delimiter) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of str) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    if (ch === delimiter && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out;
}

/**
 * Try to integrate `term` with respect to `variable` by u-substitution.
 * Returns { antiderivative, steps, u } or null.
 */
export function integrateBySubstitution(term, variable, Algebrite) {
  if (!Algebrite) return null;
  const A = Algebrite;
  const v = variable;
  const varRe = new RegExp(`\\b${v}\\b`);

  for (const u of candidateInner(term, v)) {
    const du = run(A, `d(${u}, ${v})`);
    if (!du || du === '0') continue;

    // h(x) = term / g'(x); then rewrite g(x) → u. If x survives, wrong u.
    const ratio = run(A, `simplify((${term}) / (${du}))`);
    if (!ratio) continue;
    let inU = run(A, `simplify(subst(u, ${u}, ${ratio}))`);
    // Algebrite may have normalised the ratio into a form where u no longer
    // appears literally: (x+1)/(x²+2x) ÷ (2x+2) simplifies to 1/(2x²+4x), in
    // which "x²+2x" cannot be substituted. For a denominator candidate the
    // classic case is N/D with N a constant multiple of D′ — check that
    // directly: k = N/D′ free of x  ⇒  ∫ = k·ln|D|.
    if ((!inU || varRe.test(inU)) && term.includes('/')) {
      const parts = splitTopLevel(term, '/');
      if (parts.length === 2) {
        let den = parts[1].trim();
        if (den.startsWith('(') && readGroup(den, 0) === den.slice(1, -1)) den = den.slice(1, -1).trim();
        if (den === u) {
          const k = run(A, `simplify((${parts[0]}) / (${du}))`);
          if (k && !varRe.test(k)) inU = `${k}/u`;
        }
      }
    }
    if (!inU || varRe.test(inU)) continue;

    const H = run(A, `integral(${inU}, u)`);
    if (!H || /\bintegral\s*\(/.test(H)) continue;

    const back = run(A, `simplify(subst(${u}, u, ${H}))`);
    if (!back || /\bu\b/.test(back)) continue;

    // Verify: d/dx of the result must equal the integrand. Symbolic first;
    // when simplification doesn't reach a literal 0 (trig identities, roots),
    // a numeric derivative check at several points decides.
    const check = run(A, `simplify(d(${back}, ${v}) - (${term}))`);
    if (check !== '0' && !derivativeMatchesNumerically(back, term, v)) continue;

    const steps = [
      `The integrand contains ${beautify(u)} inside a function, and its derivative d/d${v}(${beautify(u)}) = ${beautify(du)} appears as a factor (up to a constant) — the shape g′(${v})·h(g(${v})) that u-substitution is made for.`,
      `Let u = ${beautify(u)}. Then du = ${beautify(du)} d${v}, so d${v} = du/(${beautify(du)}).`,
      `Rewrite the integrand in terms of u: ∫(${beautify(term)}) d${v} = ∫(${beautify(inU)}) du.`,
      `Integrate in u: ∫(${beautify(inU)}) du = ${beautify(H)}.`,
      `Substitute back u = ${beautify(u)}: ${beautify(back)}.`,
      `Check by differentiating: d/d${v}[${beautify(back)}] = ${beautify(term)} ✓`,
    ];
    return { antiderivative: back, steps, u };
  }
  return null;
}

// Best rational approximation with a small denominator (continued fractions).
// The inputs here come from literal fractions in the input (3, 1/2, -2), so
// an exact hit is expected; the fallback is only for safety.
function toFraction(x, maxDen = 1000) {
  if (Number.isInteger(x)) return [x, 1];
  let [h1, h0, k1, k0] = [1, 0, 0, 1];
  let b = x;
  for (let i = 0; i < 40; i += 1) {
    const a = Math.floor(b);
    const h2 = a * h1 + h0;
    const k2 = a * k1 + k0;
    if (k2 > maxDen) break;
    [h0, h1, k0, k1] = [h1, h2, k1, k2];
    if (Math.abs(x - h1 / k1) < 1e-12) break;
    b = 1 / (b - a);
    if (!Number.isFinite(b)) break;
  }
  return [h1, k1];
}

/**
 * ∫ c·|a·x + b| dx = c·(a·x + b)·|a·x + b| / (2a) + C.
 *
 * Algebrite has no abs, so |x| and its linear relatives are handled here
 * directly. The result is verified numerically (mathjs knows abs).
 * Returns { antiderivative, steps } or null when the term isn't of that form.
 */
export function integrateAbsLinear(term, variable) {
  const v = variable;
  const cleaned = term.replace(/\s+/g, '');
  // [-]c*abs(g) | abs(g)*c | abs(g)/c | abs(g) | -abs(g)
  const m = cleaned.match(/^(-)?(?:([\d./]+)\*)?abs\(([^()]+)\)(?:\*(-?[\d./]+)|\/(-?[\d./]+))?$/);
  if (!m) return null;
  const negated = m[1] === '-';
  const inner = m[3];
  // linear? evaluate a and b numerically: g(x) = a x + b ⇒ a = g(1)-g(0), b = g(0), and g(2) must fit
  let a;
  let b;
  try {
    const g = (x) => math.evaluate(inner, { [v]: x });
    b = g(0);
    a = g(1) - b;
    if (typeof a !== 'number' || typeof b !== 'number') return null;
    if (Math.abs(g(2) - (2 * a + b)) > 1e-9 || Math.abs(g(-3) - (-3 * a + b)) > 1e-9) return null;
    if (Math.abs(a) < 1e-12) return null;
  } catch {
    return null;
  }
  let c = negated ? -1 : 1;
  try {
    if (m[2]) c *= math.evaluate(m[2]);
    if (m[4]) c *= math.evaluate(m[4]);
    if (m[5]) c /= math.evaluate(m[5]);
  } catch {
    return null;
  }

  const fmt = (n) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(6))));
  // Keep the coefficient exact (c/(2a) as a reduced fraction): a float here
  // makes Algebrite's later simplification of the whole integral go
  // floating-point (x^2.0, 1.0*exp(...)), and 1/2 reads better than 0.5.
  const [num, den] = toFraction(c / (2 * a));
  const g = beautify(inner);
  const inside = inner === v ? v : `(${g})`;
  const core = `${inside}*abs(${g})`;
  let antiderivative;
  if (den === 1) antiderivative = num === 1 ? core : num === -1 ? `-${core}` : `${num}*${core}`;
  else antiderivative = `${num === 1 ? '' : num === -1 ? '-' : `${num}*`}${core}/${den}`;

  // Verify numerically.
  for (const x0 of [-3.3, -1.2, -0.5, 0.4, 1.1, 2.7]) {
    try {
      const h = 1e-5;
      const d = (math.evaluate(antiderivative, { [v]: x0 + h }) - math.evaluate(antiderivative, { [v]: x0 - h })) / (2 * h);
      const f = math.evaluate(term, { [v]: x0 });
      if (Math.abs(d - f) > 1e-5 * (1 + Math.abs(f))) return null;
    } catch {
      return null;
    }
  }

  const steps = [
    `|${g}| is not differentiable at ${g} = 0, but it is continuous, so it has an antiderivative — one has to be found piecewise or by a known formula, since the usual rules don't apply directly.`,
    `Split at the corner: |${g}| = ${g} where ${g} ≥ 0 and −(${g}) where ${g} < 0. Integrating each piece and matching them at the corner gives the single formula ∫|${g}| d${v} = (${g})·|${g}| / (2·${fmt(a)}) + C.`,
    ...(c !== 1 ? [`Carry the constant factor ${fmt(c)} through.`] : []),
    `So ∫(${beautify(term)}) d${v} = ${beautify(antiderivative)} + C.`,
    `Check by differentiating: d/d${v}[${beautify(antiderivative)}] = ${beautify(term)} ✓ (the product rule with d/d${v}|${g}| = ${fmt(a)}·sgn(${g}) gives it).`,
  ];
  return { antiderivative, steps };
}
