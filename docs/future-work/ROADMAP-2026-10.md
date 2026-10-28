# MasterMath — Future Work Roadmap (October 2026)

**Version referenced:** 1.56.0 (written against 1.48.0, kept current since)
**By:** sparkinCreations™
**Last Updated:** October 26, 2026
**Supersedes:** [`ROADMAP.md`](ROADMAP.md) (September 2026; 11/13 shipped, the two P4 items carry over below)
**Source:** [`../evaluations/2026-10/REVIEW-LOG-2026-10.md`](../evaluations/2026-10/REVIEW-LOG-2026-10.md) — six outside review rounds against v1.41–v1.48, every claim reproduced before it was accepted

---

## Table of Contents

1. [Where This List Comes From](#where-this-list-comes-from)
2. [Priority Overview](#priority-overview)
3. [P1 — Typeset Every Step: Explicit Math Markers](#p1--typeset-every-step-explicit-math-markers)
4. [P1 — Implicit Differentiation](#p1--implicit-differentiation)
5. [P2 — Limits of the Form (1 + a/x)^(bx): a Named Technique](#p2--limits-of-the-form-1--axbx-a-named-technique)
6. [P2 — PDF Export With Typeset Steps and the Graph](#p2--pdf-export-with-typeset-steps-and-the-graph)
7. [P3 — Tips Chosen by Method, Everywhere](#p3--tips-chosen-by-method-everywhere)
8. [P3 — Wordy Requests and Display Gaps (October 24)](#p3--wordy-requests-and-display-gaps-october-24)
9. [P4 — Carried Over: Sequences & Series; Practice Mode](#p4--carried-over-sequences--series-practice-mode)
10. [Decided Against, and Why](#decided-against-and-why)
11. [Known Engine Limitations](#known-engine-limitations)
12. [Shipped October 22–26 (1.53.0–1.56.0)](#shipped-october-2226-15301560)

---

## Where This List Comes From

Between the first review on October 20 and v1.48.0 on October 21 the app
shipped twelve releases in two days: the system theme and the first-paint theme class,
the Symbols strip with a live preview, grouped symbols and a Clear
button, the Notation guide, step-through by default, structural proofs for
"periodic" and "defined everywhere", trigonometric substitution, the
partial-fraction walkthrough first, round axis ticks, tamed graph windows,
dark-mode contrast on every control, a 404 page, honest refusals for
differential equations and matrices, and two dozen smaller fixes. Each
came from an outside review claim that was reproduced on the build before
being accepted (the project rule: *reproduce each claim before agreeing,
then sweep the same class of input for more*).

What is left is what could not be done in a day: four pieces of real work,
one sweep, and two carried-over ideas. The review log records every claim,
including the ones that were not reproduced and the ones rejected on
purpose, so the next reviewer does not re-raise them.

---

## Priority Overview

| Priority | Item | Why it matters | Effort |
|---|---|---|---|
| ~~P1~~ | ~~Typeset every step (explicit math markers)~~ | **Shipped in 1.50.0 and 1.51.0** (every solver) | — |
| ~~P1~~ | ~~Implicit differentiation~~ | **Shipped in 1.49.0** | — |
| ~~P2~~ | ~~`(1 + a/x)^(bx)` limits by a named technique~~ | **Shipped in 1.49.0** | — |
| ~~P2~~ | ~~PDF export with typeset steps and the graph~~ | **Shipped in 1.52.0** | — |
| ~~P3~~ | ~~Tips chosen by method, everywhere~~ | **Shipped in 1.55.0** (equations, inequalities, logarithms and roots in 1.53.2–1.54.0; the Functions defaults and the limits fallbacks now): `tests/tipsByMethod.test.js` fails when two methods share a first tip | — |
| ~~P3~~ | ~~Wordy requests and display gaps~~ | **Shipped in 1.55.0 and 1.56.0**: the period, amplitude, tangent-line equation, inverse, degrees ↔ radians (1.55.0); average value, maximum and minimum on an interval, primes, rounding (1.56.0); complex roots, erf, ln(e²), partial-fraction display | — |
| ~~P3~~ | ~~Implicit curve plot~~ | **Shipped in 1.56.0**: the curve traced to scale, with the tangent at the point | — |
| ~~P3~~ | ~~General partial fractions within the budget~~ | **Shipped in 1.53.1**: under a second, improper fractions divided first | — |
| P4 | Sequences & series; practice mode | Carried over from September | — |

---

## P1 — Typeset Every Step: Explicit Math Markers

> **First increment shipped in 1.50.0.** The renderer honours ⟦…⟧
> (`src/lib/mathMarkers.js`, `mark()` from `solverUtils.js`); malformed
> markers fall back to the heuristics; `finalizeResult`, the exporters and
> `sanitizeInput` keep markers out of answers, tips, files and input.
> Converted: derivatives, implicit derivatives, limits, integrals (with
> substitution, parts, trig substitution, partial fractions), algebra
> (factoring, formula, Rational Root Theorem, synthetic division, radical,
> exp and log equations) and Functions. Measured on 51 typical problems:
> steps with math in a plain-text run, 96 of 331 → 9. Every marked run
> renders in KaTeX. `tests/typesetting.test.js` guards the converted set.
>
> **Finished in 1.51.0.** `systemsSolver`, `inequalitiesSolver`,
> `trigonometrySolver`, `trigEquationSolver`, `arithmeticSolver`,
> `linearEquationSolver` and the rarer integral paths (erf, an endpoint
> singularity, an interior asymptote, the general partial-fraction pieces)
> are converted. Measured on 66 more problems: leaky steps 80 of 342 → 0
> (KaTeX failures 0). `tests/typesetting.test.js` now covers 107 problems
> across every solver.
>
> **Found on the way (open):** `∫ (x+1)/((x−1)²(x²+1)) dx` takes about
> 115 s in Node (the same on 1.50.0), so in the app the 10 s budget stops
> it and the answer is "could not finish". The general partial-fraction
> path needs profiling; it is not in the typesetting test for that reason.

**Finding (reviews 3, 5 and 6).** Steps such as *"The integrand has the
form √(a² − x²) with a = 1: substitute x = sin θ …"* or *"write the
coefficients 1, (−6), 11, (−6); bring down 1"* render partly as plain
text and partly as KaTeX. A reviewer saw "cos is italic while sin isn't":
the same thing, a `cos` inside a prose clause next to a typeset one.
Measured across ten typical problems: 69 steps, 48 fully typeset, 15 pure
prose, **6 mixed**.

**Cause.** `src/lib/latex.js` (`segmentMathText`) decides what is math
from vocabulary: a clause is typeset when it has a math signal and no
prose words. Clauses that interleave words and math ("the coefficients 1,
(−6), 11, (−6)") cannot be classified by any heuristic; only the author
knows where the math starts and stops. The clause splitter added in
v1.43.0 got the easy cases ("Let u = … and w = …"); the rest need intent.

**Approach.**
1. Renderer: `segmentMathText` honours an explicit marker pair (for
   example `⟦…⟧`, or `$…$` if no step text ever contains a dollar sign)
   and typesets exactly what is marked, falling back to today's heuristics
   for unmarked text. One hour with tests.
2. Templates: mark the math in the solver step strings, file by file.
   There are about 580 step-template sites across `src/lib/solvers/`
   (`grep -c "steps.push(" src/lib/solvers/*.js`). Start with the visible
   ones — the cubic working, the trig substitution, the chain rule, the
   Functions steps, the integration labels such as "(Power rule)" — then
   sweep.
3. Tests: dozens of unit tests match on raw step text; either strip the
   markers in a `plainStep()` helper used by the tests, or update the
   assertions as each file is converted. The corpus harness grades answers
   only and is unaffected if markers stay out of `answer`.

**Acceptance.** The six mixed steps above render as one typeset run each;
`segmentMathText` tests cover marked, unmarked and malformed input; no
marker ever reaches an export (Markdown/JSON/PDF strip them).

---

## P1 — Implicit Differentiation

> **Shipped in 1.49.0** (`src/lib/solvers/implicitDerivativeSolver.js`).
> Every acceptance case passes, with corpus rows; also "find dy/dx if …"
> from any topic, `xy` read as x·y, and "at (a, b)" with off-curve,
> vertical-tangent and singular-point answers. Verified by following the
> curve numerically rather than at a solved-for y. One change from the plan:
> **no graph** — a tangent line drawn without its curve explained nothing,
> and plotting an implicit curve is a separate piece of work (below).
> The same sweep found y = f(x) and f(x) = … under Derivatives answered
> "already in simplest form"; fixed too.

**Finding (review 6).** `x^2 + y^2 = 25` under Derivatives is routed to
Algebra ("the input is an equation to solve") and solved for x in terms
of y. The routed step says what happened, so it is honest, but it is not
what the topic asked for.

**Approach.** In `api.js`, an equation under Derivatives whose sides
contain two variables (the chosen variable and one other) goes to a new
`implicitDifferentiation` path in `derivativesSolver.js`:

- Write F(x, y) = LHS − RHS = 0.
- dy/dx = −F_x / F_y, both partials from Algebrite (`d(F, x)`, `d(F, y)`),
  shown as the textbook does it: differentiate both sides term by term,
  every y-term picking up a dy/dx by the chain rule, collect, divide.
- Verify numerically: pick a point on the curve (solve for y at a sample
  x), compare the slope with a finite-difference slope along the curve.
- Refuse when F_y ≡ 0 (no y) or when the chain-rule term-by-term working
  cannot be produced (fall back to the formula with a note, never to the
  Algebra route).
- "at (3, 4)" evaluates dy/dx there, through `extractEvalPoint`.
- Graph: the curve as an implicit plot is out of scope; show the tangent
  at the evaluation point if one was given, else no graph.

**Acceptance.** `x^2 + y^2 = 25` → dy/dx = −x/y with the term-by-term
working; `x*y = 1`, `y^3 + x = 2`, `sin(y) = x`; the Algebra route is
never taken for a two-variable equation under Derivatives; corpus rows
added.

---

## P2 — Limits of the Form (1 + a/x)^(bx): a Named Technique

> **Shipped in 1.49.0** (`tryOneToInfinity` in `limitsSolver.js`). Any B^E
> with B → 1 and E → ±∞ at 0 or ±∞ where E·(B − 1) simplifies to a
> constant or an equal-degree rational: e, e², 1/e, √e, e^(−6), e⁹ and 1
> all proved; the sampling fallback is no longer reached for the family.

**Finding (review 6).** `lim x->∞ (1 + 1/x)^x` returns e with the steps
*"Evaluate the function at increasingly large positive values … The values
settle toward e"*. The project rule is proofs first, numeric estimate
last; this family has a one-line proof and every course names it.

**Approach.** In `limitsSolver.js`, a technique before the numeric
fallback:

- Recognise `(1 + a/x)^(bx)`, `(1 + a/x)^(bx + c)`, `(1 + ax)^(b/x)` as
  x → ∞ or x → 0 (structurally, via `linearCoefficients`), including
  `(x/(x+1))^x`-type rewrites where the base is `1 + a/(x + d)`.
- Steps: set L = the limit, take ln: ln L = lim bx·ln(1 + a/x); rewrite as
  the standard limit lim (ln(1 + u)/u) = 1 with u = a/x, or by L'Hôpital on
  ln(1 + a/x) / (1/(bx)); so ln L = ab and L = e^(ab).
- Verify numerically as the other techniques are.

**Acceptance.** e, e², e^(−1), e^(1/2) cases with the named working;
`(1 + 1/x)^(2x + 3)` → e²; the sampling fallback is no longer reached for
this family.

---

## P2 — PDF Export With Typeset Steps and the Graph

> **Shipped in 1.52.0.** `pdfTypeset.js` lays the solution out as a light
> HTML sheet (KaTeX through `mathRender.js`, the page's own renderer, and
> the graph's SVG recoloured to the light palette), captures it page by
> page with html2canvas-pro and places the pages as JPEG images, breaking
> between steps, with every block's words as an invisible text layer. The
> plain-text PDF remains the fallback. The cubic example: 2 pages, about
> 550 kB, ± and x² as themselves, the graph on page 2. Measured on the way:
> html2canvas 1.4 drew KaTeX 2–3 px below the prose (its font baseline is
> measured in a box with the page's line-height) and threw on Tailwind 4's
> `oklch()` colours; html2canvas-pro measures on the canvas and parses
> them. The smoke test opens the PDF in light and dark mode on desktop and
> phone and checks its pages, images, text layer and size.

**Finding (review 6).** The PDF is plain text: jsPDF's built-in fonts are
Latin-1, so `exportUtils.js` substitutes "+/-" for ±, "x^2" for x², and
the graph is absent. Markdown and JSON are complete (JSON carries the graph
points).

**Approach.** html2canvas already ships inside the jsPDF chunk
(`exportUtils.js` notes it at ~600 kB total, loaded only on export).
Render the on-screen solution card (KaTeX output) and the graph's SVG to
canvases and place them in the PDF as images, page-broken by step; keep
the plain-text version as the fallback when canvas rendering fails
(private mode, a blocked canvas) and as the text layer for search. Mind
dark mode: render against a white background regardless of theme.

**Acceptance.** A PDF of the cubic example shows typeset steps and the
graph; ± and x² appear as themselves; the file is under 1 MB for a
typical solution; export still works offline; the smoke test opens the
PDF blob and checks its page count.

---

## P3 — Tips Chosen by Method, Everywhere

Three reviews said tips are "sometimes generic or off-topic". The
v1.38.1 and v1.43.0 passes keyed tips to the method for equations,
integrals, derivatives and cubics; the remaining generic sets are the
Functions and Arithmetic defaults and the fallbacks in the trig and limits
solvers. Sweep each `tips:` site, name the method that produced the
result, and write the tip for that method. Add a unit test that fails when
two different methods in one solver share the same tip array.

**Shipped in 1.55.0.** Functions picks its tips by family (quadratic,
periodic, logarithm, rational, exponential, root, polynomial); Limits by
technique, now including direct substitution, the conjugate, the squeeze
theorem, Taylor series, L'Hôpital and oscillation. `tests/tipsByMethod.test.js`
solves one problem per method in six solvers and fails when two lead with
the same tip.

---

## P3 — Wordy Requests and Display Gaps (October 24)

Found while reproducing the 8.5/10 review (round 13 of the review log).

**Requests typed in words** that are still refused as unreadable: "the
period of sin(2x)", "the amplitude of 3sin(x)", "the equation of the
tangent line to x^2 at x = 1", "the inverse of 2x + 3", "convert 30 degrees
to radians", "the average value of x^2 on [0, 3]", "the maximum of … on an
interval", "is 17 prime", "round … to two decimal places". 1.54.0 reads the
common ones (zeros, critical points, vertex, slope of the tangent, gcd/lcm,
the definite integral, area under a curve) and says the rest are words it
could not read.

**Display:** a complex quadratic root shows as "-3/4 - 1/4\*i\*√31", not
(−3 ± i√31)/4; the erf derivative is labelled the power rule and shows √π as
pi^(1/2); ln(e²) is worked through the decimal 7.3891; partial-fraction
steps write ln|x² + 1| (the bars are not needed) and an ambiguous "1/2x".

**Shipped in 1.55.0** (`requestSolver.js`): the period (exact, the least
common multiple for a sum; refused for sin(x)², proven not periodic for
sin(x) + sin(πx)), the amplitude (|A|, and √(a² + b²) for a·sin + b·cos),
the tangent line (point, slope, point–slope form; refused at a corner or a
point off the curve), the inverse (operations undone one at a time, or
(ax + b)/(cx + d) cross-multiplied; refused when not one-to-one, checked by
f(f⁻¹(x)) = x) and degrees ↔ radians (exact as a multiple of π). All four
display gaps are fixed. **Shipped in 1.56.0** (`intervalSolver.js`,
`numberSolver.js`): the average value on an interval, the absolute maximum
and minimum on a closed interval by the closed interval method, "is 97
prime" and the prime factorization, and rounding to decimal places,
significant figures or a place.

---

## P4 — Carried Over: Sequences & Series; Practice Mode

Unchanged from [`ROADMAP.md`](ROADMAP.md#p4--new-topic-sequences--series).
The October 25 reviewer named both as what MasterMath is not for (Taylor
expansions; drills and quizzes) and counted them as scope, not bugs: the
User Manual does not claim either.

---

## Decided Against, and Why

Recorded so they are not re-opened without a new argument.

| Suggestion | Decision | Reason |
|---|---|---|
| Final answer above the graph and the steps | **No** | The app teaches the method. Step-through (the default since v1.47.0) holds the answer back until the last step; an answer-first layout would contradict it. Graph → steps → answer stays. |
| ~~Toasts stack and cover the theme toggle~~ | **Reversed in 1.54.0** | Judged a nitpick in v1.48.0. It was the cause of a reported one-second theme switch: the "Problem solved!" toast sat over the theme button for six seconds, so the click went to the toast. Toasts now open below the header, and a smoke test checks the button is clickable right after a solve. |
| Text under the three-icon feature box on the home page | **No** | The labels say what the app does; the Features section below explains each. More hero text helps no one. |
| "Solved locally" wording | **Keep** | Owner's choice. |
| Grey text is small and low-contrast | **No change** | Every page passes the WCAG AA audit in both themes; body grey on white is 7:1. |
| Content column narrow on wide screens | **No** | Capped near 1,150 px on purpose; full-width step text would run to 200 characters a line. |
| "Skip to input" shortcut (reviewer counted ~20 tabs) | **No** | Measured 7 tabs from the top, 2 with the existing skip link. |
| Symbol strip buttons "about 29 px" | **No** | They measure 44 CSS px; a desktop browser zoomed to a phone width rescales what a pixel means. |
| Sticky header "a quarter of the phone screen" | **No** | 74 px of a 664 px phone viewport, 11%. |
| Privacy and Terms "Last updated" dates differ | **Not a bug** | Privacy changed in October for the security-header work; Terms has not changed since March. Both dates are true. |

## Found in the 1.49.0 Sweep, Not Yet Done

| Item | What happens | Note |
|---|---|---|
| Two-variable inequalities | `x + y > 2` was answered "No solution" | **Fixed in 1.49.0**: refused honestly. Graphing the region is new work. |
| Periodic inequalities | `sin(x) > 1/2` listed intervals only inside ±50, without saying the pattern repeats | **Fixed in 1.49.1**: solved on one period and stated for every period. Periodic with breaks (tan) is refused. |
| Exact inequality endpoints | `e^x > 2` gave `x > 0.6931` | **Fixed in 1.53.1**: x > ln(2) (≈ 0.6931); √2, ∛2, (1 ± √5)/2 exact; a located root is said to be one. Also fixed: x³ − 2 > 0 was "No solution", ln(x) < 1 included x ≤ 0. |
| Implicit curve plot | Implicit derivatives had no graph | **Shipped in 1.56.0**: F(x, y) = 0 traced by marching squares for the window on screen, to scale, with the tangent at the point |

**Not reproduced, fixed anyway:** the topic list "stuck open until Escape"
(closed only on losing focus; now closes on an outside tap, v1.47.0).

---

## Known Engine Limitations

Honest refusals, each with a message that says so:

- **Differential equations** (`y'' + y = 0`, `dy/dx = 2x`) — refused since
  v1.48.0; before that the algebra path answered 0.
- **Matrices** (determinants, inverses, eigenvalues, products) — refused
  since v1.48.0.
- **Trig equations outside the reducible families** — solved numerically
  under Trigonometry, with the steps saying so.
- **Limits outside the named techniques** — numeric estimate, stated as
  such.
- **Inequalities in two variables** — refused since v1.49.0; before that
  they were answered "No solution".
- **Integrals the engine cannot do** — `unsupported`, with the
  non-elementary note where one applies (erf, Si, Fresnel). A definite
  version is estimated numerically since 1.57.0 (two step sizes must
  agree; an infinite range must settle). Still one-line answers rather
  than worked: a product of even powers of sin and cos (sin²x·cos²x,
  labelled "Trigonometric identity" but not reduced step by step),
  √(ax + b) under a product (x·√(x + 1) is answered by Algebrite's own
  substitution). A denominator that factors only over the reals is worked
  since 1.57.0 (1/(x⁵ + 1) with √5; 1/(x³ − 2) with the cube root kept to
  full precision and the answer marked ≈); a repeated irrational factor
  ((x² − 2)²) is still a one-line answer or a refusal.
- **Polynomials above degree 100** — refused.
- **Sequences, series and Taylor expansions** — not a topic yet (roadmap
  P4); the October 25 reviewer counted it as scope, since the User Manual
  does not claim it.
- **Practice drills and quizzes** — MasterMath solves what is typed; it does
  not set problems (roadmap P4, practice mode).
- **Numbers past a float's range** — whole numbers and fractions built from
  + − × ÷ ^ ! are exact at any size (1.55.2–1.55.3); anything with a root,
  a function or π past 2^53 or below the decimal setting is shown as
  ≈ m × 10^k, never as an exact-looking float.
- **Equations a search cannot settle** — since 1.55.3 a numeric search
  that finds nothing is a refusal, not "no real solution". The e^x
  substitution takes negative exponents since 1.56.2, so e^x + e^(−x) = 1
  is proved to have no real solution (u² − u + 1 = 0 has a negative
  discriminant); an equation outside every exact method, x·e^x = −1 say,
  is still refused rather than declared solution-free.
- **Complex numbers** — arithmetic with i is worked (1.55.2); complex
  functions (e^(iπ) aside, which Algebra simplifies), polar form and complex
  roots of equations beyond the quadratic formula are not.

---

## Shipped October 22–26 (1.53.0–1.56.0)

| Release | What |
|---|---|
| 1.53.0 | Auto-detect as the default topic; examples easiest first; tips, mistakes, example buttons and history typeset; screen readers announce each control once |
| 1.53.1 | Real roots of one equation in two unknowns in textbook form; cancelled factors state their zero; exact inequality endpoints; partial fractions within the budget |
| 1.53.2 | The October test list (95 cases) in the suite; f′(x) notation read as a whole; one exponential isolated and logged exactly; each derivative rule named; tips by method for quadratics and inequalities |
| 1.54.0 | Simplest radical form; logarithms worked as typed; word problems refused as such; request phrases read; one history entry per problem; typeset My Progress PDF; the toast off the theme button |
| 1.55.0 | The period, amplitude, tangent-line equation, inverse and degrees ↔ radians typed in words; tips by method in Functions and Limits; complex roots, erf, ln(e²) and partial fractions displayed as a textbook would |
| 1.55.1 | `int` as ∫; integral and derivative without "of"; "integral from a to b of"; "with respect to x" on an integral (was answered f′(x) = 0) |
| 1.55.2 | Exact big whole numbers (BigInt); ≈ m × 10^k for what a float cannot show (2^-60 was 0); complex arithmetic worked; the domain step marked per condition; exports titled by the solved topic; multi-digit exponents typeset |
| 1.55.3 | Results too small or too large for a float kept as exact fractions (2^-60 = 1/1152921504606846976); complex answers typeset; spacing before "(≈ …)" |
| 1.56.0 | Average value on an interval; absolute maximum and minimum on a closed interval; primes and prime factorization; rounding; implicit curves graphed with the tangent at the point |
