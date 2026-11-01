// Tips and mistakes for trigonometry: values, identities and equations,
// chosen by the method used, ranked, with a worked "Here: …" line second:
// the method's first insight applied to this problem (1.65.0, after
// integrals, derivatives, algebra, limits and functions).

import { mark, stripMathMarkers, beautify } from '../solverUtils.js';

const dedupe = (list) => [...new Set(list.filter(Boolean))];

// The same point said twice in other words ("Squaring both sides … — that
// introduces" and "… : that introduces"): most of the words shared.
const words = (t) => new Set(stripMathMarkers(t).toLowerCase().replace(/[^a-z0-9π²√±]+/g, ' ').split(' ').filter((w) => w.length > 2));
function distinct(list) {
  const kept = [];
  for (const item of list.filter(Boolean)) {
    const w = words(item);
    const same = kept.some((k) => {
      const v = words(k);
      const shared = [...w].filter((x) => v.has(x)).length;
      return shared / Math.min(w.size, v.size) > 0.6;
    });
    if (!same) kept.push(item);
  }
  return kept;
}
const assemble = (tips, here, mistakes) => ({ tips: dedupe([tips[0], here, ...tips.slice(1)]), common_mistakes: dedupe(mistakes) });

// --- Values -------------------------------------------------------------------

// The angle in degrees, its reference angle and quadrant, for a special angle
// typed in radians with π or in degrees.
function angleFacts(argText, treatAsDegrees) {
  const radians = evaluateAngle(String(argText).replace(/°/g, '').replace(/π/g, 'pi'));
  if (!Number.isFinite(radians)) return null;
  const degrees = treatAsDegrees ? radians : (radians * 180) / Math.PI;
  const whole = Math.round(degrees);
  if (Math.abs(degrees - whole) > 1e-9) return null;
  const d = ((whole % 360) + 360) % 360;
  const quadrant = d < 90 ? 1 : d < 180 ? 2 : d < 270 ? 3 : 4;
  const reference = d <= 90 ? d : d <= 180 ? 180 - d : d <= 270 ? d - 180 : 360 - d;
  return { degrees: whole, standard: d, quadrant, reference, onAxis: d % 90 === 0 };
}

// "5pi/6", "-pi/4", "2*pi/3", "150": a number times π over a number.
function evaluateAngle(text) {
  const t = text.replace(/\s+/g, '').replace(/\*/g, '');
  const m = t.match(/^(-?)(\d*(?:\.\d+)?)(pi)?(?:\/(\d+(?:\.\d+)?))?$/);
  if (!m) return NaN;
  const coefficient = m[2] === '' ? 1 : Number(m[2]);
  const value = (m[1] ? -1 : 1) * coefficient * (m[3] ? Math.PI : 1) / (m[4] ? Number(m[4]) : 1);
  return value;
}

const SIGNS = { sin: [1, 1, -1, -1], cos: [1, -1, -1, 1], tan: [1, -1, 1, -1], csc: [1, 1, -1, -1], sec: [1, -1, -1, 1], cot: [1, -1, 1, -1] };
const QUADRANT = ['', 'I', 'II', 'III', 'IV'];

