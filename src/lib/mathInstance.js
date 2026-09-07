// The one place mathjs is assembled. (Roadmap 2026-09 item 6.)
//
// `create(all)` pulled every mathjs factory — matrices, units, bignumbers,
// statistics, bitwise ops — into a 1.13 MB chunk that every first visit had
// to download before a single problem could be solved. The app uses the
// expression parser/evaluator, simplify, polynomialRoot, fractions, complex
// numbers, formatting, and the elementary functions students can type. Naming
// exactly those lets Vite tree-shake the rest.
//
// Adding a function: put its name in FUNCTIONS below (mathjs exports
// `<name>Dependencies` for every function and constant) and add an expression
// that uses it to tests/mathInstance.test.js, which evaluates the whole battery
// through this instance. A name missing here throws "Undefined function" at
// evaluation time — the test is what turns that into a build-time failure.

import {
  create,
  // core: parsing and evaluation, symbolic helpers, number types, display
  evaluateDependencies, parseDependencies, simplifyDependencies, polynomialRootDependencies,
  fractionDependencies, complexDependencies, formatDependencies, numberDependencies, typeOfDependencies,
  // operators the parser compiles to
  addDependencies, subtractDependencies, multiplyDependencies, divideDependencies, powDependencies,
  unaryMinusDependencies, unaryPlusDependencies, modDependencies, factorialDependencies,
  largerDependencies, smallerDependencies, equalDependencies, unequalDependencies, largerEqDependencies, smallerEqDependencies,
  // elementary functions
  sinDependencies, cosDependencies, tanDependencies, secDependencies, cscDependencies, cotDependencies,
  asinDependencies, acosDependencies, atanDependencies, atan2Dependencies,
  sinhDependencies, coshDependencies, tanhDependencies, asinhDependencies, acoshDependencies, atanhDependencies,
  sqrtDependencies, cbrtDependencies, nthRootDependencies, absDependencies, expDependencies,
  logDependencies, log10Dependencies, log2Dependencies,
  floorDependencies, ceilDependencies, roundDependencies, fixDependencies, signDependencies, gammaDependencies,
  combinationsDependencies, permutationsDependencies, gcdDependencies, lcmDependencies,
  maxDependencies, minDependencies, hypotDependencies, squareDependencies, cubeDependencies,
  reDependencies, imDependencies, argDependencies, conjDependencies,
  isNaNDependencies, isIntegerDependencies, isNumericDependencies, isZeroDependencies, isPositiveDependencies, isNegativeDependencies,
  erfDependencies, expm1Dependencies, log1pDependencies,
  // constants — both spellings students type (e / E, pi / PI) and the named
  // ones the parser protects (SQRT2, LN2, phi, …)
  piDependencies, PIDependencies, eDependencies, EDependencies, iDependencies, InfinityDependencies, NaNDependencies, nullDependencies,
  tauDependencies, phiDependencies, SQRT2Dependencies, SQRT1_2Dependencies, LN2Dependencies, LN10Dependencies, LOG2EDependencies, LOG10EDependencies,
  trueDependencies, falseDependencies,
} from 'mathjs';

const DEPENDENCIES = {
  ...evaluateDependencies, ...parseDependencies, ...simplifyDependencies, ...polynomialRootDependencies,
  ...fractionDependencies, ...complexDependencies, ...formatDependencies, ...numberDependencies, ...typeOfDependencies,
  ...addDependencies, ...subtractDependencies, ...multiplyDependencies, ...divideDependencies, ...powDependencies,
  ...unaryMinusDependencies, ...unaryPlusDependencies, ...modDependencies, ...factorialDependencies,
  ...largerDependencies, ...smallerDependencies, ...equalDependencies, ...unequalDependencies, ...largerEqDependencies, ...smallerEqDependencies,
  ...sinDependencies, ...cosDependencies, ...tanDependencies, ...secDependencies, ...cscDependencies, ...cotDependencies,
  ...asinDependencies, ...acosDependencies, ...atanDependencies, ...atan2Dependencies,
  ...sinhDependencies, ...coshDependencies, ...tanhDependencies, ...asinhDependencies, ...acoshDependencies, ...atanhDependencies,
  ...sqrtDependencies, ...cbrtDependencies, ...nthRootDependencies, ...absDependencies, ...expDependencies,
  ...logDependencies, ...log10Dependencies, ...log2Dependencies,
  ...floorDependencies, ...ceilDependencies, ...roundDependencies, ...fixDependencies, ...signDependencies, ...gammaDependencies,
  ...combinationsDependencies, ...permutationsDependencies, ...gcdDependencies, ...lcmDependencies,
  ...maxDependencies, ...minDependencies, ...hypotDependencies, ...squareDependencies, ...cubeDependencies,
  ...reDependencies, ...imDependencies, ...argDependencies, ...conjDependencies,
  ...isNaNDependencies, ...isIntegerDependencies, ...isNumericDependencies, ...isZeroDependencies, ...isPositiveDependencies, ...isNegativeDependencies,
  ...erfDependencies, ...expm1Dependencies, ...log1pDependencies,
  ...piDependencies, ...PIDependencies, ...eDependencies, ...EDependencies, ...iDependencies, ...InfinityDependencies, ...NaNDependencies, ...nullDependencies,
  ...tauDependencies, ...phiDependencies, ...SQRT2Dependencies, ...SQRT1_2Dependencies, ...LN2Dependencies, ...LN10Dependencies, ...LOG2EDependencies, ...LOG10EDependencies,
  ...trueDependencies, ...falseDependencies,
};

// A fresh instance with the app's function set. `config` is mathjs config
// (arithmeticSolver passes { number: 'Fraction' } for its exact instance).
export function createMath(config) {
  return config ? create(DEPENDENCIES, config) : create(DEPENDENCIES);
}
