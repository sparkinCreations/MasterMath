// What is wrong with the typing, said in words.
//
// Run once on the problem text before any solver, so that every topic refuses
// malformed input the same way. Until October 2026 each path did its own
// checking, and what one path refused another answered: "2+3)" integrated to
// 5x + C, "sin()" to sin(nil)·x + C, "2..5" differentiated to 0, "x^2 +" was
// echoed back as the answer under Trigonometry, "2 # 3" was 2 (mathjs reads #
// as a comment) — all marked Solved. Where a path did refuse, the parser's own
// message reached the page: "Value expected (char 3)", "2+* ? Stop: syntax
// error", "Colon : expected after object key".
//
// `syntaxProblem` finds the first thing wrong — an operator with nothing on one
// side of it, two in a row, empty or unbalanced brackets, a symbol that is not
// maths — and says it in words, with the typed characters quoted. It knows
// nothing about words: unknown names ("foo", "apples") are the routing's to
// refuse (`unknownWord` in api.js). `plainSyntaxHint` rewrites an engine's
// message for the cases the scan does not see, so that the raw text never
// reaches the page. No imports: the input preview may use this one day.

// Grouping braces are LaTeX habit in a subscript or superscript — lim_{x->0},
// ∫_{0}^{1} — and the solvers read them. Anywhere else they are not maths.
const ALLOWED_BRACES = /([_^])\s*\{[^{}]*\}/g;

const SYMBOL_HINTS = {
  '$': '"$" is not a math symbol.',
  '#': '"#" is not a math symbol.',
  '@': '"@" is not a math symbol.',
  '&': '"&" is not a math symbol. Between two inequalities, write "and".',
  '~': '"~" is not a math symbol. For "approximately", just type the expression.',
  '`': '"`" is not a math symbol.',
  '"': 'Quotation marks are not part of the maths — type the expression without them.',
  '{': 'Curly braces are not used here — group with parentheses: (x + 1)^2.',
  '}': 'Curly braces are not used here — group with parentheses: (x + 1)^2.',
  '\\': 'A backslash is not a math symbol. Type the maths directly: sqrt(x), x^2, 1/2.',
};

const OPERATOR_TIP = 'Every operator needs a value on each side of it, as in "2*x + 1".';
const PAREN_TIP = 'Every "(" needs a matching ")": "sin(x)", "(x + 1)^2".';

const result = (hint, tips) => ({ hint, tips: tips ? [tips] : [] });

// A known function name with nothing inside its parentheses.
const FUNCTION_NAMES = 'sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|asin|acos|atan|sinh|cosh|tanh|sqrt|cbrt|abs|ln|log|exp';

export function syntaxProblem(text) {
  let s = String(text ?? '');
  if (!s.trim()) return null;

  // Sentence punctuation at the end is not part of the maths.
  s = s.replace(/[?.]+\s*$/, '');

  // Characters that are not maths, before anything else: the scan below
  // reads only operators and brackets.
  const withoutBraces = s.replace(ALLOWED_BRACES, '$1');
  for (const ch of withoutBraces) {
    if (SYMBOL_HINTS[ch]) return result(SYMBOL_HINTS[ch]);
  }

  if (/==/.test(s)) return result('Use a single "=" for an equation: "x = 2".');
  if (/:=/.test(s)) return result('Use "=" alone for an equation: "x = 2".');
  // "3:4" reaches the engine as a range. A ratio is a fraction.
  if (/[\d)]\s*:\s*[\d(]/.test(s)) return result('A ratio such as "3:4" is the fraction 3/4 — type it that way.');
  // ";" separates the equations of a system; without an "=" there is none.
  if (/;/.test(s) && !/[=<>≤≥]/.test(s)) return result('";" separates the equations of a system, and there is no equation here. For one expression, leave it out.');
  if (/\.\.|\d\.\d*\.\d/.test(s)) return result('Two decimal points in one number — a number has one, as in "2.5".');
  if (/,\s*,/.test(s)) return result('Two commas in a row — something is missing between them.');
  if (/!\s*!/.test(s)) return result('The double factorial "n!!" is not supported. "5!" is 5·4·3·2·1 = 120; for 5!! = 5·3·1, type "5*3*1".');

  // Brackets.
  const count = (re) => (s.match(re) || []).length;
  const opens = count(/\(/g);
  const closes = count(/\)/g);
  if (opens !== closes) {
    return result(`Unbalanced parentheses: ${opens} opening "(" and ${closes} closing ")".`, PAREN_TIP);
  }
  const squareOpens = count(/\[/g);
  const squareCloses = count(/\]/g);
  if (squareOpens !== squareCloses) {
    return result(`Unbalanced brackets: ${squareOpens} opening "[" and ${squareCloses} closing "]".`);
  }
  if (count(/\|/g) % 2 === 1) return result('An absolute value needs a bar on each side: |x - 3|.');
  if (/\|\s*\|/.test(s)) return result('Empty absolute value bars "| |" — put an expression between them.');
  const emptyCall = s.match(new RegExp(`(?<![a-z])(${FUNCTION_NAMES})\\s*\\(\\s*\\)`, 'i'));
  if (emptyCall) {
    const fn = emptyCall[1].toLowerCase();
    return result(`"${fn}()" has nothing inside it — ${fn} needs an argument: "${fn}(x)", "${fn}(30)".`);
  }
  if (/\(\s*\)/.test(s)) return result('Empty parentheses "()" — put an expression inside them, or leave them out.');

  return operatorProblem(s);
}

