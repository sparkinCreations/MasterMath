# Changelog

All notable changes to MasterMath will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.23.0] - 2026-08-16

Fifth black-box pass: Settings (angle unit, decimal places) across every
solver, the update banner and offline flows in a real browser against a
production build, and the Progress bookkeeping. Decimal places were honoured
everywhere. The angle unit was only half-honoured, and the update banner
could be lost.

### Added

- **Angle results in degrees.** With the angle unit set to degrees,
  `arcsin(0.3)` answers `17.4576°` (was `0.3047` — radians, whatever the
  setting), `arcsin(1/2)` → `30°`, and trig equations are solved *in
  degrees* end to end: `sin(x) = 1/2` → `x = 30° + 360°n or x = 150° +
  360°n; on [0°, 360°): 30°, 150°`, with the reference angle, period and
  graph x-axis all in degrees. In radians mode the degree value is still
  noted (`π/6 (= 30°)`).
- **"Derivative of f at x = a"** evaluates the derivative at the point:
  `derivative of sin(x) at x = 1` → `f'(1) = cos(1) ≈ 0.5403`, `d/dx ln(x)
  at x = e` → `f'(e) = 1/e ≈ 0.3679`, `1/x at x = 0` → `f'(0) is undefined`.
  Before, `derivative of sin(x) at x=1` answered `f'(x) = 0` — the "at x=1"
  was read as `a·t·x = 1` — and `x^2 at x=1.5` under Derivatives claimed
  "infinitely many solutions — one equation cannot fix 3 unknowns".
- **"Expression at x = a"** under Algebra / Functions / Arithmetic
  substitutes and evaluates: `x^2 + 1 at x = 3` → `f(3) = 10`.
- The update banner has a **Later** button (updating reloads the page, so a
  student mid-problem can put it off) and is announced to screen readers.

### Fixed

- **`sin(30°)` was a syntax error** ("Syntax error in part °)") — mathjs has
  no degree token and the symbol reached it before the degree rewrite. Any
  `N°` in the input is now an angle in degrees: `sin(2*30°)`, `sin(30°) +
  cos(60°)`.
- **Angle unit = degrees ignored decimal arguments.** `sin(0.5)` and
  `tan(1.5)` were evaluated in radians under the degrees setting because the
  detector only recognised integer angles. Now `sin(0.5)` → `sin(0.5°)`.
- **`2cos(x) − 1 = 0` under Trigonometry fell to the numeric root scan**
  (five decimal roots, "more solutions in range") instead of the exact
  general solution — a regression from 1.22.0's routing: the trig-equation
  guard used a word boundary that `2cos(` does not have. Same fix for the
  Algebra-topic detector.
- **The update banner could be lost.** If a new version was installed and
  waiting and the page was reloaded instead of clicking Update, the banner
  never came back (`updatefound` does not fire for an already-installed
  worker) — the old version stayed until the next deploy. An already-waiting
  update is now offered on every load.
- **History filed routed problems under the dropdown's topic**: `d/dx x³`
  typed under Algebra was saved — and counted in Topics Covered — as
  Algebra. It is saved as what it was solved as.
- Inverse-trig steps said "Using the sine function (opposite / hypotenuse)"
  for `arcsin`; they now say inverse sine.
- Settings copy describes what the angle unit actually governs (reading and
  reporting angles in Trigonometry; calculus always uses radians).

### Verified (no change needed)

- Decimal places flow through every solver's numeric output (arithmetic,
  algebra roots and inequalities, definite integrals, limits, function
  analysis, trig).
- Offline: with the server stopped, the shell, every route, and a full solve
  (Algebrite, mathjs, KaTeX, charts) load from the precache — all 51 built
  assets are in the manifest.

## [1.22.0] - 2026-08-16

Fourth black-box pass: what happens when a problem is typed under the
"wrong" topic, natural-language wrappers, degenerate input, and the
solve → export → history round-trip. The round-trip was clean (Markdown,
JSON, CSV and history validation all faithful for the new content). The
routing side had a systemic problem: the topic dropdown was trusted
absolutely and the input's own intent was ignored.

### Changed

- **The input's intent wins over the dropdown.** Derivative notation
  (`d/dx`, "derivative of", `dy/dx`), integral notation (`∫`, "integrate")
  and limit notation (`lim`, `->`, "approaches") route to that solver under
  *any* topic; a single equation in one unknown routes to Algebra from any
  topic that doesn't own equations (trig equations stay in Trigonometry,
  `f(x) = …` / `y = …` stay in Functions); a variable expression under
  Arithmetic goes to Algebra. A routed result's first step says so: "Solved
  as Derivatives (you chose Algebra): the input uses derivative notation."
  Before: `d/dx x³` under Algebra "simplified" to `x³` (Solved); `x² = 4`
  under Integrals gave `∫(x²=4) dx = nil·x + C`; under Derivatives, `f′(x) =
  0`; `x²−4=0` under Trigonometry was "not a supported trig equation".

### Fixed

- **`d/dx sin(x)` lost its closing parenthesis** ("sin(x") — the extractor's
  optional trailing `\)?` ate it. Outer parentheses are now stripped only
  when they wrap the whole expression: `d/dx (x³) → x³`, `d/dx sin(x)·cos(x)`
  intact.
- **`2x + 3y = 6` answered "6".** The `y = …` extractor pattern grabbed
  "3y = 6" from inside the equation. It now requires a standalone `y`. And
  one equation in two unknowns is solved for one in terms of the other, with
  the explanation: `x = −3/2·y + 3` — "infinitely many solutions, one for
  every value of y, so we solve for x in terms of y". `solve for y: …` picks
  the variable; radicals are shown in real form (`x = ±(25 − y²)^(1/2)`, not
  `±i·(y² − 25)^(1/2)`).
- **`What is x if 2x + 5 = 11?` answered `x = 6/xif2`.** "What is x if / find
  y when / solve for x given" wrappers are read; a trailing "(solve for y)"
  is treated as an instruction, not part of the expression. "What is the
  limit of … as x approaches 0" (was `limitof…`) is read too.
- **A limit with no approach point silently assumed x → 0** (`x² + 1` under
  Limits → "lim (x→0) … = 1"). It now asks: "No approach point was given —
  a limit needs one (where does x go?)". A constant such as `tan(π/2)` still
  reports Undefined; a bare `lim` is a parse error.
- **A constant under Functions** (`sin(π/4)`, `5`) was analysed as "periodic"
  with a "horizontal asymptote". It is described as a constant function.
- **`=`, `x =`, `= 5`** answered "No real solution found"; they are parse
  errors ("An equation needs an expression on both sides"). `∫` alone: "There
  is nothing to integrate". `9999999999^9999` is an *overflow*, not ∞.
- `expand (x+1)²` was echoed back; it expands to `x² + 2x + 1`.
- The examples list labelled the arithmetic example "Other:" (from 1.21.2).

## [1.21.2] - 2026-08-16

A pass over the UI around the solver, which had not been re-checked since
the solver output changed shape (hole markers, endpoint extrema, extraneous-
root steps, ln|…| forms, π/√/≈ everywhere).

### Fixed

- **PDF export was garbled for essentially every current answer.** jsPDF's
  built-in Helvetica covers Latin-1 only, and anything else — `∫ π √ ≈ ≠ ≤
  ≥ ′ θ ∈ ℤ → − · ² ✓`, all of which today's solver output contains — was
  emitted as garbage glyphs, silently. Every string handed to jsPDF now
  passes through a transliteration to readable Latin-1 (`π → pi`,
  `√ → sqrt`, `≤ → <=`, `− → -`, `∫ → integral`, `′ → '`, `≈ → ~=`, …); a
  character with no mapping becomes a visible `?`, never a wrong glyph.
  Verified against the actual PDF content stream: no UTF-16 fallback runs.
  Markdown, JSON and CSV exports are UTF-8 and were already fine.
- **The Progress page scrolled sideways on a phone.** The history card's
  title / Export / Clear row could not wrap and forced the page 5 px wider
  than the viewport. The row wraps, and `<main>` takes `min-w-0` so no
  descendant can push the layout past the viewport again.
- The mobile header brand wrapped with an orphaned "by"; the byline is now
  its own line under the name.
- The examples list labelled the arithmetic example **"Other:"** (the raw
  topic key); it now uses the topic's display label, "Arithmetic".
- The functions graph's description panel repeated the Key features list in
  different words ("x-intercepts at −1" vs "Crosses the x-axis at x = −1")
  and omitted things the panel had. It now says what the panel does not —
  the overall shape ("A parabola opening upward", "Strictly increasing",
  "The curve breaks at its vertical asymptote") and the analysis window.
