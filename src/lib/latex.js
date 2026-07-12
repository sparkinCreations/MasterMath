// ASCII-math → LaTeX conversion for KaTeX rendering.
//
// Solver output is plain ASCII math ("f'(x) = 2x + 3", "∫(2x + 1) dx = x^2 +
// x + C") embedded in prose steps ("Power rule — d/dx(x^n) = n·x^(n-1)."). The
// two jobs here:
//   toLatex(ascii)      — convert one math fragment to LaTeX
//   segmentMathText(s)  — split a step string into prose and math segments
// Rendering falls back to plain text whenever KaTeX rejects the output, so a
// conversion miss degrades to exactly what users see today — never worse.

const FUNCTIONS = ['arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'asin', 'acos', 'atan', 'sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'ln', 'log', 'exp'];

// Words allowed to appear inside a "math" fragment without making it prose.
const MATH_WORDS = new Set([
  ...FUNCTIONS, 'sqrt', 'abs', 'lim', 'pi', 'dx', 'dy', 'dt', 'du', 'dd',
  'or', 'and', 'C', 'DNE', 'e', 'i', 'd', 'f', 'F', 'x', 'y', 't', 'u', 'n', 'a', 'b', 'c',
]);

/**
 * Convert an ASCII math fragment to LaTeX. Conservative by design: structures
 * it does not recognize pass through mostly unchanged (KaTeX renders bare
 * slashes, parens, and letters fine).
 */
export function toLatex(ascii) {
  let s = String(ascii).trim();

  // Unicode operators / symbols
  s = s
    .replace(/−/g, '-')
    .replace(/·/g, ' \\cdot ')
    .replace(/×/g, ' \\times ')
    .replace(/±/g, ' \\pm ')
    .replace(/≈/g, ' \\approx ')
    .replace(/≠/g, ' \\neq ')
    .replace(/≤/g, ' \\le ')
    .replace(/≥/g, ' \\ge ')
    .replace(/∞/g, ' \\infty ')
    .replace(/⁺/g, '^{+}')
    .replace(/⁻/g, '^{-}')
    .replace(/→/g, ' \\to ')
    .replace(/π/g, ' \\pi ')
    .replace(/°/g, '^{\\circ}')
    .replace(/√\(([^()]*)\)/g, '\\sqrt{$1}')
    .replace(/√(\w+)/g, '\\sqrt{$1}')
    .replace(/″/g, "''")
    .replace(/′/g, "'");

  // lim (x→0) → \lim_{x \to 0}
  s = s.replace(/\blim\s*\(([^()]*?)\\to([^()]*?)\)/g, (_, a, b) => `\\lim_{${a.trim()} \\to ${b.trim()}}`);

  // ∫(expr) dx = → \int expr \, dx =
  s = s.replace(/∫\s*\(([^]*?)\)\s*d([a-z])\b/g, (_, body, v) => `\\int ${body} \\, d${v}`);
  s = s.replace(/∫/g, '\\int ');

  // ln|x| style bars first — must run BEFORE abs() conversion, or the bars
  // that abs() emits would get wrapped a second time.
  s = s.replace(/\|([^|]+)\|/g, '\\left|$1\\right|');
  // sqrt(...) / abs(...) with balanced nesting
  s = replaceCall(s, 'sqrt', (arg) => `\\sqrt{${arg}}`);
  s = replaceCall(s, 'abs', (arg) => `\\left|${arg}\\right|`);

  // Exponents: ^(...) → ^{...}; ^-2 / ^12 / ^x → ^{-2} etc.
  s = replaceCaret(s);

  // d/dx → \frac{d}{dx}
  s = s.replace(/\bd\/d([a-z])\b/g, '\\frac{d}{d$1}');

  // Simple numeric fractions like 1/3 (not part of a longer token) → \frac
  s = s.replace(/(?<![\w}])(\d+)\/(\d+)(?![\w.])/g, '\\frac{$1}{$2}');

  // Function names → \sin etc.
  for (const fn of FUNCTIONS) {
    s = s.replace(new RegExp(`\\b${fn}\\b`, 'g'), `\\${fn === 'arcsin' ? 'arcsin' : fn === 'arccos' ? 'arccos' : fn === 'arctan' ? 'arctan' : fn}`);
  }
  // KaTeX has no \arcsec etc.; \arcsin/\arccos/\arctan exist. sec/csc/cot exist.

  // Explicit multiplication that survived beautify: a*b → a \cdot b
  s = s.replace(/\*/g, ' \\cdot ');

  // " or " between solutions → text
  s = s.replace(/\s+or\s+/g, ' \\;\\text{or}\\; ');
  // ", " listing stays as commas (KaTeX fine)

  // + C at the end stays; DNE-style words shouldn't reach here (prose filter)
  return s.replace(/\s{2,}/g, ' ').trim();
}

