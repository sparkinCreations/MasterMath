# Production Audit — v1.12.0 (July 16, 2026)

A third external black-box evaluation, run against **production at
mastermath.app (v1.12.0)** through the real UI — topic dropdown, textarea,
Solve button — with **78 problems** across all seven topics plus an
adversarial set. Every answer was independently verified with SymPy 1.14
and/or by hand **before** comparing against the app; the app's output was
never treated as ground truth. It follows the v1.8.0 audit
([`PRODUCTION-AUDIT-v1.8.md`](PRODUCTION-AUDIT-v1.8.md)) and deliberately
probes the capabilities added since: definite integrals, integration by
parts, systems of equations, and inequalities.

**Raw per-problem results:**
[`mastermath_evaluation_v1.12.csv`](mastermath_evaluation_v1.12.csv)
(same 5-column format as the earlier evaluation CSVs).

## Headline

| Metric | Result |
|---|---|
| Overall pass rate (Correct + Equivalent + Honest Refusal) | **70/78 = 89.7%** |
| Pass rate on well-formed math input (excl. 4 adversarial) | **70/74 = 94.6%** |
| **Confidently wrong answers** (the zero-goal metric) | **3** — one math answer (`1/0` → `∞`), two malformed-input claims ("No real solution found") |
| Confident nonsense (echoed garbage, no wrong number) | 2 ("itpls", "asdfghjkl") |
| Partial | 3 |
| Honest refusals | 2 (both appropriate) |

Verdict: **8/10.** The core engine is in the best shape it has ever been —
every 2026-07 headline feature scored 100% — but the app answers
confidently on garbage input, which is exactly the failure mode the
"refuse clearly, never guess" philosophy forbids.

## Per-topic accuracy

| Topic | Pass / total | Rate | Notes |
|---|---|---|---|
| Integrals (definite, indefinite, by-parts, improper) | 19/19 | **100%** | includes swapped bounds, term-by-term mixed sum, and a clean refusal of ∫₋₁¹ 1/x |
| Derivatives | 9/9 | **100%** | includes x^x and natural-language phrasing |
| Systems of equations | 5/5 | **100%** | exact rationals (18/5, −2/5), both degenerate trichotomy cases |
| Inequalities | 8/8 | **100%** | every endpoint open/closed decision correct, incl. (−∞,−2)∪[1,∞) |
| Trigonometry | 5/5 | **100%** | tan(π/2) → Undefined with asymptote explanation |
| Functions/graphing | 4/4 | **100%** | zero fabricated features (the v1.3 failure mode is gone) |
| Limits | 8/9 | 89% | one PARTIAL: `(1+1/x)^x` → 2.7183 instead of exact e |
| Algebra (equations/simplify) | 6/7 | 86% | one PARTIAL: `expand` verb ignored |
| Arithmetic | 6/8 | 75% | `1/0` → ∞ (INCORRECT), `0/0` → NaN (PARTIAL) |
| **Adversarial / malformed** | **0/4** | **0%** | none of the four garbage inputs was refused |

## What passed that used to fail

Worth recording, because all of these were failures in the July 8
evaluation of v1.3.1 ([`ANALYSIS.md`](ANALYSIS.md)):

- **Definite integrals** — exact values with FTC steps and Simpson's-rule
  cross-check; swapped bounds give the correct sign; the improper
  ∫₋₁¹ 1/x dx is refused with a correct explanation instead of the
  "confident but meaningless" ln|−1|−ln|1| = 0.
- **Integration by parts** — the full LIATE u/dv derivation renders for
  every case tested, and the two families Algebrite cannot do are now
  correct: repeated (`x³·sin x`, three rounds shown) and cyclic
  (`eˣ·sin x`, shown solving for the reappearing integral algebraically).
  All five antiderivatives differentiate back to the integrand (verified
  independently in SymPy).
- **Systems** — unique / parallel / same-line trichotomy all correct, with
  exact rational arithmetic and a back-substitution check step.
- **Inequalities** — the sign-chart method with correct open/closed
  endpoints in all eight cases, including poles-always-open on the
  rational inequality and the single-point solution of (x+1)² ≤ 0.
- **Functions** — no invented vertices or intercepts anywhere; exact
  irrational intercepts (±√3) and exact extrema on x³−3x.
- **One-sided limits and DNE** — `x→0⁺ 1/x` → ∞; two-sided 1/x and |x|/x
  → DNE with correct one-sided values; sin(1/x) → DNE attributed to
  oscillation; (1−cos x)/x² → exact 1/2, not 0.5.

## Findings

### F1 — Malformed input is answered, not refused (4/4 adversarial failures, 2 confidently wrong)

