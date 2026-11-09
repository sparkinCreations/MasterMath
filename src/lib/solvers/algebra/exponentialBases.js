// Exponentials with more than one base, or an offset in the exponent
// (1.75.0): 9^x − 3^(x+1) − 4 = 0, 2^(x+1) + 2^x = 12, 4^x = 8^(x−1),
// 2^x = 3^(x−1). Each fell to the numeric scan ("x ≈ 1.2619").
// - Powers of one base are rewritten in it (9^x = 3^(2x), 3^(x+1) = 3·3^x)
//   and handed to the u = bˣ substitution (`solveViaExpSubstitution`).
// - Two single powers, N^(L1) = M^(L2): with a common base the exponents are
//   equated (4^x = 8^(x−1) is 2x = 3x − 3); otherwise both sides are logged
//   and the linear equation solved, x = ln(3)/(ln(3) − ln(2)).
// Every answer is checked in the original equation.

import { math, beautify, mark, loadAlgebrite } from '../solverUtils.js';

const POW = (v) => new RegExp(`(?<![\\w.)])(\\d+)\\s*\\^\\s*(\\((?:[^()]|\\([^()]*\\))*\\)|${v}(?![a-z]))`, 'g');

// The smallest base b with N = b^m, and m.
function rootBase(N) {
  for (let b = 2; b <= N; b += 1) {
    let m = 0;
    let n = N;
    while (n % b === 0) { n /= b; m += 1; }
    if (n === 1 && m > 0) return { b, m };
  }
  return { b: N, m: 1 };
}

// p·x + q, p and q whole numbers, as { p, q }, or null.
function linearIn(text, v) {
  const t = String(text).replace(/^\((.*)\)$/, '$1');
  try {
    const at = (x) => Number(math.evaluate(t, { [v]: x }));
    const q = at(0);
    const p = at(1) - q;
    if (![q, p].every(Number.isInteger)) return null;
    if (Math.abs(at(3.7) - (p * 3.7 + q)) > 1e-9) return null;
    return { p, q };
  } catch { return null; }
}

const powerText = (b, k, v) => (k === 1 ? `${b}^${v}` : k === -1 ? `${b}^(-${v})` : `${b}^(${k}${v})`);

// Every N^(px + q) in the equation, rewritten in the common base:
// { equation, rewrites, base } or null when there is none to rewrite, the
// bases share no base, or an exponent is not linear with whole numbers.
export function rewriteToCommonBase(equation, v) {
  const found = [...String(equation).matchAll(POW(v))];
  if (found.length < 2) return null;
  const parts = [];
  for (const m of found) {
    const N = Number(m[1]);
    const lin = linearIn(m[2], v);
    if (!(N > 1) || !lin || lin.p === 0) return null;
    parts.push({ text: m[0], N, ...lin, ...rootBase(N) });
  }
  const b = parts[0].b;
  if (parts.some((p) => p.b !== b)) return null;
  // Nothing to do when every term is already b^(kx).
  if (parts.every((p) => p.N === b && p.q === 0)) return null;
  const rewrites = [];
  let out = equation;
  for (const p of parts) {
    const k = p.m * p.p;
    const c = p.m * p.q;
    const term = powerText(b, k, v);
    const replaced = c === 0 ? term : c > 0 ? `(${b ** c}*${term})` : `(${term}/${b ** -c})`;
    if (p.text !== term) rewrites.push(`${beautify(p.text)} = ${beautify(replaced.replace(/^\((.*)\)$/, '$1'))}`);
    out = out.replace(p.text, replaced);
  }
  return { equation: out, rewrites, base: b };
}

// N^(L1) = M^(L2), one power on each side.
export async function solveTwoPowers(equation, v) {
  const [lhs, rhs] = String(equation).split('=').map((s) => s.trim());
  if (rhs === undefined) return null;
  const one = (side) => {
    const m = side.match(new RegExp(`^(\\d+)\\s*\\^\\s*(\\((?:[^()]|\\([^()]*\\))*\\)|${v})$`));
    if (!m) return null;
    const lin = linearIn(m[2], v);
    return lin && lin.p !== 0 ? { N: Number(m[1]), exp: m[2].replace(/^\((.*)\)$/, '$1'), ...lin, ...rootBase(Number(m[1])) } : null;
  };
  const [a, c] = [one(lhs), one(rhs)];
  if (!a || !c || a.N === c.N) return null;
  const Algebrite = await loadAlgebrite();
  const run = (e) => String(Algebrite.run(e)).trim();
  let steps;
  let x;
  let shown;
  if (a.b === c.b) {
    // Same base: equate the exponents.
    const b = a.b;
    const left = `${a.m}*(${a.exp})`;
    const right = `${c.m}*(${c.exp})`;
    const A = a.m * a.p - c.m * c.p;
    if (A === 0) return null;
    x = (c.m * c.q - a.m * a.q) / A;
    shown = run(`(${c.m * c.q - a.m * a.q})/(${A})`);
    steps = [
      `Write both sides as powers of ${mark(String(b))}: ${mark(`${beautify(lhs)} = ${b}^(${beautify(run(`expand(${left})`))})`)} and ${mark(`${beautify(rhs)} = ${b}^(${beautify(run(`expand(${right})`))})`)}.`,
      `Equal powers of the same base have equal exponents: ${mark(`${beautify(run(`expand(${left})`))} = ${beautify(run(`expand(${right})`))}`)}, so ${mark(`${v} = ${beautify(shown)}`)}.`,
    ];
  } else {
    // Different bases: take ln of both sides, the exponents come down.
    const A = `${a.p}*log(${a.N}) - ${c.p}*log(${c.N})`;
    const B = `${c.q}*log(${c.N}) - ${a.q}*log(${a.N})`;
    x = Number(math.evaluate(`(${B})/(${A})`));
    if (!Number.isFinite(x)) return null;
    // ln(3)/(ln(3) − ln(2)), positive term first.
    shown = run(`simplify((${B})/(${A}))`).replace(/\blog\(/g, 'ln(')
      .replace(/\(-(ln\(\d+\)) \+ (ln\(\d+\))\)/g, '($2 - $1)').replace(/\(-(ln\(\d+\))\+(ln\(\d+\))\)/g, '($2-$1)');
    const ln = (N, exp) => `${/[+-]/.test(beautify(exp)) ? `(${beautify(exp)})` : beautify(exp)}·ln(${N})`;
    steps = [
      `The bases ${mark(String(a.N))} and ${mark(String(c.N))} are not powers of one number, so take the natural logarithm of both sides; each exponent comes down: ${mark(`${ln(a.N, a.exp)} = ${ln(c.N, c.exp)}`)}.`,
      `This is linear in ${mark(v)}: collect the ${mark(v)} terms and divide, ${mark(`${v} = ${beautify(shown)}`)}.`,
    ];
  }
  // The check, in the original.
  const diff = Number(math.evaluate(`(${lhs}) - (${rhs})`, { [v]: x }));
  if (!(Math.abs(diff) <= 1e-8 * (1 + Math.abs(Number(math.evaluate(lhs, { [v]: x })))))) return null;
  const exact = beautify(shown);
  const decimal = /ln|√/.test(exact) ? ` (≈ ${Math.round(x * 1e4) / 1e4})` : '';
  steps.push(`Solution: ${mark(`${v} = ${exact}`)}${decimal}`);
  return { steps, answer: `${v} = ${exact}${decimal}`, solutions: [x] };
}