// Replace fn(...) with a LaTeX form, handling one level of nested parens.
function replaceCall(s, name, build) {
  const re = new RegExp(`\\b${name}\\(`);
  let out = s;
  let guard = 0;
  while (guard++ < 20) {
    const m = re.exec(out);
    if (!m) break;
    const open = m.index + m[0].length - 1;
    let depth = 0;
    let close = -1;
    for (let i = open; i < out.length; i += 1) {
      if (out[i] === '(') depth += 1;
      else if (out[i] === ')') { depth -= 1; if (depth === 0) { close = i; break; } }
    }
    if (close === -1) break;
    out = out.slice(0, m.index) + build(out.slice(open + 1, close)) + out.slice(close + 1);
  }
  return out;
}

// ^(...) → ^{...}; ^token → ^{token}
function replaceCaret(s) {
  let out = '';
  let i = 0;
  while (i < s.length) {
    if (s[i] !== '^') { out += s[i]; i += 1; continue; }
    i += 1;
    if (s[i] === '(') {
      let depth = 0;
      let j = i;
      for (; j < s.length; j += 1) {
        if (s[j] === '(') depth += 1;
        else if (s[j] === ')') { depth -= 1; if (depth === 0) break; }
      }
      out += `^{${s.slice(i + 1, j)}}`;
      i = j + 1;
    } else if (s[i] === '{') {
      out += '^'; // already latex-style
    } else {
      const m = s.slice(i).match(/^-?[\w.\\]+/);
      if (m) { out += `^{${m[0]}}`; i += m[0].length; } else { out += '^'; }
    }
  }
  return out;
}

/**
 * Is a fragment "math" (typeset it) rather than prose (leave as text)?
 * Requires a math signal AND no prose words.
 */
export function isMathFragment(s) {
  const t = String(s).trim().replace(/[.,;:]+$/, '');
  if (!t) return false;
  const hasSignal = /[=^∫√π|]|\bd\/d[a-z]\b|\d\s*\/\s*\d|→|±|∞|\blim\b|'/.test(t);
  if (!hasSignal) return false;
  // Any alphabetic word not in the math whitelist ⇒ prose.
  const words = t.match(/[A-Za-z]+/g) || [];
  return words.every((w) => MATH_WORDS.has(w) || MATH_WORDS.has(w.toLowerCase()) || w.length === 1);
}

/**
 * Split a step string into [{type:'text'|'math', value}] segments.
 * Handles the two shapes our solvers emit:
 *   "Prose: math tail"    (split at the last ": ")
 *   "Label — math tail."  (split at " — ")
 * plus fully-math strings. Anything else stays one text segment.
 */
export function segmentMathText(step) {
  const s = String(step);
  const trimmed = s.trim();

  if (isMathFragment(trimmed)) {
    return [{ type: 'math', value: trimmed.replace(/[.]$/, '') }];
  }

  for (const sep of [' — ', ': ']) {
    const idx = s.lastIndexOf(sep);
    if (idx === -1) continue;
    const head = s.slice(0, idx + sep.length);
    let tail = s.slice(idx + sep.length);
    const trailing = tail.match(/[.?!]\s*$/) ? tail.slice(-1) : '';
    const core = trailing ? tail.slice(0, -1) : tail;
    if (isMathFragment(core)) {
      const segs = [{ type: 'text', value: head }, { type: 'math', value: core.trim() }];
      if (trailing) segs.push({ type: 'text', value: trailing });
      return segs;
    }
  }

  return [{ type: 'text', value: s }];
}
