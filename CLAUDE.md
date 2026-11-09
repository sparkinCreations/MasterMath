# CLAUDE.md

Guidance for Claude Code when working in this repository. This file holds the
architecture, the invariants and the process; the history of individual fixes
lives in `CHANGELOG.md`, and the behaviour of each solver is documented at the
top of its own file.

## What MasterMath is

A React app that solves maths problems step by step — arithmetic, algebra,
systems, inequalities, trigonometry, functions, limits, derivatives, integrals —
using local JavaScript maths libraries (mathjs, Algebrite), **not AI**. All data
stays in the browser (IndexedDB, localStorage). Hosted on Netlify at
mastermath.app; GitHub Actions deploys it from `main`.

Branding: **MasterMath** (never MathMaster) by sparkinCreations™; tagline
"Step-by-step math, solved locally" (since 1.70.2; was "Master math with confidence"); positioning is "step-by-step local solver", never
"tutor" or AI-chatbot framing. Palette: indigo (book) and orange (operators) from
the logo; green = answer, amber = tips. Since 1.70.4 the UI is plain: no
gradients, a solid blue-50 page, thin grey borders; headings, the name and
action buttons are blue-800 (blue-300 in dark mode, dark text); Solve is the
one orange button; a selected tab or option is gray-900 (white in dark
mode), so "picked" never looks like "press". The home page's worked example
copies the Solver's look by hand: change both.

## Layout

```
src/
  App.jsx, Layout.jsx          providers, routes, sidebar/header/footer
  pages/                       Home, Solver, Progress, Settings, FAQ, UserManual, PrivacyPolicy, TermsOfService, Feedback, NotFound (the `*` route)
  components/solver/           ProblemInput (+ SymbolStrip: one-tap symbols from lib/symbolInsert.js, MathKeypad: digits and operators from lib/keypad.js, open on touch-first devices, inputmode="none" while open; a live KaTeX preview, and the NotationGuide dialog), SolutionDisplay (+ PracticeDialog: "Try a similar one"), GraphViewer, GraphEmptyState
  components/ui/               shadcn/ui primitives (Button, Card, Select, Sidebar, Toast, ConfirmDialog, …)
  components/MathText.jsx      KaTeX rendering of solver text (lib/mathRender.js, shared with the PDF; lib/latex.js `mode`: 'auto' = ⟦…⟧-marked math exactly, else clause heuristics (steps, answers); 'marked' = marked runs only (tips, mistakes); 'input' = a typed problem)
  contexts/DarkModeContext.jsx theme 'system' | 'light' | 'dark' (lib/theme.js); resolved `isDarkMode` toggles the `dark` class; index.html's boot script applies it before first paint
  hooks/                       usePageTitle, useServiceWorker
  lib/
    api.js                     solveProblem (intent routing); api/ holds topic detection, words, request phrases and the finalizeResult gate (worker side: imports mathjs)
    problemHistory.js          the history store's IndexedDB wrappers — what pages import; never import api.js from a page
    budgetedSolver.js          the page's entry point: worker, 10 s budget, Cancel, in-thread fallback
    solver.worker.js           runs solveProblem off the main thread, and the practice tasks (a `task` field)
    practice/                  practice mode, worker side: check.js (answer kinds, the engine's answer read, a typed answer checked by value), generate.js (seeded variations kept only with the same method and as clean an answer), tasks.js
    practiceClient.js          practice mode, page side: the set of up to five (one worker request per candidate), answer checks
    plainEnglish.js            spoken maths → notation ("x squared", "sine of x", "is greater than", x**3, "two plus one"); first step of solveProblem, and the input preview; no imports
    mathParser.js              notation → mathjs/Algebrite syntax; expression extraction
    validation.js              input length/topic checks
    syntaxCheck.js             malformed typing refused once, in words, before any solver (operators, brackets, stray symbols); engine messages put into words
    settings.js                angleUnit, decimalPlaces (localStorage, or primed by message in the worker)
    solutionEnvelope.js        typed result statuses: solved / parse_error / unsupported / undefined / indeterminate / diverges / overflow
    mathInstance.js            mathjs built from an explicit dependency list (tree-shaken)
    graphSampling.js, graphDescription.js, latex.js, mathRender.js, exportUtils.js, indexedDB.js, reveal.js
    pdfTypeset.js              the solution PDF: typeset sheet + graph → html2canvas-pro page images + invisible text layer
    graphPalette.js            the graph's light/dark colours (GraphViewer) and the PDF's dark→light recolouring
    solverPrefs.js             solution mode (step-through default), last topic, the bare-expression nudge
    guidance.js                tips and mistakes: ranked lists, first three shown ("Show more" for the rest), an item may carry a source
    learnMore.js               "Learn more" links by topic: approved sites only, checked before release
    solvers/                   one module per topic (below) + solverUtils.js shared helpers; a large file's methods sit in a folder of its name (algebra/, integrals/, …)
tests/        node --test unit suite; tests/corpus/harness.mjs grades the evaluation corpora
e2e/          Playwright smoke test of the production build
docs/         evaluations/ (graded CSVs + audits, 2026-10/REVIEW-LOG is the claim log), future-work/ (ROADMAP-2026-10.md is the open list), HOW_THE_APP_WORKS.md, REACT_GUIDE.md
public/       _headers (CSP), sw.js (service worker), manifest, icons, robots, sitemap
```

