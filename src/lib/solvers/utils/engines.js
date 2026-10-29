// The two maths engines every solver shares: the mathjs instance (with ln,
// arcsin, arccos, arctan and sgn aliased) and Algebrite, loaded lazily and
// wrapped so that a throwing call cannot poison later ones.

import { createMath } from '../../mathInstance.js';

export const math = createMath();

// mathjs names the natural log `log`; students (and Algebrite) write `ln`.
// Alias it so every numeric evaluation — graphs, sampling, arithmetic —
// understands `ln(x)` instead of throwing "Undefined function ln".
//
// Likewise, mathjs names the inverse trig functions `asin`/`acos`/`atan`, but
// students and Algebrite write `arcsin`/`arccos`/`arctan`. Alias those too, so
// numeric checks and graphs of e.g. arctan(x) don't silently fail to evaluate.
//
// And Algebrite writes the sign function as `sgn` (it appears when it
// differentiates abs: d/dx|x| = sgn(x)); mathjs calls it `sign`. Alias so
// Algebrite's derivatives of abs-bearing results can be checked numerically.
math.import({
  ln: (x) => math.log(x),
  arcsin: (x) => math.asin(x),
  arccos: (x) => math.acos(x),
  arctan: (x) => math.atan(x),
  sgn: (x) => math.sign(x),
}, { override: true });

// Algebrite is large and only needed for symbolic work, so it is imported
// lazily and memoized. Every solver shares this single promise.
let algebritePromise = null;

export function loadAlgebrite() {
  if (!algebritePromise) {
    algebritePromise = import('algebrite').then((module) => wrapAlgebrite(module.default));
  }
  return algebritePromise;
}

// Algebrite is a global CAS with an internal evaluation stack. When one of its
// direct-API calls (roots, derivative, simplify, …) throws — "Stop: divide by
// zero" for roots((x/0) - 1, x) — that stack is left unbalanced, and EVERY
// later direct call fails with "Stop: frame error" until something resets it.
// In production that meant one x/0 equation silently downgraded every exact
// solve for the rest of the session to the numeric fallback (x^3 = 8 → "x =
// 2", the two complex roots gone; x^2 = 2 → ±1.4142 instead of ±√2).
// Algebrite.run() resets the frame on its own; the wrapper calls it after any
// throw, then rethrows so the caller's own handling still runs.
function wrapAlgebrite(A) {
  const recover = () => {
    try { A.run('1'); } catch { /* the reset itself may report the frame error once */ }
    try { A.run('1'); } catch { /* ignore */ }
  };
  return new Proxy(A, {
    get(target, prop) {
      const value = target[prop];
      if (typeof value !== 'function') return value;
      return (...args) => {
        try {
          return value.apply(target, args);
        } catch (error) {
          recover();
          throw error;
        }
      };
    },
  });
}

/**
 * Is this Algebrite output a failure message rather than mathematics?
 *
 * Algebrite reports many failures by RETURNING text instead of throwing:
 * "Stop: integral: sorry, could not find a solution", "Unsupported function
 * abs", "nil". A guard that only knew "stop|error|nil" let "Unsupported
 * function abs" through as an antiderivative. Every solver's Algebrite
 * wrapper routes through this so the vocabulary lives in one place.
 */
export function isAlgebriteFailure(output) {
  const s = String(output ?? '').trim();
  if (!s) return true;
  return /\b(stop|error|nil|unsupported|sorry|cannot|can't|undefined|not implemented)\b/i.test(s);
}

// One Algebrite command, trimmed, or null when it throws or answers with a
// failure marker. For callers that treat "no answer" and "error" alike.
export function runAlgebrite(Algebrite, code) {
  try {
    const out = String(Algebrite.run(code)).trim();
    return isAlgebriteFailure(out) ? null : out;
  } catch {
    return null;
  }
}