export function valueGuidance(expression, steps, answer) {
  const text = stripMathMarkers(steps.join('\n'));
  const call = String(expression).match(/(?<![a-z])(arcsin|arccos|arctan|asin|acos|atan|sin|cos|tan|sec|csc|cot)\s*\(((?:[^()]|\([^()]*\))*)\)/i);
  const fn = call?.[1]?.toLowerCase();
  const arg = call?.[2] ?? '';
  const exactAnswer = String(answer).replace(/\s*\(≈[^)]*\)$/, '');
  const approximate = /^≈/.test(String(answer));
  // Read as degrees: a ° typed, or the steps say the input was taken as degrees.
  const asDegrees = /°/.test(expression) || /Detected input as degrees|Angle unit is set to degrees/.test(text);
  const unitNote = /degrees|radians/.test(text) && !/pi|π/i.test(expression);

  if (/^a?(?:arc)?(sin|cos|tan)$/.test(fn || '') && /^a|^arc/.test(fn)) {
    const base = fn.replace(/^a(?!rc)/, 'arc');
    const range = base === 'arccos' ? '[0, π]' : base === 'arcsin' ? '[−π/2, π/2]' : '(−π/2, π/2)';
    const what = { arcsin: 'sine', arccos: 'cosine', arctan: 'tangent' }[base];
    const tips = [
      `An inverse trig function returns an ANGLE: ${mark(`${base}(c)`)} is the one angle in ${mark(range)} whose ${what} is ${mark('c')}, the principal value.`,
      `arcsin and arccos only accept inputs in ${mark('[−1, 1]')}; arctan accepts any real number.`,
      `The principal ranges are chosen so each inverse is a function: arcsin and arctan return angles in quadrants I and IV, arccos in I and II.`,
      `${mark('sin(arcsin(c)) = c')} for every allowed ${mark('c')}, but ${mark('arcsin(sin(θ)) = θ')} only for ${mark('θ')} in ${mark('[−π/2, π/2]')}: ${mark('arcsin(sin(3π/4)) = π/4')}.`,
    ];
    const here = approximate
      ? `Here: ${mark(`${base}(${beautify(arg)})`)} is not one of the special values, so the angle is ${mark(String(answer).replace(/^≈\s*/, '≈ '))}.`
      : `Here: ${mark(`${base}(${beautify(arg)})`)} asks for the angle in ${mark(range)} whose ${what} is ${mark(beautify(arg))}: ${mark(exactAnswer)}.`;
    return assemble(tips, here, [
      `Reading ${mark('arcsin(x)')} as ${mark('1/sin(x)')}: that is ${mark('csc(x)')}, a different function.`,
      'Reporting an angle outside the principal range, or in the wrong unit.',
      `Taking ${mark('arcsin(sin(θ)) = θ')} for every ${mark('θ')}: it holds only on the principal range.`,
    ]);
  }

  if (!fn) return { tips: [], common_mistakes: [] };
  const facts = arg ? angleFacts(arg, /°/.test(arg) || (asDegrees && !/pi/i.test(arg))) : null;
  const special = facts && !approximate;
  const reciprocal = ['sec', 'csc', 'cot'].includes(fn);
  const tips = [];
  if (fn === 'tan') tips.push(`${mark('tan = sin/cos')}, so tan is undefined wherever ${mark('cos = 0')} (${mark('90°')}, ${mark('270°')}, …) and its period is ${mark('180°')}, not ${mark('360°')}.`);
  else if (reciprocal) tips.push(`${fn} is a reciprocal: ${mark('sec = 1/cos')}, ${mark('csc = 1/sin')}, ${mark('cot = cos/sin')}, undefined wherever the function below it is ${mark('0')}. Find the sine or cosine first, then take the reciprocal.`);
  else if (special && facts.standard !== facts.reference) tips.push(`A special angle has an exact value: reduce it to its reference angle in ${mark('[0°, 90°]')}, read the value from ${mark('0°, 30°, 45°, 60°, 90°')}, and give it the sign of the quadrant.`);
  else tips.push(fn === 'cos'
    ? `Remember: ${mark('cos(0°) = 1')}, ${mark('cos(30°) = √3/2')}, ${mark('cos(45°) = √2/2')}, ${mark('cos(60°) = 1/2')}, ${mark('cos(90°) = 0')}.`
    : `Remember: ${mark('sin(0°) = 0')}, ${mark('sin(30°) = 1/2')}, ${mark('sin(45°) = √2/2')}, ${mark('sin(60°) = √3/2')}, ${mark('sin(90°) = 1')}.`);
  tips.push(`The signs by quadrant ("All Students Take Calculus"): all positive in I, sine in II, tangent in III, cosine in IV.`);
  if (special && facts.standard === facts.reference && !['tan', 'sec', 'csc', 'cot'].includes(fn)) tips.push(`Beyond ${mark('90°')}, reduce to the reference angle in ${mark('[0°, 90°]')} and give the value the sign of the quadrant: ${mark('sin(150°) = sin(30°) = 1/2')}, ${mark('cos(150°) = −cos(30°)')}.`);
  tips.push(fn === 'tan' || reciprocal ? `Key identities: ${mark('1 + tan²(x) = sec²(x)')} and ${mark('1 + cot²(x) = csc²(x)')}.` : `Key identity: ${mark('sin²(x) + cos²(x) = 1')}; and sin and cos are cofunctions, ${mark('sin(θ) = cos(90° − θ)')}.`);
  if (unitNote) tips.push(`${mark('π')} radians = ${mark('180°')}: multiply degrees by ${mark('π/180')} to get radians. Write "pi" for ${mark('π')} ("sin(pi/6)") or set the angle unit in Settings.`);
  if (approximate) tips.splice(1, 0, `The familiar special angles (multiples of ${mark('30°')} and ${mark('45°')}) have exact values from the table, and others have exact forms too (${mark('sin(15°) = (√6 − √2)/4')}, ${mark('sin(22.5°) = √(2 − √2)/2')}). When no simpler form is found, the value is shown as a decimal with ${mark('≈')}; ${mark('sin(1)')} itself is still an exact number.`);

  let here = null;
  if (special && facts) {
    const sign = SIGNS[fn]?.[facts.quadrant - 1] ?? 1;
    const angle = /pi|π/i.test(arg) ? `${beautify(arg).replace(/pi/g, 'π')} = ${facts.degrees}°` : `${facts.degrees}°`;
    here = facts.onAxis || facts.standard === facts.reference
      ? `Here: ${mark(angle)}${facts.onAxis ? ', on an axis' : ', a special angle'}, so ${mark(`${fn}(${facts.degrees}°) = ${exactAnswer}`)}.`
      : `Here: ${mark(angle)} is in quadrant ${QUADRANT[facts.quadrant]} with reference angle ${mark(`${facts.reference}°`)}; ${fn} is ${sign > 0 ? 'positive' : 'negative'} there, so ${mark(`${fn}(${facts.degrees}°) = ${sign > 0 ? '' : '−'}${fn}(${facts.reference}°) = ${exactAnswer}`)}.`;
  } else if (approximate) {
    here = `Here: ${mark(`${fn}(${beautify(arg)})`)} is not a special angle${!/pi|π|°/.test(arg) && !asDegrees ? ` (${mark(beautify(arg))} ${Number(arg) === 1 ? 'radian' : 'radians'} is about ${mark(`${Math.round((Number(arg) * 1800) / Math.PI) / 10}°`)})` : ''}, so its value is a decimal: ${mark(String(answer))}.`.replace(/\(NaN°\)|about NaN°/g, '');
  }

  // A degree-looking angle read as radians: sin(30) with the unit on
  // Radians is −0.988; that leads, because it explains the surprise.
  const n = Number(arg);
  // Auto read a bare common angle as degrees: say so first.
  if (/Detected input as degrees/.test(text) && !/°/.test(expression)) {
    tips.unshift(`The angle unit is on Auto, so a bare common angle such as ${mark(String(n))} is read as degrees (${mark(`${n}°`)}); in radians, ${mark(`${fn}(${n})`)} is a different number. Write ${mark(`${fn}(${n}°)`)} or ${mark(`${fn}(${n}π/180)`)} to be explicit, or set the angle unit in Settings.`);
  }
  const radiansSurprise = Number.isInteger(n) && n !== 0 && n % 15 === 0 && /treated as -?\d+ radians|Interpreting -?\d+ as radians/.test(text);
  if (radiansSurprise) {
    tips.unshift(`Here ${mark(`${fn}(${n})`)} is ${mark(String(n))} radians (about ${mark(`${Math.round((n * 1800) / Math.PI) / 10}°`)}), not ${mark(`${n}°`)} — which is why the answer is not the value of ${mark(`${fn}(${n}°)`)}. For degrees, write ${mark(`${fn}(${n}°)`)} or set the angle unit to Degrees in Settings.`);
    here = null;
  }

  const mistakes = [];
  if (unitNote) mistakes.push(`Mixing up radians and degrees — ${mark('sin(30)')} in radians is ${mark('−0.988')}, not ${mark('1/2')}.`);
  if (fn === 'tan' || reciprocal) {
    const undefinedAt = { tan: 'tan(90°)', sec: 'sec(90°)', csc: 'csc(0°)', cot: 'cot(0°)' }[fn];
    const because = { tan: 'cos(90°) = 0', sec: 'cos(90°) = 0', csc: 'sin(0°) = 0', cot: 'sin(0°) = 0' }[fn];
    mistakes.push(`Forgetting that ${mark(undefinedAt)} is undefined (${mark(because)}) — a calculator shows a huge number, not the truth.`);
  }
  if (fn === 'tan') mistakes.push(`Using ${mark('360°')} as the period of tan (it repeats every ${mark('180°')}).`);
  else if (reciprocal) mistakes.push({ sec: `Confusing sec with ${mark('1/sin')} (${mark('sec = 1/cos')}).`, csc: `Confusing csc with ${mark('1/cos')} (${mark('csc = 1/sin')}).`, cot: `Reading cot as ${mark('1/sin')} or ${mark('1/cos')}: ${mark('cot = cos/sin = 1/tan')}.` }[fn], `Taking ${mark(fn)} as an inverse: ${mark('sec(x) = 1/cos(x)')}, not ${mark('arccos(x)')}.`);
  else mistakes.push(`Confusing sin and cos values for complementary angles (${mark('sin 30° = cos 60°')}).`);
  mistakes.push(`Giving the reference angle's value without the quadrant's sign: ${mark('sin(210°)')} is ${mark('−1/2')}, not ${mark('1/2')}.`);
  if (special) mistakes.push('Giving a decimal where the exact value is expected: special angles have exact values.');
  return assemble(tips, here, mistakes);
}

