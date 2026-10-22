# MasterMath — Future Work Roadmap (October 2026)

**Version referenced:** 1.49.1 (written against 1.48.0)
**By:** sparkinCreations™
**Last Updated:** October 21, 2026
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
8. [P4 — Carried Over: Sequences & Series; Practice Mode](#p4--carried-over-sequences--series-practice-mode)
9. [Decided Against, and Why](#decided-against-and-why)
10. [Known Engine Limitations](#known-engine-limitations)

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
| P1 | Typeset every step (explicit math markers) | About one step in ten still mixes plain-text math with typeset math; the renderer guesses which fragments are math | 1–2 days |
| ~~P1~~ | ~~Implicit differentiation~~ | **Shipped in 1.49.0** | — |
| ~~P2~~ | ~~`(1 + a/x)^(bx)` limits by a named technique~~ | **Shipped in 1.49.0** | — |
| P2 | PDF export with typeset steps and the graph | The PDF is plain text: ± as "+/-", x² as x^2, no graph; Markdown and JSON are complete | 1 day |
| P3 | Tips chosen by method, everywhere | Reviews still find generic or off-topic tips on some paths | ½ day sweep |
| P4 | Sequences & series; practice mode | Carried over from September | — |

---

## P1 — Typeset Every Step: Explicit Math Markers

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

---

## P4 — Carried Over: Sequences & Series; Practice Mode

Unchanged from [`ROADMAP.md`](ROADMAP.md#p4--new-topic-sequences--series);
neither was raised by any October review.

---

## Decided Against, and Why

Recorded so they are not re-opened without a new argument.

| Suggestion | Decision | Reason |
|---|---|---|
| Final answer above the graph and the steps | **No** | The app teaches the method. Step-through (the default since v1.47.0) holds the answer back until the last step; an answer-first layout would contradict it. Graph → steps → answer stays. |
| Toasts stack and cover the theme toggle | **No** | Judged a nitpick: toasts auto-dismiss, and the error toast is now cleared by the next solve (v1.48.0). |
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
| Exact inequality endpoints | `e^x > 2` gives `x > 0.6931` | Should be x > ln 2 (≈ 0.6931); the endpoint is exact, and a located one needs ≈ |
| Implicit curve plot | Implicit derivatives have no graph | A contour plot of F(x, y) = 0 with the tangent at the point |

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
  non-elementary note where one applies (erf, Si, Fresnel).
- **Polynomials above degree 100** — refused.
