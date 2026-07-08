# MasterMath — Future Work Roadmap

**Version referenced:** 1.2.0 (commit `971613db`)
**By:** sparkinCreations™
**Last Updated:** July 6, 2026

---

## Table of Contents

1. [Where This List Comes From](#where-this-list-comes-from)
2. [Priority Overview](#priority-overview)
3. [P0 — Undefined Trig Values](#p0--undefined-trig-values)
4. [P1 — Quadratic Function Insights](#p1--quadratic-function-insights)
5. [P1 — KaTeX Math Rendering](#p1--katex-math-rendering)
6. [P2 — Graph Annotations](#p2--graph-annotations)
7. [P2 — Messy-Input Test Corpus](#p2--messy-input-test-corpus)
8. [P3 — Integration by Parts Walkthrough](#p3--integration-by-parts-walkthrough)
9. [P3 — Technique-Aware Limit Explanations](#p3--technique-aware-limit-explanations)
10. [P4 — Tutor Mode (Step Interactivity)](#p4--tutor-mode-step-interactivity)
11. [Known Engine Limitations](#known-engine-limitations)
12. [Explicitly Out of Scope](#explicitly-out-of-scope)

---

## Where This List Comes From

Two sources, merged and verified in July 2026:

1. **An external review** (July 2026) that tested easy, intermediate, and
   conceptual problems across every category. Overall verdict: 9.2/10 —
   "starting to feel like a real educational tool rather than just a
   calculator."
2. **An internal code assessment** done alongside the v1.2.0 solver overhaul
   (worked-solution steps, indigo/orange rebrand, dark mode fixes).

Every mathematical claim below was **verified against the actual solvers**
before being written down — including reproducing the bugs. Where the review
and the code disagreed, the code's behavior is what's documented.

---

## Priority Overview

| # | Item | Priority | Effort | Type |
|---|------|----------|--------|------|
| 1 | ~~Undefined trig values (`tan(π/2)`)~~ ✅ Fixed July 2026 | **P0** | Small | Bug |
| 2 | Eval Wave 1: input-perimeter fixes (arctan, `!`, `C(n,k)`, `ln` alias, abs-limit verification gate, one-sided limits, factor verb, exact radicals, `ln\|x\|`, refuse-clearly guards) | **P0** | Small–Med | Bug |
| 3 | Eval Wave 2: Functions/Graphing rebuild (derivative-based extrema, root-based intercepts, domain + asymptotes) | **P1** | Medium | Engine |
| 4 | Quadratic insights (axis of symmetry, opens up/down) — fold into Wave 2 | P1 | Small | Feature |
| 5 | KaTeX math rendering | P1 | Medium | Feature |
| 6 | Graph annotations (limit point, extrema, asymptotes) — pairs with Wave 2 | P2 | Medium | Feature |
| 7 | Messy-input test corpus (the 91-row eval CSV is the seed corpus) | P2 | Medium | Quality |
| 8 | Definite integrals (Algebrite `defint` + notation parsing) | P2 | Medium | Feature |
| 9 | Systems of equations (2×2 linear, elimination steps) | P3 | Medium | Feature |
| 10 | Inequalities (roots + sign chart) | P3 | Medium | Feature |
| 11 | Integration by parts walkthrough | P3 | Large | Engine |
| 12 | ~~Technique-aware limit explanations~~ ✅ Largely done July 2026 (symbolic ladder: simplify → Taylor → L'Hôpital; squeeze/rationalize narration still open) | P3 | Large | Engine |
| 13 | Tutor mode (collapsible / reveal-one-at-a-time steps) | P4 | Medium | UX |

"Effort" is relative to this codebase: Small = one sitting, Medium = a few
sittings, Large = real engine work that needs its own design pass.

> **July 2026 external evaluation:** a 91-problem black-box test of the live
> app scored ~78% (6/10). Every failure was reproduced and root-caused — see
> [`../evaluations/2026-07/ANALYSIS.md`](../evaluations/2026-07/ANALYSIS.md).
> Items 2, 3, and 8–10 come from that analysis; ~10 of the 16 wrong answers
> are input-perimeter bugs (Wave 1), not missing math.

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

## P2 — Messy-Input Test Corpus

The external review tested well-formed inputs. Real students type things
like `2x+5=11 solve it pls`, `whats the derivative of x squared`, mismatched
parens, and mixed notation. A mis-parse that produces a *confident wrong
answer* is worse than an error message.

- Build a corpus file (`tests/fixtures/student-inputs.txt`) of realistic
  messy inputs per topic.
- For each: assert the parser either extracts the right expression **or**
  the validation layer rejects it — never a silently wrong parse.
- Grow the corpus from the Feedback page whenever a user reports a
  wrong answer.

This is the main defense for the app's credibility as it gets real users.

---

## P3 — Integration by Parts Walkthrough

**Current behavior (verified):**

- Single-pass by-parts integrands (`x·cos(x)`, `x·eˣ`) — Algebrite computes
  the antiderivative and the step generator correctly labels it
  "Integration by parts" with the LIATE hint. Good.
- Repeated by-parts (`x³·sin(x)`) — **Algebrite fails outright** and the app
  returns "Unable to compute integral." The external review described this
  as "simplified rather than fully shown," but the reality is a hard failure.

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

---

## Explicitly Out of Scope

Locked in by the project's philosophy (see `CLAUDE.md`):

- **No AI/LLM solving** — the entire product identity is local, deterministic
  computation. The UI must never even *look* AI-powered (Calculator icon,
  "Calculating…", no sparkle iconography).
- **No accounts, no cloud sync, no tracking** — IndexedDB is the only store.
- **No server-side anything** — every feature above must work offline.
