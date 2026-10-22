// Plain-English maths → notation, before anything else reads the problem.
//
// The notation guide promises "Type it as you would say it", and students
// do: "x squared", "e to the x", "square root of x", "2x + 1 is greater than
// 5", "sine of x", "x**3", "two x plus five equals eleven". Until 1.52.2, 7 of 56 such phrasings solved; the
// rest were parse errors ("squared" is not a known function) and three were
// confidently wrong (the integral path read "squared" as a constant).
//
// solveProblem runs this first, so routing sees the notation ("equals"
// becomes =, which makes it an equation), and the input preview runs it too,
// so the student sees how the words were read before pressing Solve.
//
// "of" takes ONE term: "square root of x + 1" is √x + 1, as "sin x + 1" is
// sin(x) + 1. A longer argument goes in parentheses, and the preview shows
// the reading either way. This module has no dependencies on purpose: it is
// imported by the input preview, and must not pull a maths library onto the
// page (see "Page weight" in CLAUDE.md).

// One term: a parenthesised group (one level of nesting), or a signed
// number and/or a single-letter variable, with an optional power.
const PAREN = String.raw`\((?:[^()]|\([^()]*\))*\)`;
const ATOM = String.raw`(?:${PAREN}|-?(?:\d+(?:\.\d+)?)?(?:[a-z]|pi)?(?![a-z]))`;
const TERM = String.raw`(?:${ATOM}(?:\^(?:-?\d+(?:\.\d+)?|[a-z]|${PAREN}))?)`;

const FUNCTION_NAMES = {
  'natural logarithm': 'ln', 'natural log': 'ln', logarithm: 'log',
  'square root': 'sqrt', 'cube root': 'cbrt', 'absolute value': 'abs',
  sine: 'sin', cosine: 'cos', tangent: 'tan', secant: 'sec', cosecant: 'csc', cotangent: 'cot',
};
const FUNCTIONS = 'sin|cos|tan|sec|csc|cot|ln|log|sqrt|cbrt|abs|exp|arcsin|arccos|arctan';
const ORDINALS = { second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10 };

// An exponent as written: wrap anything longer than one number or letter.
const exponent = (raw) => {
  const e = raw.trim().replace(/^(\d+)(?:st|nd|rd|th)$/i, '$1');
  const word = ORDINALS[e.toLowerCase()];
  if (word) return `^${word}`;
  return /^(?:-?\d+(?:\.\d+)?|[a-z])$/i.test(e) || /^\(.*\)$/.test(e) ? `^${e}` : `^(${e})`;
};

const nonEmpty = (t) => t && t.trim().length > 0;

// Numbers written as words: "two plus one", "twenty-one", "one hundred and
// five", "two point five", "one half", "three quarters of twelve", "two x".
// Cardinals only: ordinals ("second derivative", "to the third power") keep
// their own meaning, and "one-sided" / "one-to-one" are left alone.
const UNITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const TEENS = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALES = { hundred: 100, thousand: 1000, million: 1e6 };
const DENOMINATORS = { half: 2, halves: 2, third: 3, thirds: 3, quarter: 4, quarters: 4, fourth: 4, fourths: 4, fifth: 5, fifths: 5, sixth: 6, sixths: 6, eighth: 8, eighths: 8, tenth: 10, tenths: 10 };
const NUMBER_WORD = `(?:${[...UNITS, ...TEENS, ...Object.keys(TENS), ...Object.keys(SCALES)].join('|')})`;
const NUMBER_RUN = new RegExp(
  // "and" joins only after a scale word ("one hundred and five"); elsewhere
  // it is the conjunction ("add two and three").
  `\\b${NUMBER_WORD}(?![\\s-]+(?:sided|side|to[\\s-]+one)\\b)(?:[\\s-]+(?:${NUMBER_WORD}|point(?=[\\s-]+(?:${UNITS.join('|')})\\b))|(?<=hundred|thousand|million)[\\s-]+and(?=[\\s-]+${NUMBER_WORD}))*\\b`,
  'gi'
);

const wordValue = (w) => {
  const u = UNITS.indexOf(w);
  if (u >= 0) return { kind: 'unit', value: u };
  const t = TEENS.indexOf(w);
  if (t >= 0) return { kind: 'teen', value: 10 + t };
  if (TENS[w]) return { kind: 'tens', value: TENS[w] };
  return { kind: 'scale', value: SCALES[w] };
};

// A run of number words → the numbers it spells, in order. Words that do not
// continue the number in progress ("two three") start a new one.
function spellNumbers(words) {
  const out = [];
  let total = 0;
  let current = 0;
  let last = null; // the kind of the previous word in this number, or null
  let decimals = null;
  const flush = () => {
    if (last !== null) out.push(String(total + current) + (decimals ? `.${decimals}` : ''));
    total = 0; current = 0; last = null; decimals = null;
  };
  for (let i = 0; i < words.length; i += 1) {
    const w = words[i];
    if (w === 'and') { last = 'and'; continue; }
    if (w === 'point') { decimals = ''; continue; }
    const { kind, value } = wordValue(w);
    if (decimals !== null) {
      if (kind === 'unit') { decimals += String(value); continue; }
      flush();
    }
    const fits =
      last === null ? kind !== 'scale'
        : kind === 'unit' ? last === 'tens' || last === 'scale' || last === 'and'
          : kind === 'teen' || kind === 'tens' ? last === 'scale' || last === 'and'
            : last !== 'scale' && last !== 'and';
    if (!fits) flush();
    if (kind === 'scale') {
      if (last === null) current = 1;
      if (value === 100) current *= 100;
      else { total += current * value; current = 0; }
    } else {
      current += value;
    }
    last = kind;
  }
  flush();
  return out;
}

