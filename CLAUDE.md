# CLAUDE.md

Guidance for Claude Code when working in this repository. This file holds the
architecture, the invariants and the process; the history of individual fixes
lives in `CHANGELOG.md`, and the behaviour of each solver is documented at the
top of its own file.

## What MasterMath is

A React app that solves maths problems step by step — arithmetic, algebra,
systems, inequalities, trigonometry, functions, limits, derivatives, integrals —
using local JavaScript maths libraries (mathjs, Algebrite), **not AI**. All data
stays in the browser (IndexedDB, localStorage). Deployed at mastermath.app by
Netlify from `main`.

Branding: **MasterMath** (never MathMaster) by sparkinCreations™; tagline
"Master math with confidence"; positioning is "step-by-step local solver", never
"tutor" or AI-chatbot framing. Palette: indigo (book) and orange (operators) from
the logo; green = answer, amber = tips.

## Layout

```
src/
  App.jsx, Layout.jsx          providers, routes, sidebar/header/footer
  pages/                       Home, Solver, Progress, Settings, FAQ, UserManual, PrivacyPolicy, TermsOfService, Feedback, NotFound (the `*` route)
  components/solver/           ProblemInput (+ SymbolStrip: one-tap symbols from lib/symbolInsert.js, a live KaTeX preview, and the NotationGuide dialog), SolutionDisplay, GraphViewer, GraphEmptyState
  components/ui/               shadcn/ui primitives (Button, Card, Select, Sidebar, Toast, ConfirmDialog, …)
  components/MathText.jsx      KaTeX rendering of solver text (lib/mathRender.js, shared with the PDF; lib/latex.js typesets ⟦…⟧-marked math exactly, unmarked text by clause heuristics)
  contexts/DarkModeContext.jsx theme 'system' | 'light' | 'dark' (lib/theme.js); resolved `isDarkMode` toggles the `dark` class; index.html's boot script applies it before first paint
  hooks/                       usePageTitle, useServiceWorker
  lib/
    api.js                     solveProblem (intent routing) + finalizeResult gate (worker side: imports mathjs)
    problemHistory.js          the history store's IndexedDB wrappers — what pages import; never import api.js from a page
    budgetedSolver.js          the page's entry point: worker, 10 s budget, Cancel, in-thread fallback
    solver.worker.js           runs solveProblem off the main thread
    plainEnglish.js            spoken maths → notation ("x squared", "sine of x", "is greater than", x**3, "two plus one"); first step of solveProblem, and the input preview; no imports
    mathParser.js              notation → mathjs/Algebrite syntax; expression extraction
    validation.js              input length/topic checks
    settings.js                angleUnit, decimalPlaces (localStorage, or primed by message in the worker)
    solutionEnvelope.js        typed result statuses: solved / parse_error / unsupported / undefined / indeterminate / diverges / overflow
    mathInstance.js            mathjs built from an explicit dependency list (tree-shaken)
    graphSampling.js, graphDescription.js, latex.js, mathRender.js, exportUtils.js, indexedDB.js, reveal.js
    pdfTypeset.js              the solution PDF: typeset sheet + graph → html2canvas-pro page images + invisible text layer
    graphPalette.js            the graph's light/dark colours (GraphViewer) and the PDF's dark→light recolouring
    solverPrefs.js             solution mode (step-through default), last topic, the bare-expression nudge
    solvers/                   one module per topic (below) + solverUtils.js shared helpers
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
   then routes by **intent, not topic**: derivative /
   integral / limit notation goes to that solver under any topic; a single
   equation goes to Algebra — except an equation in x and y under Derivatives
   (or with "find dy/dx"), which goes to implicit differentiation, checked
   before the differential-equation refusal; two `=` signs go to systems; a comparison operator
   to inequalities; a trailing "at x = a" is stripped first (`extractEvalPoint`).
   A routed result's first step says so (`routedTopic`), and it carries
   `routing: { from, to, reason }`: the page shows a "Solved as …" notice
   above the steps (with "Switch topic to …", which moves the solved-input
   record with the dropdown so the answer is not cleared) and hides that
   first step; exports and history keep it. A trig function or ° under
   Arithmetic goes to Trigonometry (angle units live there); a leading
   factor / expand / simplify / solve goes to Algebra; a constant that
   divides by zero (and any plain number under Limits) goes to Arithmetic. A word no engine
   knows is a parse error on every path, never a constant: the single-
   expression paths check the extracted expression (`unknownWord`), the
   limit, integral, inequality and system paths the whole problem minus
   instruction words (`unknownWordInProblem`).
4. The solver returns `{ steps[], answer, tips[], common_mistakes[], graph? }`
   wrapped in an envelope status. `finalizeResult` enforces the status and
   refuses anything that is not presentable text (objects, code-shaped
   strings) as `unsupported`.
5. `SolutionDisplay` renders it (KaTeX via `MathText`, which must keep
   `htmlAndMathml` output — the MathML is what screen readers get);
   `GraphViewer` re-samples `graph.expression` for the window on screen.
6. Solved / undefined / indeterminate / diverges results are saved to
   IndexedDB (`MathMasterDB` — legacy name, keep it) under `routedTopic`.

## Solvers (`src/lib/solvers/`)

Each file documents its own methods at the top. Shared invariants:

- **Verify before reporting.** Every equation solution is substituted back
  into the original; every antiderivative is differentiated back; definite
  integrals are cross-checked by quadrature; limits numerically. Extraneous
  roots are rejected with the reason shown.
- **Refuse honestly.** Out-of-family input returns `unsupported`, never a
  guess. Never decide a mathematical property (linearity, completeness of a
  root list) from fixed sample points — construct a proof or refuse.
- **Exact first.** Fractions and radicals stay exact (18/5, √2, π/6); a
  decimal is shown alongside. `formatNumber` honours the `decimalPlaces`
  setting. A root located numerically is shown with ≈, `=` only when it is
  exactly the number shown.
- **Teach the method.** Steps show the working a textbook would (u and dv,
  the discriminant, the sign chart, the LCD), with tips and mistakes chosen
  from the method used, not one generic list.

Modules: `arithmeticSolver` (PEMDAS working, exact fractions), `algebraSolver`
(equations: linear → `linearEquationSolver` in exact fractions; quadratics with
factoring or the formula; cubics and higher by the Rational Root Theorem and
synthetic division (`solveByRationalRoots`, shown step by step) down to a
quadratic, the rest to `polynomialRoots` without calling Algebrite — its
`roots()` grinds for seconds on an irreducible quintic; exp/log/radical/abs
substitutions; Algebrite roots checked for completeness against the degree,
anything above degree 12 to `polynomialRoots`; simplification; factoring),
`polynomialRoots` (exact reader, `factorByRationalRoots`, Sturm counting,
exact bisection, verified complex roots, cap `MAX_POLYNOMIAL_DEGREE` = 100), `systemsSolver` (2×2 Cramer, 3×3 Gaussian,
non-linear by substitution), `inequalitiesSolver` (sign charts, compound; periodic ones on one period + every period; refuses two variables),
`trigonometrySolver` (values, identities; exports `detectTrigAsymptote`),
`trigEquationSolver` (A·f(kx)+B=C and reducible forms; refuses the rest),
`functionsSolver` (exact extrema/intercepts/asymptotes), `limitsSolver`
(named techniques incl. 1^∞ by logarithms, each verified; numeric estimate last), `derivativesSolver`
(rule classification and worked rule steps, orders 1–4, evalAt),
`implicitDerivativeSolver` (dy/dx of F(x, y) = 0 term by term, checked by
following the curve; "at (a, b)"),
`integralsSolver` (direct / `substitutionSolver` / `byPartsSolver` /
`trigSubstitutionSolver` (√(a² − b²x²)) / partial fractions / definite /
improper).

`solverUtils.js` owns the shared helpers — `beautify`, `formatNumber`,
`splitTerms`, `splitTopLevel`, `stripOuterParens`, `gcd`, `runAlgebrite`,
`loadAlgebrite`, `lnify`, `piForm`, and the structural proofs
`linearCoefficients`, `structuralPeriod`, `definedEverywhere`,
`trigUndefinedPoints` (facts read off the parse tree: use these for any
"periodic" / "defined everywhere" / "undefined at" claim) — import them,
never copy them. Never strip parentheses with `/^\((.*)\)$/`.

**Mark the math in a step.** Wrap every formula in step text with
`mark()` (from `solverUtils.js`): `` `Let ${mark(`u = ${g}`)} (the inside).` ``.
The renderer typesets exactly the marked runs, so mark whole formulas and
never a word (KaTeX sets words as italic letters). Markers belong to steps
only: `finalizeResult` strips them from answers, tips and mistakes, the
exporters strip them, and code that reads step text (guidance regexes)
reads `stripMathMarkers(...)`. Tests about wording use
`tests/helpers/solvePlain.js`; `tests/typesetting.test.js` fails on math
left in a plain-text run, or a run KaTeX rejects; every solver is
converted (1.51.0), so a new step template needs its marks and a problem
in that test.

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
viewer, 400 points per window, gaps at `breaks`), `annotations` (extrema,
intercepts, asymptotes, holes, limit guideline/point, shaded regions,
intersection, open points) and `initialWindow`. The viewer opens on
`initialWindow`, else the window framing the annotations, else `growthWindow`
(the widest ±w in which max|y| ≤ 25× the median — eˣ opens on ±3), else ±10;
whichever is chosen is then passed through `tameWindow` (shrunk about its
centre while the curve explodes at an edge; curves with poles are exempt).
Axis ticks come from `niceTicks` (round steps; y-axes widen to round ends).
Drag pans (horizontal on touch, both axes with a mouse; `touch-action: pan-y`
so the page still scrolls); the tooltip names series as `f'(x)`, never by
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
for search. Any failure falls back to the plain-text jsPDF document
(`pdfSafe` transliterates to Latin-1). The smoke test opens the PDF (light
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
  denial, referrer and permissions policies. `vite preview` serves the same
  file, so the smoke test fails on any CSP violation. A new outside origin
  needs a `connect-src`/`img-src` entry.
- The only outbound request is the Feedback form (Web3Forms), only on submit.
  Privacy wording anywhere must name that exception.
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
shown in the UI use `logo-192.png` (23 kB); `favicon.png` is the 500 px
original for the manifest only, the tab uses `favicon-32.png`. The route
placeholder (`RouteFallback`) is a screen tall so the footer never jumps.

## Tests and verification

- `npm test` — unit suite (node --test), includes the corpus harness
  (`tests/corpus/`: July + September 2026 evaluations, 288 graded problems,
  0 confidently-wrong is the bar) and a build-preload check.
- `npm run smoke` — Playwright against the production build, desktop and
  phone: pages, every example, worker + budget + Cancel, CSP, accessibility
  (axe-core, WCAG 2.1 AA rules, light and dark). Run it after any change to
  `vite.config.js`, chunking, dependencies or a page component — real crashes
  have been invisible to the unit suite.
- Both run in GitHub Actions; Netlify's build runs `npm test` before building,
  so a red unit suite blocks the deploy.
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
  accepts natural notation (`x²`, `2x`, `∫`, `d/dx`).
- Topic values: `derivatives`, `integrals`, `limits`, `functions`,
  `trigonometry`, `algebra`, `other` (= Arithmetic).
- Dark mode support on every component; respect `prefers-reduced-motion`;
  a `Button` variant without its own text colours (`VARIANT_CLASS` in
  `components/ui/button.jsx`) inherits black in dark mode;
  every page sets its title; icon-only controls carry `aria-label`.
- UI must never look AI-powered: Calculator icon, "Calculating…", keep the
  "not AI" disclaimers.
