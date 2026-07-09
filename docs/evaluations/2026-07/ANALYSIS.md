# July 2026 External Evaluation — Root-Cause Analysis & Fix Plan

**Version evaluated:** 1.3.1 (live at mastermath.app)
**Analysis against:** commit `52bd38ce`
**By:** sparkinCreations™
**Last Updated:** July 8, 2026

**Sources in this folder:**
- [`mastermath_report.md`](mastermath_report.md) — the external evaluation (91 problems, black-box testing against the live app, answers verified with SymPy)
- [`mastermath_evaluation.csv`](mastermath_evaluation.csv) — the raw per-problem results

**Evaluation verdict:** 71/91 correct, 4 partial, 16 incorrect (~78%), overall **6/10** — "recommend as a supplementary tool… but not as a sole source of truth."

---

## Table of Contents

1. [Reading the Score Honestly](#reading-the-score-honestly)
2. [Verified Root Causes — Every Failure](#verified-root-causes--every-failure)
3. [Corrections to the Report's Diagnoses](#corrections-to-the-reports-diagnoses)
4. [Fix Plan](#fix-plan)
5. [Testing Policy for the Fixes](#testing-policy-for-the-fixes)

---

## Reading the Score Honestly

The 78% / 6-out-of-10 is a fair *black-box* snapshot, but the failure
distribution matters more than the number:

- **~10 of the 16 incorrect results trace to the input/verification perimeter**
  (parser word lists, punctuation stripping, a missing function alias, and one
  missing guard in the limit ladder) — **not** to missing mathematical
  capability. The underlying engines already compute most of these correctly
  when reached.
- **6 failures are one module:** Functions/Graphing, which fabricates
  "vertices" and intercepts from coarse sampling. This is the report's most
  serious finding and requires a real rebuild, not a patch.
- **The rest are genuinely unbuilt features** (definite integrals, systems of
  equations, inequalities, one-sided limits), which the app should either
  support or *clearly refuse* — silently mis-parsing them into wrong answers
  is the worst of the three options.

Every root cause below was **reproduced and verified against the code on
July 8, 2026** — none are hypotheses.

---

## Verified Root Causes — Every Failure

### A. Parser / input-perimeter bugs (wrong answers, engine is fine)

| # | Failure (from CSV) | Verified root cause | Layer |
|---|--------------------|---------------------|-------|
| A1 | `d/dx arctan(x)` → `0` | `arctan`/`arcsin`/`arccos` are missing from `MATH_FUNCTIONS` in `src/lib/mathParser.js`, so `extractVariable('arctan(x)')` returns **`a`** (first letter not part of a known function). Algebrite then computes d/d**a** — which is legitimately 0. The engine differentiates arctan fine when asked correctly. | Parser |
| A2 | `7!` → `7` | `parseMathExpression` strips `[.?!]+$` as sentence punctuation before evaluation. mathjs natively evaluates `7!` = 5040 — the `!` never reaches it. | Parser |
| A3 | `C(5,2)` → "Unable to evaluate" | No mapping from `C(n,k)` / `nCr` notation to mathjs's built-in `combinations(n,k)` (which returns 10). | Parser |
| A4 | `ln(x)` graph → "no x-intercepts" | mathjs has **no `ln` function** (throws "Undefined function ln"); its natural log is `log`. Every *numeric* evaluation of `ln` dies silently — graphs, sampling, intercept scans. Algebrite understands `ln`, which is why `d/dx ln(x)` works while its graph is empty. | Parser/eval alias |
| A5 | `2x+3y=6; x-y=4` → `6` | The extraction regexes split on the first `=` and mangle multi-equation input to `"6;x-y=4"`. No system support exists, but the real bug is that mangled input still produces a *confident* answer instead of a refusal. | Parser |
| A6 | `∫_0^1 x dx` → nonsense | No definite-integral notation is recognized; `int_0^1 x dx` parses to the string `int_0^1xdx` and is treated as symbols. Same class as A5: should refuse, currently mis-answers. | Parser + feature gap |

### B. Solver logic bugs

| # | Failure | Verified root cause | Layer |
|---|---------|---------------------|-------|
| B1 | `lim x→0 abs(x)/x` → `0` (true: DNE); `lim x→2 (x−2)/abs(x−2)` → `−1` (true: DNE) | The symbolic ladder in `otherSolvers.js` returns a rung's answer **even when its own numeric cross-check fails to verify it** (`verified: false` results are still surfaced as the answer). Algebrite's simplification of `abs` is unreliable at the crossing point; the numeric rung would have caught the two-sided disagreement, but it is never reached. Fix: unverified rung answers must fall through the ladder. | Limits ladder |
| B2 | One-sided notation `x→0+` ignored | The limit-notation regexes don't capture a trailing `+`/`−` on the approach value; input silently degrades to the two-sided limit. Should either support one-sided evaluation (the sampling machinery already computes each side separately) or refuse. | Limits parser |
| B3 | `sin(x)^2 + cos(x)^2` → "Unable to evaluate" | The trig solver only evaluates numerically (`math.evaluate` throws "Undefined symbol x"). No symbolic-simplification fallback (Algebrite `simplify` returns `1` for this). | Trig solver |
| B4 | `factor x^2 - 9` → echoed back | The `factor` verb is recognized by extraction (correctly yields `x^2-9`) but the algebra solver never receives the *intent* — it just simplifies, and `x^2-9` is already "simple." Algebrite's `factor()` produces `(x-3)(x+3)`; it is never called. | Algebra routing |
| B5 | `sqrt(50)` → `7.0711` (want `5√2`) | The simplify path (mathsteps → mathjs) evaluates numerically; there is no exact-radical rung. Algebrite `simplify(50^(1/2))` returns `5*2^(1/2)`. | Algebra simplify |

### C. Display honesty

| # | Failure | Verified root cause | Layer |
|---|---------|---------------------|-------|
| C1 | `∫1/x dx` → `log(x) + C` (want `ln|x| + C`) | Algebrite's output uses `log` for natural log and omits the absolute value. Pure display-layer translation needed (`log(x)` → `ln|x|` in integral results). | Display |

### D. Functions/Graphing — the module that needs a rebuild

The evaluation scored this category 2/10, and the mechanism is fully
understood (all in `solveFunctions` in `src/lib/solvers/otherSolvers.js`):

| # | Symptom (from CSV) | Verified root cause |
|---|--------------------|---------------------|
| D1 | `exp(x)` has a "vertex near (−1.5, 0.22)" | `findVertex` falls back to **returning the midpoint sample** when no local extremum exists in the window — monotonic functions are guaranteed a fabricated vertex. |
| D2 | `1/(x−2)`, `1/x²`, `exp(x)` have "x-intercepts near −10, −9.5, −9" | `findIntercepts` flags any sample with `|y| < 0.1` — the flat tails of decaying functions brush the threshold near the window edge. |
| D3 | Vertical asymptotes never reported | No detection: undefined points are silently skipped during sampling. |
| D4 | `sqrt(x−3)` domain wrong; `ln(x)` intercept missed | No domain analysis (undefined regions are dropped, not reported); `ln` additionally dies on A4 above. |
| D5 | `x³−x` turning points wrong (−0.5 vs ±1/√3) | Extrema estimated from 0.5-step samples instead of solving f′(x) = 0 — Algebrite can differentiate and `roots()` can solve exactly. |

**Rebuild direction:** compute f′ symbolically → exact critical points via
roots; intercepts via root-finding (not thresholds); report undefined sampling
regions as domain restrictions; flag sign-flip-with-blowup as vertical
asymptotes; never fabricate a vertex for monotonic functions. Graph
annotations from the existing roadmap item pair naturally with this.

### E. Genuinely unbuilt features (report is correct; no surprises inside)

| Feature | Current behavior | Minimum acceptable behavior | Full support |
|---------|-----------------|-----------------------------|--------------|
| Definite integrals | Mis-parses to nonsense (A6) | Detect notation and refuse clearly | Algebrite `defint`, or F(b)−F(a) with steps |
| Systems of equations | Mis-parses, returns unrelated number (A5) | Detect `;`/newline-separated equations and refuse | 2×2 linear solver with elimination steps |
| Inequalities | Echoes input rearranged | Detect `<`/`>`/`≤`/`≥` and refuse | Solve via roots + sign chart |
| One-sided limits | Silently answers two-sided (B2) | Parse the notation | Evaluate the requested side (machinery exists) |

---

## Corrections to the Report's Diagnoses

The report's *observations* are accurate (every one reproduced), but three
*diagnoses* need correcting for the record:

1. **"Inverse trigonometric derivatives are not implemented"** — they are;
   the parser mis-identifies the variable (A1). One word-list entry away.
2. **"The module does not support factorials or combinatorics"** — mathjs
   supports both natively; the parser eats the `!` and the `C(n,k)` notation
   is unmapped (A2, A3).
3. **"Limits involving absolute value remain unsolved"** — the numeric
   machinery handles them correctly; the symbolic ladder overrides it with
   unverified answers (B1). This was a regression risk documented in the
   ladder's own design notes and is a one-guard fix.

None of this changes the user-facing score — a wrong answer is a wrong answer
— but it changes the fix cost dramatically: most of the "missing capability"
is actually present and one perimeter bug away from working.

---

## Fix Plan

### Wave 1 — perimeter and logic fixes (single sitting, ~10 of 16 wrong answers)

| Fix | Items | Where |
|-----|-------|-------|
| Add inverse-trig names + `ln`→`log` numeric alias | A1, A4 | `mathParser.js`, `solverUtils.js` |
| Preserve mid-expression `!`; map `C(n,k)`→`combinations` | A2, A3 | `mathParser.js`, validation |
| Gate limit-ladder answers on `verified` | B1 | `otherSolvers.js` |
| One-sided limit notation (parse + evaluate the side) | B2 | `otherSolvers.js` |
| Algebrite fallbacks: symbolic identity simplify, `factor` verb, exact radicals | B3, B4, B5 | trig + algebra solvers |
| `ln\|x\|` display for reciprocal integrals | C1 | `integralsSolver.js` |
| Refuse-clearly guards for systems/definite/inequalities | A5, A6, E | parser + api routing |

Estimated effect on this evaluation: **~78% → ~89%**, and — more importantly —
eliminates every *confidently wrong* answer, which the roadmap already
identifies as the credibility killer.

### Wave 2 — Functions/Graphing rebuild (own sitting, the 2/10 category)

Derivative-based critical points, root-based intercepts, domain reporting,
asymptote detection (D1–D5). Estimated effect: **~89% → ~93%**, plus honest
graphs. Pairs with the existing "Graph annotations" roadmap item.

### Wave 3 — new capabilities (roadmap items, by demand)

Definite integrals → systems (2×2) → one-sided limits already landed in
Wave 1 → inequalities. Each needs parsing conventions, solver, steps, and
tests; sized individually on the roadmap.

---

## Testing Policy for the Fixes

Per the repo's established practice (`tests/regressions.test.js`):

- Every Wave 1/2 fix lands **with a regression test citing the evaluation
  row** it fixes (e.g. "CSV row 10: d/dx arctan(x) returned 0").
- The full evaluation CSV in this folder becomes a **runnable regression
  harness** (roadmap P0, Wave 1) — after Wave 2, a scripted re-run of all 91
  inputs scores ≥ 90% and, critically, produces **zero confident wrong
  answers** (failures must be explicit refusals).
- The "refuse clearly" guards get their own tests: mangled input (systems,
  definite integrals, inequalities) must never return a numeric answer.

### The harness cannot be a string match

Several CSV rows classified "Correct" are *format-divergent* from their
expected answer — the engine is right, the text differs:

- `d/dx tan(x)`: solver `1/(cos(x)^2)` vs expected `sec^2(x)`
- `d/dx sqrt(x)`: solver `1/(2*x^(1/2))` vs expected `1/(2*sqrt(x))`
- `∫1/x`: solver `log(x)` vs expected `ln|x|`

A naive `assert.equal` harness fails these true-positives and floods the run
with false alarms until it gets ignored. The harness must compare by **math
equivalence**: evaluate both expressions at several sample points and compare
numerically, or normalize both through Algebrite (`simplify(a - b) == 0`).
Each row resolves to Correct / Equivalent-but-reformatted / Wrong / Refused,
where **Refused is a pass** for the unbuilt-feature rows.

## Why "Refuse Clearly" Downgrades Half the Roadmap

The single most important structural point, and the honest answer to "when is
MasterMath trustworthy?":

**Trustworthy ≠ solves everything. Trustworthy = never confidently wrong.**

Definite integrals, systems of equations, and inequalities appear as *P0
correctness harms* today only because they **mis-answer** — parse to nonsense
and return a confident wrong number (A5, A6, and the inequality echo). They
are not P0 because the feature is missing; they are P0 because the failure is
*silent and wrong*.

The refuse-clearly guard (Wave 1) severs that. The moment the app says "I
can't solve definite integrals yet" instead of returning garbage:

- the **correctness harm is gone** — a student is never misled;
- *building* the capability drops from **P0 correctness → P2/P3 feature**,
  scheduled by demand, not by danger.

So one small guard converts three frightening correctness bugs into three
calm, optional features. This is why the roadmap lists the *guard* in Wave 1
P0 but the *definite-integral / systems / inequality solvers* down at P2/P3 —
they are deliberately different line items, and conflating them (as an
outside reader might) overstates the remaining correctness risk.
