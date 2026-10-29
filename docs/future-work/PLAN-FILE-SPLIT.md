# MasterMath — Plan: Break Up the Large Solver Files

**Version referenced:** 1.59.0
**By:** sparkinCreations™
**Written:** October 29, 2026
**Status:** Done (1.59.1–1.59.5) — `algebraSolver.js` split in 1.59.1, `integralsSolver.js` in 1.59.2, `limitsSolver.js` in 1.59.3, the arithmetic tips in 1.59.4, the functions tips in 1.59.5. `api.js` (Wave 2, last) and the inequality tips were not moved; see below
**Do before:** [`PLAN-INSIGHTS-AND-RESOURCES.md`](PLAN-INSIGHTS-AND-RESOURCES.md) (this split moves every solver's tips into its own file, which that work then edits)

---

## Why

Seven files hold most of the engine, and the two biggest are three
thousand lines each. Every fix this month landed in one of them, and each
new topic or method makes them bigger. Large files are slower to change
safely: a fix in one method sits next to forty others, and a review has
to read around all of them.

| File | Lines (1.59.0) | What is in it |
|---|---|---|
| `src/lib/solvers/algebraSolver.js` | 3,255 | equation dispatch, ~10 equation methods, root formatting, the numeric search, two-variable equations, simplify / expand / factor, radicals, tips |
| `src/lib/solvers/integralsSolver.js` | 2,983 | indefinite integrals, partial fractions, definite and improper integrals, singularities, rule labels, display tidying, tips |
| `src/lib/solvers/limitsSolver.js` | 1,504 | the named techniques plus 174 lines of tips |
| `src/lib/solvers/arithmeticSolver.js` | 1,432 | the working plus the tips |
| `src/lib/api.js` | 1,321 | routing (`solveProblem` alone is 472 lines), request phrases, the result gate |
| `src/lib/solvers/functionsSolver.js` | 1,267 | |
| `src/lib/solvers/inequalitiesSolver.js` | 1,071 | |

## What makes it safe

- **The public surface is tiny.** Outside their own files, only
  `solveAlgebra`, `solveIntegral`, and `splitRootsList` / `prettyRadicals`
  (used by `systemsSolver.js`) are imported. Each file stays as the entry
  point and re-exports the same names, so no caller changes.
- **There is almost no module state.** The only top-level mutable values in
  the solvers are two lazy caches (`algebritePromise` in `solverUtils.js`,
  `exactMathInstance` in `integralsSolver.js`) and `DEGREES` in
  `trigEquationSolver.js`, which is not being split. The rest is plain
  functions, which can move between modules.

## Rules

1. **Move, never change.** No renaming, tidying or fixing in the same
   pull request. A bug found on the way is written down and fixed in its
   own pull request afterwards.
2. **Prove nothing changed.** Before the first move, record a golden file:
   the full result (status, steps, answer, tips, mistakes, readAs) of every
   problem in `tests/corpus/`, `docs/evaluations/2026-10/test-cases.json`
   and `tests/helpers/typesetProblems.js`, about 1,000 problems. After each
   move the output must match it exactly, character for character. That is
   in addition to `npm test` and `npm run smoke`.
3. **Imports run one way:** shared helpers → method files → the entry
   file. A method file never imports its entry file. This rules out the
   import cycles that break at load time.
4. **Page weight is unchanged.** Compare the built chunk sizes before and
   after; `tests/buildPreload.test.js` still proves the maths libraries
   never load on a page's main thread.
5. **Target size:** no file over about 600 lines. A guideline: a method
   that belongs together stays together.
6. **Files stay `.js`.** They hold no JSX, run in the worker without React,
   and the unit suite imports them in plain Node.

## Wave 1 — the two biggest

### `algebraSolver.js` → `src/lib/solvers/algebra/`

| File | Contents | ~Lines |
|---|---|---|
| `algebraSolver.js` (entry, stays in `solvers/`) | `solveAlgebra`, `solveEquation`'s dispatch | 350 |
| `algebra/guidance.js` | `equationGuidance`, every tips and mistakes list (equations, simplify, cancel, radicals) | 330 |
| `algebra/polynomial.js` | rational roots and synthetic division, Algebrite roots with the degree check, the exact root finder path | 450 |
| `algebra/rootsFormat.js` | `splitRootsList`, `parseRootsList`, `prettyRadicals`, complex roots, `formatSolutions` | 200 |
| `algebra/expLog.js` | power, single-exponential, exp- and log-substitution equations | 650 |
| `algebra/specialForms.js` | absolute-value and radical-isolation equations | 200 |
| `algebra/numeric.js` | `solveNumerically`, domain restrictions, root refinement | 350 |
| `algebra/twoVariables.js` | `solveForVariable` and the textbook-root helpers | 150 |
| `algebra/expressions.js` | simplify, expand, factor, cancel | 400 |
| `algebra/radicals.js` | `exactRadicalForm`, the quadratic-formula derivation | 180 |

### `integralsSolver.js` → `src/lib/solvers/integrals/`

| File | Contents | ~Lines |
|---|---|---|
| `integralsSolver.js` (entry) | `solveIntegral`, `solveIndefiniteIntegral`, `integrateTerm` | 450 |
| `integrals/guidance.js` | tips and mistakes, `directTip` / `directMistake`, the non-elementary notes | 150 |
| `integrals/partialFractions.js` | every partial-fraction path, `sumOfSquaresQuartic`, exact coefficients | 600 |
| `integrals/definite.js` | reading bounds, definite integrals, numeric estimates, refusals | 600 |
| `integrals/improper.js` | infinite bounds, singular endpoints, integrals across an asymptote | 550 |
| `integrals/rules.js` | `classifyIntegralRule`, inverse trig, half-angle and quotient steps | 350 |
| `integrals/display.js` | log polishing, dropping bars, `prettyErf`, `bindOtherLetters` | 150 |

## Wave 2 — the rest

- **`limitsSolver.js`:** `limits/guidance.js` (174 lines of tips), the
  techniques (factor and cancel, conjugate, L'Hôpital, series, 1^∞) in one
  file, the numeric estimates in another.
- **`arithmeticSolver.js`, `functionsSolver.js`, `inequalitiesSolver.js`:**
  each one's tips and mistakes into its own `guidance.js`. These are the
  largest single blocks; moving them is enough for now.
- **`api.js` last:** request phrases, topic detection, the result gate
  (`finalizeResult`) and `solveProblem` into separate files. Routing is
  where unusual input is interpreted, so this is the most delicate move,
  and it is checked against the golden file like the others.

## Releases

- One pull request per file, about 6–8 in all, in the order above.
- Each is a patch release (1.59.1, 1.59.2, …): `CLAUDE.md` requires a
  version bump for any change to `src/`. The changelog says the code was
  reorganised with no change in behaviour.
- Nothing changes for users.
- `CLAUDE.md`'s module map is updated in the same pull request as each move.

## Progress

- **Golden file:** `tests/golden/record.mjs` collects every problem the
  project exercises — the corpora, the October test list, the typesetting
  problems and every `solveProblem` / `solvePlain` call with a literal
  problem in `tests/` — and runs each under its own topic and under
  Auto-detect: 2,241 solves. Two recordings of the same code match byte
  for byte. `--compare` checks a refactor against a recording.
- **1.59.1 — `algebraSolver.js`:** as planned, except that `IMAGINARY`,
  `satisfiesEquation` and the complex-root helpers live in `rootsFormat.js`
  (they are shared by several methods) and `generateAlgebraGraph` in
  `expressions.js`. 77 top-level statements moved byte for byte; the golden
  file, the unit suite and the smoke test pass; the worker bundle is 42
  bytes smaller (unused imports dropped).

- **1.59.2 — `integralsSolver.js`:** two files more than planned.
  `integrateTerm` and the form substitutions call each other, and the
  definite and improper paths integrate term by term, so leaving
  `integrateTerm` in the entry file would have had method files import
  their entry (rule 3). It lives in `terms.js` with the form
  substitutions; the helpers definite and improper integrals share
  (evaluation at a bound, quadrature, named constants, refusals, the area
  graph) are `evaluate.js`, so `improper.js` and `definite.js` do not
  import each other. 75 statements moved byte for byte; golden, unit and
  smoke suites pass.
- **1.59.3 — `limitsSolver.js`:** as planned: `limits/techniques.js` (the
  named techniques and the helpers they share), `limits/numeric.js` (the
  estimates and one-sided limits, with `evalAt`, which the techniques
  import) and `limits/guidance.js`. 41 statements moved byte for byte.
- **1.59.4 — arithmetic tips:** `arithmeticGuidance` and
  `complexGuidance` (with `complexOperation`, which only it uses) to
  `arithmetic/guidance.js`. 51 statements moved byte for byte.
- **1.59.5 — functions tips:** `functionGuidance` and
  `variableOutsideExponents` (which only it uses) to
  `functions/guidance.js`. 30 statements moved byte for byte.
- **Not done:** `api.js` is not split. Nothing waits on it, and routing is
  the most delicate move; do it when a change to routing needs the room.
- **1.59.6 — `arithmeticSolver.js`, the rest:** beyond the plan, at the
  owner's request (every large file split, not only the tips). Six method
  files beside `guidance.js`: `notation.js` (the helpers every other file
  uses), `fractions.js`, `undefinedCases.js`, `working.js`,
  `exactNumbers.js`, `complex.js`. 48 statements moved byte for byte.
- **1.59.7 — `functionsSolver.js`, the rest:** `features.js` (every
  feature finder, with the window constants they share) and
  `presentation.js`. 28 statements moved byte for byte.
- **1.59.8 — `inequalitiesSolver.js`:** `roots.js`, `intervals.js`,
  `linear.js`, `periodic.js`, `presentation.js`. Its tips are still inline
  in the results (there is no `guidance.js` yet). 37 statements moved
  byte for byte.
- **1.59.9 — `derivativesSolver.js`:** `rules.js`, `absLinear.js`,
  `guidance.js`. 23 statements moved byte for byte.
- **Tips written inline.** Most integral tips (and every inequality tip)
  are written inside the result they belong to, not in a list of their
  own, so `integrals/guidance.js` holds only the shared ones
  (`directTip`, `directMistake`, the non-elementary notes). Gathering the
  inline lists into `guidance.js` changes code rather than moving it; it
  belongs to the insights work, which edits those lists anyway.

### Found on the way (not fixed: move, never change)

- `TIPS` and `COMMON_MISTAKES` in the algebra solver (now
  `algebra/guidance.js`) are never used: every equation path takes its
  lists from `equationGuidance`. Delete them in their own change.

## Risks

| Risk | Guard |
|---|---|
| A behaviour change slips in | The golden-file comparison over ~1,000 problems, plus the unit and browser suites |
| An import cycle breaks loading | One-way imports; the smoke test loads every topic |
| The worker bundle grows | Built chunk sizes compared before and after |
| Line history is harder to follow | `git blame -C -C` follows moved code; each pull request is a pure move |

## Open decisions

1. **Scope:** Wave 1 only, or both waves. *Recommended: Wave 1, then
   Wave 2's tip files before the insights work.*
2. **Order:** before the insights work. *Recommended.*
3. **Releases:** one per file or one per wave. *Recommended: one per file.*