// --- Identities ---------------------------------------------------------------

export function identityGuidance(display, result, lost, identityUsed) {
  const name = stripMathMarkers(identityUsed || '');
  const generic = !name || /^trigonometric identities$/.test(name);
  const tips = [
    /double-angle/.test(name)
      ? `Double angle: ${mark('sin(2x) = 2·sin(x)·cos(x)')} and ${mark('cos(2x) = cos²(x) − sin²(x) = 1 − 2sin²(x) = 2cos²(x) − 1')}: read them both ways.`
      : /quotient/.test(name)
        ? `Quotient identities: ${mark('tan(x) = sin(x)/cos(x)')}, ${mark('cot(x) = cos(x)/sin(x)')}, defined where the bottom is not ${mark('0')}.`
        : `Pythagorean identity: ${mark('sin²(x) + cos²(x) = 1')}, and its ${mark('÷cos²')} and ${mark('÷sin²')} forms, ${mark('1 + tan²(x) = sec²(x)')} and ${mark('1 + cot²(x) = csc²(x)')}.`,
    'Rewriting tan, sec, csc and cot in terms of sin and cos often unlocks a simplification.',
    `An identity must hold for every angle where both sides are defined; checking a few values can only find a counterexample, never prove it. By hand, the usual proof is algebra: rewrite one side with the identities until it is the other.`,
    `Simplifying can change the domain: ${mark('tan(x)·cos(x) = sin(x)')} only where ${mark('cos(x) ≠ 0')}, so say where the result holds.`,
    `To prove one by hand, work on one side only, and keep going until it matches the other; never move terms across as in an equation.`,
  ];
  // A rewrite in sin and cos leads when no one identity was named.
  if (generic) tips.unshift(tips.splice(1, 1)[0]);
  const here = result && result !== display
    ? `Here: ${generic ? 'written in sin and cos, ' : ''}${mark(`${display} = ${result}`)}${generic ? '' : ` by the ${identityUsed}`}${lost ? `, for ${mark(lost.replace('= 0', '≠ 0'))}` : ''}.`
    : null;
  return assemble(tips, here, [
    `Cancelling across a sum: ${mark('sin(x)/x')} is not sin — only common factors cancel.`,
    `Dropping the argument: ${mark('sin² + cos²')} means nothing without the same angle inside both.`,
    `Writing ${mark('sin(2x) = 2sin(x)')}: the double-angle identity is ${mark('2·sin(x)·cos(x)')}.`,
    'Forgetting where the original is undefined after it simplifies.',
  ]);
}

