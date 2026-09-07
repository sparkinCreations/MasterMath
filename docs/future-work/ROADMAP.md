# MasterMath — Future Work Roadmap

**Version referenced:** 1.29.2
**By:** sparkinCreations™
**Last Updated:** September 7, 2026
**Supersedes:** [`ROADMAP-2026-07.md`](ROADMAP-2026-07.md) (13/13 items shipped)

---

## Table of Contents

1. [Where This List Comes From](#where-this-list-comes-from)
2. [Priority Overview](#priority-overview)
3. [P0 — Black-Box Re-Evaluation Against v1.29.1](#p0--black-box-re-evaluation-against-v1291)
4. [P1 — Stale Trig Refusal Message](#p1--stale-trig-refusal-message)
5. [P1 — Limit Techniques Named the Way a Course Names Them](#p1--limit-techniques-named-the-way-a-course-names-them)
6. [P2 — Nonlinear 2×2 Systems](#p2--nonlinear-22-systems)
7. [P2 — Compound Inequalities](#p2--compound-inequalities)
8. [P2 — First-Load Payload: mathjs Chunk](#p2--first-load-payload-mathjs-chunk)
9. [P3 — Dependency Majors](#p3--dependency-majors)
10. [P3 — Isolate mathsteps Behind One Seam](#p3--isolate-mathsteps-behind-one-seam)
11. [P3 — Documentation Debt](#p3--documentation-debt)
12. [P4 — New Topic: Sequences & Series](#p4--new-topic-sequences--series)
13. [P4 — Practice Mode: "Try a Similar Problem"](#p4--practice-mode-try-a-similar-problem)
14. [Known Engine Limitations](#known-engine-limitations)
15. [Explicitly Out of Scope](#explicitly-out-of-scope)

---

## Where This List Comes From

The July 2026 roadmap is finished. Between v1.13.0 (July 21) and v1.29.1
(August 31) the app shipped seventeen releases: u-substitution, partial
fractions (general case), trig equations across five reducible families,
3×3 systems, improper integrals, worked product/quotient/chain steps,
intent-based routing, degree mode, exact-first numbers, the offline service
worker, an accessibility pass, and the "local solver, not AI" repositioning.
None of that was on a roadmap; it came from edge-case sweeps.

This list was assembled on September 7, 2026 from four verified inputs:

1. **What the solvers refuse today.** Every `unsupported({ reason })` string
   in `src/lib/solvers/` and `src/lib/api.js` was collected. A refusal is an
   honest capability boundary, so the refusal list *is* the feature backlog —
   and one refusal message turned out to be stale (item 2).
2. **What the July reviews left open.** The black-box review's seven-point
   fix order and the v1.12 audit's recommendation
   ([`../evaluations/2026-07/`](../evaluations/2026-07/)) were checked
   line-by-line against the changelog. All seven landed (v1.16–v1.20, via
   [`MATH-STATE-SEMANTICS.md`](MATH-STATE-SEMANTICS.md)). The v1.12 audit's
   two *Partial* rows — `expand (x+2)^2` and `lim x→∞ (1+1/x)^x` — are both
   fixed and in the corpus.
3. **The one loose end the old roadmap named.** Item 12 (technique-aware
   limits) was marked "largely done; squeeze/rationalize narration still
   open." Verified in `otherSolvers.js`: the ladder simplify → Taylor →
   L'Hôpital exists; squeeze, conjugate, and leading-term narration do not.
4. **The build and the dependency tree.** `dist/` measured at 3.5 MB of JS
   with mathjs alone at 1.13 MB; `npm outdated` shows nine major-version
   gaps.

Every claim below was checked against the code or the build output before
it was written down. Test count at the time of writing: **344 passing, 0
failing**, including the corpus row "zero confidently-wrong answers."

---

## Priority Overview

**Priority = severity or leverage. Sequence = the order to do the work,
which also weighs effort.** The single P0 is a measurement, not a feature:
seventeen releases of solver work have never been graded the way v1.12 was,
and everything else on this list should be re-ranked by what that grading
finds.

| # | Item | Priority | Effort | Type | Wave |
|---|------|----------|--------|------|------|
| 1 | Black-box re-evaluation against v1.29.1 | **P0** | Medium | Quality | 1 |
| 2 | ~~Stale trig refusal message~~ ✅ Done v1.29.2 (message states the real boundary; contract test checks every cited example) | P1 | Small | Bug | 1 |
| 3 | Limit techniques named the way a course names them | P1 | Medium | Engine | 2 |
| 4 | Nonlinear 2×2 systems | P2 | Medium | Feature | 2 |
| 5 | Compound inequalities | P2 | Small–Med | Feature | 2 |
| 6 | First-load payload: mathjs chunk | P2 | Small–Med | Perf | 3 |
| 7 | Dependency majors (React 19, Vite 8, Tailwind 4, …) | P3 | Medium | Maint | 3 |
| 8 | Isolate mathsteps behind one seam | P3 | Small | Maint | 3 |
| 9 | ~~Documentation debt~~ ✅ Done v1.29.2 (semantics status header, test renamed, worktree pruned) | P3 | Small | Docs | 1 |
| 10 | New topic: Sequences & Series | P4 | Large | Engine | — |
| 11 | Practice mode: "Try a similar problem" | P4 | Medium | UX | — |

"Effort" is relative to this codebase: Small = one sitting, Medium = a few
sittings, Large = real engine work that needs its own design pass.

**Why the re-evaluation is the only P0.** The July roadmap's acceptance
target was "≥ 90% Correct/Equivalent and zero confident-wrong answers."
The corpus test asserts the second half on every `npm test`, but the corpus
is the app grading itself against rows it already knows. Nothing since
v1.12 has been graded by an independent tool on problems the app has never
seen. That is the difference between "all tests pass" and "the app is
right."

**Why items 4–5 are P2 and not P0.** Both refuse clearly today (regression
tests at `tests/regressions.test.js:618` and `:677` pin the refusal). The
old roadmap's rule still holds: a clear refusal removes the correctness
harm, so building the capability is a feature, not a fix.

---

## P0 — Black-Box Re-Evaluation Against v1.29.1

**What exists:** a repeatable method
([`../evaluations/2026-07/PRODUCTION-AUDIT-v1.12.md` § Method](../evaluations/2026-07/PRODUCTION-AUDIT-v1.12.md)):
problems run against the live app, every answer independently checked with
SymPy, classified Correct / Partial / Incorrect / Refused. Two CSVs from
July (`mastermath_evaluation.csv`, `mastermath_evaluation_v1.12.csv`).

**What to do:**

- Build a **fresh** problem set, not a re-run of July's. The July rows are
  now in `tests/corpus/` and will pass by construction. Target ~100 rows
  weighted toward what shipped since v1.13: u-substitution, partial
  fractions with repeated and quadratic factors, the five trig-equation
  families, 3×3 systems (including rank-deficient ones), improper
  integrals, degree mode, higher-order derivatives, and "at x = a"
  evaluation points. Keep ~20 adversarial/malformed rows.
- Grade against the deployed site at mastermath.app, black-box, exactly as
  in July. Write it up under `docs/evaluations/2026-09/`.
- **Every Incorrect or Partial row lands in `tests/corpus/additions.csv`**
  before its fix ships, citing the evaluation row. Every Refused row that
  should have been solved becomes a candidate item on this roadmap.

**Acceptance:** ≥ 90% Correct/Equivalent and **zero confident-wrong**. If
either fails, the failures re-rank this list; the P1 and P2 items below are
provisional until then.

---

## P1 — Stale Trig Refusal Message — ✅ Done v1.29.2

**The bug (verified):** `trigEquationSolver.js` refuses out-of-family
equations with

> "Trigonometric equations are supported in the form A·sin(kx) + B = C
> (likewise cos and tan). Equations with two different trig functions,
> squared trig terms, or non-linear arguments are not solved yet."

Two of those three clauses are false as of v1.26.0–v1.28.0: squared trig
terms (`2sin²x − sin x − 1 = 0`) and two different functions
(`a·sin x + b·cos x = c`, `sin x = cos x`, `sin(2x) = cos(x)`) are solved.
A student who types one of the *still*-unsupported shapes is told the wrong
boundary, and a student reading the message for a supported shape is told
not to bother.

**The fix:** enumerate what actually still refuses — non-linear arguments
(`sin(x²) = 0`), mixed families that don't reduce (`sin x + tan x = 1`),
products of different functions — and say exactly that. Add a regression
test that asserts the message names none of the supported families. Small,
one sitting, and it matters more than its size: the refusal text is the
app's stated contract.

---

## P1 — Limit Techniques Named the Way a Course Names Them

**Current behavior (verified in `otherSolvers.js`, `evaluateFiniteLimit`):**
a four-rung ladder — direct substitution → Algebrite `simplify` →
Taylor-series ratio (`trySeriesLimit`) → L'Hôpital (`tryLHopital`, depth-
capped) — plus a numeric estimator for `x → ±∞` (`estimateInfiniteLimit`).
Every rung is verified numerically from both sides. This is correct and
honest, and it closed the July roadmap's item 12.

**What's missing:** three cases where the ladder gets the right number but
narrates a technique a calculus course would never use there:

| Pattern | Today's narration | Course technique |
|---------|-------------------|------------------|
| `sin(x)/x`, `(1 − cos x)/x²` | Taylor series | Standard limit / squeeze theorem |
| `x·sin(1/x)`, `x²·cos(1/x)` as `x → 0` | numeric only | Squeeze theorem with explicit bounds |
| `(√(x+1) − 1)/x`, `(√x − 2)/(x − 4)` | Taylor or L'Hôpital | Multiply by the conjugate, cancel |
| `x → ∞`, rational `p(x)/q(x)` | numeric estimate + generic "compare growth rates" tip | Divide by the highest power; compare degrees |

**Design:** classify *before* climbing the ladder. Each pattern is a small
matcher plus a step template; the existing ladder stays as the fallback and
the numeric check stays as verification ("and indeed, approaching from both
sides gives 1"). The `x → ∞` rational case is the cheapest and most common:
Algebrite can read the leading terms directly. The squeeze cases need the
bounding functions stated (`−|x| ≤ x·sin(1/x) ≤ |x|`) — that is the whole
lesson, so it must be shown, not just named.

**Acceptance:** each row above produces its course technique by name, the
answer is unchanged, and a corpus row pins each one.

---

## P2 — Nonlinear 2×2 Systems

**Current behavior (verified):** `x^2 + y = 1; x - y = 0` refuses with
"not linear" (`tests/regressions.test.js:618`). `systemsSolver.js` is
Cramer's rule and Gaussian elimination in exact fractions; it has no
substitution path.

**Scope:** one linear equation and one quadratic (line ∩ parabola, line ∩
circle), and two conics of the forms a course actually sets
(`x² + y² = 25; y = x + 1`). Solve by substitution into the linear equation
— which produces a single-variable polynomial the algebra solver already
handles — then back-substitute, verify every pair against both original
equations (the existing systems discipline), and mark the intersection
points on the graph. The graph contract already has `intersection`; extend
it to an array.

**Refuse clearly** anything else (two general quadratics, three unknowns),
with a message that names the supported shapes.

---

## P2 — Compound Inequalities

**Current behavior (verified):** `-1 < 2x + 1 ≤ 5` and `x < 2 or x > 5`
refuse (`tests/regressions.test.js:677`). `inequalitiesSolver.js` does the
sign-chart method for one comparison.

**Scope:** the chained form `a < f(x) ≤ b` (split into two inequalities,
solve each with the existing solver, intersect the solution sets) and the
`and` / `or` forms (intersect / union). The interval arithmetic is the new
part; the per-inequality work already exists. Render the result in
interval notation with correct open/closed endpoints and extend the
`shadedRegions` graph annotation, which already takes an array.

---

## P2 — First-Load Payload: mathjs Chunk

**Measured (v1.29.1 build):**

| Chunk | Size |
|-------|------|
| `mathjs` | 1.13 MB |
| `Solver` | 394 KB |
| `pdf` (jsPDF) | 388 KB |
| `charts` (Recharts) | 354 KB |
| `algebrite` | 350 KB |
| `html2canvas` (jsPDF dependency) | 202 KB |
| all JS | 3.5 MB |

jsPDF and html2canvas are already lazy (`exportUtils.js` imports on first
export). The service worker caches everything after the first visit, so
this is a *first-visit* cost only — but on a phone on a school network the
first visit is the one that decides whether there is a second.

**The lever:** both mathjs entry points use `create(all)`
(`src/lib/**`, two sites), which pulls every mathjs factory including
matrices, units, complex, and bignumber. The app uses expression parsing,
`evaluate`, `derivative`, `simplify`, fractions, and a handful of scalar
functions. mathjs supports `create({ evaluateDependencies, simplifyDependencies, … })`
with only the factories named, and the tree-shaken result is typically a
third the size.

**Method:** measure first (`vite build` + a bundle visualizer), switch to
named dependencies, re-run the full suite (the corpus is the safety net —
a missing factory throws, it does not mis-answer), measure again.

**Acceptance:** mathjs chunk under 500 KB, zero test changes, no solver
behavior change.

---

## P3 — Dependency Majors

`npm outdated` on September 7, 2026:

| Package | Current | Latest | Risk |
|---------|---------|--------|------|
| katex | 0.17 | 0.18 | Low — check `trust: false` still default-off and fonts unchanged |
| mathjs | 14.8 | 15.2 | Low–Med — run the corpus; do together with item 6 |
| jspdf | 3.0 | 4.2 | Low — export tests cover it |
| vite / plugin-react | 5.4 / 4.7 | 8.2 / 6.1 | Med — `stampServiceWorker` in `vite.config.js` uses the plugin API; verify the SW stamp and chunk names |
| react / react-dom | 18.3 | 19.2 | Med — Recharts 2 and framer-motion 11 have React 19 peers only in their next majors, so this is a bundle: React 19 + Recharts 3 + framer-motion 13 |
| react-router-dom | 6.30 | 7.18 | Med — `createPageUrl` and lazy routes; mechanical but touches every page |
| tailwindcss | 3.4 | 4.3 | High — v4 replaces `tailwind.config.js` with CSS-first config; every `dark:` and gradient utility is in play. Do last, alone |
| lucide-react | 0.441 | 1.41 | Low — icon renames |

**Rule:** one major per release, each its own patch/minor with the corpus
green and a manual pass over the Solver page in light and dark. Order:
katex → jspdf → mathjs (with item 6) → Vite → the React bundle → Router →
Tailwind. None of these is urgent; there is no user base yet and the app
works. They are here so they are done deliberately rather than discovered
during a feature.

---

## P3 — Isolate mathsteps Behind One Seam

mathsteps is v0.2.0 and unmaintained (already noted in July). It has 20
call sites in `algebraSolver.js` plus `mathstepsUtils.js`. Its linear and
simple-quadratic steps are the best explanations in the app, so it is not
being replaced — but every call should go through `mathstepsUtils.js` so
that when it finally breaks on a Node or mathjs upgrade, the fallback
(Algebrite roots → numeric scan, which already exists) is one switch away
rather than twenty. Small, and best done as part of item 7 when mathjs
moves.

---

## P3 — Documentation Debt — ✅ Done v1.29.2

Small, one sitting, but this is what let the last roadmap drift seventeen
releases past its own completion:

- **[`MATH-STATE-SEMANTICS.md`](MATH-STATE-SEMANTICS.md)** has no status
  markers. Add a header block mapping each of its five phases to the release
  that shipped it (Phase 1 envelope → v1.16.1 "an unevaluated derivative is
  never reported as solved"; Phases 4–5 → v1.17.0 holes/cusps and v1.19.0
  evidence-scoped claims) and mark it **Implemented**. Keep the body as the
  design record.
- **Roadmap hygiene:** when an item ships, strike it here *and* bump the
  "Version referenced" header in the same commit. When the last item ships,
  archive this file under a dated name the same day, as was done with
  [`ROADMAP-2026-07.md`](ROADMAP-2026-07.md).
- **`tests/regressions.test.js:612`** is named "a 3-variable system is
  refused" but feeds *two* equations in three unknowns. It is correct; the
  name is misleading now that 3×3 systems are supported. Rename to
  "an underdetermined system is refused."
- **Stale worktree:** `git worktree list` shows a prunable worktree from
  July under the old `MathMaster/` path on a branch already merged into
  main. `git worktree prune`.

---

## P4 — New Topic: Sequences & Series

The seven topics have been fixed since v1.0. Every item above deepens one
of them. The first *new* topic should be the one adjacent to what already
exists: sequences and series sit between the limits and integrals the app
already handles, and their standard problems are fully deterministic.

**Scope for a first release:**

- Arithmetic and geometric sequences: nth term, sum of n terms, sum to
  infinity with the `|r| < 1` condition stated and checked.
- Convergence tests for a given series: nth-term, geometric, p-series,
  ratio, comparison — each as a named worked step, the way item 3 does for
  limits. The ratio test is a limit the existing solver can compute.
- Partial-sum graph (points, not a curve) using the existing `GraphViewer`.

**Why P4:** it is a new solver, a new topic value in the dropdown, new
examples, new corpus rows, and a new User Manual section — a design pass of
its own. Do it after the re-evaluation says the existing seven are solid.
Matrices/vectors and complex numbers are the other candidates; series was
chosen for curriculum adjacency, not because the others are harder.

---

## P4 — Practice Mode: "Try a Similar Problem"

Tutor mode (v1.8.0) hides the answer until every step is revealed. The
natural next step is to let the student *do* one: after any solved problem,
a button generates a structurally identical problem with different numbers
— same topic, same technique, new coefficients — and checks the student's
answer with the same math-equivalence grader the corpus harness uses.

- **Deterministic, not AI.** The generator perturbs the parsed expression
  tree (change integer coefficients, roots, bounds) and re-solves with the
  existing engine. If the perturbed problem fails to solve or refuses, try
  another perturbation; never show one the app cannot check.
- The grader already exists (`tests/corpus/harness.mjs`): evaluate at
  sample points, or Algebrite `simplify(a − b) == 0`.
- Store attempts in IndexedDB alongside history so the Progress page can
  show "practised" as well as "solved."

This is the highest-teaching-value item on the list and the least urgent.
It needs nothing new from the engine.

---

## Known Engine Limitations

Updated from July. Keep in mind when triaging bug reports:

- **mathsteps is unmaintained** (v0.2.0). See item 8.
- **Algebrite is the symbolic engine, and the app drives it, not the other
  way round.** Repeated/cyclic by-parts, u-substitution, partial fractions,
  and every trig-equation family are implemented on top of Algebrite's
  single-step primitives, each verified by differentiation or substitution
  before being shown. A throwing *direct* Algebrite call poisons the session
  for every later call; everything goes through the self-healing
  `loadAlgebrite()` wrapper (v1.25.0). Ordering-dependent answers in a sweep
  are this bug class.
- **Non-elementary integrals** (`sin(x²)`, `e^(x²)`, `1/ln(x)`) are refused
  as *unsupported* with the special-function name. That is correct; it is
  not a bug.
- **Limits at infinity are numeric estimates** with growth-classification
  (converge / diverge / slow-log / oscillate). Finite limits are symbolic
  (item 3 improves the narration, not the math).
- **The parser is regex-based** with a validation gate in front of it
  (`validation.js`, `inputValidator`). It is still the most likely origin of
  a confident-wrong answer; the corpus's adversarial rows are its regression
  net.
- **Result gate:** `finalizeResult` in `api.js` refuses any answer or step
  that is not presentable text. Engine internals cannot reach the screen.

---

## Explicitly Out of Scope

Locked in by the project's philosophy (see `CLAUDE.md`) and restated on the
live site since v1.29.0:

- **No AI/LLM solving** — the product identity is local, deterministic
  computation. The UI must never even *look* AI-powered (Calculator icon,
  "Calculating…", no sparkle iconography). Practice mode (item 11) is a
  tree perturbation, not a generator model.
- **No accounts, no cloud sync, no tracking** — IndexedDB is the only store.
- **No server-side anything** — every item above must work offline after
  the first visit, because the service worker caches the whole app.
