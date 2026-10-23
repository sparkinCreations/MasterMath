// ASCII-math → LaTeX conversion for KaTeX rendering.
//
// Solver output is plain ASCII math ("f'(x) = 2x + 3", "∫(2x + 1) dx = x^2 +
// x + C") embedded in prose steps ("Power rule — d/dx(x^n) = n·x^(n-1)."). The
// two jobs here:
//   toLatex(ascii)      — convert one math fragment to LaTeX
//   segmentMathText(s)  — split a step string into prose and math segments
// Rendering falls back to plain text whenever KaTeX rejects the output, so a
// conversion miss degrades to exactly what users see today — never worse.

import { MATH_OPEN, MATH_CLOSE, hasMathMarkers, stripMathMarkers } from './mathMarkers.js';

// True when the text between a "(" and a ")" is balanced on its own — the
// two brackets around it are a pair — so they can be dropped.
function wrapsWhole(body) {
  let depth = 0;
  for (const ch of body) {
    if (ch === '(') depth += 1;
    else if (ch === ')' && --depth < 0) return false;
  }
  return depth === 0;
}

const FUNCTIONS = ['arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'asin', 'acos', 'atan', 'sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'ln', 'log', 'exp'];

// Words allowed to appear inside a "math" fragment without making it prose.
export const MATH_WORDS = new Set([
  ...FUNCTIONS, 'sqrt', 'abs', 'sgn', 'mod', 'lim', 'pi', 'dx', 'dy', 'dt', 'du', 'dv', 'dd',
  'or', 'and', 'C', 'DNE', 'e', 'i', 'd', 'f', 'F', 'x', 'y', 't', 'u', 'v', 'n', 'a', 'b', 'c',
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
    // Typed spellings the parser accepts (a typed problem reaches here).
    .replace(/(?<![A-Za-z\\])(?:infinity|inf)(?![A-Za-z])/g, ' \\infty ')
    .replace(/(?<![A-Za-z\\])theta(?![A-Za-z])/g, ' \\theta ')
    // Typed pi: "sin(pi/4)" was set as the italic letters p·i, and screen
    // readers said "p i".
    .replace(/(?<![A-Za-z\\])pi(?![A-Za-z])/g, ' \\pi ')
    .replace(/⁺/g, '^{+}')
    .replace(/⁻/g, '^{-}')
    .replace(/→/g, ' \\to ')
    // The typed form of the arrow: "x->0" rendered as a minus and a greater-than.
    .replace(/->/g, ' \\to ')
    .replace(/π/g, ' \\pi ')
    .replace(/°/g, '^{\\circ}')
    .replace(/∛\(([^()]*)\)/g, '\\sqrt[3]{$1}')
    .replace(/∛(\w+)/g, '\\sqrt[3]{$1}')
    .replace(/√\(([^()]*)\)/g, '\\sqrt{$1}')
    .replace(/√(\w+)/g, '\\sqrt{$1}')
    // √π (the erf constants): π has become \pi by now.
    .replace(/√ \\pi /g, '\\sqrt{\\pi} ')
    .replace(/″/g, "''")
    .replace(/′/g, "'")
    // % opens a comment in TeX: 15% would swallow the rest of the run.
    .replace(/%/g, '\\%')
    // a mod b is an operator, not the italic letters m·o·d.
    .replace(/\s*\bmod\b\s*/g, ' \\bmod ');

  // lim (x→0) → \lim_{x \to 0}
  s = s.replace(/\blim\s*\(([^()]*?)\\to([^()]*?)\)/g, (_, a, b) => `\\lim_{${a.trim()} \\to ${b.trim()}}`);
  // The typed form without parentheses, "lim x->0 (…)": the same limit. Math
  // mode drops the spaces, so without this it read as "limx→0(…)".
  s = s.replace(/\blim\s+([a-z])\s*\\to\s*((?:[-+]\s*)?(?:\\infty|[^\s()]+))/g, (_, a, b) => `\\lim_{${a} \\to ${b.replace(/\s+/g, '')}}`);

  // ∫_a^b (expr) dx → \int_{a}^{b} expr \, dx  (definite; bounds before body)
  // ∫(expr) dx = → \int expr \, dx =
  // The brackets go only when they wrap the whole integrand: in
  // "∫ (x+1)/((x-1)^2) dx" the first "(" and the last ")" are not a pair,
  // and dropping them showed "∫ x+1)/((x−1)²" (October 2026 review).
  const unwrap = (body) => (wrapsWhole(body) ? body : `(${body})`);
  s = s.replace(/∫\s*_\s*([^\s^]+)\s*\^\s*(\S+?)\s*\(([^]*?)\)\s*d([a-z])\b/g,
    (_, a, b, body, v) => `\\int_{${a}}^{${b}} ${unwrap(body)} \\, d${v}`);
  s = s.replace(/∫\s*\(([^]*?)\)\s*d([a-z])\b/g, (_, body, v) => `\\int ${unwrap(body)} \\, d${v}`);
  s = s.replace(/∫/g, '\\int ');

  // ln|x| style bars first — must run BEFORE abs() conversion, or the bars
  // that abs() emits would get wrapped a second time.
  s = s.replace(/\|([^|]+)\|/g, '\\left|$1\\right|');
  // sqrt(...) / abs(...) with balanced nesting
  s = replaceCall(s, 'sqrt', (arg) => `\\sqrt{${arg}}`);
  s = replaceCall(s, 'cbrt', (arg) => `\\sqrt[3]{${arg}}`);
  s = replaceCall(s, 'abs', (arg) => `\\left|${arg}\\right|`);

  // Exponents: ^(...) → ^{...}; ^-2 / ^12 / ^x → ^{-2} etc.
  s = replaceCaret(s);

  // d/dx → \frac{d}{dx}
  s = s.replace(/\bd\/d([a-z])\b/g, '\\frac{d}{d$1}');

  // Simple numeric fractions like 1/3 (not part of a longer token) → \frac
  s = s.replace(/(?<![\w}])(\d+)\/(\d+)(?![\w.])/g, '\\frac{$1}{$2}');

  // log_2(x) (beautify's form of the parser's log(x)/log(2)) → \log_{2}(x);
  // the word-boundary loop below does not see "log" before an underscore.
  s = s.replace(/\blog_(\d+(?:\.\d+)?|[a-z](?![a-z]))/g, '\\log_{$1}');

  // Function names → \sin etc.
  for (const fn of FUNCTIONS) {
    // Not \b: "2sin²(x)" has no boundary between the 2 and the s.
    s = s.replace(new RegExp(`(?<![A-Za-z\\\\])${fn}(?![A-Za-z])`, 'g'), `\\${fn === 'arcsin' ? 'arcsin' : fn === 'arccos' ? 'arccos' : fn === 'arctan' ? 'arctan' : fn}`);
  }
  // KaTeX has no \arcsec etc.; \arcsin/\arccos/\arctan exist. sec/csc/cot exist.
  // The error function has no KaTeX command: upright, as a named operator.
  s = s.replace(/\berf\b/g, '\\operatorname{erf}');
  s = s.replace(/\bsgn\b/g, '\\operatorname{sgn}');
  // A "lim" with no approach written under it (a tip's "lim B^E"): upright.
  s = s.replace(/(?<!\\)\blim\b/g, '\\lim');

  // Explicit multiplication that survived beautify: a*b → a \cdot b
  // A number times a letter, a function or a bracket is written the
  // textbook way: typed "2*x + 5" shows as 2x + 5, "3*sin(x)" as 3 sin x.
  s = s.replace(/(\d)\s*\*\s*(?=[A-Za-z(\\])/g, '$1');
  s = s.replace(/\*/g, ' \\cdot ');

  // Connecting words inside a math fragment are text, not a product of
  // variables. Without this, "F(1) = 0 and F(0) = -1" typeset as
  // "F(1)=0andF(0)=−1" — the letters a, n, d run together in italic with no
  // spacing on either side. Every word the fragment test lets through
  // (MATH_WORDS) has to be handled here.
  s = s.replace(/\s+or\s+/g, ' \\;\\text{or}\\; ');
  s = s.replace(/\s+and\s+/g, ' \\;\\text{and}\\; ');
  s = s.replace(/\bDNE\b/g, '\\text{DNE}');
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
// Quotation marks around a typeset run are prose: an error step quotes the
// input ("“∫ (x+1) dx” is valid mathematical input"), and KaTeX set the
// opening “ as a closing ” at the start of the formula.
function liftQuotes(segments) {
  const out = [];
  const push = (type, value) => { if (value) out.push({ type, value }); };
  for (const seg of segments) {
    if (seg.type !== 'math') { push(seg.type, seg.value); continue; }
    const m = seg.value.match(/^([“‘"]*)([^]*?)([”’"]*)$/);
    push('text', m[1]);
    push('math', m[2]);
    push('text', m[3]);
  }
  return out;
}

// mode 'auto' (steps, answers): the ⟦…⟧ markers when present, else the
// clause heuristics below. 'marked' (tips and mistakes): only what is
// marked is math; unmarked text stays prose, never guessed at — the
// heuristics typeset half a phrase in a tip ("as ⟦x = −2⟧ or −3"). 'input'
// (a typed problem: the preview, the example buttons, the history list):
// see segmentInput.
export function segmentMathText(step, { mode = 'auto' } = {}) {
  if (mode === 'input') return segmentInput(step);
  if (mode === 'marked') {
    const s = String(step);
    const marked = hasMathMarkers(s) ? markedSegments(s) : null;
    return marked ? liftQuotes(marked) : [{ type: 'text', value: stripMathMarkers(s) }];
  }
  return liftQuotes(segmentRaw(step));
}

// A typed problem has no markers, and the heuristics want an equation-like
// signal, so "sin(pi/4)", "2*x + 1" and the x^3 in "derivative of x^3"
// stayed plain. Here English words are prose and everything between them
// is math: "integrate ⟦x^2⟧ from ⟦0⟧ to ⟦1⟧", "⟦sin(pi/4)⟧". A word is a
// letter run of three or more that is not a math name, or a short word
// such as "of"; single letters and "dx" are math.
const INPUT_MATH_WORDS = new Set(['cbrt', 'infinity', 'inf', 'theta']);
const SHORT_PROSE = new Set(['of', 'to', 'at', 'is', 'by', 'as', 'on', 'in', 'if', 'it', 'an', 'be', 'we', 'do', 'my', 'me', 'up']);
const isProseWord = (w) => {
  const l = w.toLowerCase();
  if (MATH_WORDS.has(w) || MATH_WORDS.has(l) || INPUT_MATH_WORDS.has(l)) return false;
  return w.length >= 3 || SHORT_PROSE.has(l);
};
function segmentInput(text) {
  const out = [];
  const push = (type, value) => {
    if (!value) return;
    const last = out[out.length - 1];
    if (last && last.type === 'text' && type === 'text') last.value += value;
    else out.push({ type, value });
  };
  let run = '';
  const flush = () => {
    // Spaces and punctuation at the edges of a run are prose ("solve for x: …").
    const m = run.match(/^([\s:,;.?!]*)([^]*?)([\s:,;.?!]*)$/);
    push('text', m[1]);
    push(/[0-9A-Za-zπθ∞∫√]/.test(m[2]) ? 'math' : 'text', m[2]);
    push('text', m[3]);
    run = '';
  };
  // ": " is prose too: "solve for ⟦x⟧: ⟦3x = 9⟧".
  for (const part of String(text).split(/([A-Za-z]+|:\s+)/)) {
    if (/^:\s+$/.test(part) || (/^[A-Za-z]+$/.test(part) && isProseWord(part))) {
      flush();
      push('text', part);
    } else {
      run += part;
    }
  }
  flush();
  return liftQuotes(out);
}

function segmentRaw(step) {
  let s = String(step);
  // Explicit markers (mathMarkers.js): typeset exactly what is marked.
  // Malformed markers (unbalanced, nested) are dropped and the heuristics
  // below get the plain text — never a half-typeset step.
  if (hasMathMarkers(s)) {
    const marked = markedSegments(s);
    if (marked) return marked;
    s = stripMathMarkers(s);
  }
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

  // "Let u = sin(x²) and w = eˣ." / "Then u′ = 2x·cos(x²) and w′ = eˣ.":
  // prose joined by connector words around several math clauses. Split at
  // the connectors and typeset each clause that is math on its own; a step
  // with no such clause stays one text segment, as before.
  const clauses = splitClauses(s);
  if (clauses.some((c) => c.type === 'math')) return clauses;

  return [{ type: 'text', value: s }];
}

// "Let ⟦u = x^2⟧ (the inside)." → text, math, text. Null when the markers
// do not pair up (an open without a close, a close without an open, or one
// open inside another).
function markedSegments(s) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    const open = s.indexOf(MATH_OPEN, i);
    const stray = s.indexOf(MATH_CLOSE, i);
    if (open === -1) {
      if (stray !== -1) return null;
      out.push({ type: 'text', value: s.slice(i) });
      break;
    }
    if (stray !== -1 && stray < open) return null;
    const close = s.indexOf(MATH_CLOSE, open + 1);
    if (close === -1) return null;
    const inner = s.slice(open + 1, close);
    if (inner.includes(MATH_OPEN)) return null;
    if (open > i) out.push({ type: 'text', value: s.slice(i, open) });
    if (inner.trim()) out.push({ type: 'math', value: inner.trim() });
    i = close + 1;
  }
  return out.filter((seg) => seg.value !== '');
}

// Connector words and punctuation that separate clauses. A comma is not
// one: "x = 1, 3" is a single list.
const CONNECTOR = /(\s*\b(?:Let|Then|So|and|so|or|where|with|gives|is|are|if|when|since|because|but|while|for|at|from|to|into|as|not)\b\s*|;\s+|\s+[—–]\s+|:\s+)/;

const balanced = (s) => {
  let depth = 0;
  for (const ch of s) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0;
};

function splitClauses(s) {
  const out = [];
  let text = '';
  for (const piece of s.split(CONNECTOR)) {
    if (piece === undefined || piece === '') continue;
    // A tick or cross and the sentence's full stop stay prose.
    const trailing = piece.match(/(?:\s*[✓✗✔✘])?[.?!]*\s*$/)?.[0] ?? '';
    const core = trailing ? piece.slice(0, -trailing.length) : piece;
    if (core.trim() && isMathFragment(core) && balanced(core) && !CONNECTOR.test(core)) {
      if (text) out.push({ type: 'text', value: text });
      text = '';
      out.push({ type: 'math', value: core.trim() });
      if (trailing) text += trailing;
    } else {
      text += piece;
    }
  }
  if (text) out.push({ type: 'text', value: text });
  return out;
}