// --- Equations ----------------------------------------------------------------

function equationMethod(text) {
  if (/never outside \[−1, 1\]|always lies between −1 and 1/.test(text)) return 'no solution';
  if (/is negative, so there is no real value of|lies in its range, so the equation has no real solution/.test(text)) return 'no solution: quadratic';
  if (/Combine them into one sine/.test(text)) return 'a sin + b cos';
  if (/two sines are equal|Two sines are equal|Two cosines are equal|Two tangents are equal|equal arguments|supplementary/i.test(text)) return 'equal functions';
  if (/is quadratic in/.test(text)) return 'quadratic';
  if (/double-angle identity sin\(2θ\) = 2 sin θ cos θ/.test(text)) return 'product';
  if (/Since (?:sec|csc|cot)\(θ\) = /.test(text)) return 'reciprocal';
  if (/solved numerically/.test(text)) return 'numeric';
  if (/inverse tangent/.test(text)) return 'tan';
  if (/only once per period/.test(text)) return 'once per period';
  if (/inverse sine|inverse cosine/.test(text)) return 'two per period';
  return 'general';
}

const EQUATION_LISTS = {
  'two per period': {
    tips: [
      `${mark('sin(θ) = c')} has two solutions in each period, ${mark('arcsin(c)')} and ${mark('π − arcsin(c)')}; ${mark('cos(θ) = c')} has ${mark('±arccos(c)')}. A calculator gives only the first.`,
      `With ${mark('kx')} inside, solve for ${mark('θ = kx')} first, then divide: for a nonzero integer ${mark('k')} there are ${mark('|k|')} times as many solutions in each ${mark('2π')}; for other ${mark('k')}, count the family members in the interval.`,
      'Check each solution in the original equation: a slip in the quadrant shows up at once.',
    ],
    mistakes: [
      `Dividing the period by ${mark('k')} but not the base angle (or the reverse).`,
    ],
  },
  'once per period': {
    tips: [
      `${mark('sin = ±1')} and ${mark('cos = ±1')} happen once per period, at the top or the bottom of the wave: one family of solutions, not two.`,
      `${mark('sin = 0')} and ${mark('cos = 0')} happen twice per period, half a period apart, so they too are one family, stepping by ${mark('π')}.`,
    ],
    mistakes: [],
  },
  tan: {
    tips: [
      `${mark('tan(θ) = c')} has one solution per period, ${mark('arctan(c)')}, and its period is ${mark('π')}: the general solution steps by ${mark('πn')}, not ${mark('2πn')}.`,
      `tan takes every real value, so ${mark('tan(θ) = c')} always has solutions; it is undefined where ${mark('cos(θ) = 0')}.`,
      `The general solution is ${mark('x = arctan(c) + πn')}, ${mark('n')} any integer: choose the values of ${mark('n')} that put ${mark('x')} in the interval asked for (${mark('tan(x) = −1')} gives ${mark('3π/4')} and ${mark('7π/4')} in ${mark('[0, 2π)')}, since ${mark('arctan(−1) = −π/4')} is outside it). For a nonzero integer ${mark('k')}, ${mark('tan(kx) = c')} has ${mark('2|k|')} solutions in ${mark('[0, 2π)')}.`,
    ],
    mistakes: [
      `Stepping by ${mark('2π')}: half of the solutions are lost.`,

    ],
  },
  reciprocal: {
    tips: [
      `A reciprocal turns into a basic equation when ${mark('c ≠ 0')}: ${mark('sec(θ) = c')} is ${mark('cos(θ) = 1/c')}, ${mark('csc(θ) = c')} is ${mark('sin(θ) = 1/c')}, ${mark('cot(θ) = c')} is ${mark('tan(θ) = 1/c')}.`,
      `For ${mark('c = 0')}: ${mark('cot(θ) = cos(θ)/sin(θ) = 0')} exactly where ${mark('cos(θ) = 0')}, so ${mark('θ = π/2 + πn')}; ${mark('sec(θ) = 0')} and ${mark('csc(θ) = 0')} have no solution.`,
      `${mark('sec')} and ${mark('csc')} are never strictly between ${mark('−1')} and ${mark('1')}: ${mark('sec(θ) = 1/2')} has no solution.`,
      'Then solve the basic equation as usual: both solutions per period, and the general solution.',
    ],
    mistakes: [
      `Inverting the wrong function: ${mark('sec')} is ${mark('1/cos')}, ${mark('csc')} is ${mark('1/sin')}.`,
      `Writing ${mark('sec(θ) = 2')} as ${mark('cos(θ) = 2')}: the value is inverted too.`,
    ],
  },
  quadratic: {
    tips: [
      `A quadratic in one trig function is solved like any quadratic: let ${mark('u = sin(x)')} (or cos, tan), solve for ${mark('u')}, then solve each ${mark('sin(x) = u')}.`,
      `Discard any ${mark('u')} outside ${mark('[−1, 1]')} for sine and cosine before looking for angles.`,
      `${mark('sin²(x) = 1 − cos²(x)')} turns a mix of ${mark('sin²')} and ${mark('cos')} into a quadratic in ${mark('cos')} alone.`,
      `Factor when you can: ${mark('2u² − u − 1 = (2u + 1)(u − 1)')}.`,
    ],
    mistakes: [
      `Dividing both sides by ${mark('sin(x)')} and losing the ${mark('sin(x) = 0')} solutions.`,
      `Solving for ${mark('u')} and reporting ${mark('u')} as the answer: the angle still has to be found.`,
      `Keeping a value such as ${mark('u = 2')}: ${mark('sin(x) = 2')} has no solution.`,
    ],
  },
  'a sin + b cos': {
    tips: [
      `${mark('a·sin θ + b·cos θ = R·sin(θ + φ)')} with ${mark('R = √(a² + b²)')}: one sine wave, so the equation becomes a basic one.`,
      `If ${mark('|c| > R')} the equation has no solution: the combined wave never reaches ${mark('c')}.`,
      `${mark('φ')} is the angle with ${mark('cos φ = a/R')} and ${mark('sin φ = b/R')}, in the quadrant of the point ${mark('(a, b)')} (the two-argument arctangent, "atan2(b, a)" on a calculator); ${mark('arctan(b/a)')} gives it only when ${mark('a > 0')}. If ${mark('a = b = 0')} there is no wave at all.`,
    ],
    mistakes: [
      `Taking ${mark('φ = arctan(b/a)')} when ${mark('a < 0')}: for ${mark('−sin θ + cos θ')} it gives ${mark('−π/4')}, but ${mark('φ = 3π/4')}.`,
      'Squaring both sides to remove the mixed terms: that introduces extraneous solutions.',
      `Forgetting to subtract ${mark('φ')} after solving for ${mark('θ + φ')}.`,
    ],
  },
  product: {
    tips: [
      `${mark('sin(x)·cos(x) = ½·sin(2x)')}: the double-angle identity turns a product into one sine.`,
      `Solve ${mark('sin(2x) = 2c')} for ${mark('2x')}, then divide by ${mark('2')}: there are four solutions in ${mark('[0, 2π)')} when ${mark('|2c| < 1')}.`,
      `${mark('sin(x)·cos(x) = c')} has no solution when ${mark('|c| > 1/2')}.`,
    ],
    mistakes: [
      `Dividing by ${mark('cos(x)')} to get ${mark('tan')}: ${mark('sin(x)·cos(x)/cos(x)')} is ${mark('sin(x)')}, and the other side becomes ${mark('c/cos(x)')}, so the equation is not in ${mark('tan')} alone. (Dividing by something that can be ${mark('0')} also loses any solutions where it is ${mark('0')}; here ${mark('cos(x) = 0')} makes the left side ${mark('0')}, so none are lost when ${mark('c ≠ 0')}.)`,
      `Forgetting the ${mark('½')}: ${mark('sin(x)·cos(x)')} is ${mark('½·sin(2x)')}, not ${mark('sin(2x)')}.`,
    ],
  },
  'equal functions': {
    tips: [
      `${mark('sin A = sin B')} has TWO branches (equal or supplementary angles); ${mark('cos A = cos B')} has ${mark('A = ±B')}; ${mark('tan A = tan B')} has one branch with period ${mark('π')}.`,
      `Cofunctions convert: ${mark('cos B = sin(π/2 − B)')}.`,
      'Solve each branch for x separately, then list every solution in [0, 2π).',
    ],
    mistakes: [
      `Cancelling the function on both sides as if it were a factor: ${mark('sin A = sin B')} does not mean ${mark('A = B')} only.`,
      'Forgetting the second branch.',
    ],
  },
  'no solution': {
    tips: [
      `${mark('sin')} and ${mark('cos')} stay between ${mark('−1')} and ${mark('1')}: an equation that needs a value outside that range has no real solution.`,
      `${mark('tan')} and ${mark('cot')} take every real value; ${mark('sec')} and ${mark('csc')} never lie strictly between ${mark('−1')} and ${mark('1')}.`,
    ],
    mistakes: [`Applying arcsin or arccos to a number outside ${mark('[−1, 1]')} and reading the calculator error as a value.`],
  },
  'no solution: quadratic': {
    tips: [
      'A quadratic in a trig function has no solution when the quadratic has no real root, or when every root lies outside the function\'s range.',
      `Check each root ${mark('u')} against ${mark('[−1, 1]')} for sine and cosine.`,
    ],
    mistakes: [`Taking a root such as ${mark('u = 2')} and looking for an angle with ${mark('sin = 2')}.`],
  },
  numeric: {
    tips: [
      'Equations that mix trig terms with different arguments or with x itself usually have no closed form: numeric solutions are the honest answer, shown with ≈.',
      'Each root was located by scanning and then checked by substitution; without a bound like the one above, there can be more outside the range searched.',
    ],
    mistakes: ['Expecting an exact answer for every trig equation: most mixed ones have none.'],
  },
};