Path alias `@/` → `src/`. Tailwind 4 is CSS-first in `src/index.css` (no
`tailwind.config.js`); dark mode is the `dark` class.

## How a solve flows

1. `ProblemInput` validates and sanitizes the text, then `Solver.jsx` calls
   `solveWithBudget(problem, topic, { signal })` (`budgetedSolver.js`). The
   page never calls `solveProblem` directly.
2. The request (with the current settings) goes to a module Web Worker. The
   worker primes the settings and runs `solveProblem`. Past
   `SOLVE_BUDGET_MS` (10 s), or on Cancel, the worker is **terminated** and the
   page gets an honest `unsupported` envelope / `null`; the next solve gets a
   fresh worker. If the worker cannot start, the solve runs in-thread and
   `console.error("Solver worker failed …")` is logged — the smoke test fails
   on that line.
3. `solveProblem` (`api.js`) first reads plain English as notation
   (`readPlainEnglish`: "of" takes one term, a power binds to its term),
   then, under Auto-detect (`auto`, the default topic), picks the topic
   with `detectTopic` and solves under it: the result's notice reads
   "Detected as …" (`routing.from === 'auto'`, no switch button, none on
   a parse error). Every topic then routes by **intent, not topic**: derivative /
   integral / limit notation goes to that solver under any topic; a single
   equation goes to Algebra — except an equation in x and y under Derivatives
   (or with "find dy/dx"), which goes to implicit differentiation, checked
   before the differential-equation refusal; a primed call f'(x) is the
   derivative of f when the input defines f, else a differential equation or
   a function not given, both refused, as is any f(x), g(x), h(x) never
   defined (`primedFunctionRequest`); request phrases are read first
   (`readRequestPhrases`: "the zeros of", "the critical points of" → Functions,
   "the period of" → `requestSolver`, …); two `=` signs go to systems; a comparison operator
   to inequalities; a trailing "at x = a" is stripped first (`extractEvalPoint`).
   Before any of this, `syntaxProblem` (`syntaxCheck.js`) refuses malformed
   typing — "2+*", "x^2 +", "()", "2 # 3" — once, in words, so every
   topic refuses it the same way; `parseError` puts any engine message that
   still arises into words, and says the reason once (in the answer, not
   again as a step and a tip). A parse error is never routed.
   A routed result's first step says so (`routedTopic`), and it carries
   `routing: { from, to, reason }`: the page shows a "Solved as …" notice
   above the steps (with "Switch topic to …", which moves the solved-input
   record with the dropdown so the answer is not cleared) and hides that
   first step; exports and history keep it. A trig function or ° under
   Arithmetic goes to Trigonometry (angle units live there); a leading
   factor / expand / simplify / solve goes to Algebra (to Trigonometry
   when the input has a trig function: it knows the identities); a constant that
   divides by zero (and any plain number under Limits) goes to Arithmetic. A word no engine
   knows is a parse error on every path, never a constant: the single-
   expression paths check the extracted expression (`unknownWord`), the
   limit, integral, inequality and system paths the whole problem minus
   instruction words (`unknownWordInProblem`; an instruction word raised to
   a power, "as^2", is not one). Every path checks, the derivative "at x =
   a" paths included: unchecked, "kx" was a constant and d/dx sin(kx) at 0
   was 0. Letters side by side are a product (1.71.0): `solveProblem` is a
   wrapper that retries a parse error on a 2–3-letter word as its product
   (`rewriteAsProduct` in `api/words.js`: two letters unless a differential
   "dx" or an English word standing alone, "at" in "x^2 at x = 2", where
   "at^2" is a·t; three only with two of x, y, z) and adds the warning
   'Read "kx" as k·x'. Names keep their meaning (pi, ln, dx); doubled
   letters ("xx") keep their own message.
