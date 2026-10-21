// Trigonometric substitution for ∫ c·√(A − B·x²) dx (A, B > 0):
//   b·x = a·sin θ with a = √A, b = √B, −π/2 ≤ θ ≤ π/2, so
//   dx = (a/b)·cos θ dθ and √(A − B·x²) = a·cos θ (cos θ ≥ 0 there);
//   ∫ c·a cos θ·(a/b) cos θ dθ = c·(A/b)·∫cos²θ dθ = c·(A/(2b))·(θ + sin θ cos θ),
//   and back in x: c·(A/(2b))·arcsin(b·x/a) + c·(x/2)·√(A − B·x²).
// Algebrite integrates these on its own, but hands back
// 1/2·x·(−x²+1)^(1/2) labelled "u-substitution" with no working; this
// module shows the substitution a textbook shows and writes the root as a
// root. The caller differentiates the result back before trusting it.
import { beautify, gcd } from './solverUtils.js';

const NUM = '(\\d+(?:\\.\\d+)?)';

function readRadicand(inner, v) {
  const s = inner.replace(/\s+/g, '');
  // A − B·x²  |  A − x²  |  −B·x² + A  |  −x² + A
  let m = s.match(new RegExp(`^${NUM}-(?:${NUM}\\*?)?${v}\\^2$`));
  if (m) return { A: Number(m[1]), B: m[2] === undefined ? 1 : Number(m[2]) };
  m = s.match(new RegExp(`^-(?:${NUM}\\*?)?${v}\\^2\\+${NUM}$`));
  if (m) return { A: Number(m[2]), B: m[1] === undefined ? 1 : Number(m[1]) };
  return null;
}

const isSquare = (n) => Number.isInteger(n) && Number.isInteger(Math.sqrt(n));
const rootText = (n) => (isSquare(n) ? String(Math.sqrt(n)) : `√${n}`);
const rootExpr = (n) => (isSquare(n) ? String(Math.sqrt(n)) : `sqrt(${n})`);
const frac = (p, q) => {
  if (Number.isInteger(p) && Number.isInteger(q)) {
    const g = gcd(Math.abs(p), Math.abs(q)) || 1;
    const [n, d] = [p / g, q / g];
    return d === 1 ? String(n) : `${n}/${d}`;
  }
  return `${p}/${q}`;
};

export function integrateByTrigSubstitution(term, variable) {
  const v = variable;
  const t = String(term).trim();
  const m = t.match(new RegExp(`^(-)?(?:${NUM}\\s*\\*\\s*)?(?:sqrt\\(([^()]+)\\)|\\(([^()]+)\\)\\^\\(1/2\\))$`));
  if (!m) return null;
  const rad = readRadicand(m[3] ?? m[4], v);
  if (!rad || !(rad.A > 0) || !(rad.B > 0)) return null;
  const { A, B } = rad;
  const sign = m[1] ? -1 : 1;
  const c = sign * (m[2] === undefined ? 1 : Number(m[2]));
  const a = rootText(A);
  const b = rootText(B);
  const radical = `√(${beautify(`${A} - ${B === 1 ? '' : `${B}*`}${v}^2`)})`;
  const bx = B === 1 ? v : `${b}${v}`;
  const sub = B === 1 ? `${v} = ${a === '1' ? '' : `${a}·`}sin θ` : `${v} = (${a}/${b})·sin θ`;
  const dx = B === 1 ? `d${v} = ${a === '1' ? '' : `${a}·`}cos θ dθ` : `d${v} = (${a}/${b})·cos θ dθ`;
  const cText = c === 1 ? '' : c === -1 ? '−' : `${c}·`;
  // Coefficient of ∫cos²θ dθ: c·A/b, and of the final arcsin: c·A/(2b).
  const coef = isSquare(B) ? frac(c * A, Math.sqrt(B)) : `${c === 1 ? '' : `${c}·`}${A}/${b}`;
  const half = isSquare(B) ? frac(c * A, 2 * Math.sqrt(B)) : `${c === 1 ? '' : `${c}·`}${A}/(2${b})`;
  const xHalf = c === 1 ? `${v}/2` : c === -1 ? `−${v}/2` : `${frac(c, 2)}·${v}`;
  const asinArg = B === 1 ? (a === '1' ? v : `${v}/${a}`) : `${bx}/${a}`;
  const steps = [
    `The integrand has the form √(a² − ${B === 1 ? '' : 'b²'}${v}²) with a = ${a}${B === 1 ? '' : ` and b = ${b}`}: substitute ${sub} (−π/2 ≤ θ ≤ π/2), so ${dx} and ${radical} = √(${A} − ${A === 1 ? '' : `${A}·`}sin²θ) = ${a === '1' ? '' : `${a}·`}cos θ (cos θ ≥ 0 on that range).`,
    `Substitute: ∫${cText}${radical} d${v} = ∫${cText}${a === '1' ? '' : `${a}·`}cos θ · ${B === 1 ? (a === '1' ? '' : `${a}·`) : `(${a}/${b})·`}cos θ dθ = ${coef === '1' ? '' : `${coef}·`}∫cos²θ dθ.`,
    'Half-angle identity cos²θ = (1 + cos 2θ)/2: ∫cos²θ dθ = θ/2 + sin(2θ)/4 = (θ + sin θ·cos θ)/2.',
    `Back to ${v}: sin θ = ${asinArg}, so θ = arcsin(${asinArg}); from the right triangle (opposite ${bx}, hypotenuse ${a}) cos θ = ${radical}${a === '1' ? '' : `/${a}`}, so sin θ·cos θ = ${bx}·${radical}${A === 1 ? '' : `/${A}`}.`,
    `So ∫${cText}${radical} d${v} = ${half === '1' ? '' : `${half}·`}arcsin(${asinArg}) + ${xHalf}·${radical}.`,
  ];
  const antiderivative = `${half === '1' ? '' : `${half}*`}arcsin(${B === 1 ? (a === '1' ? v : `${v}/${rootExpr(A)}`) : `${rootExpr(B)}*${v}/${rootExpr(A)}`}) + ${frac(c, 2)}*${v}*sqrt(${A} - ${B === 1 ? '' : `${B}*`}${v}^2)`;
  return { antiderivative, steps };
}