- The graph's Key features panel called `√(x−2)`'s endpoint minimum a
  "Local minimum" while the steps called it an endpoint minimum. Endpoint
  extrema now carry that distinction into the graph annotations and read
  "Absolute minimum at the domain endpoint (2, 0)".

## [1.21.1] - 2026-08-16

The Low tail from the third black-box pass, plus one classification bug
found while fixing it.

### Fixed

- Trig-equation solutions at π/8, π/18 and similar are shown exactly
  (`tan(2x) = 1 → π/8, 5π/8, 9π/8, 13π/8`; `sin(3x) = ½ → π/18, 5π/18, …`);
  the exact-angle formatter's denominators now cover halves and thirds of
  the standard angles. Same for inverse-trig results.
- `sin(2x)/sin(x)` → `2cos(x)` (identity table gains `2cos x`, `2sin x`).
- Scientific notation (`1e3`, `2.5e-2`) is read as one number; the constant
  `e` protector no longer splits it.
- Under Arithmetic, `2 x 3` reads the `x` between numbers as multiplication,
  with a step saying so (there are no variables in arithmetic).
- **Odd roots are real.** `x^(1/3)` and `x^(2/3)` under Functions claimed
  "domain: x ≥ 0" — mathjs's `pow` takes the complex principal value for a
  negative base — so the graph stopped at the origin. Numeric evaluation for
  graphs and analysis now rewrites `x^(k/n)` (odd n) to `nthRoot(x, n)^k`;
  the domain is all reals and the graph is the full curve. Even roots keep
  their restriction; Algebrite (derivatives, integrals) still sees the power
  form it understands.
- **`x^(4/3)` at 0 was called a cusp.** It is differentiable there
  (f′ = (4/3)·x^(1/3) → 0, just slowly), and the one-sided slopes at
  h = 1e⁻⁵ (±0.02) tripped the "slopes disagree" test. The classifier now
  checks whether the slopes *shrink* as h → 0 (stationary) or hold/grow
  (corner/cusp): `|x|` and `x^(2/3)` stay cusps, `x^(4/3)` and `x⁴` are
  stationary, `|x²−4|` gets cusps at ±2 and a smooth maximum at 0.

## [1.21.0] - 2026-08-16

Fixes from a third black-box pass (131 fresh problems against v1.20.1): all
four High findings and all six Mediums. Two of the Highs were regressions
from the previous release — called out as such below.

### Fixed

- **`e^(−x²) = 0` answered "x = −28.5, −28, …" — a regression from 1.20.0.**
  That release required a touch root to be a local minimum of |f|, but for
  |x| ≳ 27 `e^(−x²)` underflows to exactly 0 in floating point, so
  "0 ≤ 0 ≤ 0" passed. Both neighbours must now be *strictly* greater. Applied
  in the algebra scan and the functions intercept finder; genuine touch roots
  (`|x−1| = 0`, `x·eˣ = 0`, `(x−1)²`) still count.
- **`sin(45)^2` answered 0.988.** The degrees converter rewrote *every*
  integer in the expression, so the exponent became 2° too. Only the number
  inside each trig call is converted now: `sin(45)^2 → 1/2`, `2·sin(30) → 1`.
- **Extraneous roots were reported.** `x²/(x−1) = 1/(x−1) + 1` gave "x = 0 or
  x = 1"; x = 1 zeroes both denominators. Every solution is now substituted
  into the *original* sides, and any that leaves a side undefined is dropped
  with the reason: "x = 1 makes a denominator zero, so it is extraneous —
  introduced when the equation was multiplied through". `x/(x−2) = 2/(x−2)`
  → "No solution (every candidate makes the original equation undefined)".
- **`2X + 4 = 10` answered "No real solution found".** mathjs is
  case-sensitive, so the uppercase X was undefined at every sample. A lone
  uppercase letter is now read as its lowercase variable — after the
  combinatorics rewrite (`5C2` stays nCr), excluding E and any letter that
  is part of a name (`PI`) or a function (`C(5,2)`).
- **`∫x dx` was a parse error** ("∫ ? xdx"): with no bounds the integral sign
  and trailing `dx` reached the expression extractor. Both are stripped first.
- **"limit of (1+x)^(1/x) as x approaches 0" fused into `limitof(1+x)…`** and
  reported "does not exist". The `(find/evaluate/…) (the) limit of` prefixes
  are stripped; the answer is e.
- **`arcsin(2)` printed a raw complex number** (`1.5707963267948966 −
  1.3169578969248166i`). Inverse trig outside [−1, 1] is now "Undefined for
  real numbers — arcsin is only defined on [−1, 1]", status *undefined*.
- **`∫₀¹ 1/x dx` said "could not compute exactly (the antiderivative may have
  no elementary form)".** The antiderivative is ln|x|; the integral
  *diverges*. When F is unbounded at an endpoint where the integrand blows
  up, the answer is now "Diverges — the integral has no finite value
  (unbounded at x = 0)", with the improper-integral reasoning. Convergent
  endpoint singularities are computed: `∫₀¹ 1/√x dx = 2`,
  `∫₀⁴ 1/√(4−x) dx = 4` — Simpson's rule now uses a mesh graded toward a
  singular endpoint (x = a + (b−a)t³), which is what lets the exact FTC value
  pass the numeric cross-check there.
- **`1/sin(x)`'s domain line said "x ≠ 0"** while the asymptote line listed
  ±π, ±2π, …: the domain only knew the poles the grid hit exactly. Asymptote
  points now join the exclusion list, and isolated points read as one sorted
  list — "x ≠ −9.4248, −6.2832, −3.1416, 0, 3.1416, 6.2832, 9.4248" — rather
  than a chain of "and x ≠".
- **`∫(x+1)/(x²+2x) dx` was refused.** The denominator candidate was tried,
  but Algebrite normalised the ratio to `1/(2x²+4x)` in which `x²+2x` no
  longer appears literally for `subst`. For a denominator candidate D with
  numerator N the classic case is checked directly — N/D′ free of x ⇒
  k·ln|D| — giving `½·ln|x²+2x|`, `⅓·ln|x³+1|`, `ln|x³+2x|`.

## [1.20.1] - 2026-08-16

The last four (Low) items from the second black-box pass. With this
release every finding from both passes is closed.

### Fixed

- **Double-angle identities are recognised.** `2·sin(x)·cos(x)` was "already
  in simplest terms"; Algebrite's simplify knows the Pythagorean identity
  but not the double-angle family. A small table of canonical forms
  (`sin(2x)`, `cos(2x)`, `tan(2x)`, `sin²x`, `cos²x`, `sec²x`, `csc²x`, …) is
  now tried and the shortest one that is *numerically equal* to the input is
  used, with the identity named in the step. `cos²x − sin²x`,
  `1 − 2sin²x`, `2cos²x − 1` → `cos(2x)`; `1 + tan²x` → `sec²x`. Nothing is
  claimed where no shorter equal form exists (`sin x + cos x` stays).
- **Partial-fraction logs display in textbook form.** `∫1/(x²−1) dx` showed
  `½·ln|−1/(−x−1) + x/(−x−1)|`; the argument of every `log(…)` is now
  rationalized and, since it sits under `|…|` where a sign flip is exact,
  shown with the fewest minus signs: `½·ln|(x−1)/(x+1)|`,
  `¼·ln|(x−2)/(x+2)|`. Display only; every candidate is checked numerically
  equal in absolute value before it replaces the original.
- `7 mod 3` failed ("Undefined symbol mod3") because the parser strips every
  space, fusing the word operator; the numeric infix form is rewritten to
  `mod(a, b)` first. `12 choose 3` is recognised alongside `C(12,3)`/`12C3`.

## [1.20.0] - 2026-08-16

Fixes from a second black-box pass (117 fresh problems against v1.19.0):
its four High findings, both Mediums, and two small ones. All four Highs
were pre-existing — fresh inputs reached them, today's changes did not
introduce them — and three share one root cause.

### Fixed

- **A value that is merely small is not a root.** `e^x = 0` answered
  "x = −9 or x = −8.5 or … −7" (e⁻⁹ ≈ 1e⁻⁴ passed a loose |f| < 1e⁻³
  test), and `e^(−x²)` under Functions listed "x-intercepts at x = −10,
  −9.95, −9.9, …" — a fabricated feature. In both the algebra scan and the
  functions intercept-finder, a candidate that does not come from a sign
  change must now be a genuine touch root: |f| tiny *and* a local minimum
  of |f| (a decaying tail keeps getting smaller, so it never is). The
  back-substitution gate is 1e⁻⁶, not 1e⁻³. `e^x = 0`, `e^(−x) = 0`,
  `1/x = 0` → "No real solution"; `e^(−x²)` → "no x-intercepts";
  `|x − 1| = 0` still finds 1.