4. The solver returns `{ steps[], answer, tips[], common_mistakes[], graph? }`
   wrapped in an envelope status. `finalizeResult` enforces the status and
   refuses anything that is not presentable text (objects, code-shaped
   strings) as `unsupported`.
5. `SolutionDisplay` renders it (KaTeX via `MathText`, which must keep
   `htmlAndMathml` output — the MathML is what screen readers get). Only a
   worked solution is stepped through: a parse error, a refusal and an
   overflow are shown all at once, under "Notes";
   `GraphViewer` re-samples `graph.expression` for the window on screen.
6. Practice mode (`docs/future-work/PLAN-PRACTICE-MODE.md`): the worker
   marks a result `practicable` when `practice/check.js` can read its answer
   (a number, the solutions of one equation or a trig equation's on [0, 2π),
   an inequality's solution set, a system's pairs, a function's x-intercepts,
   a derivative, an antiderivative); the page then offers **Try a similar one**, a pop-up of
   up to five problems that rotate. Candidate i is a pure function of the
   problem (seeded), so every student gets the same set; it is kept only
   when it solves with the same first Key Insight (the method; its marked
   formulas set aside), an answer
   with no feature the original's lacks, and a readable correct answer.
   Answers are checked by value in the worker, never by text.
7. Solved / undefined / indeterminate / diverges results are saved to
   IndexedDB (`MathMasterDB` — legacy name, keep it) under `routedTopic`,
   one entry per problem and topic: a repeat solve updates that entry
   (`solveCount`), and older repeats are merged on read (`collapseRepeats`
   in `problemHistory.js`). A word problem is refused up front
   (`looksLikeWordProblem`: "Word problems are not supported").

## Solvers (`src/lib/solvers/`)

Each file documents its own methods at the top. Shared invariants:

- **Verify before reporting.** Every equation solution is substituted back
  into the original; every antiderivative is differentiated back; definite
  integrals are cross-checked by quadrature; limits numerically. Extraneous
  roots are rejected with the reason shown.
- **Refuse honestly.** Out-of-family input returns `unsupported`, never a
  guess. Never decide a mathematical property (linearity, completeness of a
  root list) from fixed sample points — construct a proof or refuse.
