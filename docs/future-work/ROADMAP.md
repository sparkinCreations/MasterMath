# MasterMath — Future Work Roadmap

**Version referenced:** 1.12.0
**By:** sparkinCreations™
**Last Updated:** July 12, 2026

---

## Table of Contents

1. [Where This List Comes From](#where-this-list-comes-from)
2. [Priority Overview](#priority-overview)
3. [P0 — Undefined Trig Values](#p0--undefined-trig-values)
4. [P1 — Quadratic Function Insights](#p1--quadratic-function-insights)
5. [P1 — KaTeX Math Rendering](#p1--katex-math-rendering)
6. [P2 — Graph Annotations](#p2--graph-annotations)
7. [P0 — Regression Harness Over the Evaluation Corpus](#p0--regression-harness-over-the-evaluation-corpus)
8. [P3 — Integration by Parts Walkthrough](#p3--integration-by-parts-walkthrough)
9. [P3 — Technique-Aware Limit Explanations](#p3--technique-aware-limit-explanations)
10. [P4 — Tutor Mode (Step Interactivity)](#p4--tutor-mode-step-interactivity)
11. [Known Engine Limitations](#known-engine-limitations)
12. [Explicitly Out of Scope](#explicitly-out-of-scope)

---

## Where This List Comes From

Three inputs, merged and verified in July 2026. They graded **different
things**, so their scores are not in conflict — read together they tell one
story: strong presentation, real correctness gaps on the edges.

1. **A usability/pedagogy review** (early July 2026) that worked
   well-formed problems and graded presentation, explanations, and teaching
   value — praising it as "starting to feel like a real educational tool
   rather than just a calculator." This is what drove the worked-step and
   dark-mode work.
2. **A correctness evaluation** (mid-July 2026): 91 problems, black-box
   against the live app, every answer independently verified with SymPy and
   classified Correct / Partial / Incorrect. It scored **~78% (16 wrong
   answers)** and is what drives the correctness items below. Full analysis:
   [`../evaluations/2026-07/ANALYSIS.md`](../evaluations/2026-07/ANALYSIS.md).
3. **An internal code assessment** done alongside the solver overhaul
   (worked-solution steps, indigo/orange rebrand, dark mode fixes).

The two external reviews are complementary, not contradictory: the first
measured *how well it teaches* on problems it can solve; the second measured
*how often it is right* across a hard, adversarial set. A tool can be
excellent at the former and still have the correctness gaps this roadmap now
prioritizes.

Every mathematical claim below was **verified against the actual solvers**
before being written down — including reproducing the bugs. Where a review
and the code disagreed, the code's behavior is what's documented.

---

## Priority Overview

**Priority = severity (how wrong is the current behavior). Sequence = the
order to actually do the work, which also weighs effort.** They differ:
everything in the P0 *correctness* tier is equally "must fix," but the cheap,
high-yield perimeter fixes go first because they clear ~10 of 16 wrong
answers in a single sitting, while the Functions rebuild is a medium engine
job. Do them in Wave order; treat the P0s as one severity class.

| # | Item | Priority | Effort | Type | Wave |
|---|------|----------|--------|------|------|
| 1 | ~~Undefined trig values (`tan(π/2)`)~~ ✅ Fixed July 2026 | **P0** | Small | Bug | — |
| 2 | ~~Regression harness over the 91-row eval CSV~~ ✅ Done v1.4.0 (`tests/corpus/`, math-equivalence grading, wired into `npm test`) | **P0** | Medium | Quality | 1 |
| 3 | ~~Input-perimeter fixes (arctan, `!`, `C(n,k)`, `ln` alias, abs-limit gate, `ln\|x\|`) + refuse-clearly guards~~ ✅ Done v1.4.0 — **0 confident-wrong on the corpus**. ~~Tail: one-sided limits, factor verb, exact-radical form, symbolic trig identity~~ ✅ Done v1.7.0 (all four, each verified numerically before being claimed) | **P0** | Small–Med | Bug | 1 |
| 4 | ~~Functions/Graphing rebuild~~ ✅ Done v1.5.0 (`functionsSolver.js`: f′-based extrema, verified intercepts, domain + asymptotes; all 10 eval rows pass) | **P0** | Medium | Engine | 2 |
| 5 | ~~Quadratic insights (axis of symmetry, opens up/down)~~ ✅ Done v1.5.0 (folded into #4) | P1 | Small | Feature | 2 |
| 6 | ~~KaTeX math rendering~~ ✅ Done v1.6.0 (typeset steps/answers, offline, plain-text fallback) | P1 | Medium | Feature | 3 |
| 7 | ~~Graph annotations~~ ✅ Done v1.6.0 (extrema, intercepts, asymptotes, limit guideline + L marker; plus height controls and clamped 4-way pan) | P2 | Medium | Feature | 3 |
| 8 | ~~Definite integrals~~ ✅ Done v1.9.0 (`defint` via FTC, worked steps, Simpson cross-check + improper-integral guard, shaded-area graph) | P2 | Medium | Feature | — |
| 9 | ~~Systems of equations~~ ✅ Done v1.10.0 (`systemsSolver.js`: 2×2 linear via Cramer's rule in exact fractions, substitution steps, unique/parallel/dependent trichotomy, intersection graph) | P3 | Medium | Feature | — |
| 10 | ~~Inequalities (roots + sign chart)~~ ✅ Done v1.11.0 (`inequalitiesSolver.js`: linear/polynomial/rational, sign chart with correct open/closed endpoints, shaded-region graph) | P3 | Medium | Feature | — |
| 11 | ~~Integration by parts walkthrough~~ ✅ Done v1.12.0 (`byPartsSolver.js`: LIATE-driven ∫u dv = uv − ∫v du, repeated + cyclic by-parts, per-term walkthroughs, differentiate-back verification) | P3 | Large | Engine | — |
| 12 | ~~Technique-aware limit explanations~~ ✅ Largely done July 2026 (symbolic ladder: simplify → Taylor → L'Hôpital; squeeze/rationalize narration still open) | P3 | Large | Engine | — |
| 13 | ~~Tutor mode (reveal-one-at-a-time steps)~~ ✅ Done v1.8.0 — "Show all / Step through" toggle; answer/tips/mistakes gated until every step is revealed | P4 | Medium | UX | — |

"Effort" is relative to this codebase: Small = one sitting, Medium = a few
sittings, Large = real engine work that needs its own design pass.

**Why Functions/Graphing is P0, not a feature (#4):** fabricating a vertex for
`exp(x)` or inventing x-intercepts at −10/−9.5/−9 is a *wrong answer*, the same
severity class as a wrong limit — not a missing capability. It scored 2/10 in
the evaluation.

**The refuse-clearly guard (in #3) is the hinge that downgrades the rest of the
list.** Definite integrals (#8), systems (#9), and inequalities (#10) sit low
*because* they will refuse clearly after Wave 1 instead of mis-answering.
Today they parse to nonsense and hand back a confident wrong number — a P0
correctness harm. The moment a guard says "I can't solve this yet," the harm is
gone and *building* the capability becomes an optional P2/P3 feature. Trustworthy
does not mean "solves everything"; it means "never confidently wrong," and the
guard buys that far ahead of the features.

> **July 2026 external evaluation:** 91 problems, black-box, ~78% (16 wrong).
> Every failure reproduced and root-caused — see
> [`../evaluations/2026-07/ANALYSIS.md`](../evaluations/2026-07/ANALYSIS.md).
> ~10 of the 16 wrong answers are input-perimeter bugs (Wave 1), not missing math.

---

## P0 — Undefined Trig Values

> **✅ Fixed (July 2026).** `solveTrigonometry` now detects vertical
> asymptotes (argument within epsilon of a zero of the relevant denominator,
> or a result magnitude past 1e12) and returns "Undefined" with an
> explanatory step. Covers tan/sec at odd multiples of π/2 and cot/csc at
> multiples of π, in both radian and degree inputs. The Limits topic is
> guarded too: a constant expression on an asymptote (`tan(pi/2)`) returns
> "Undefined", and a limit approaching one (`lim x->pi/2 tan(x)`) reports
> one-sided divergence instead of the float blow-up. Tests added in
> `tests/solvers.test.js`.

**The bug (verified):** `tan(pi/2)` returns `16331239353195370` instead of
"Undefined."

**Why it happens:** mathjs computes `tan()` of an *approximated* π/2. Since
the argument never lands exactly on the asymptote, the result is a huge
floating-point number rather than an error. Same applies to `tan(3pi/2)`,
`sec(pi/2)`, `csc(0)`, `cot(0)`, and any odd multiple of π/2 or multiple of π
for the respective functions.

**The fix (in `src/lib/solvers/otherSolvers.js`, `solveTrigonometry`):**

- Detect when the evaluated result's magnitude explodes past a threshold
  (e.g. `|result| > 1e12`), **or** when the argument is within epsilon of a
  known asymptote for that function.
- Return an answer of `Undefined` with a step explaining *why*:
  "tan(π/2) is undefined — the tangent function has a vertical asymptote
  there because cos(π/2) = 0, and tan = sin/cos."
- Add a common-mistake entry: "Assuming tan is defined everywhere — it blows
  up wherever cos(x) = 0."
- Add tests: `tan(pi/2)`, `tan(3*pi/2)`, `tan(90)` (degree detection),
  `sec(pi/2)`, and one negative control (`tan(pi/4)` still returns 1).

This was the biggest mathematical issue found in the external review, and it
is the cheapest of the high-impact fixes.

---

## P1 — Quadratic Function Insights

For quadratics, the Functions solver already reports vertex, intercepts,
domain/range hints, and symmetry tips. Two things students are taught almost
immediately in Algebra are missing:

- **Axis of symmetry:** `x = -b/2a` (e.g. `x = 2` for `x² − 4x + 3`).
- **Opening direction:** "Opens upward — leading coefficient is positive."

**Where:** `solveFunctions` in `src/lib/solvers/otherSolvers.js`. Detect a
degree-2 polynomial (parse coefficients with mathjs), then push both steps.
Small, self-contained, high teaching value per line of code.

---

## P1 — KaTeX Math Rendering

Steps and answers currently render as plain text (`x^2`, `1/3*x^3`). The
`beautify()` helper in `src/lib/solvers/solverUtils.js` cleans this up
considerably, but typeset math (fractions, exponents, integral signs) is the
single biggest *perceived-quality* jump available.

- **KaTeX is compatible with the offline philosophy** — it's a local npm
  package, no CDN or network needed (self-host the fonts).
- Render steps/answers through a component that detects math fragments and
  typesets them; fall back to plain text on parse failure.
- Watch the bundle size — load KaTeX lazily alongside the solver chunks
  (the app already code-splits Algebrite this way).

---

## P2 — Graph Annotations

The graphs are good (the external review rated them 9.5/10); the request is
to make them *point at the interesting thing*:

- **Limits:** vertical guideline + dot at the approach point (`x → 0`).
  `GraphViewer` already receives `solutions` for equations and renders
  special points — the same mechanism extends to a `pointOfInterest` prop.
- **Functions:** mark extrema and intercepts (already computed in
  `solveFunctions`, just not passed to the graph).
- **Trig/rational functions:** dashed vertical asymptote lines. Pairs
  naturally with the P0 asymptote detection.

**Where:** extend the `graph` object contract (documented in `CLAUDE.md`)
with optional `annotations`, and render them in
`src/components/solver/GraphViewer.jsx` using Recharts `ReferenceLine` /
`ReferenceDot` (both already imported for the axes).

---

## P0 — Regression Harness Over the Evaluation Corpus

**This is the highest-leverage item on the list** — arguably worth more than
any single feature. The July 2026 evaluation left a 91-problem corpus of
input → expected-answer pairs
([`../evaluations/2026-07/mastermath_evaluation.csv`](../evaluations/2026-07/mastermath_evaluation.csv)).
Turn it into a permanent, runnable regression suite so no fixed bug can
silently return — the discipline SymPy, Maple, and Wolfram use to stay
correct as they grow.

**The non-obvious part — it can't be a string match.** Several CSV rows
classified "Correct" are *format-divergent* from their expected answer:
- `d/dx tan(x)` → solver `1/(cos(x)^2)` vs expected `sec^2(x)`
- `d/dx sqrt(x)` → solver `1/(2*x^(1/2))` vs expected `1/(2*sqrt(x))`
- `∫1/x` → solver `log(x)` vs expected `ln|x|`

A naive `assert.equal` harness would fail these true-positives and flood the
run with false alarms until everyone ignores it. So the harness needs a
**math-equivalence check**, not text comparison:

- Evaluate both expressions at several sample points and compare numerically
  (fast, catches ~everything), **or** normalize both through Algebrite
  `simplify(a - b) == 0` for symbolic forms.
- Classify each row Correct / Equivalent-but-reformatted / Wrong / Refused.
  "Refused" is a *pass* for the unbuilt-feature rows (see refuse-clearly
  guards) — the suite must reward an honest refusal, never a confident guess.
- Grow it: every bug fixed anywhere lands a new row citing its source (eval
  CSV row, user report, or `tests/regressions.test.js` case). It subsumes the
  earlier "messy-input corpus" idea — add realistic malformed inputs
  (`2x+5=11 solve it pls`, mismatched parens) as Refused-expected rows.

**Acceptance target:** after Wave 2, a full re-run scores ≥ 90% Correct/Equivalent
**and zero confident wrong answers** — every failure is an explicit refusal.

---

## P3 — Integration by Parts Walkthrough — ✅ Done v1.12.0

> **Shipped July 2026** as `byPartsSolver.js`. The walkthrough below is exactly
> what the app now produces: LIATE-chosen u/dv, each round shown, repeated
> by-parts recursed to a direct base case, and cyclic by-parts solved
> algebraically when the integral reappears. Built on a linear accumulator
> (`I = boundary + coeff·∫current`) so one loop handles both the terminating and
> cyclic cases; every antiderivative is differentiated back and checked before
> it is shown. Runs per additive term, so a by-parts term inside a sum gets its
> own labelled walkthrough. The section below is kept for the design rationale.

**Original behavior (verified before the build):**

- Single-pass by-parts integrands (`x·cos(x)`, `x·eˣ`) — Algebrite computed
  the antiderivative and the step generator labelled it "Integration by parts"
  with a LIATE hint, but never *showed* the u/dv derivation.
- Repeated by-parts (`x³·sin(x)`) — **Algebrite failed outright** and the app
  returned "Unable to compute integral." Now computed via the recursion.
- Cyclic by-parts (`eˣ·sin(x)`) — Algebrite also failed; now solved by
  detecting the reappearing integral and closing the linear equation for `I`.

**The vision** (from the review, and it's the right one):

```
Choose Integration by Parts
  u  = x³        dv = sin(x) dx
  du = 3x² dx    v  = -cos(x)
Apply: ∫u dv = uv − ∫v du
  = -x³cos(x) + 3∫x²cos(x) dx
Repeat on the remaining integral…
```

**What it actually takes:** implementing tabular/repeated integration by
parts *ourselves* on top of Algebrite's single-step primitives — choose `u`
by LIATE, differentiate/integrate the parts, recurse on the remainder with a
depth limit, and emit each round as steps. This is real engine work, not a
formatting change, which is why it's P3 despite being the flashiest item.
It should be designed together with u-substitution support (same "we drive,
Algebrite assists" architecture).

---

## P3 — Technique-Aware Limit Explanations

**Current behavior:** the limit solver evaluates numerically from both
sides, detects indeterminate forms honestly, handles ∞, and says what it
did. Correct — but the explanation is always "approach from both sides,"
regardless of which *technique* a calculus course would use.

**Goal:** classify the limit first, then explain the matching technique:

| Pattern | Technique to show |
|---------|-------------------|
| Polynomial factor cancels (e.g. `(x²−4)/(x−2)`) | Factor and cancel, then substitute |
| `sin(x)/x`-family | Standard limit `sin(x)/x → 1` (squeeze theorem) |
| Radical difference (e.g. `(√(x+1)−1)/x`) | Rationalize with the conjugate |
| 0/0 after the above fail | L'Hôpital's rule, show the derivative quotient |
| `x → ±∞` rational | Compare leading-term growth rates |

The numeric evaluation stays as verification ("and indeed, approaching from
both sides gives 4"). Algebrite can factor and differentiate, so several of
these are feasible without new dependencies — but each pattern is its own
mini-solver, hence Large.

---

## P4 — Tutor Mode (Step Interactivity)

> **✅ Done (v1.8.0).** `SolutionDisplay` has a "Show all / Step through"
> toggle (shown only for multi-step solutions). Step-through reveals steps one
> at a time via a "Reveal next step" button — with a "Reveal all" shortcut, a
> "Step X of N" counter, and a "predict the next step" prompt — and the "hide
> the final answer until the end" idea below is implemented: the final answer,
> key insights, and common mistakes stay hidden until every step is revealed,
> so it teaches rather than lets you copy the answer. Reset per new problem.
> The collapsible-accordion sibling was not needed.

Steps currently animate in with a stagger, all visible at once. The
review's more interesting suggestion is a **reveal-one-at-a-time mode**:
show step 1, let the student *predict* the next move, then reveal.

- A toggle on `SolutionDisplay` ("Show all / Step through").
- State is just an index; the step data already exists.
- Pairs well with a future "hide the final answer until the end" option —
  that's what makes it tutoring rather than answer-copying.

Collapsible steps (accordion) are the low-effort sibling if the full mode
is too much.

---

## Known Engine Limitations

Honest constraints to keep in mind when triaging bug reports:

- **mathsteps is unmaintained** (v0.2.0). It handles linear equations and
  simple quadratics well and its steps are excellent — but it will never
  improve. Anything it can't finish falls through to Algebrite roots
  (added in v1.2.0), then numeric root-finding.
- **Algebrite gaps:** no repeated integration by parts (`x³sin(x)` fails),
  and some integrals have no elementary form at all (`sin(x²)` — the app
  correctly reports failure; that one is *mathematically* unsolvable in
  elementary terms, not a bug).
- **Limits are numeric estimates**, not symbolic proofs. Results are
  reliable for the covered curriculum but the explanation depth is capped
  until P3 lands.
- **The parser is regex-based.** It's decent, but it's the most likely
  source of confident-wrong-answer bugs — see the P2 corpus item.
- **The numeric equation fallback was hardened in v1.8.1** after a
  production audit caught it reporting scan artifacts as roots
  ([`../evaluations/2026-07/PRODUCTION-AUDIT-v1.8.md`](../evaluations/2026-07/PRODUCTION-AUDIT-v1.8.md)):
  non-real values are out-of-domain (not NaN sign flips), constant
  differences resolve to identity/no-solution, and every candidate root must
  survive back-substitution. It was the last solver path without a
  verification gate.

---

## Explicitly Out of Scope

Locked in by the project's philosophy (see `CLAUDE.md`):

- **No AI/LLM solving** — the entire product identity is local, deterministic
  computation. The UI must never even *look* AI-powered (Calculator icon,
  "Calculating…", no sparkle iconography).
- **No accounts, no cloud sync, no tracking** — IndexedDB is the only store.
- **No server-side anything** — every feature above must work offline.