// The equation's own working, read from its steps.
function equationHere(method, text, answer) {
  const ref = text.match(/the principal value is ((?:arcsin|arccos|arctan)\([^)]*\)) ([=≈]) ([^\s.]+(?:\.\d+)?)/);
  const families = String(answer).split(' (n ∈ ℤ)')[0];
  switch (method) {
    case 'two per period': {
      const second = text.match(/and (θ|[a-z]) = (?:π|180°) − (?:\([^)]*\)|arcsin\([^)]*\)) [=≈] ([^\s.]+(?:\.\d+)?)/);
      const even = /Cosine is even/.test(text);
      if (!ref) return null;
      const kStep = text.match(/(Divide by|Multiply by) (\S+) to get [a-z]: (.+)$/m);
      return `Here: ${mark(`${ref[1]} ${ref[2]} ${ref[3]}`)}, and the second solution in the period is ${even ? mark(`−${ref[3]}`) : second ? mark(`π − ${ref[3]} ${ref[2]} ${second[2]}`) : 'the supplementary angle'}${kStep ? `; then ${kStep[1].toLowerCase()} ${mark(kStep[2])}` : ''}: ${mark(families)}.`;
    }
    case 'once per period': {
      const top = text.match(/only once per period, at the (top|bottom) of the wave: (?:θ|[a-z]) = ([^.\s]+)/);
      return top ? `Here: the value is reached only at the ${top[1]} of each wave, at ${mark(top[2])}, so ${mark(families)}.` : null;
    }
    case 'tan':
      return ref ? `Here: ${mark(`${ref[1]} ${ref[2]} ${ref[3]}`)}, and tan repeats every ${mark('π')}: ${mark(families)}.` : null;
    case 'reciprocal': {
      const r = text.match(/this is ((?:sin|cos|tan)\([^)]*\) = [^.\s]+)\./);
      return r ? `Here: the equation is ${mark(r[1])}, solved as usual: ${mark(families)}.` : null;
    }
    case 'quadratic': {
      const q = text.match(/Let (u|v) = ([a-z]+\([^)]*\)): ([^\n]+?) = 0\./);
      const roots = text.match(/quadratic formula\): ([^\n]+?)\./);
      return q && roots ? `Here: with ${mark(`${q[1]} = ${q[2]}`)}, ${mark(`${q[3]} = 0`)} gives ${mark(roots[1])}; each value is solved for the angle.` : null;
    }
    case 'a sin + b cos': {
      const r = text.match(/So (sin\([^)]*\) = [^.]+?)\. Let/);
      const R = text.match(/R = √\(a² \+ b²\) = (\S+) and φ the angle with [^:]+: φ = (?:arctan\(b\/a\) = )?([^.\s]+)/);
      return r && R ? `Here: ${mark(`R = ${R[1]}`)} and ${mark(`φ = ${R[2]}`)}, so ${mark(r[1])}.` : null;
    }
    case 'product': {
      const r = text.match(/So (sin\(2[a-z]\) = [^.\s]+)\./);
      return r ? `Here: the product is ${mark('½·sin(2x)')}, so ${mark(r[1])}.` : null;
    }
    case 'equal functions': {
      const b = text.match(/up to full turns: (.+?)\.\s*$/m);
      return b ? `Here: the two branches are ${mark(b[1])}.` : null;
    }
    default:
      return null;
  }
}