- **State when an answer in constants holds** (1.71.1). x with letter
  constants (a*x + b = 0, e^(a*x) = b) is solved for x with the constants
  held fixed, and the steps call them constants, not unknowns; x with y is
  one equation in two unknowns. The answer carries its conditions, read off
  the answer and the equation (`constantConditions` in `algebraSolver.js`):
  a divisor ≠ 0 (also the coefficient divided by: a*x = 0 is x = 0 for
  a ≠ 0), a logarithm's argument > 0, a square root's ≥ 0: "x = ln(b)/a,
  for a ≠ 0 and b > 0". A step says what the equation is when a constant is
  0, decided when it can be. Since 1.74.0 the same holds for the unknown
  inside one function or a denominator (`algebra/undoOuter.js`), simplify
  (a cancelled factor is a condition), inequalities (case by case on the
  sign of what is divided by, `inequalities/constants.js`), systems
  (Cramer's rule, D ≠ 0, `systems/constants.js`) and limits with a
  parameter (`limits/parameter.js`; each answer compared with the
  function's values at several values of the parameter). Function analysis
  with a parameter is refused, with a case to try, until it is supported.
- **Exact first.** Fractions and radicals stay exact (18/5, √2, π/6); a
  decimal is shown alongside, "=" when it is the whole value (1/2 (= 0.5)),
  "≈" when rounded (1/3 (≈ 0.3333)): write "(≈ …)" and `finalizeResult`
  corrects an exact one (`exactDecimalSigns`). `formatNumber` honours the `decimalPlaces`
  setting. A root located numerically is shown with ≈, `=` only when it is
  exactly the number shown.
- **Teach the method.** Steps show the working a textbook would (u and dv,
  the discriminant, the sign chart, the LCD), with tips and mistakes chosen
  from the method used, not one generic list.

A large file is a folder of method files behind its entry file, which stays
the only import callers use: `algebraSolver.js` → `algebra/`,
`integralsSolver.js` → `integrals/`, `limitsSolver.js` → `limits/`,
`arithmeticSolver.js` → `arithmetic/`, `functionsSolver.js` → `functions/`,
`inequalitiesSolver.js` → `inequalities/`, `derivativesSolver.js` →
`derivatives/`, `solverUtils.js` → `utils/`, `api.js` → `api/`.
A solver's `guidance.js` holds its tips and mistakes. Imports run one way
— shared helpers → method files → the entry — and a method file never
imports its entry. `tests/golden/record.mjs` records every solve the
project exercises (about 2,200) and compares a refactor against it.

Modules: `arithmeticSolver` (PEMDAS working, exact fractions; gcd, lcm and
mod worked; ≈ beside a rounded decimal, = only beside an exact one), `algebraSolver`
(equations: linear → `linearEquationSolver` in exact fractions; one exponential
with a linear exponent isolated and logged (`solveSingleExponential`); quadratics with
factoring or the formula; cubics and higher by the Rational Root Theorem and
synthetic division (`solveByRationalRoots`, shown step by step) down to a
quadratic, the rest to `polynomialRoots` without calling Algebrite — its
`roots()` grinds for seconds on an irreducible quintic; exp/log/radical/abs
substitutions; Algebrite roots checked for completeness against the degree,
anything above degree 12 to `polynomialRoots`; simplification; factoring),
`polynomialRoots` (exact reader, `factorByRationalRoots`, Sturm counting,
exact bisection, verified complex roots, cap `MAX_POLYNOMIAL_DEGREE` = 100), `systemsSolver` (2×2 Cramer, 3×3 Gaussian,
non-linear by substitution; linearity read off the parse tree by
`linearCoefficientsIn`, the substitution's real roots from the exact root
finder; x and y with constants by Cramer's rule in `systems/constants.js`,
a word in the text never read as constants), `inequalitiesSolver` (sign charts, compound; periodic ones on one
period + every period, their zeros the real roots of a polynomial in the
tangent of the half-angle (`trigonometry/circle.js`); every zero proved
(`inequalities/zeros.js`: the exact root finder, else monotone stretches
between turning points with end signs read off growth rates, convexity for
a wave against a line, branches for an absolute value, squaring for one
square root against a polynomial; refused when not proved; checked
against a dense grid by `tests/crossCheck.test.js`); poles read from the typed expression, so a cancelled factor stays
out; a boundary point decided by the value there; x with constants, linear
or x² against a constant, case by case (`inequalities/constants.js`);
refuses two variables),
`trigonometrySolver` (values, exact only to double precision, else ≈;
identities proved in sin and cos by t = tan(x/2) in exact fractions, with
the domain a simplification loses; A·sin/cos(kx + c) + d = mx + b counted
exactly by convexity and every root located (`trigonometry/rootCount.js`),
where the numeric scan missed roots; c·tan(kx + d) or cot plus terms
defined everywhere has a root on every branch between poles, each located
there (`trigonometry/tanBranches.js`); exports `detectTrigAsymptote`; tips in
`trigonometry/guidance.js`; identities proved in `trigonometry/circle.js`),
`trigEquationSolver` (A·f(kx)+B=C and reducible forms; refuses the rest;
callers use `solveTrigEquationExact` in `trigonometry/factorEquation.js`,
which then writes a mix of functions of one angle in sin and cos, clears,
factors and solves each factor exactly, excluded angles removed),
`functionsSolver` (exact extrema/intercepts/asymptotes: a numeric value is
shown exact only when `recognizeExact` proves it by substitution, else ≈;
polynomial intercepts from the exact root finder; sine and cosine waves as
patterns in n; slant asymptotes; ranges and domains only when proved), `limitsSolver`
(named techniques incl. 1^∞ by logarithms, the conjugate at ±∞, growth rates
read off c·x^p·e^(kx)·ln(x)^m (`limits/growth.js`), each verified; a
function defined on one side only is limited from that side, said so; 0⁰
is never a value; at ±∞, leading powers, the conjugate of two roots and the
limit laws proved from the parse tree (`limits/laws.js`); numeric estimate
last, said to be an estimate on the answer line, and refused when two
ladders of samples disagree or have not settled — never "does not exist"
from samples), `derivativesSolver`
(rule classification and worked rule steps, orders 1–4, evalAt; a power
of a polynomial in the chain rule's own form c·n·P′·P^(n − 1), a ratio of
polynomials as (N′D − ND′)/D² (`derivatives/quotient.js`), never Algebrite's
factor() or simplify there, which ground for 15–150 s; the poles of f′ from
the exact root finder),
`implicitDerivativeSolver` (dy/dx of F(x, y) = 0 term by term, checked by
following the curve; "at (a, b)"),
`integralsSolver` (direct / `substitutionSolver` / a polynomial times a
root of a linear inside, P(x)·(ax + b)^r, by u = ax + b with x written in u
(`integratePolynomialTimesLinearPower`) / `byPartsSolver` /
`trigSubstitutionSolver` (√(a² − b²x²); x^m·(x² ± a²)^(k/2) and
x^m·(a² − x²)^(k/2) by x = a·tan θ / a·sec θ / a·sin θ, worked in θ and
turned back with the triangle) / `trigPowerSolver` (sin^m·cos^n
with an odd power, both even lowered by the half-angle identities to first
powers of cosines (m + n ≤ 12), sec^n and csc^n by u = tan or the reduction formula,
tan^m·sec^n, tan^m) / partial fractions (the denominator factored over the
rationals by the exact root finder, never Algebrite's `factor()`, which
grinds for seconds on x⁴ + 1; coefficients solved exactly; repeated
irreducible quadratics by the reduction formula; incl. c/(x⁴ + a⁴) over √2, and
`surdPartialFractions` for any denominator that factors only over the
reals: factors from the root finder, coefficients recognised as rationals
or quadratic surds, else full-precision decimals shown rounded with ≈; a
repeated real root takes one term per power, its constants the Taylor
coefficients at the root) /
form substitutions u = eˣ and x = u² / a power of a linear inside,
c·(ax + b)^r, by u = ax + b in its own form (`integrals/linearPower.js`) /
definite / improper; a definite
integral with no antiderivative found is estimated numerically and said to
be: two step sizes must agree, an infinite range must settle), `requestSolver` (one thing asked in words, read by
`readRequestPhrases` in `api/requests.js` and dispatched by `solveRequest`: the
period (lcm of the terms' periods), amplitude, tangent-line equation,
inverse (operations undone one at a time, or (ax + b)/(cx + d); checked by
f(f⁻¹(x)) = x) and degrees ↔ radians), `intervalSolver` (average value on
[a, b]; absolute maximum and minimum by the closed interval method:
continuity from the parts, every critical point from the exact root finder
or the equation solvers, refused when not provably complete),
`numberSolver` (primes and prime factorization by trial division; rounding
on the digits as typed, half away from zero).

`solverUtils.js` owns the shared helpers — `beautify`, `formatNumber`,
`splitTerms`, `splitTopLevel`, `stripOuterParens`, `gcd`, `runAlgebrite`,
`loadAlgebrite`, `lnify`, `piForm`, `exactForm` (an Algebrite value as a
textbook writes it: 1/e, √2, π/6), and the structural proofs
`linearCoefficients`, `linearCoefficientsIn` (several variables),
`structuralPeriod`, `definedEverywhere`,
`trigUndefinedPoints`, `neverZeroSide` (facts read off the parse tree: use
these for any "periodic" / "defined everywhere" / "undefined at" / "never
0" claim) — import them, never copy them. Never strip parentheses with `/^\((.*)\)$/`.

**Mark the math in a step, a tip and a mistake.** Wrap every formula in
step, tip and mistake text with `mark()` (from `solverUtils.js`):
`` `Let ${mark(`u = ${g}`)} (the inside).` ``. The renderer typesets exactly
the marked runs, so mark whole formulas and never a word (KaTeX sets words
as italic letters). Tips and mistakes render in `'marked'` mode: unmarked
text there stays prose, never guessed at. In a tip about what to type, the
typed form goes in quotes ("2*x") and stays literal. Markers belong to steps,
tips and mistakes: `finalizeResult` strips them from answers and warnings,
the exporters strip them, and code that reads that text (guidance regexes)
reads `stripMathMarkers(...)`. Tests about wording use
`tests/helpers/solvePlain.js`; `tests/typesetting.test.js` (steps) and
`tests/typesettingTips.test.js` (tips and mistakes) fail on math left in a
plain-text run, a word inside a math run, or a run KaTeX rejects; every
solver is converted (steps 1.51.0, tips and mistakes 1.53.0), so a new
template needs its marks and a problem in
`tests/helpers/typesetProblems.js`. A typed problem (the input preview, the
example buttons, the Progress history) renders in `'input'` mode: words are
prose, the rest is math.

**Rank the tips and mistakes.** Each list is in order of importance and as
long as is useful: the page shows the first three and puts the rest behind
"Show more" (`guidance.js`); exports and history keep all of them. Never
shuffle a list: every student gets the same advice. The first insight is
specific to the method (`tests/tipsByMethod.test.js`); "+C" and "check by
differentiating" go last. An item that uses a named idea from a specific
source is `{ text, source: { title, url } }` (a DOI or publisher link,
`SOURCE_HOSTS`); `finalizeResult` turns it into text and keeps the source in
`result.sources`. Integrals (1.60.0), derivatives (1.61.0), algebra
(1.62.0), limits (1.63.0), functions (1.64.0), trigonometry (1.65.0),
inequalities and systems (1.66.0) and arithmetic (1.67.0) are done, each
with a review document in `docs/future-work/insights-review/`; a new
method gets its list the same way, with a review document first. The second insight works the student's
own problem (read from its steps), and every statement says where it holds.

Algebrite: always through `loadAlgebrite()` (a throwing direct call poisons
every later call; the worker's termination also clears it). mathjs: add a
function to `mathInstance.js` **and** to the battery in
`tests/mathInstance.test.js`. The number-only entry lacks Complex/Fraction, so
keep the full dependency list. `log(…)` typed bare is base 10
(`rewriteCommonLog`); `ln` is natural.

**No mathsteps** (removed 1.39.0: unmaintained, vulnerable nested mathjs,
needs `eval` which the CSP forbids). Never re-add it or any dependency that
needs `eval`; `tests/linearEquation.test.js` checks.

## Graphs

`graph` may carry `expression` / `secondaryExpression` (re-sampled by the
viewer, 400 points per window, gaps at `breaks`), `implicit` (a curve
F(x, y) = 0: `implicitCurve` in `graphSampling.js` traces it for the window
on screen by marching squares, drawn to scale from `implicitYWindow`),
`annotations` (extrema,
intercepts, asymptotes, holes, limit guideline/point, shaded regions,
intersection, open points) and `initialWindow`. The viewer opens on
`initialWindow`, else the window framing the annotations, else `growthWindow`
(the widest ±w in which max|y| ≤ 25× the median — eˣ opens on ±3), else ±10;
whichever is chosen is then passed through `tameWindow` (shrunk about its
centre while the curve explodes at an edge; curves with poles are exempt).
Axis ticks come from `niceTicks` (round steps; y-axes widen to round ends).
Drag pans (horizontal on touch, both axes with a mouse; `touch-action: pan-y`
so the page still scrolls). Zoom (1.72.0): two-finger pinch, Ctrl/⌘ + wheel
and Safari's trackpad `gesture*` events, each about the point under the
fingers or pointer (`zoomWindow` in `graphSampling.js`; the plot measured
off `.recharts-cartesian-grid`); a plain wheel scrolls the page and shows
"Hold Ctrl and scroll to zoom" — never take the wheel. The buttons stay for
the keyboard. Expand opens the same chart in a full-screen dialog (h-dvh,
safe-area padding; focus, Escape and Tab as in the other dialogs; one
`data-export-graph` at a time). `CHART_MARGIN` leaves room for the axis
name "x": at Recharts' 5px it hung past the SVG and was cut off on an
iPhone. The tooltip names series as `f'(x)`, never by
the whole expression. Vertical-line and marker
labels are drawn inside the plot by `LineLabels`/`PointLabel` — never
Recharts' `position: 'top'`, which is clipped. Every graph gets a text
description (`graphDescription.js`). Theme colours come from
`graphPalette.js`, never inline hex: the PDF recolours a dark-mode copy of
the SVG by mapping that palette.

## Exports

Markdown, JSON and CSV are UTF-8 text (`exportUtils.js`, markers stripped).
A solution's PDF is typeset (`pdfTypeset.js`): an off-screen light sheet of
KaTeX HTML (`mathRender.js`, the same renderer as the page) and the graph's
SVG, captured page by page with html2canvas-pro (pages break between
blocks), placed as JPEG images with each block's words as invisible text
for search. The My Progress PDF is typeset the same way
(`buildProgressPDF`). Any failure falls back to the plain-text jsPDF document
(`pdfSafe` transliterates to Latin-1). Toasts open below the header
(`top-20`): at the top they covered the theme button. The smoke test opens the PDF (light
and dark, desktop and phone). html2canvas-pro is pinned at 2.5.0: 2.5.1+
declares `node >= 24` and CI/Netlify run 22. The original html2canvas is
not used directly: it measures font baselines in a box that inherits the
page's line-height (KaTeX drew low) and cannot parse `oklch()`. KaTeX and
html2canvas-pro have their own chunk groups in `vite.config.js`; with two
owners each they would otherwise land in `shared`, which every solve and
the worker load.

## Security and privacy

- `public/_headers`: CSP (self-only scripts, no `eval`, the inline boot
  script in `index.html` — theme before first paint + the stale-shell
  watchdog — allowed by hash; edit that script and
  `tests/securityHeaders.test.js` tells you the new hash), nosniff, frame
  denial, referrer and permissions policies, COOP `same-origin`, and HSTS
  with `includeSubDomains` (never `preload`). `vite preview` serves the same
  file, so the smoke test fails on any CSP violation. A new outside origin
  needs a `connect-src`/`img-src` entry.
- `public/_redirects`: `/.well-known/*` answers 404 before the SPA
  fallback (`/* /index.html 200`); the app publishes no agent manifests, and
  a 200 HTML shell there reads as a broken one (`tests/redirects.test.js`).
- The only outbound request is the Feedback form (Web3Forms), only on submit.
  Privacy wording anywhere must name that exception. "Learn more" and source
  links are plain links (new tab, `rel="noopener noreferrer"`) to the sites in
  `learnMore.js` and `guidance.js`; the app sends them nothing of the user's,
  but a click is an ordinary visit (they see the IP and browser), and the
  Privacy Policy says so.
- `npm audit --omit=dev` runs in CI and must stay clean.
- `/assets/*` is served `max-age=31536000, immutable` (hashed names); nothing
  else gets a Cache-Control rule, so `sw.js` and the shell always revalidate
  (`tests/securityHeaders.test.js`).

## Page weight

The maths libraries load in the solver worker, never on a page's main
thread: a page that imports `api.js` (even for one helper) pulls mathjs in
with it. `tests/buildPreload.test.js` walks the static import graph of the
Solver, Progress and Settings chunks. (Resource timing cannot tell: a module
worker's imports show up in the page's list too.) Images
shown in the UI use `logo-224.webp` (7.8 kB); the manifest has `icon-192.png`,
`icon-512.png` and a padded `icon-maskable-512.png`, made from `favicon.png`
(the 500 px original, referenced by nothing); the tab uses `favicon-32.png`.
Theme colour is indigo `#4F46E5`. The home hero is a real recording of the
Solver (`HeroVideo`, files in `public/hero/` made by
`scripts/record-hero.mjs`; re-record when the Solver's look changes): one
video per visitor (theme, 1600 or 800 wide, WebM then MP4), its poster
preloaded at high priority as the largest paint, the poster alone under
reduced motion, and a pause button. The route
placeholder (`RouteFallback`) is a screen tall so the footer never jumps.

## Tests and verification

- `npm test` — unit suite (node --test), includes the randomized
  cross-check (`tests/crossCheck.test.js`, seeded: answers against a dense
  grid used only as an oracle), the corpus harness
  (`tests/corpus/`: July + September 2026 evaluations, 288 graded problems,
  0 confidently-wrong is the bar), the October 2026 test list
  (`tests/octoberTestList.test.js`, 95 cases from
  `docs/evaluations/2026-10/test-cases.json`) and a build-preload check.
- `npm run smoke` — Playwright against the production build, desktop and
  phone: pages, every example, worker + budget + Cancel, CSP, accessibility
  (axe-core, WCAG 2.1 AA rules, light and dark). Run it after any change to
  `vite.config.js`, chunking, dependencies or a page component — real crashes
  have been invisible to the unit suite.
- Both run in GitHub Actions, and the `deploy` job in `checks.yml` runs only
  after they pass: it builds there and uploads `dist/` with netlify-cli
  (`--no-build`; a push to `main` goes live, a PR gets
  `pr-N--mastermathapp.netlify.app`). Netlify's own builds are off
  (`ignore = "exit 0"` in `netlify.toml`): the free plan's 300 build minutes
  ran out in November 2026. It needs the `NETLIFY_AUTH_TOKEN` repository secret.
- When an outside review lands, reproduce each claim before agreeing, then
  sweep the same class of input for more.

## Release process (required)

Every push to `main` deploys. Any push that changes the app (`src/`,
`public/`, `index.html`, `vite.config.js`, dependencies) must, in the same
push:

1. Bump `package.json` (semver: patch = fixes, minor = features) and run
   `npm install --package-lock-only` (or edit the two lockfile version fields).
2. Add a dated `CHANGELOG.md` entry (Keep a Changelog: Added / Changed /
   Fixed) under `## [Unreleased]`.

The version is single-sourced from `package.json` (footer, Settings, service
worker stamp). Docs-only or test-only pushes need no bump. `git fetch` before
choosing a version number: releases land from other sessions and PRs.

## Conventions

- Math input: `*` and `^` explicit, standard function names; the parser also
  accepts natural notation (`x²`, `2x`, `∫`, `d/dx`). Scientific notation
  (`1e-6`) leaves the parser as its plain decimal (`expandScientific` for a
  solver that reads the typed text): Algebrite reads `1e-6` as `1·e − 6`.
  A repeating decimal (`0.333...`, `0.1666…`) is read as its fraction
  (`readRepeatingDecimals`), and `finalizeResult` says how. Two signs in a
  row are one (`x + -3` is `x-3`): Algebrite stops on `+-`.
- Topic values: `auto` (Auto-detect, the default for a new visitor:
  `detectTopic` in `api/topic.js`; never saved to history, which files under the
  detected topic), `derivatives`, `integrals`, `limits`, `functions`,
  `trigonometry`, `algebra`, `other` (= Arithmetic).
- Dark mode support on every component; respect `prefers-reduced-motion`;
  a `Button` variant without its own text colours (`VARIANT_CLASS` in
  `components/ui/button.jsx`) inherits black in dark mode;
  every page sets its title; icon-only controls carry `aria-label`, or a
  `title` that is their name — never both with the same text (Chrome passes
  the title on as a description, read a second time). A control named by
  `aria-label` hides its visual content (`aria-hidden`), so it is announced
  once; `e2e/a11y.spec.js` checks for double announcements.
- UI must never look AI-powered: Calculator icon, "Calculating…", keep the
  "not AI" disclaimers.
