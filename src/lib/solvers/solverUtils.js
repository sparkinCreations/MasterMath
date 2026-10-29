// Shared helpers for the math solvers.
//
// Every solver used to carry its own copy of the Algebrite loader, the graph
// sampling loop, and ad-hoc number/expression formatting. Those now live here
// so the individual solvers can focus on the mathematics and the step wording.
//
// This file only re-exports them, by kind: utils/engines.js (mathjs and
// Algebrite), utils/text.js (expression text), utils/numeric.js (numeric
// checks and sampling), utils/structure.js (facts read off the parse tree).

export { math, loadAlgebrite, isAlgebriteFailure, runAlgebrite } from './utils/engines.js';
export {
  realOddRoots,
  findUndefinedRegions,
  formatRestriction,
  expressionsNumericallyEqual,
  numericAgreement,
  sampleFunction,
} from './utils/numeric.js';
export {
  bareFunctionName,
  readAsText,
  absBars,
  bareFunctionRefusal,
  isUnevaluatedOperator,
  parsesAsMath,
  formatNumber,
  beautify,
  lnify,
  splitTopLevel,
  stripOuterParens,
  gcd,
  splitTerms,
  rewriteReciprocalTrig,
  hasVariable,
  piForm,
  exactForm,
} from './utils/text.js';
export {
  linearCoefficients,
  structuralPeriod,
  definedEverywhere,
  trigUndefinedPoints,
  neverZeroSide,
} from './utils/structure.js';

// ⟦…⟧ around the math in a step: `Let ${mark(`u = ${inner}`)} (the inside).`
// The renderer typesets exactly what is marked (see mathMarkers.js).
export { mark, stripMathMarkers } from '../mathMarkers.js';

