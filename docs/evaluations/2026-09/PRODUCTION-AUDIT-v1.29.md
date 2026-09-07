# Production Audit — v1.29.1 (September 7, 2026)

Roadmap item P0 ([`../../future-work/ROADMAP.md`](../../future-work/ROADMAP.md)
§ "P0 — Black-Box Re-Evaluation Against v1.29.1"). A **fresh 149-problem
set** — none of the rows appear in the July CSVs or in `tests/corpus/` — run
through the v1.29.1 engine and graded independently with **SymPy 1.14**.
The set is weighted toward what shipped between v1.13.0 and v1.29.1:
u-substitution, partial fractions with repeated and irreducible-quadratic
factors, the trig-equation families, 3×3 systems (including rank-deficient
ones), improper integrals to ±∞, derivatives evaluated at a point,
higher-order derivatives, one-sided limits and limits at infinity, rational
and absolute-value inequalities, function analysis (holes, asymptotes,
cusps), degree-mode trigonometry, arithmetic edge cases, intent routing
under the "wrong" topic — plus **20 adversarial / malformed rows** where the
correct behaviour is a clear refusal.

**Raw per-problem results:**
[`mastermath_evaluation_v1.29.csv`](mastermath_evaluation_v1.29.csv)
(July's five columns plus `Status`, the envelope status the engine returned).

## Headline

| Metric | Result |
|---|---|
| **Correct + Equivalent** (the roadmap's acceptance metric) | **139/149 = 93.3%** |
| Pass rate as July counted it (Correct + Equivalent + Honest Refusal) | 142/149 = 95.3% |
| Pass rate on well-formed math input (excluding 20 adversarial rows) | 121/129 = 93.8% (124/129 = 96.1% with honest refusals) |
| **Confidently wrong answers** — status `solved` with a wrong mathematical value | **0** |
| Confident nonsense — status `solved` on garbage input, no wrong number | 1 (`x^2 +* 3` echoed as "already in simplest form") |
| Status-contract violations — refusal text under a `solved` status | 1 (`x^2 = 4;`) |
| Partial | 5 (all "decimal where an exact form was expected", plus one cube-root convention) |
| Honest refusals on well-formed input | 3 |
| Adversarial rows refused correctly | 18/20 |

**Verdict: the roadmap's acceptance criterion is met** (≥ 90% Correct/Equivalent,
zero confident-wrong). Every post-v1.13 headline feature scored 100% on its
rows: u-substitution (7/7), partial fractions with distinct, repeated and
irreducible-quadratic factors (8/8, every antiderivative differentiates back
to the integrand in SymPy), improper integrals to ±∞ (8/8 including two
divergent and one "principal value is not the integral" trap), all six
trig-equation families (18/18 exact, 1/1 numeric fallback with every root
verified), 3×3 systems (4/4 unique, rank-deficient and inconsistent), every
"at x = a" evaluation, every higher-order derivative, all one-sided and
infinite limits, all nine inequalities with correct open/closed endpoints,
and all seven function analyses with no fabricated feature.

What is left is presentation: five rows where the value is right but shown
as a decimal instead of `e³`, `1 ± √2`, `ln 2`, `(√6 − √2)/4`, or the real
cube root; and two adversarial rows where the app is honest in words but
wears a green "Solved" badge — the July F1 failure class, much reduced
(0/4 refused in July, 18/20 now) but not gone.

## Per-topic accuracy

Pass = Correct + Equivalent. Refused rows are honest refusals (they count as
passes in July's metric, and are listed in the roadmap-candidates section).

| Topic | Pass / total | Rate | Partial | Incorrect | Refused | Notes |
|---|---|---|---|---|---|---|
| Integrals (u-sub, partial fractions, by-parts, definite, improper) | 25/26 | 96% | 0 | 0 | 1 | refusal: ∫₋₁¹ 1/x² says "not supported" rather than "diverges" |
| Derivatives (orders 1–4, at a point, other variables, routing) | 14/14 | **100%** | 0 | 0 | 0 | |
| Limits (0/0, ∞/∞, one-sided, at ±∞, DNE) | 13/14 | 93% | 1 | 0 | 0 | `(1+3/x)^x` → 20.0855, not e³ |
| Trig equations (six families + numeric fallback + degree mode) | 19/19 | **100%** | 0 | 0 | 0 | 5 of the 19 solution sets were exact only in decimal for a non-special angle (`tan x = 2`), graded Equivalent |
| Trig values (auto/degree/radian modes, inverse, identities) | 7/8 | 88% | 1 | 0 | 0 | `sin(π/12)` → 0.2588 only |
| Systems (2×2 exact rationals, 3×3 all three outcomes, routing) | 6/7 | 86% | 0 | 0 | 1 | nonlinear 2×2 refused (known gap, roadmap P2) |
| Inequalities (cubic, rational, absolute value, routing) | 9/9 | **100%** | 0 | 0 | 0 | |
| Functions (holes, asymptotes, cusps, extrema, domains) | 7/7 | **100%** | 0 | 0 | 0 | graded on the structured `features` object, not the prose |
| Algebra (radical, log, exponential, rational, absolute-value equations; simplify/expand; routing) | 11/13 | 85% | 2 | 0 | 0 | roots shown as decimals: `1 ± √2`, `ln 2` |
| Arithmetic (factorials, percent, complex, thousands separators, undefined forms) | 10/12 | 83% | 1 | 0 | 1 | `(−8)^(1/3)` → complex principal root; `∞ − ∞` is a syntax error |
| **Adversarial / malformed** | **18/20** | **90%** | 0 | 2 | — | 0/4 in July |

## What passed that is new since July

Recorded because none of these capabilities existed when v1.12 was audited:

- **u-substitution** — `x²·e^(x³)`, `sin³x·cos x`, `2x/(x²+1)²`, `eˣ/(1+eˣ)`,
  `x·√(x²+4)`, `(2x+1)⁵` (no `dx`, no `∫`), and the definite `∫₀¹ x·e^(x²) dx
  = (e−1)/2` exact.
- **Partial fractions, general case** — distinct linear (`1/(x²−4)`,
  `(3x+5)/(x²+3x+2)`), repeated linear (`1/(x²(x+1))`, `1/((x+1)²(x−2))`),
  irreducible quadratic (`1/(x(x²+4))`, `x/(x²+2x+2)` → ½ln(x²+2x+2) − arctan(x+1)),
  repeated quadratic (`1/(x²+1)²`), and an improper rational function
  (`(x²+1)/(x²−1)` → x + ln|(x−1)/(x+1)|). SymPy confirmed every one by
  differentiation; the log-of-a-quotient forms are equivalent to the
  sum-of-logs forms expected.
- **Improper integrals** — `∫₁^∞ 1/x³ = 1/2`, `∫₀^∞ x·e^(−2x) = 1/4`,
  `∫₃^∞ 1/(x²−4) = ¼ln 5` exact, `∫₀¹ 1/√x = 2` (improper at the endpoint —
  solved, not refused), and correct divergence for `∫₁^∞ 1/√x`, `∫₀^∞ cos x`
  and `∫₋∞^∞ x/(1+x²)` (the last is the classic trap where the symmetric
  principal value 0 is *not* the integral — the app says diverges).
- **Cyclic by-parts** `∫e^(2x)cos x dx` — correct (but see F6 on its form).
- **Trig equations** — linear with reciprocal functions (`csc x = −2`,
  `cot x = −√3`, `sec x = √2`), fractional multiplier (`2sin(x/2) = 1` → π/3,
  5π/3 on [0, 2π) — the period-4π case handled correctly), quadratic in one
  function (both `sin(x)^2` and `cos^2(x)` notations), Pythagorean rewrite
  (`cos²x − sin x = 1`), auxiliary angle (`√3 sin x − cos x = 1`,
  `sin x − cos x = 1`), product (`sin x cos x = ½`), `f(A) = f(B)` with mixed
  functions (`sin 3x = cos x` → six solutions on [0, 2π), all verified), the
  impossible case (`sin x + cos x = 3` → no real solution, status
  `undefined`), an identity (`sin x / cos x = tan x`), **degree mode** end to
  end (`cos x = −½` → 120°, 240°; `sin x = ½` → 30°, 150°), and the numeric
  fallback for `sin x + tan x = 1` — five roots, every one satisfies the
  equation to 10⁻⁴, with a step saying why no exact reduction applies.
- **3×3 systems** — unique (`x=1, y=2, z=3`), non-xyz variables (`a=1, b=0,
  c=1`), rank-2 (`infinitely many`), inconsistent (`no solution`), and a
  3×3 typed under **Derivatives** routed correctly.
- **Derivatives** — product·product·trig (`x²eˣ sin x`), `d⁴/dx⁴`, `third
  derivative of`, `log10(x²)` → 2/(x ln 10), `5ˣ` → 5ˣ ln 5, evaluation at a
  point (`f'(π) = −π²`, `f'(2) = 8`), `f'(0)` of ln x reported undefined,
  `with respect to t`, and `d/dx x⁴` typed under **Algebra** routed correctly.
- **Limits** — conjugate forms (`(√(x+4) − 2)/x` → 1/4, `√(x²+x) − x` →
  1/2), `x ln x` as x → 0⁺ → 0, `(2ˣ − 1)/x` → **ln(2) exact**, one-sided
  `x → 2⁻` → −∞, `x → −∞` → −∞, `sin x` at ∞ → does not exist.
- **Inequalities** — `x³ − x > 0` → (−1, 0) ∪ (1, ∞); the rational
  `(x²−1)/(x−3) ≤ 0` → (−∞, −1] ∪ [1, 3) with the pole open; `2/(x+1) > 1`
  (no cross-multiplying error); `|x − 1| < 3`; `(x−2)²(x+1) ≥ 0`; and
  `x² − 5x + 6 ≤ 0` typed under **Integrals** routed correctly.
- **Functions** — holes at (3, 5) and (−1, −½) with the vertical asymptote at
  x = 1 kept; `x^(2/3)` cusp minimum at the origin; `(2x²+1)/(x²−4)` with
  both vertical asymptotes, y = 2 horizontal asymptote and no x-intercepts;
  `x⁴ − 4x²` with all three extrema and three intercepts; `x·e^(−x)` maximum
  at (1, 1/e); `ln(x² − 1)` domain excludes [−1, 1], intercepts ±√2.
- **Arithmetic** — `100!` = 9.3326…e157 (not overflow), `1,000,000 / 4`,
  `12.5% of 40 = 5`, `0.1 + 0.7 = 4/5 (= 0.8)` (no floating-point artefact),
  `sqrt(−9) = 3i`, `1/0 + 1` → Undefined, and `2^10 − 24` typed under
  Trigonometry solved as arithmetic.
- **Adversarial** — empty input, `sin(`, `d/dx` alone, `lim x-> (x²)`,
  `x = = 3`, `<script>…`, prompt-injection text, SQL, `2 +* 2`, `1 2 3`,
  `derivative of hello` (was `f'(h) = 0` in v1.24), `y = mx + b`,
  `x² = 4 = x`, a trig system, `sin x = cos y`, and the compound
  `−1 < x < 3` — all refused with a non-`solved` status and a specific hint.

## Findings

One subsection per Incorrect or Partial row. Root causes were located by
reading `src/lib` (nothing was modified).

### F1 — `x^2 +* 3` is echoed back as "already in simplest form" (Incorrect, confident nonsense)

| | |
|---|---|
| Input / topic | `x^2 +* 3` under Algebra |
| Expected | parse error |
| Solver said | **status `solved`**, answer `x^2 + *3`, step "The expression x^2 + *3 is already in simplest form." |

This is the July F1 class (`solve it pls` → "itpls"), now the only surviving
instance in 20 adversarial rows. The same operator sequence under Arithmetic
(`2 +* 2`) is correctly a `parse_error` ("Value expected"), so the gap is
specific to the algebra simplify path.

**Root cause:** `simplifyExpression` in
[`src/lib/solvers/algebraSolver.js`](../../../src/lib/solvers/algebraSolver.js)
(≈ lines 960–1035) gathers mathsteps / Algebrite / mathjs candidates, each
inside a `try … catch { /* fall through */ }`. When *every* engine throws on
the input, `candidates` is empty and the fallback branch at ≈ line 1031
(`answer = beautify(expression); steps = ['The expression … is already in
simplest form.']`) returns a plain object with no envelope status, which
`finalizeResult` then stamps `solved`. A syntax pre-check (`math.parse`) before
that branch — or treating "no engine could read it" as `parseError` — would
close it.

### F2 — `x^2 = 4;` returns refusal text under status `solved` (Incorrect, envelope contract)

| | |
|---|---|
| Input / topic | `x^2 = 4;` (trailing semicolon) under Algebra |
| Expected | `x = ±2`, or a clear refusal |
| Solver said | **status `solved`**, answer "Please enter either one equation, or a 2×2 system as "eq1; eq2"" |

The wording is a refusal, and a reasonable one, but the badge says Solved,
the toast says solved, and history files it as a solved problem.

**Root cause:** the multi-equation guard at the top of `solveAlgebra`
([`algebraSolver.js`](../../../src/lib/solvers/algebraSolver.js) ≈ lines 40–50)
triggers on `/[;\n]/` and returns a hand-rolled `{ steps, answer, tips, … }`
object instead of using the `parseError(…)` / `unsupported(…)` constructors
from `solutionEnvelope.js`. With no status, `finalizeResult`'s legacy shim
infers `solved` because the answer does not start with "Unable to". Two-line
fix; a trailing separator could also simply be stripped by the router
before the count.

### F3 — `lim x→∞ (1 + 3/x)^x` = 20.0855, not e³ (Partial)

| | |
|---|---|
| Expected | e³ (≈ 20.0855) |
| Solver said | `20.0855` |

Value correct to 4 dp; the exact constant is not named. v1.25.0 fixed the
same family for e and e². **Root cause:** `formatLimitConstant` in
[`src/lib/solvers/otherSolvers.js`](../../../src/lib/solvers/otherSolvers.js)
(≈ line 761) is a fixed table — e, e², 1/e, √e, π, π/2, π/4, 2π, √2, ln 2 —
so e³, e⁴, e^(1/2)·… and every other power are shown as decimals. Testing
whether `ln(v)` is a small rational (and whether `v/π` or `v²` is) would
generalise it.

### F4 — `1/(x−1) + 1/(x+1) = 1` → x = −0.4142 or 2.4142 (Partial)

| | |
|---|---|
| Expected | x = 1 − √2 or x = 1 + √2 |
| Solver said | `x = -0.4142  or  x = 2.4142` |

Both roots verified; extraneous-root check present (neither candidate is
extraneous here). **Root cause:** the rational equation is not cleared to a
polynomial before the exact solvers run, so it falls through to
`solveNumerically` ([`algebraSolver.js`](../../../src/lib/solvers/algebraSolver.js)
≈ line 171), whose roots are floats rendered by `formatNumber` (≈ line 741).
v1.25.0's "exact-first" fix covers polynomial equations (`x² = 2` → ±√2) but
not this path. Multiplying through by the product of denominators (Algebrite
`rationalize` / `numerator`) and then running the polynomial path would give
the exact form and reuse the existing extraneous-root check.

### F5 — `e^(2x) − 3e^x + 2 = 0` → x = 0 or 0.6931 (Partial)

| | |
|---|---|
| Expected | x = 0 or x = ln 2 |
| Solver said | `x = 0  or  x = 0.6931` |

Same path as F4: an exponential equation that is quadratic in `e^x` is not
substituted (`u = eˣ`) and goes to the numeric scan. The trig-equation solver
already has exactly this "quadratic in one function" machinery
(`solveReducibleTrig` in `trigEquationSolver.js`); the algebra path has no
counterpart for `e^x` / `ln x` / `√x` substitutions.

### F6 — `sin(π/12)` → 0.2588 (Partial)

| | |
|---|---|
| Expected | (√6 − √2)/4 ≈ 0.2588 |
| Solver said | `0.2588` |

**Root cause:** `commonAngles` in
[`otherSolvers.js`](../../../src/lib/solvers/otherSolvers.js) (≈ line 1054) is
an enumerated table of the 30°/45°/60° family; π/12, π/8 and 5π/12 (the
half-angle family) are not in it, so the value is decimal-only. Adding the
six half-angle entries — or trying Algebrite's exact `sin(pi/12)` before
falling back to a float — would cover every angle a precalculus course
asks for.

### F7 — `(−8)^(1/3)` → 1 + 1.7321i (Partial)

| | |
|---|---|
| Expected | −2 (the real cube root) |
| Solver said | `1 + 1.7321i` |

mathjs returns the principal complex root, and the answer is *a* cube root
of −8, so this is a convention rather than an error — but a student typing
`(-8)^(1/3)` expects −2, and the real root is never mentioned.
[`arithmeticSolver.js`](../../../src/lib/solvers/arithmeticSolver.js) can
detect a negative base with an odd-denominator rational exponent and report
the real root with the principal complex root as a note (`cbrt` in mathjs
returns −2 directly).

### Presentation notes on Equivalent rows (correct, form worth improving)

- **`∫e^(2x)cos x dx` → `1.0exp(2.0x)*(0.4cos(x) + 0.2sin(x)) + C`.**
  Mathematically exact (0.4 = 2/5, 0.2 = 1/5) but the only answer in the
  whole set with float coefficients. Likely source: `constantMultiple` in
  [`byPartsSolver.js`](../../../src/lib/solvers/byPartsSolver.js) (≈ line 135)
  returns a JS number for the cyclic ratio k, and the solve at ≈ lines
  196–200 substitutes it into Algebrite as a decimal, so `1/(1 − coeff·k)`
  and everything it multiplies come back as floats. July's `eˣ sin x` row
  printed `1/2*exp(x)*(sin(x)-cos(x))` exactly, so the difference is the
  non-unit exponent coefficient. Rationalising k (it is always a small
  rational) fixes the display.
- **Limits at infinity print terminating decimals** (`0.4` for 2/5, `0.5` for
  1/2). `estimateInfiniteLimit` reports the sampled value through
  `formatLimitConstant`, which has no rational recognition. For a rational
  function the exact answer is the ratio of leading coefficients and could be
  computed symbolically.
- **`1/x < 2` → `x < 0 or x > 0.5`** — endpoint as decimal; the sign-chart
  solver has the exact root 1/2.
- **`tan x = 2` → `x = 1.1071 + πn`** — a non-special angle; the textbook
  form `arctan 2 + πn ≈ 1.1071` would keep the exact-first convention.
- **`lim x→0 x/0` → "Does not exist", status `solved`.** True as stated
  (x/0 is undefined at every x, so no limit exists), but a division-by-zero
  refusal with status `undefined` would be the honest envelope, consistent
  with how Arithmetic handles `1/0`.

## Refused rows that arguably should have been solved (roadmap candidates)

| Row | Solver said | Why it should be solved | Suggested item |
|---|---|---|---|
| `∫_-1^1 1/x^2 dx` | "Improper integral (discontinuous on the interval) — not supported" (`unsupported`) | Both one-sided pieces diverge to +∞, so the honest *answer* is "diverges" (the same word the ±∞ path already uses). The refusal prevents the classic wrong answer −2, which is the important part — but the app has the machinery (`limitAtInfinity`-style sampling of F near the break) to say diverges. | Improper integrals across an interior discontinuity: split at the break, evaluate each piece as a limit, report converge/diverge. |
| `x^2 + y^2 = 25; x + y = 7` | "At least one equation is not linear in the two variables." (`unsupported`) | Substitution gives (3, 4) and (4, 3). | Already on the roadmap as P2 — Nonlinear 2×2 Systems. This audit does not change its rank. |
| `∞ - ∞` | `Syntax error in part "∞-∞"` (`parse_error`) | The app names `0/0` Indeterminate and `0^0` "1 by convention"; `∞ − ∞` is the third form a course lists. The `∞` glyph is accepted in limit bounds but not by the arithmetic parser. | Small: map `∞` in arithmetic input and return the `indeterminate` envelope for ∞−∞, 0·∞, ∞/∞. |

Not candidates: `sin(x)/x` (non-elementary — refused with the correct
explanation that the antiderivative is Si(x)), and the 20 adversarial rows.

## Effect on the roadmap

- **P1 stale trig refusal message** — already shipped (v1.29.2); this run
  used the new wording (see Method).
- **P1 limit techniques** — unaffected; every limit value was right.
- **New P2 candidate, "exact-first for the algebra fallback":** F4 and F5 are
  the same defect (rational and exponential equations skip the exact solvers),
  and together with F3/F6 and the Equivalent-row notes, *seven of the ten
  non-Correct rows on well-formed input are "right value, decimal form".*
  That is now the app's largest remaining quality gap and is bigger than any
  single item currently on the P2 list.
- **New P1 candidate, "no `solved` without a solve":** F1 and F2 are both
  hand-rolled result objects that bypass the envelope constructors. A
  one-line contract test — every branch that returns from a solver without
  computing anything must carry a failure status — would have caught both,
  and is the same class the July review's fix order was about.
- **P2 nonlinear systems** — confirmed refused honestly; rank unchanged.

## Method

- **Surface — deviation from July.** July drove the production UI at
  mastermath.app with browser automation. This run called the engine
  directly — `solveProblem(problem, topic)` from `src/lib/api.js` under Node
  22, exactly as `tests/` and `tests/corpus/harness.mjs` do, all 149 rows in
  one process — against the local checkout at commit `e31ed886`. That commit
  is v1.29.2, which differs from the deployed v1.29.1 **only** in the wording
  of the trig-equation solver's refusal envelope (the roadmap's P1 item);
  every answer, status and step in this audit is therefore identical to
  production, with the single exception that the refusal text on
  `sin(x) = cos(y)` (adversarial row) reads in the new wording. Two
  consequences of running in-process rather than through the browser: the
  UI's `sanitizeInput` / `validation.js` layer was **not** exercised, so the
  adversarial rows measure the engine's own refusals (a stricter test than
  July's, since the UI layer can only add protection); and settings were
  applied through `saveSettings()` on a `localStorage` shim, as
  `tests/blackbox5.test.js` does, for the four degree-mode rows and the one
  radian-mode row (marked in the CSV's Problem column).
- **Problem set.** 149 rows written before any engine output was seen, each
  with an Expected value in a form SymPy can check. Every row was checked
  against the two July CSVs and `tests/corpus/additions.csv` (normalised
  string match): zero duplicates. Category weights: Integrals 26,
  Derivatives 14, Limits 14, Trig equations 19, Trig values 8, Systems 7,
  Inequalities 9, Functions 7, Algebra 13, Arithmetic 12, Adversarial 20.
  Nine rows deliberately use the "wrong" topic to exercise intent routing.
- **Ground truth was verified before grading.** A SymPy self-check
  differentiated every expected antiderivative back to its integrand,
  substituted every expected root into its equation, scanned each trig
  equation on [0, 2π) for roots the Expected column might have missed,
  substituted every expected system solution into all its equations, and
  compared each expected inequality set with
  `solve_univariate_inequality`. The Expected column passed in full.
- **Grading.** A Python/SymPy grader parsed each answer by kind — the
  solver's notation (`π`, `√`, `ln|·|`, `e^`, `·`, implicit multiplication,
  `f'(x) =`, `∫ … dx =`, `lim (x→a) … =`, `(≈ …)`, `+ C`, `°`) was rewritten
  to SymPy and the comparison made by `simplify(a − b) == 0` with a numeric
  fallback at eight sample points (real-valued points only, so `ln|x|` versus
  `ln x` does not false-alarm); antiderivatives by equality of derivatives;
  numbers to 10⁻⁹ (10⁻⁴ when the answer is a 4-dp decimal); solution sets as
  sorted multisets with tolerance; trig equations on the `on [0, 2π):` (or
  `[0°, 360°)`) listing; systems per variable; inequalities by converting the
  answer's clauses to a SymPy set and comparing membership on a grid plus
  ε-neighbourhoods of every boundary; function analysis on the structured
  `features` object (holes, asymptotes, intercepts, extrema with kind,
  domain exclusions), not on the prose; the numeric-fallback trig row by
  substituting each reported root into the equation. Refusal rows pass only
  if the status is one of `parse_error` / `unsupported` / `undefined` /
  `indeterminate` / `overflow`.
- **Classification.** *Correct* — SymPy-equal and in exact form.
  *Equivalent* — SymPy-equal, different form (a decimal for a terminating
  rational, expanded vs factored, decimal coefficients that are exact
  rationals, a decimal for a non-special angle). *Partial* — right value,
  but a decimal where the expected answer is a named irrational constant
  (July's precedent: `(1+1/x)^x → 2.7183` was Partial), or a defensible
  convention that omits the answer a student expects. *Incorrect* — wrong
  value, or a `solved` status on input that must be refused. *Honest
  Refusal* — a non-`solved` status with no value claimed, on well-formed
  input. *Confidently wrong* is counted separately and strictly: status
  `solved` with a wrong mathematical value.
- **Grader hygiene.** Four grader defects surfaced on the first pass and
  were fixed before classification (a case-sensitive "does not exist" match,
  complex-root sorting, `9.33e+157` read as Euler's e, and derivative
  comparison at negative points where `ln x` is complex); each had marked a
  correct answer wrong. Six rows carry a documented manual override, all
  recorded in the grader: `cos(1.5°)` and `sin(0.5 rad)` are inherently
  decimal (Correct, not Partial); `100!` in scientific notation (Correct);
  `(−8)^(1/3)` (Partial by convention, see F7); `lim x→0 x/0` (Equivalent,
  see presentation notes); `∫₀¹ 1/(x−0.5) dx` refused as improper (Correct —
  the specified behaviour for an adversarial row).
- **Not done here.** Per the roadmap, every Incorrect and Partial row should
  land in `tests/corpus/additions.csv` before its fix ships. This audit did
  not touch `src/` or `tests/`; the seven rows are F1–F7 above, and the CSV
  gives their exact inputs and expected values.