function readNumberWords(input) {
  let s = input.replace(NUMBER_RUN, (run, offset, whole) => {
    const numbers = spellNumbers(run.toLowerCase().split(/[\s-]+/)).join(' ');
    // "two x" is 2x: a single-letter variable right after a number spelled
    // in words joins it. (Typed "2 x" is left to the solver's own rules.)
    const variable = whole.slice(offset + run.length).match(/^\s+[a-z](?![a-z(])/i);
    return variable ? `${numbers}\u0000` : numbers;
  });
  s = s.replace(/\u0000\s+/g, '');
  // Fractions: "one half", "two thirds", "a quarter" → (1/2), (2/3), (1/4).
  s = s.replace(new RegExp(`\\b(\\d+|an?)\\s+(${Object.keys(DENOMINATORS).join('|')})\\b`, 'gi'), (m, n, d) => {
    const num = /^an?$/i.test(n) ? 1 : Number(n);
    return `(${num}/${DENOMINATORS[d.toLowerCase()]})`;
  });
  // "(3/4) of 12" → (3/4)*12.
  return s.replace(/(\(\d+\/\d+\))\s+of\s+/g, '$1*');
}

export function readPlainEnglish(input) {
  let s = readNumberWords(String(input));

  // Programming-style power: x**3.
  s = s.replace(/\*\*/g, '^');

  // Spelled-out function names (whole words only: "tangent line" stays).
  for (const [words, fn] of Object.entries(FUNCTION_NAMES)) {
    s = s.replace(new RegExp(`\\b(?:the\\s+)?${words.replace(' ', '\\s+')}(?=\\s+of\\b|\\s*\\()`, 'gi'), fn);
  }
  // "log base 2 of 8" → log(8, 2).
  s = s.replace(new RegExp(`\\blog\\s+base\\s+(\\d+(?:\\.\\d+)?|e)\\s+of\\s+(${TERM})`, 'gi'),
    (m, base, arg) => (nonEmpty(arg) ? `log(${arg}, ${base})` : m));
  // "sin squared x", "sin squared of x" → sin(x)^2.
  s = s.replace(new RegExp(`\\b(${FUNCTIONS})\\s+squared\\s+(?:of\\s+)?(${TERM})`, 'gi'),
    (m, fn, arg) => (nonEmpty(arg) ? `${fn}(${arg})^2` : m));

  // Powers. "to the power of n", "raised to (the power of) n", "to the nth
  // power", "to the n" — n a term or an ordinal word.
  // A fraction is one exponent: "to the power of 1/2" is x^(1/2), not x^1/2.
  const N = String.raw`(\d+(?:st|nd|rd|th)|${Object.keys(ORDINALS).join('|')}|-?\d+\/\d+|${TERM})`;
  s = s
    .replace(new RegExp(`\\s+(?:raised\\s+)?to\\s+the\\s+power\\s+of\\s+${N}`, 'gi'), (m, n) => (nonEmpty(n) ? exponent(n) : m))
    .replace(new RegExp(`\\s+raised\\s+to\\s+(?:the\\s+)?${N}(?:\\s+power)?`, 'gi'), (m, n) => (nonEmpty(n) ? exponent(n) : m))
    .replace(new RegExp(`\\s+to\\s+the\\s+${N}(?:\\s+power)?(?![a-z])`, 'gi'), (m, n) => (nonEmpty(n) ? exponent(n) : m))
    .replace(/\s+squared\b/gi, '^2')
    .replace(/\s+cubed\b/gi, '^3');

  // "sin of x", "ln of x", "sqrt of 16" → sin(x), ln(x), sqrt(16). After
  // the powers, so a power binds to its term first: "ln of x squared" is
  // ln(x^2), as written. ("sin squared x", above, is sin(x)^2.)
  s = s.replace(new RegExp(`\\b(${FUNCTIONS})\\s+of\\s+(${TERM})`, 'gi'),
    (m, fn, arg) => (!nonEmpty(arg) ? m : new RegExp(`^${PAREN}$`).test(arg) ? `${fn}${arg}` : `${fn}(${arg})`));

  // Relations, longest phrases first. "is" alone is left alone ("what is").
  s = s
    .replace(/\s+(?:is\s+)?greater\s+than\s+or\s+equal\s+to\s+/gi, ' >= ')
    .replace(/\s+(?:is\s+)?less\s+than\s+or\s+equal\s+to\s+/gi, ' <= ')
    .replace(/\s+is\s+at\s+least\s+/gi, ' >= ')
    .replace(/\s+is\s+at\s+most\s+/gi, ' <= ')
    .replace(/\s+(?:is\s+)?(?:greater|more)\s+than\s+/gi, ' > ')
    .replace(/\s+(?:is\s+)?less\s+than\s+/gi, ' < ')
    .replace(/\s+(?:is\s+)?equal\s+to\s+|\s+equals\s+/gi, ' = ');

  // "x over 2" → x / 2 — but not "integrate over the interval".
  s = s.replace(/(?<=[\w)])\s+over\s+(?!(?:the|a|an|interval|from)\b|\[)(?=[\w(-])/gi, ' / ');
  // "negative 3" → -3; "20 percent of 50" → 20% of 50; "half of 10" → (1/2)*10.
  s = s
    .replace(/\bnegative\s+(?=[\w(])/gi, '-')
    .replace(/(\d)\s*percent\b/gi, '$1%')
    .replace(/\bhalf\s+of\s+/gi, '(1/2)*');

  return s;
}