- **A root between two poles was stepped over.** `1/x + 1/(x+1) = 1`
  returned only x = 1.618; the second root, −0.618, sits between the poles
  at −1 and 0, and the 0.5-step scan saw only ∞ on one side of it. A gap
  that contains an undefined point is now re-scanned finely, and ±∞ is
  treated as undefined rather than as a huge finite value.
- **`tan(x)` claimed "domain: all real numbers" with no asymptotes.** No
  0.05 grid point lands on π/2 + kπ (irrational), so every sample was
  finite and nothing was ever undefined. Poles the grid steps over are now
  found from their signature — a sign change between adjacent samples with
  |f| large on both sides — and located by bisecting 1/f. tan, sec, cot,
  csc and off-grid rational poles like 1/(3x−1) all report their
  asymptotes, deduplicated across the symbolic and numeric sources, and the
  domain reads "all real numbers except x = …".
- **`∫_{−1}^{1} |x| dx` was refused** ("could not compute exactly"): the
  definite path only asked Algebrite's `defint`, which has no `abs`. When
  that fails it now falls back to the same per-term antiderivative machinery
  the indefinite path uses (abs, substitution, by parts) and applies the
  FTC itself, still cross-checked against Simpson and still preferring an
  exact symbolic value when Algebrite can form one from F —
  `∫₀¹ x·cos(x²) dx = ½·sin(1) (≈ 0.4207)`.
- **Denominators are substitution candidates.** `∫(2x+3)/(x²+3x+5) dx` and
  `∫eˣ/(1+eˣ) dx` were refused; u = the denominator gives `ln|x²+3x+5|`
  and `ln|1+eˣ|`.
