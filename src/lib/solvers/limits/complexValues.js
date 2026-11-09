// A limit with the imaginary unit in it (r/mathematics, November 2026;
// 1.73.1): lim x→2 x√(−1) was "does not exist" — the samples were complex,
// read as "not defined on either side" — and lim x→2 x·i was 2i. MasterMath
// works limits of real functions of a real variable, so a limit whose
// expression or point involves i, or an even root of a negative constant,
// is refused as complex-valued instead of answered either way.

import { math } from '../solverUtils.js';

const hasSymbol = (node, name) => node.filter((n) => n.type === 'SymbolNode' && n.name === name).length > 0;

// The complex part as typed (i, √(−1), (−4)^(1/2)), or null when there is none.
export function complexPart(text, variable) {
  const s = String(text ?? '');
  if (/(?<![a-z])i(?![a-z])/i.test(s)) return 'i';
  // √(−1), sqrt(-4): read off the text, since "x√(-1)" need not parse.
  const root = s.match(/(?:√|sqrt)\s*\(\s*-\s*[\d.]+(?:\s*[*/]\s*[\d.]+)*\s*\)/i);
  if (root) return root[0].replace(/^sqrt/i, '√');
  let node;
  try { node = math.parse(s); } catch { return null; }
  let found = null;
  node.traverse((n) => {
    if (found || hasSymbol(n, variable)) return;
    const even = (n.type === 'FunctionNode' && n.fn?.name === 'sqrt')
      || (n.type === 'OperatorNode' && n.op === '^' && !/^\d+$/.test(n.args[1].toString()));
    if (!even) return;
    try {
      const v = math.evaluate(n.toString());
      if (v && typeof v.im === 'number' && Math.abs(v.im) > 1e-12) found = n.toString();
    } catch { /* not a number */ }
  });
  return found;
}

// Text before "lim" that is not an instruction ("i * lim x->0 …", "2 + lim …"):
// it would be dropped, and the answer would be the limit's alone.
export function textBeforeLimit(cleaned) {
  // Only a limit written out (lim x->a …) after it: a "lim" left at the end
  // of another shape keeps its format hint.
  const m = String(cleaned).match(/^(.*?)\blim(?:it)?\s+(?:as\s+)?[a-z]\s*(?:->|→|approaches)/i);
  if (!m) return null;
  const rest = m[1].replace(/\b(?:what(?:'s| is)|find|evaluate|calculate|compute|determine|the|of|please)\b/gi, ' ').replace(/[:,]/g, ' ').trim();
  return rest || null;
}