// The solver's own lists are about this value ("sin reaches 1 only once in
// each period", "missing π/4 + π"): they lead, the worked line comes second,
// and the method's list adds what they do not say.
const BASIC = new Set(['two per period', 'once per period', 'tan']);
export function equationGuidance(result) {
  const text = stripMathMarkers((result.steps || []).join('\n'));
  const method = equationMethod(text);
  const list = EQUATION_LISTS[method];
  if (!list) return null;
  let here = null;
  try { here = equationHere(method, text, String(result.answer || '')); } catch { here = null; }
  // A bounded scan: every root lies in the interval, said for this equation.
  if (method === 'numeric' && result.bounded) {
    const b = result.bounded;
    const f = (x) => (Number.isInteger(x) ? String(x) : String(Math.round(x * 1e4) / 1e4));
    here = `Here: ${b.fn === 'cos' ? 'cosine' : 'sine'} is never beyond ${mark('±1')}, so every solution lies in ${mark(`${f(b.lo)} ≤ x ≤ ${f(b.hi)}`)}: none can be outside it. The scan found these there; that they are all of them is not proved by the scan.`;
  }
  // The numeric scan's own lists come from the algebra solver, with its
  // x·eˣ examples: those stay out of a trig equation.
  const keep = (t) => method !== 'numeric' || !/e\^x|e\^\(/.test(stripMathMarkers(t));
  const own = (result.tips || []).filter(keep);
  // The basic solver's second tip is the value-specific one; its first, the
  // general "infinitely many solutions", follows the worked line. The
  // method's own first tip says the same as the value-specific one, so the
  // list adds from its second.
  // The k-tip only when there is a k (sin(x) = 1/2 has none).
  const extra = list.tips.slice(1).filter((t) => /Let θ = /.test(text) || !/With ⟦kx⟧ inside/.test(t));
  let tips;
  if (BASIC.has(method) && own.length > 1) tips = [own[1], here, own[0], ...own.slice(2), ...extra];
  // A reciprocal, a numeric scan and a no-solution lead with the method's
  // own point, then the advice the solver gave.
  else if (['reciprocal', 'numeric', 'no solution'].includes(method)) tips = [list.tips[0], here, ...(method === 'reciprocal' && own.length > 1 ? [own[1], own[0], ...own.slice(2)] : own), ...extra];
  else if (own.length) tips = [own[0], here, ...own.slice(1), ...extra];
  else tips = [list.tips[0], here, ...extra];
  const kMistakes = result.cotZero ? [] : list.mistakes.filter((m) => /Let θ = /.test(text) || !/by ⟦k⟧/.test(m));
  return { tips: distinct(tips), common_mistakes: distinct([...(result.common_mistakes || []).filter(keep), ...kMistakes]) };
}