- **No imaginary unit in a real integral.** `∫e^(x²) dx` returned
  `−½·i·√π·erf(i·x) + C` marked Solved — right via erfi, wrong to show. It
  is now refused as non-elementary ("involves the imaginary error function
  erfi"), and any complex-valued antiderivative is refused the same way.
- `x² = 0` answered "x = 0 or x = 0"; a repeated root is stated once, with
  its multiplicity.
- `.map(formatNumber)` passed the array index as the decimals argument, so a
  list of asymptotes printed as "−8, −4.7, −1.57, 1.571, …". Every value now
  prints at the same precision.
- An exact-zero sample was treated as a sign change against both
  neighbours, so `x³` reported "x-intercepts at x = −0.0001, 0, 0.0001".
- `sqrt(9−x²)`'s domain reads "−3 ≤ x ≤ 3", not "x ≥ −3 and x ≤ 3".
- `ln|…|` display now handles a nested log argument: `ln|1 + exp(x)|`,
  `ln|ln(x)|`.

## [1.19.0] - 2026-08-16

The presentation sweep — every remaining item from the QA report on v1.13.0.
With this release all 20 findings are closed.

### Changed

- **Exact-first numbers.** Rational arithmetic shows the fraction with the
  decimal alongside — `1/3 + 1/6 → 1/2 (= 0.5)`, `0.1 + 0.2 → 3/10 (= 0.3)`;
  constant expressions in e and π keep their exact form — `e^2 ≈ 7.3891`,
  `π/4 ≈ 0.7854`, `2π ≈ 6.2832` (only when the expression is built from
  e, π, digits and operators — `sin(π/6)` still gives its own value, `0.5`);
  integers and irrationals are unchanged. Trigonometry shows the special
  value first — `sin(π/4) → √2/2 (≈ 0.7071)`, `tan(π/3) → √3 (≈ 1.7321)` —
  and an inverse-trig result that lands on a multiple of π says so:
  `arcsin(1/2) → π/6 (≈ 0.5236)`, `arctan(−1) → −π/4 (≈ −0.7854)`.
- **Function analysis has a real "Final Answer".** It summarised nothing —
  it echoed the input. It now states the findings in reading order, only
  those actually established: `f(x) = x² − 4x + 3: domain: all real numbers;
  y-intercept (0, 3); x-intercepts at x = 1, 3; vertex (2, −1) (minimum), axis
  x = 2.` Cusps, endpoint extrema, holes, asymptotes and inflections all
  appear when present.
- **The integration fallback distinguishes two different claims.** "No
  elementary closed form, or beyond this engine" bundled a theorem with a
  shrug. Non-elementarity is now asserted only for the integrands in the
  known list (Fresnel, erf, Si); everything else says "MasterMath could not
  solve this integral symbolically" and that this is a limitation of the
  solver, not a statement about the mathematics.
- The Solver page no longer says "Enter *any* precalculus or calculus
  problem" — it now reads "Choose a topic and enter a supported math problem
  — from arithmetic and algebra through precalculus and calculus".
- The homepage's export line no longer claims CSV for individual solutions:
  solutions export as PDF, Markdown or JSON; the whole history as CSV too.

### Added

- **Percent notation.** `50% of 80 → 40` and a bare `25% → 1/4 (= 0.25)`, with
  a step explaining "per hundred". This is notation, not natural language —
  the app still does not parse sentences, and says so in its placeholders.

### Fixed

- The Progress page showed authoritative-looking `0` totals while history
  was still loading. The three stat cards now show `—` (with `aria-busy`)
  until the local history has loaded.

## [1.18.0] - 2026-08-16

QA report item 5 — the last finding with real mathematical depth — plus a
guard bug found on the way.

### Added

- **u-substitution.** `x·cos(x²)` was refused as "no elementary closed form,
  or beyond this engine". Algebrite's integrator has no substitution step; the
  solver now supplies one (`substitutionSolver.js`): candidate inner
  functions are the arguments of function calls, the calls themselves
  (`sin(x)`, `ln(x)`), power bases and `e^(…)` exponents; for each, the
  integrand is divided by g′(x) and rewritten in u, and if x has vanished it
  is integrated in u, back-substituted, and **verified by differentiation**
  before anything is reported. The steps read the way it is taught — choose
  u, compute du, rewrite, integrate in u, substitute back, check. Now solved:
  `x·cos(x²) → ½sin(x²)`, `x·sin(x²) → −½cos(x²)`, `2x·e^(x²) → e^(x²)`,
  `sin²x·cos x → ⅓sin³x`, `cos x / sin x → ln(sin x)`, `ln(x)/x → ½ln²x`,
  `1/(x·ln x) → ln(ln x)`. Products are tried as substitutions before
  integration by parts, so `2x·e^(x²)` no longer takes a by-parts detour
  through `erf(ix)`.
- **∫|ax + b| dx.** Algebrite has no `abs`, so `∫|x| dx` was refused. Now
  `∫|x| dx = x·|x|/2 + C` (and `|ax+b|` with constant multiples), with the
  piecewise reasoning in the steps and an exact fractional coefficient — a
  float here made Algebrite's simplification of a mixed sum go floating-point
  (`x^2.0`). Verified numerically; a non-linear `|…|` is not claimed.

### Fixed

- **Algebrite failure text was accepted as a result.** Algebrite reports some
  failures by *returning* text rather than throwing — `Unsupported function
  abs`, `Stop: integral: sorry, could not find a solution` — and the wrappers'
  guard only knew `stop|error|nil`, so "Unsupported function abs" was taken
  as an antiderivative and then rejected downstream in confusing ways. One
  shared `isAlgebriteFailure` now backs every solver's Algebrite wrapper.
- The integral trust gate handles results Algebrite can differentiate only
  partly (an unevaluated `d(abs(x),x)` inside the derivative) by falling
  through to a numeric derivative check instead of failing closed; and
  Algebrite's `sgn` is aliased to mathjs's `sign` so its derivatives of
  abs-bearing results can be checked numerically.

## [1.17.0] - 2026-08-16

QA report items 3, 4, 8, 9 and 10: domain bookkeeping and the extrema logic
— the findings that gave mathematically wrong or incomplete analyses.

### Fixed

- **Identities keep their domain.** `1/(x-1) = 1/(x-1)` returned "All real
  numbers", including x = 1 where the original equation is undefined. The
  restrictions are now read off the *original* sides before anything is
  simplified: "All real numbers with x ≠ 1 (identity on its domain)", with a
  step that names where the equation is undefined and why the simplified
  0 = 0 doesn't get to reinstate it. Works for poles, radicands and logs —
  `sqrt(x-2) = sqrt(x-2)` gives x ≥ 2, `ln(x) = ln(x)` gives x > 0 — and a
  plain identity like `2x+3 = 2x+3` still reads "All real numbers".
- **Identities on restricted domains no longer report grid points as
  solutions.** `sqrt(x-2) = sqrt(x-2)` used to answer "x = 2 or x = 2.5 or
  x = 3 …": the constant-difference probe needed five defined samples and
  most of its fixed probe points sat where sqrt is undefined, so the identity
  went unrecognised and the numeric scan called every point a root. The
  probe now sweeps densely before giving up.
- **Cusps are named as cusps.** `abs(x)`'s minimum at (0, 0) was attributed
  to f′(x) = 0; the derivative does not exist there. Each extremum now
  records how it arises — stationary (f′ = 0) or corner/cusp (one-sided
  slopes disagree) — and the step says explicitly that a cusp minimum is a
  critical point but *not* a stationary point.
- **Domain endpoints are extrema too.** `sqrt(x-2)` said "No local extrema",
  missing (2, 0). Finite domain edges where f is defined are now checked and
  reported in their own words — "Absolute minimum at the domain endpoint
  (2, 0): … this is where the graph begins — and since f is increasing from
  there, no other value is lower" — rather than folded into the local-extrema
  list, since they are not two-sided local extrema. "Absolute" is claimed only
  when f is monotonic on its domain; `sqrt(4-x²)` gets its stationary maximum
  at (0, 2) plus endpoint minima at ±2 with no absolute claim.
- **`ln(x)`'s domain wording is right.** "undefined for x < 0" omitted 0. Each
  undefined region now knows whether its edge is itself undefined, so ln(x)
  reads "undefined for x ≤ 0 — so the domain is x > 0" while sqrt(x-2), which
  is defined at 2, reads "undefined for x < 2 — so the domain is x ≥ 2".
- **Removable discontinuities are explained and drawn.** `(x²-1)/(x-1)` said
  only "undefined for x = 1". It now reports "Hole (removable discontinuity)
  at (1, 2) … Simplifying, f(x) = x + 1 for every x ≠ 1: a common factor
  cancels, but the original is still undefined at x = 1", distinguishes it
  from an asymptote (both one-sided limits exist and agree), draws a hollow
  marker labelled "hole" on the graph, and includes it in the graph's text
  description.

### Changed

- The domain/undefined-region finder is now shared (`findUndefinedRegions`
  and `formatRestriction` in `solverUtils.js`) between the algebra and
  functions solvers, so both describe restrictions the same way.

## [1.16.1] - 2026-08-16

QA report items 6 and 7: the two findings that silently produced wrong
"Solved" answers for inputs students actually type.

### Fixed

- **`asin`, `acos`, `atan` behave exactly like `arcsin`, `arccos`, `arctan`.**
  Algebrite only knows the long names, so the short aliases came back as the
  unevaluated operator — `f'(x) = d(asin(x),x)`, marked Solved. The aliases
  are now normalised once, in `parseMathExpression`, upstream of every
  solver, which fixes derivatives, integrals, functions and trig alike (the
  report only tested derivatives; integrals and functions had the same gap).
  `sin^-1(x)`, `sin^(-1)(x)` and `sin⁻¹(x)` normalise too; `asinh` and `x^-1`
  are left alone.
- **An unevaluated derivative or integral is never reported as solved.**
  When Algebrite cannot differentiate or integrate something it does not
  throw — it hands the operator back: `d(f, x)`, `integral(f, x)`. Both
  solvers now detect that (`isUnevaluatedOperator` in `solverUtils.js`) and
  return an honest *unsupported* envelope. This mattered for integrals in
  particular: the existing derivative trust gate did not catch it, because
  `d(integral(f,x),x)` simplifies straight back to `f` and passes.
- **Unknown function names no longer hijack the variable.** `erf(x)`
  differentiated as `f'(f) = 0` — the variable extractor took the "f" of
  "erf" as the variable. Multi-letter names directly before "(" are now
  excluded as candidates (single letters stay: `x(x+1)` is implicit
  multiplication). `erf(x)` now gives `2e^(−x²)/√π`; a function neither
  engine knows is refused, not "solved" with respect to one of its letters.

## [1.16.0] - 2026-08-16

The first fixes from the external QA report on v1.13.0 (98 problems, seven
topics): its one critical finding, plus the capability that finding was
missing.

### Fixed

- **`sin(x) = 1/2` under Trigonometry displayed minified JavaScript as the
  final answer — under a green "Solved" badge, and saved to history as a
  solved problem.** An equation skipped the simplifier and reached
  `math.evaluate`, which reads `sin(x) = 1/2` as a *definition* of a function
  named `sin` and hands back the function object; stringifying it produced
  the source of mathjs's `typed-function` wrapper. Two fixes, both needed:
  - Equations are routed to the new trig-equation solver before anything can
    reach the evaluator (below).
  - `finalizeResult` in `api.js` — the gate every solver's output already
    passes through — now refuses any answer or step that is not presentable
    text: a function, object or array, or a string shaped like source code
    (`function name(...) {`, an arrow with a body, `[object Object]`,
    `[native code]`). Such a result is replaced with an honest *unsupported*
    envelope and never marked solved. The pattern is deliberately
    code-specific, so prose such as "return to the original variable" or "the
    arguments of the trig functions" is never mistaken for a leak. Verified
    across all seven topics: zero false refusals.

### Added

- **Trigonometric equations.** `A·f(kx) + B = C` for f ∈ {sin, cos, tan}
  — `sin(x) = 1/2`, `2cos(x) − 1 = 0`, `tan(2x) = 1`, `√3 = 2sin(x)`,
  `tan(x/2) = √3` — with the trig term isolated first, the reference angle
  given exactly for special values (π/6, 2π/3, √3/2 …), the full general
  solution (`x = π/6 + 2πn or x = 5π/6 + 2πn`, `x = πn`, `x = π/2 + πn`),
  the solutions on [0, 2π) with the kx argument divided (or multiplied)
  through, and a graph of the curve against `y = c` with those solutions
  marked. Every listed solution is substituted back into the original
  equation before it is reported. `sin(x) = 2` is "no real solution", not an
  error. Out-of-family equations — `sin²(x) = 1/4`, `sin(x) = cos(x)`,
  `sin(x²) = 0` — are refused with an explicit "not supported yet", never
  mis-solved.
- The same equations typed under **Algebra** get the same exact treatment
  (previously five decimal roots from a numeric scan); out-of-family
  equations still fall through to the numeric scan.
- `sin(x) = 1/2` joins the Trigonometry examples and placeholder.

## [1.15.0] - 2026-08-16

### Added

- **The whole app is available offline after one visit.** The service
  worker now precaches every hashed asset the build produced — all route
  chunks, the lazily loaded solver modules, mathjs / Algebrite / Recharts /
  jsPDF, both stylesheets, and the KaTeX fonts — at install time. Before,
  assets were cached only when first fetched, so a route you had not opened
  while online (the routes are code-split) had nothing to load from and hit
  the error boundary. Verified with the server stopped: the Solver, never
  opened online in that session, rendered and solved a derivative and a
  definite integral, with typeset maths and a graph, entirely from cache.
  - The manifest is generated at build time by `stampServiceWorker` in
    `vite.config.js` (the filenames carry content hashes) — 50 assets,
    ~3.7 MB raw, ~1 MB over the wire, fetched once in the background.
  - Unchanged assets are **reused from the previous worker's cache** rather
    than re-downloaded, so a release that doesn't touch mathjs doesn't cost
    every user 1 MB again. Verified by deleting the mathjs chunk from the
    server and installing a new worker: the new cache still held the real
    script, copied across.
  - Precaching is best-effort: assets are fetched individually and a miss
    never fails the install; the fetch handler still caches anything absent
    the first time it is requested online.

### Fixed

- Cache lookups ignore the `Vary` header. Some servers send `Vary: Origin`
  on static files, and Vite's module preloads carry an `Origin` header while
  the worker's precache fetches do not, so a strict match refused entries the
  precache had just stored and an offline route load returned 503 with the
  file sitting in the cache. Everything cached is content-addressed or the
  single app shell, so the same bytes are correct for every requester.
  (Netlify does not currently send `Vary` on assets; this hardens against a
  hosting change and matched what was observed under `vite preview`.)

## [1.14.1] - 2026-08-16

### Fixed

- **Blank page for returning visitors after a deploy.** Two service-worker
  defects compounded. (1) Navigations were served cache-first from an
  `index.html` frozen at the worker's install time — the "background
  revalidation" wrote its fresh copy under the request URL, never under the
  `/index.html` key that navigations read — so a worker that activated after
  a later deploy served a shell pointing at hashed chunks that no longer
  existed. (2) Netlify's SPA rewrite answers any unknown path with
  `index.html` and a **200**, so a request for a vanished chunk came back as
  HTML; the browser refuses to run HTML as a module script (blank page, no
  console error), and `fetchAndCache` — which trusted any 200 — stored that
  HTML under the `.js` URL, poisoning the entry for the life of the worker.
  Three deploys in quick succession on 2026-08-16 widened the window and
  surfaced it.

  Now: navigations are **network-first** (the shell is a few KB and is the
  one file that must agree with the server), with the cached copy used only
  when offline; a response whose body type doesn't match its filename
  (HTML for `.js`/`.css`) is never cached and, for scripts and stylesheets,
  is reported to open tabs as a stale shell, which reload **once** (guarded
  via `sessionStorage`) to pick up the current version; and the worker
  re-fetches `/index.html` on activation, so a worker installed before a
  deploy does not carry a dead shell into service. Verified end to end
  against a local SPA-fallback server: a deploy under a live worker with a
  populated cache now renders the new build on a plain reload, HTML-for-JS
  is refused by the cache and triggers exactly one recovery reload, and the
  offline shell fallback still works.

  Users already stuck on the blank page: a hard reload (⌘⇧R) loads the
  current version, and the update banner then installs this worker.

## [1.14.0] - 2026-08-16

Third accessibility pass. The graph gets a text alternative — a new
capability, hence the minor bump — and the last structural gaps from the
audit are closed: menu semantics, notification timing, and the heading
outline.

### Added

- **The graph can be read, not just seen.** `src/lib/graphDescription.js`
  turns the same annotation data the chart is drawn from into prose: the
  chart wrapper is exposed as one `role="img"` named by a summary ("Graph
  of f(x) = x² − 4x + 3. Line chart with 3 key features marked: Local
  minimum at (2, −1). Crosses the x-axis at x = 1 and x = 3. Crosses the
  y-axis at y = 3."), and a collapsible **Key features** panel beneath the
  chart lists the same points for everyone. It covers extrema, intercepts,
  asymptotes, equation solutions, the limit guideline and marker, the
  definite-integral region, the system intersection point, inequality
  intervals, and the secondary curve. It describes only what the solver
  annotated — it never infers features from the sampled points, since a
  fabricated feature is worse than none. Eleven unit tests pin the wording.
- The graph's icon-only controls carry `aria-label`s (previously `title`
  only) and are grouped as "Graph view controls".

### Fixed

- **The export menus are real menus.** The dropdown had no roles at all;
  the items were reachable only because they happened to be buttons. Now
  the WAI-ARIA menu-button pattern: `aria-haspopup="menu"` /
  `aria-expanded` / `aria-controls` on the trigger, `role="menu"` with a
  name on the popup, `role="menuitem"` on items, focus moves into the menu
  on open (ArrowDown/Enter/Space → first item, ArrowUp → last), arrow keys
  rove and wrap, Home/End jump, Escape closes and returns focus to the
  trigger, and Tab closes on the way out. Items are `tabIndex=-1`, so the
  menu is one tab stop.
- **Notifications can be read in time (WCAG 2.2.1).** Every toast used to
  vanish after 3 seconds with no way to hold it. Errors and warnings now
  persist until dismissed — they carry something the reader must act on —
  and are announced assertively (`role="alert"`). Success and info still
  auto-dismiss, but at 6 seconds, and the countdown pauses while the toast
  is hovered or focused, resuming from where it left off.
- **One h1 per page, no skipped levels.** The header and sidebar brand text
  were `h1`/`h2` on every page, on top of each page's own `h1`; they are
  now plain text (they are home links, not headings). `CardTitle` defaults
  to `h2` — a card sits directly under the page title — and takes `as="h3"`
  on Home, where the cards live under `h2` sections. The FAQ questions
  jumped `h1 → h3` and the "Why Choose MasterMath?" points jumped
  `h2 → h4`; both are corrected. Verified: exactly one `h1` and zero level
  skips on all nine routes.

## [1.13.3] - 2026-08-16

Second accessibility pass, covering perceivability: contrast, motion
sensitivity, and focus visibility. Follows the operability fixes in 1.13.2.

### Fixed

- Text contrast now meets WCAG AA everywhere. The problem-input placeholder
  was 2.54:1 against white — and it is where the input-format examples live,
  so the readers who most need the hint could least read it. Now 4.83:1. The
  step-through counter ("Step 3 of 7") was 2.54:1 in light and 3.04:1 in
  dark; now 4.83:1 and 5.78:1. The graph placeholder had no dark-mode colour
  at all, leaving it at 3.04:1 on the dark card; now 5.78:1. The Feedback
  email field, which relied on the browser's default placeholder colour, now
  matches the rest of the app. Verified across seven routes in both themes:
  zero remaining AA text failures.
- The focus ring is visible again. `Button` asked for `ring-ring` and
  `ring-offset-background` — shadcn tokens this project never defined in its
  Tailwind config, so they compiled to nothing and every button silently fell
  back to Tailwind's default translucent blue, all but invisible on the blue
  and indigo gradient buttons. Replaced with explicit indigo ring colours and
  a theme-aware offset.

### Added

- `prefers-reduced-motion: reduce` is honoured (WCAG 2.3.3). Sidebar slides,
  hover fades and the update banner's bounce collapse to instant state
  changes. The busy spinner is deliberately exempt — it is the only signal
  that work is in progress — but slows to 1.5s so it does not draw the eye.
  Framer Motion sits outside CSS control, so the solution card and its step
  reveals opt out through `useReducedMotion` in `SolutionDisplay`, which is
  the only component that uses it; handling it there rather than app-wide
  keeps Framer Motion inside the lazy solver chunk.
- `forced-colors: active` support for the gradient headings. They paint
  their colour into the text's own fill and set the text transparent, which
  made them vanish outright in Windows High Contrast Mode; they now fall
  back to a plain system-coloured heading.

## [1.13.2] - 2026-08-16

Accessibility pass over the app shell and shared controls. Seven defects
that made the app unusable — or in places silent — for keyboard and screen
reader users.

### Fixed

- **Math is no longer silent to screen readers.** `MathText` rendered KaTeX
  with `output: "html"`, which emits only the visual span that KaTeX itself
  marks `aria-hidden`. Every expression in every step and final answer was
  announced as nothing. Restored to KaTeX's default `htmlAndMathml`, so the
  MathML copy carries the content.
- **The topic picker is keyboard-operable.** Options were `<div>`s with a
  click handler — not focusable, no roles — so the required topic could not
  be chosen without a mouse. Rebuilt on the ARIA combobox/listbox pattern:
  `role="combobox"` with `aria-expanded`/`aria-haspopup`/`aria-controls`,
  `role="option"` with `aria-selected`, arrow keys, Home/End, Enter/Space to
  choose, and Escape to dismiss, tracked via `aria-activedescendant`.
- **Form labels point at real elements.** The `<label for>` on the Solver
  topic select and both Feedback selects referenced ids that existed nowhere
  in the DOM. `Select` now accepts an `id` for its trigger, and the trigger
  is named via `aria-labelledby`.
- **The sidebar toggle has an accessible name** — previously a bare button
  wrapping an SVG, announced only as "button". Now labelled, with
  `aria-expanded` and `aria-controls`.
- **A collapsed sidebar leaves the tab order.** It was hidden with `w-0
  overflow-hidden`, which hides nothing from assistive tech, so keyboard
  users tabbed through seven invisible links before reaching the page. Now
  marked `inert` (plus `aria-hidden`) when closed.
- **The skip link works.** Its off-screen position was an inline style, which
  outranks any stylesheet rule, so the `:focus` rule could never bring it
  back on screen — it had never been visible. Both states now live in
  `index.css`, and `<main>` takes `tabIndex={-1}` so activating it moves
  focus rather than just scrolling.
- **The confirm dialog is a real dialog.** No role, no name, no focus
  management — Tab walked straight behind the backdrop, and this is the
  gate on "clear all history". Now `role="dialog"` + `aria-modal` with
  `aria-labelledby`/`aria-describedby`, initial focus on Cancel, a Tab trap,
  Escape to cancel, and focus restored to whatever opened it.

## [1.13.1] - 2026-08-15

### Changed

- Initial page load is ~10× smaller: 81 KB of JavaScript (gzipped) instead of
  860 KB. Every visitor — including one who only opened the landing page or a
  policy page — used to download mathjs, Algebrite, Recharts and jsPDF
  (~2.4 MB raw) before anything rendered.
  - Routes are split with `React.lazy`, so a page's code is fetched when it is
    opened. `Home` stays eager, since deferring the landing page would only
    add a round trip.
  - The graph panel loads Recharts the first time a solution actually has a
    graph to draw, rather than on every visit to the solver.
  - jsPDF is imported on demand inside the PDF export functions, so only users
    who choose "Export as PDF" pay for it. CSV, JSON and Markdown exports are
    unaffected.
  - `manualChunks` now names every module the entry chunk shares — React,
    Vite's preload helper, Rollup's CommonJS interop shims and the small
    styling/icon helpers. Previously these were folded into whichever chunk
    Rollup found convenient (React ended up inside `charts`, the preload
    helper inside `pdf`), which forced the entry chunk to statically import
    those bundles and made Vite preload them from `index.html`.
- History exports tell the truth about outcomes, matching the solution card.
  History holds every outcome except parse errors, so it contains results the
  solver could not solve; the CSV, Markdown and PDF exports presented all of
  them as answers.
  - The CSV gains a `Status` column, and the Markdown and PDF exports label
    any entry that was not solved and head its text "Result" rather than
    "Solution".
  - "Total Problems Solved: N" becomes "Total Problems: N", with a
    "(solved: M)" breakdown whenever the two differ.

### Security

- Exported CSVs no longer let a saved problem be run as a spreadsheet formula.
  Cells beginning with `=`, `+`, `-`, `@`, tab or carriage return are prefixed
  with an apostrophe so the spreadsheet treats them as literal text. A maths
  app produces such cells routinely — "-3*x + 6 = 0" is a formula to Excel —
  and problems are free text, so they can also be crafted deliberately. Every
  field is now quoted as well, so a locale whose date format contains a comma
  cannot shift the columns.

### Fixed

- `validateMathInput` no longer rejects legitimate mathematics. Its
  "dangerous content" patterns blocked nothing reachable — React escapes what
  it renders, KaTeX runs with `trust: false` over solver output, and the
  exports are plain text — but the event-handler pattern `/on\w+\s*=/i`
  matched the "on" inside "constant", so "constant = 5" was refused as
  "Invalid input detected" with no explanation.
- The solver is now given the same string that was validated. `ProblemInput`
  sanitized the input, validated the sanitized copy, then solved the raw text,
  so the two could differ. Sanitizing no longer strips `<...>` spans either:
  that pass deleted everything between a `<` and a later `>`, quietly turning
  "x < 5 and x > 1" into "x  1".
- Exporting a solution now describes the solution on screen. The export used
  the live contents of the problem box and topic picker, so editing either
  after solving produced a file whose problem statement did not match its
  answer.
- The storage helpers in `api.js` no longer discard the reason a call failed.
  A validation failure is reported as itself ("Invalid topic selected")
  instead of being flattened into "Failed to save problem. Please try again.",
  and genuine storage failures still show that generic message but now carry
  the original error as `cause`.

- A failure to save a solved problem to history is no longer reported as a
  failed solve. Storage can fail for reasons unrelated to the mathematics
  (quota exceeded, private browsing, an evicted database); the solution stays
  on screen and the message now says the history save failed, instead of the
  misleading "Failed to solve problem. Please try again."
- Toasts raised in the same millisecond no longer collide. Ids came from
  `Date.now()`, so two simultaneous notifications shared a React key and
  dismissed each other.
## [1.13.0] - 2026-07-21

Phase 1 of the mathematical state semantics architecture
(`docs/future-work/MATH-STATE-SEMANTICS.md`): every solver result now
carries a typed status, and the UI tells the truth about outcomes.

### Added

- Solution envelope (`src/lib/solutionEnvelope.js`): every result carries a
  `status` — `solved`, `parse_error`, `unsupported`, `undefined`,
  `indeterminate`, or `overflow` — enforced by the result gate in `api.js`.
- Status badge on the solution card, with status-matched styling: green is
  reserved for real solves, amber for honest non-answers (unsupported /
  undefined / indeterminate / overflow), red for unreadable input with a
  "What went wrong" card.
- Non-elementary integrals are now told the truth: ∫sin(x²)dx reports the
  Fresnel S function instead of blaming the input's formatting; e^(−x²)
  reports erf. Failure messages never suggest a formatting fix when the
  input parsed correctly.
- Parse guards in the Functions and Limits solvers: unreadable input fails
  loudly instead of being sampled into a fabricated analysis ("f(x)=x^^2"
  echoed as a success; a false "one-sided limits disagree" claim).
- Contract test suite (`tests/envelope.test.js`) turning the July 2026
  black-box review's failure cases (D7, I5, I7, T10, F7, M1, M2) into
  permanent regressions.

### Changed

- The success toast fires only for actual solves; parse errors toast red,
  engine limitations toast amber ("Problem solved successfully!" no longer
  appears on failures — the worst-scored finding in the July 2026 review).
- Failed parses are no longer saved to problem history, and history entries
  record the real outcome instead of a hardcoded "Solved successfully".
- Solver failure messages carry the specific cause (from the math engine)
  instead of five generic syntax tips; systems/inequalities/definite-
  integral refusals state their reason as the answer.
- Exports label non-solved results with their status; a failed solve's PDF
  no longer reads like an answer.

### Added
- **Integration by parts walkthrough** — `∫x·cos(x) dx`, `∫x³·sin(x) dx`,
  `∫eˣ·sin(x) dx`, `∫ln(x) dx`, `∫arctan(x) dx` and friends now show the full
  derivation: the LIATE choice of u and dv, du and v, and the
  `∫u dv = uv − ∫v du` line for each round
- **Repeated by-parts now computes** — `x³·sin(x)` (which Algebrite fails
  outright) recurses through three rounds to a direct base case
- **Cyclic by-parts now computes** — `eˣ·sin(x)` / `eˣ·cos(x)` are solved
  algebraically: the walkthrough shows the original integral reappearing and
  moves it to the left to solve for it
- **Per-term walkthroughs** — a by-parts term inside a sum
  (`x³·sin(x) + x²`) gets its own labelled walkthrough
- Steps render through KaTeX where possible, plain text otherwise

### Changed
- Indefinite integrals are now computed term by term, so a single hard term
  no longer sinks the whole integral. Every antiderivative is differentiated
  back and checked against the integrand before it is shown; anything that
  fails falls back to Algebrite or an honest "unable to compute"

### Fixed
- Numeric evaluation now understands `arcsin`/`arccos`/`arctan` (aliased to
  mathjs's `asin`/`acos`/`atan`), so graphs and verification of inverse-trig
  expressions no longer silently fail

## [1.11.0] - 2026-07-12

### Added
- **Inequalities** — solve linear, polynomial, and rational inequalities with
  `<`, `>`, `≤`, `≥` by the sign-chart method: `x^2 - 4 > 0` → `x < -2 or
  x > 2`, `2x + 3 < 7` → `x < 2`, `(x-1)/(x+2) >= 0` → `x < -2 or x ≥ 1`.
  Worked steps show moving to one side, finding the critical points, and the
  sign on each interval; the answer is given in both inequality and interval
  notation
- **Correct endpoints** — a root is closed for `≤`/`≥` and open for `<`/`>`,
  and a denominator zero (pole) is always excluded. All-real-numbers,
  no-solution, and single-point (`x^2 ≤ 0` → `x = 0`) cases are named
  correctly
- **Sign-chart graph** — plots the expression with its zeros marked, breaks
  drawn as dashed lines, and the solution ranges shaded (new graph annotation
  `shadedRegions`)
- Compound inequalities (`a < x < b`) are refused clearly for now

### Changed
- Algebra input containing a comparison operator is routed to the inequality
  solver from the raw text; equations, systems, factoring, and simplification
  are unaffected

## [1.10.0] - 2026-07-12

### Added
- **Systems of equations** — solve a 2×2 linear system like
  `2x + 3y = 6; x − y = 4` and get exact fractions (`x = 18/5, y = −2/5`),
  not decimals. Worked steps show the substitution; the solution is checked
  by substituting back into both equations before it is reported. Accepts
  semicolon-, comma-, newline-, or "and"-separated equations, any two
  variable names, and "solve the system …" phrasing
- **The three system outcomes** are named correctly: a unique solution, *no
  solution* (parallel lines), or *infinitely many* (the two equations are the
  same line) — the classic elimination pitfall of reading "0 = 0" as "no
  solution" is handled
- **Intersection graph** — both lines are plotted with the solution point
  marked where they cross (new graph annotation `intersection`)
- Non-linear systems, three-variable systems, and anything that isn't a clean
  2×2 linear system are refused clearly instead of mis-solved

### Changed
- Algebra input with two or more equations is routed to the new systems
  solver from the raw text (before single-expression extraction); single
  equations, factoring, and simplification are unaffected

## [1.9.1] - 2026-07-12

Presentation polish — the three cosmetic nits noted in the July 2026
production audit. Each fix keeps the correctness discipline (the exact form
is numerically re-checked before it is shown).

### Changed
- **Exact-fraction limits** — removable limits now report the exact value
  (`lim x→0 (sin x − x)/x³ = −1/6`, `(1−cos x)/x² = 1/2`) instead of a rounded
  decimal (`−0.1667`, `0.5`). Clean integers stay integers; the fraction is
  confirmed to match the verified numeric value before it is displayed, and
  renders as a proper KaTeX fraction
- **Oscillation wording** — a limit that fails because the function oscillates
  (`sin(1/x)`, `cos(1/x)`) now says so explicitly, rather than blaming
  "one-sided limits disagree." A genuine jump (`|x|/x`) still reads
  "the one-sided limits disagree" — the two DNE reasons are no longer conflated

### Fixed
- **Simplification never grows the expression** — `(x²−9)/(x+3)` now
  simplifies to `x−3` (via Algebrite) instead of mathsteps' longer split form
  `x²/(x+3) − 9/(x+3)`. The solver gathers candidate simplifications from
  mathsteps, Algebrite, and math.js, verifies each is equivalent, and picks
  the shortest — so a result is never longer than what was typed; genuinely
  simple inputs are left alone

## [1.9.0] - 2026-07-12

### Added
- **Definite integrals** — `∫_0^1 x^2 dx`, `∫_0^pi sin(x) dx`, and
  "x^2 from 0 to 3" now evaluate to an exact value (`1/3`, `2`, `9`) via the
  Fundamental Theorem of Calculus. The steps show the antiderivative F, its
  values at each bound, and the subtraction F(b) − F(a). Previously these
  refused clearly ("not supported yet"); this replaces the honest refusal
  with a real capability
- **Improper-integral guard** — an integral across a discontinuity
  (`∫_{-1}^{1} 1/x dx`) is detected and refused instead of reporting
  Algebrite's meaningless complex value. Every definite result is
  independently confirmed by Simpson's-rule quadrature before it is shown;
  the two methods must agree or the solver refuses
- **Shaded-area graphs** — a definite integral graphs the integrand with the
  interval [a, b] shaded and its bounds marked, since the integral *is* that
  signed area
- KaTeX now typesets definite integrals with their bounds (`\int_{a}^{b}`)

### Changed
- The integrals solver now receives the raw problem text (like limits do) so
  it can read bounds before notation is normalized; indefinite integrals are
  unaffected

## [1.8.1] - 2026-07-12

Fixes every defect from the July 2026 production audit of v1.8.0
(`docs/evaluations/2026-07/PRODUCTION-AUDIT-v1.8.md`). All three confident-
wrong answers lived in one place — the algebra solver's numeric fallback,
the last path without a verification gate.

### Fixed
- **Radical equations** — `sqrt(x) = 5` answers x = 25 instead of five scan
  artifacts near −100. The scanner treats non-real values (√ of a negative)
  as out-of-domain instead of feeding NaN sign comparisons, and every
  candidate root must survive back-substitution before it is reported
- **Identities** — `2(x+3) = 2x+6` answers "All real numbers" instead of
  five arbitrary grid points
- **Contradictions** — `5x−7 = 5x+2` states "No solution (the two sides are
  never equal)" confidently instead of hedging about the searched range
- **Absolute-value bars** — `|x−3| = 5` now parses (`|…|` → `abs(…)`) and
  solves: x = −2 or x = 8 (was "No real solution found")
- **Quartic roots** — `x⁴ − 16 = 0` displays x = ±2, ±2i instead of raw
  `(−1)^(1/4)` principal-root notation (each root verified by
  back-substitution)
- Periodic fallback equations (`sin(x) = 0`) show the five roots nearest
  zero, not the five nearest −100

### Added
- `tests/corpus/additions.csv` — post-evaluation acceptance rows (the audit
  failures plus a never-invent-roots guard), loaded by the corpus harness
  alongside the original 91-row evaluation (97 rows, 100%, zero
  confident-wrong)

## [1.8.0] - 2026-07-12

### Added
- **Tutor mode (step-through)** — a "Show all / Step through" toggle on the
  step-by-step solution. In step-through mode steps are revealed one at a
  time via a "Reveal next step" button (with a "Reveal all" shortcut and a
  "Step X of N" counter), and a prompt invites the student to predict the
  next move before revealing it. The final answer, key insights, and common
  mistakes stay hidden until every step has been revealed, so it teaches
  rather than lets you copy the answer. Defaults to "Show all"; the toggle
  only appears for multi-step solutions.

## [1.7.0] - 2026-07-12

The Wave 1 "quality tail" from the July 2026 evaluation (items B2–B5 in
`docs/evaluations/2026-07/ANALYSIS.md`) — the last four known partial
behaviours. The evaluation corpus now scores 88 correct + 3 clear refusals
of 91, with zero confident-wrong answers.

### Added
- **One-sided limits** — `lim x→0+ 1/x`, `x->0^-`, and "as x approaches 0
  from the right" all evaluate the requested side (∞ here) instead of
  silently answering the two-sided limit. Handles domain boundaries
  (`lim x→0⁻ √x` does not exist), slow divergence (`lim x→0⁺ ln(x) = −∞`),
  and marks the side on the graph guideline (`x → 0⁺`)
- **Factoring** — "factor x² − 9" now factors: `(x − 3)(x + 3)`, with
  difference-of-squares narration and a check-by-expanding step. Results are
  verified numerically before being shown; irreducible inputs say so honestly
- **Exact radicals** — `sqrt(50)` answers `5√2 (≈ 7.0711)` with the
  perfect-square walkthrough instead of a bare decimal; radical sums combine
  exactly (`√8 + √2 = 3√2`)
- **Symbolic trig identities** — `sin(x)² + cos(x)² = 1` (was "Unable to
  evaluate"); simplifications are verified numerically before being claimed,
  and expressions with no simpler form say so instead of guessing

### Changed
- One-sided limit markers typeset as proper superscripts in KaTeX (`0⁺`)

## [1.6.0] - 2026-07-08

### Added
- **KaTeX math rendering** — solution steps and final answers now display
  typeset math (real fractions, exponents, integral and root signs) instead
  of ASCII like `x^2`. Fully offline (KaTeX is bundled); any fragment KaTeX
  can't render falls back to plain text
- **Graph annotations** — graphs now mark what the solution talks about:
  extrema dots labeled max/min, x- and y-intercept dots, dashed vertical
  asymptote lines, and for limits a guideline at the approach point with a
  hollow marker at (a, L)
- **Graph height controls** — make the chart taller or shorter (5 sizes)
- **Four-way panning** — pan up/down as well as left/right; panning is
  clamped to a reasonable extent (the solvers now sample x ∈ ±40, and the
  vertical window can't wander more than one screen past the data)
- Limit graphs open centered on the approach point

### Changed
- Sample cap raised so polynomial growth isn't dropped from the pannable
  range (only true blow-ups are excluded); Reset restores view and height

### Fixed
- Graph height changes apply instantly (removed a transition that could
  leave the chart stuck at its old size)

## [1.5.0] - 2026-07-08

### Added
- **Quadratic insights** — parabolas now report the axis of symmetry
  (x = −b/2a), opening direction from the leading coefficient, and the exact
  vertex
- Function analysis now reports domain restrictions, y-intercept, inflection
  points, and horizontal asymptotes

### Changed
- **Functions/Graphing rebuilt from scratch** (scored 2/10 in the July 2026
  evaluation). Features are now computed, never guessed:
  - extrema from solving f′(x) = 0 (exact via Algebrite, verified numeric
    fallback) — no more fabricated "vertices" for monotonic functions like eˣ
  - x-intercepts from real root-finding with |f(root)| ≈ 0 verification — no
    more invented intercepts near the window edge for 1/(x−2)
  - vertical asymptotes detected and reported (denominator roots + divergence
    check), including slow log-type divergence
  - domain boundaries found by bisection (sqrt(x−3) reports "undefined for
    x < 3" and its (3, 0) starting point)
  - honest fallbacks: "no local extrema" / "none found" instead of made-up
    features; no global monotonicity claims across a broken domain
- All 10 Functions rows of the evaluation corpus now pass — the full 91-row
  corpus grades 100% with zero confidently-wrong answers and zero skips

### Fixed
- ln(x) graphing/analysis works (previously every numeric evaluation failed)

## [1.4.0] - 2026-07-08

### Added
- **Regression harness over the 91-problem evaluation corpus**
  (`tests/corpus/`) — re-runs every eval input through the real pipeline and
  grades by math-equivalence (not string match), so no fixed bug returns
  silently. Wired into `npm test`; it fails if any answer is confidently wrong.
- Combinatorics: `C(n,k)`/`nCr` and `P(n,k)`/`nPr` notation now evaluate
  (e.g. `C(5,2)` = 10).
- Clear refusals for not-yet-supported input instead of confident wrong
  answers: definite integrals (`∫_a^b`) and systems of equations now explain
  they aren't supported rather than returning a garbage number.

### Fixed
- **Wave 1 of the July 2026 evaluation** — zero confidently-wrong answers
  remain on the graded corpus:
  - `d/dx arctan(x)` now returns `1/(x^2+1)` (was `0`; inverse-trig names were
    missing from the variable detector, so it differentiated w.r.t. "a").
  - `7!` evaluates to `5040` (the trailing `!` was being stripped as sentence
    punctuation).
  - `lim x→0 |x|/x` correctly reports "does not exist" (was `0`; the symbolic
    limit ladder now discards any rung whose numeric cross-check fails).
  - `∫1/x dx` displays `ln|x| + C` (was `log(x) + C`).
  - `ln(x)` is now evaluable everywhere (graphs, sampling) via a mathjs `ln`
    alias — mathjs only knew `log`.

## [1.3.1] - 2026-07-08

### Fixed
- **Limits no longer return confidently wrong answers on 0/0 forms** —
  numeric-only sampling suffered floating-point cancellation (e.g.
  (1−cos x)/x² returned 0 instead of 0.5, (sin x − x)/x³ returned 0 instead
  of −1/6). Finite limits now climb a symbolic ladder — direct substitution,
  simplify-and-resubstitute, Taylor-series ratio, L'Hôpital — with numeric
  sampling as the last resort, and answers are independently cross-checked
  (verified flag with the method named)
- sec/csc/cot now differentiate and integrate — Algebrite has no reciprocal
  trig functions, so d/dx sec(x) previously returned the unevaluated literal
  "d(sec(x),x)" and ∫sec²x failed; they are rewritten to sin/cos forms first
- Cubic equations like x³ = 8 now return clean roots (x = 2 plus the complex
  pair) instead of principal-complex-root notation like −2·(−1)^(1/3)

### Added
- Regression test suite (tests/regressions.test.js) pinning every bug above
  with its original wrong output, plus a numeric-invariant test for the
  limit substitution guard (55 tests total)

## [1.3.0] - 2026-07-07

### Added
- **Settings page** (`/settings`) — Appearance (theme), Solver Preferences,
  Data & Privacy (export all / clear history), and About sections
- **Solver preferences that change solving behavior**
  - Angle unit: auto-detect / degrees / radians for trig inputs like sin(30),
    with explanatory steps and a cross-check note for the other unit
  - Decimal places (2–6) for all numeric results
- **Worked, term-by-term solution steps** — derivatives and integrals now show
  the real intermediate result for each term with the rule that produced it,
  instead of generic rule reminders
- Exact algebra fallback via Algebrite roots — quadratics like x^2 = 2 return
  exact radicals (and complex roots like x = ±i) instead of stopping early
- Limits at infinity and honest indeterminate-form (0/0) handling
- Build-time service worker stamping so the in-app update banner fires on
  every release

### Changed
- **Rebrand to match the logo** — indigo replaces purple throughout; primary
  action buttons (Solve, Start Solving) are now orange with a Calculator icon
- Solution steps restyled as a clean divided list (no boxed backgrounds)
- Sidebar menu slimmed (legal pages moved to footer/Settings) and now
  auto-collapses after selecting a page
- Home hero tiles are unboxed, and lay out icon-beside-text on mobile
- Dark mode overhauled across every page and base component (inputs, selects,
  toasts, dialogs), with WCAG-contrast fixes in both themes

### Fixed
- tan(π/2) and other vertical-asymptote trig values now return "Undefined"
  with an explanation instead of a floating-point artifact
- Service worker no longer force-reloads the page mid-session when an update
  is detected — updates apply when the user clicks the banner

## [1.1.0] - 2025-01-05

### Added
- **New Homepage/Landing Page**
  - Hero section with welcome message and prominent CTAs
  - Feature showcase grid highlighting 6 core features
  - "How It Works" section with 3-step process
  - "Why Choose MasterMath?" benefits section with checkmarks
  - Final CTA section encouraging users to start solving
  - Fully responsive design with dark mode support
  - Home navigation link added to sidebar (first position)

- **SEO Optimization**
  - Comprehensive meta tags in index.html (title, description, keywords, author)
  - Open Graph tags for Facebook/LinkedIn social sharing
  - Twitter Card meta tags for Twitter previews
  - Canonical URL and theme color configuration
  - Schema.org JSON-LD structured data for Google rich snippets
  - Dynamic page-specific titles using custom `usePageTitle` hook
  - Sitemap.xml for search engine crawling
  - Robots.txt for crawler instructions

- **Developer Experience**
  - Custom `usePageTitle` hook for SEO-friendly page titles
  - Completely rewrote CLAUDE.md with accurate, comprehensive documentation
  - Documented all 7 pages, IndexedDB implementation, math solvers, and architecture

### Changed
- **Sidebar UX Improvement**
  - Sidebar now starts collapsed by default for better first impression
  - Updated `SidebarProvider` to accept `defaultOpen` prop
  - Improved mobile and desktop user experience

- **Branding Consistency**
  - Updated all references from "MasterMath" to "MasterMath"
  - Updated UserManual.jsx, PrivacyPolicy.jsx with consistent branding
  - Updated Layout.jsx header and footer

- **Page Titles** (SEO-optimized)
  - Home: "Master Math with Confidence - Free Math Solver"
  - Solver: "Solver - Step-by-Step Math Solutions"
  - Progress: "My Progress - Track Your Learning Journey"
  - User Manual: "User Manual - How to Use MasterMath"
  - Privacy Policy: "Privacy Policy - Your Privacy Matters"
  - Terms of Service: "Terms of Service - Usage Guidelines"
  - Feedback: "Feedback & Support - We'd Love to Hear From You"

### Fixed
- Feedback form for user reports and suggestions
- Enhanced documentation for open source release
- Improved Terms of Service with comprehensive accuracy disclaimers

## [1.0.0] - 2025-10-05

### Added
- **Core Math Solver Engine**
  - Derivatives and differentiation with step-by-step explanations
  - Integrals and integration with detailed processes
  - Limits calculations with mathematical reasoning
  - Algebra solver for equations and simplification
  - Trigonometry function solutions
  - Functions and graphing capabilities
  - Arithmetic operations support

- **Educational Features**
  - Step-by-step solution breakdowns
  - Educational tips and learning guidance
  - Common mistakes warnings
  - Mathematical concept explanations

- **User Interface**
  - Clean, modern React-based interface
  - Dark/light mode toggle
  - Responsive design for all devices
  - Intuitive problem input system
  - Topic selection for targeted solving

- **Privacy & Security**
  - 100% client-side processing
  - No data transmission to servers
  - Local storage for problem history
  - No user accounts required
  - Privacy-focused architecture

- **Visualization**
  - Interactive graph generation
  - Function plotting and analysis
  - Mathematical visualization tools
  - Recharts integration for data display

- **Progress Tracking**
  - Local problem history storage
  - Progress monitoring and analytics
  - Export functionality for solutions
  - Learning journey tracking

- **Accessibility**
  - ARIA labels and semantic HTML
  - Keyboard navigation support
  - Screen reader compatibility
  - High contrast mode support

### Technical Implementation
- **Frontend**: React 18.3.1 with Vite build system
- **Math Libraries**: Algebrite, MathJS, mathsteps integration
- **Styling**: Tailwind CSS with custom components
- **Icons**: Lucide React icon library
- **Charts**: Recharts for data visualization
- **Animation**: Framer Motion for smooth interactions

### Documentation
- Comprehensive user manual
- Privacy policy and terms of service
- Mathematical accuracy disclaimers
- Educational usage guidelines

---

## Version History Notes

### Development Approach
This project was developed using AI-assisted programming techniques, demonstrating modern collaborative development between human vision and AI implementation. The core educational philosophy and user experience design remained human-driven, while AI assistance accelerated implementation and feature development.

### Educational Mission
MasterMath was created to serve as a learning companion that promotes understanding over quick answers. The tool emphasizes the importance of verifying solutions independently and using the application as a supplement to traditional learning methods.

### Open Source Release
Version 1.0.0 marks the initial open source release of MasterMath, making this educational tool freely available to students, educators, and developers worldwide.

---

## Future Roadmap

### Planned Features
- Additional mathematical topics (differential equations, linear algebra)
- Enhanced graph customization options
- Collaborative features for educators
- Multiple language support
- Improved mobile experience
- Advanced export formats (PDF, LaTeX)

### Educational Enhancements
- Interactive tutorials and guided learning paths
- Adaptive difficulty based on user progress
- Integration with common curricula standards
- Enhanced explanations for different learning styles

### Technical Improvements
- Performance optimizations
- Extended browser compatibility
- Offline progressive web app capabilities
- Enhanced accessibility features

---

*For the complete history of changes, see the [GitHub releases page](https://github.com/sparkinCreations/MasterMath/releases).*