| Input | App output |
|---|---|
| `solve it pls` | "The expression **itpls** is already in simplest form. Final Answer: itpls" |
| `asdfghjkl` | "Final Answer: asdfghjkl" |
| `2*(x+3 = 10` (mismatched parens) | "Rewrite as (2(x+3) − (10) = 0 … **No real solution found**" |
| `x^2 + = 5` (dangling operator) | "**No real solution found**" |

The last two are the serious ones: **"No real solution found" is a
mathematical claim, and it is false.** `2(x+3) − 10 = 0` — the rewrite the
step itself displays — is solved by x = 2, and `x² = 5` by ±√5. The likely
mechanism (hypothesis, not yet verified in code): the input fails to
evaluate at every numeric scan point, the scanner sees no sign change, and
the empty scan is reported with the same wording as a genuine
no-solution result. This is the same structural lesson as the v1.8.0
audit: *the refuse-clearly guards cover unsupported topics, but a path
that thinks it succeeded slips under them.* A parse-validation gate in
front of every solver — words stripped, unbalanced parens, dangling
operators, leftover non-math tokens → "I couldn't understand this input"
— would convert all four rows into honest refusals.

Note the asymmetry: the integrals path already refuses beautifully
(∫₋₁¹ 1/x dx), and arithmetic refuses `15% of 80` with "Unable to
evaluate". The gap is specifically the algebra/simplify fallback path.

### F2 — `1/0` → `∞` (confidently wrong), `0/0` → `NaN` (leaked artifact)

The only wrong answer on well-formed math input in the entire run. Real
division by zero is **undefined**, not ∞ — this is mathjs's IEEE-754
convention passed straight to a student. `0/0` → "NaN (0/0)" has the right
idea (no value) but leaks a JavaScript artifact instead of saying
"undefined (0/0 is indeterminate)". The trig solver already gets this
exactly right for tan(π/2) → "Undefined", so the presentation standard
exists in the codebase.

### F3 — `expand (x+2)^2` ignored (PARTIAL)

The `expand` verb isn't recognized; mathsteps sees an already-simplified
expression and answers "already in simplest form." Not a false statement,
but the requested operation was silently not performed. Either support
`expand`/`multiply out`, or refuse the verb explicitly.

### F4 — `lim x→∞ (1+1/x)^x` → `2.7183` (PARTIAL)

The numeric-sampling limit path presents a rounded decimal as the limit.
The true value is exactly **e**. The removable-discontinuity path already
reports exact fractions (1/2 for (1−cos x)/x², fixed in v1.9.1), so this
is the one remaining limit family answering in decimals — recognizing
e / π / simple multiples in the sampling path (or routing this form
through a known-limits table) would fix it.

### Cosmetic (not graded down)

- Step labels sometimes cite the wrong rule name: ∫sec²x dx and d/dx(x^x)
  both say "Power rule".
- `x² − 2x + 1 = 0` answers "x = 1 or x = 1" — correct, but the double
  root should be deduplicated ("x = 1, a double root").
- Mixed `ln`/`log` notation within a single derivative answer
  (`1/x^2 − log(x)/x^2`).
- UI: roughly 1 in 15 Solve clicks after editing the input did not
  register on the first click (previous solution stayed up; second click
  always worked). Observed via browser automation; worth a quick manual
  check that rapid input-change → click isn't dropping the handler.

## Recommendation

One sentence: **add a "did this actually parse as math?" gate in front of
every solver, make the algebra fallback say "I couldn't understand this
input" instead of "No real solution found", and render 1/0 as undefined —
that alone takes confidently-wrong from 3 to 0.**

Suggested acceptance rows for `tests/corpus/additions.csv` (the four
adversarial rows plus `1/0`, `0/0`, `expand (x+2)^2`, and
`lim x→∞ (1+1/x)^x`) are already in the evaluation CSV in this folder.

## Method

- **Surface:** production https://mastermath.app v1.12.0 (footer-verified),
  driven through the real UI (topic dropdown via example cards, textarea,
  Solve button) with browser automation on July 16, 2026.
- **Ground truth:** every expected answer computed independently with
  SymPy 1.14 (`solve`, `integrate`, `limit`, `diff`,
  `solve_univariate_inequality`) and/or by hand, *before* reading the
  app's answer.
- **Grading:** CORRECT / EQUIVALENT (mathematically equal, different
  form — judged by equivalence, never string match) / PARTIAL / INCORRECT
  / HONEST REFUSAL, per the same rubric as the earlier audits. Honest
  refusals count as passes; only wrong claims count as failures.
- **Verification hygiene:** stale-solution reads (the Solve-click nit
  above) were detected by matching the echoed problem in step 1 against
  the input, and re-solved before grading — no result in the CSV was
  graded against the wrong problem.