// The operators, read one character at a time with the spaces gone. Binary
// operators (* / ^) need a value on each side; a sign (+ −) may open a
// value (−3, 2*−3, e^−x) but needs one after it; a comparison (= < > ≤ ≥ ≠)
// needs an expression on each side and never follows another.
function operatorProblem(text) {
  const t = text
    .replace(/[−–]/g, '-').replace(/[×·⋅]/g, '*').replace(/÷/g, '/')
    .replace(/<=/g, '≤').replace(/>=/g, '≥').replace(/!=/g, '≠')
    .replace(/->|=>|→/g, '→')
    // A one-sided limit's sign after the approach value: "x→0+", "x -> 0-".
    .replace(/(→\s*-?[\w.∞]+)\s*[+-](?=\s|$|[),])/g, '$1')
    .replace(/\s+/g, '');
  const BINARY = '*/^';
  const SIGN = '+-';
  const COMPARE = '=<>≤≥≠';
  const shown = (ch) => ({ '*': '*', '/': '/', '^': '^', '+': '+', '-': '−', '=': '=', '<': '<', '>': '>', '≤': '≤', '≥': '≥', '≠': '≠' }[ch] || ch);
  const twoSided = (ch) => (COMPARE.includes(ch)
    ? result(ch === '=' ? 'An equation needs an expression on both sides of "=".' : `An inequality needs an expression on both sides of "${shown(ch)}".`)
    : null);

  for (let i = 0; i < t.length; i += 1) {
    const ch = t[i];
    const isBinary = BINARY.includes(ch);
    const isSign = SIGN.includes(ch);
    const isCompare = COMPARE.includes(ch);
    if (!isBinary && !isSign && !isCompare) continue;
    const prev = t[i - 1];
    const next = t[i + 1];
    const prevIsOperator = prev !== undefined && (BINARY + SIGN + COMPARE).includes(prev);

    if (isBinary) {
      if (prev === undefined) return result(`The input starts with "${shown(ch)}" — something is missing before it.`, OPERATOR_TIP);
      if ('([,;'.includes(prev)) return result(`"${prev}${shown(ch)}" — the "${shown(ch)}" has nothing before it.`, OPERATOR_TIP);
      if (prevIsOperator) return result(`"${shown(prev)}${shown(ch)}" — two operators in a row. Put a value between them, or remove one.`, OPERATOR_TIP);
    }
    if (isCompare) {
      if (prev === undefined || next === undefined) return twoSided(ch);
      if (COMPARE.includes(prev)) {
        return result(prev === ch
          ? `Two "${shown(ch)}" signs in a row — one goes between the two sides.`
          : `"${shown(prev)} ${shown(ch)}" — two comparison signs in a row.`);
      }
    }
    if (next === undefined) {
      return result(`The input ends with "${shown(ch)}" — something is missing after it.`, OPERATOR_TIP);
    }
    if (')]'.includes(next)) return result(`"${shown(ch)}${next}" — the "${shown(ch)}" has nothing after it inside the brackets.`, OPERATOR_TIP);
    if (',;'.includes(next)) return result(`"${shown(ch)}${next}" — the "${shown(ch)}" has nothing after it.`, OPERATOR_TIP);
    if (!isCompare && COMPARE.includes(next)) return result(`"${shown(ch)} ${shown(next)}" — the "${shown(ch)}" has nothing after it.`, OPERATOR_TIP);
  }
  return null;
}

// Does a hint read like an engine's own message rather than words for a
// student? mathjs: "Value expected (char 3)", "Unexpected end of expression",
// "Undefined symbol foo"; Algebrite: "2+* ? \nStop: syntax error".
export function isEngineMessage(message) {
  const m = String(message ?? '');
  return /\(char \d+\)|Stop:|^Value expected|^Unexpected (?:end|part|operator|type|character)|^Undefined symbol|^Parenthesis|^End of matrix|^Colon :|^Syntax error in part|^Unable to extract|^Cannot |^Unexpected /.test(m);
}

// An engine message in words. The scan runs first, since it knows what was
// typed; the rewrites below cover what it cannot see.
export function plainSyntaxHint(message, input) {
  const found = syntaxProblem(input);
  if (found) return found.hint;
  const m = String(message ?? '').replace(/\s*\(char \d+\)/, '').trim();
  const stop = m.match(/Stop:\s*(.+)$/);
  const core = stop ? stop[1].trim() : m;
  if (/^Undefined symbol\s+(\S+)/.test(core)) return `"${core.match(/^Undefined symbol\s+(\S+)/)[1]}" is not a known function, constant or variable.`;
  if (/^Value expected/.test(core)) return 'A value is missing: an operator has nothing to work on.';
  if (/^Unexpected end of expression/.test(core)) return 'The expression ends too soon — something is missing at the end.';
  if (/^Unexpected part\s+(.+)/.test(core)) return `${core.match(/^Unexpected part\s+(.+)/)[1]} does not fit where it is.`;
  if (/^Unexpected operator\s+(\S+)/.test(core)) return `The operator "${core.match(/^Unexpected operator\s+(\S+)/)[1]}" does not fit where it is.`;
  if (/^Parenthesis \) expected|^\) expected/.test(core)) return 'A closing ")" is missing.';
  if (/^End of matrix \] expected/.test(core)) return 'A closing "]" is missing.';
  if (/^Syntax error in part\s+(.+)/.test(core)) return `${core.match(/^Syntax error in part\s+(.+)/)[1]} could not be read.`;
  if (/^Unable to extract/.test(core)) return 'No expression was found in the input.';
  if (/^Unexpected type of argument/.test(core)) return 'A function name is used without an argument in parentheses.';
  if (/^syntax error/i.test(core)) return 'The expression could not be read: check the operators and brackets.';
  return 'The input could not be read as a math expression.';
}
