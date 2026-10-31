# October 2026 Outside Reviews — Claim Log

**Versions covered:** 1.36.3 → 1.48.0 (October 20–21, 2026)
**By:** sparkinCreations™
**Rule applied:** every claim reproduced on the build before being accepted; the same class of input swept for more.

Six review rounds arrived over the two days. Each table lists the claim, what
reproduction showed, and where the fix landed. "Worse" means reproduction
found more than the reviewer reported. Open items are in
[`../../future-work/ROADMAP-2026-10.md`](../../future-work/ROADMAP-2026-10.md).

## Round 1 (against v1.36.3)

| Claim | Verdict | Release |
|---|---|---|
| d/dx |x| answered as if smooth | Confirmed | 1.41.0 (`solveAbsLinear`, corner reported) |
| Thin steps for sin², x²+1=0, √(x+2)=x | Confirmed | 1.41.0 |
| Graph re-sampling, zoom, polygonal curves, dual curves, tangent | Confirmed | 1.41.0 (viewer re-samples `graph.expression`) |
| Derivative domains, cos wording | Confirmed | 1.41.0 |

## Round 2 (against v1.40.5)

| Claim | Verdict | Release |
|---|---|---|
| Cubics jump to the answer | Confirmed | 1.41.0 (Rational Root Theorem + synthetic division shown) |
| eˣ graph unreadable | Confirmed | 1.41.0 (`growthWindow`) |
| Graph below the fold on a phone; header scrolls away; no drag; tooltip cut off | Confirmed | 1.41.0 (sticky header, drag-to-pan, short tooltip labels), 1.41.1 (reveal lands on the graph) |
| "Not AI" repeated | Confirmed | 1.41.0 (one mention) |
| Manual/FAQ missing features | Confirmed | 1.41.0 |
| Landing example and audience line | Confirmed | 1.41.0, 1.41.1 |

## Round 3 (against v1.42.0)

| Claim | Verdict | Release |
|---|---|---|
| sin(x²)·eˣ graph: jumbled y-axis, range blows up | Confirmed | 1.43.0 (`tameWindow`) |
| Graph below the fold on desktop | Confirmed | 1.44.0 (graph heads the results column) |
| Two derivative steps plain text | Confirmed | 1.43.0 (clause-level typesetting) |
| Cubic tips generic | Confirmed | 1.43.0 |
| Functions mixes window and domain | **Worse**: also called sin(x²)·eˣ periodic | 1.43.0 (`structuralPeriod`, `definedEverywhere`) |
| ln(sin x) not simplified to cot x | **Worse**: labelled "Trig rule", no chain working | 1.43.0 |
| tan identity ignores undefined points | **Worse**: opening step contradicted itself | 1.43.0 (`trigUndefinedPoints`) |
| LaTeX error drops a space | Confirmed | 1.43.0 (dedicated message) |
| /nope shows the home page | By design then | 1.44.0 (404 page) |
| Feedback box resize handle gone on phone | Not a bug (iOS never shows one) | — |
| Typing "si" only | Reviewer's setup | — |
| Footer links tiny | 14 px, 20 px targets | 1.43.0 (24 px), 1.44.0 (44 px) |

## Round 4 (against v1.43.0)

| Claim | Verdict | Release |
|---|---|---|
| Graph below the fold on desktop | Confirmed | 1.44.0 |
| Footer links 24 px | Confirmed | 1.44.0 (44 px on phones) |
| ∫√(1−x²) shows (−x²+1)^(1/2), one step plain | **Worse**: labelled u-substitution, no working | 1.44.0 (trigonometric substitution; roots as roots) |
| /nope | Confirmed | 1.44.0 |
| Uneven y-axis ticks | Confirmed | 1.44.0 (`niceTicks`) |
| Indigo curve dim in dark mode | Confirmed; title also black (1.2:1) | 1.44.0 |
| Tooltip near the right edge | Not reproduced (no sample under the pointer there) | — |

Owner-reported after this round: graph controls and the menu arrow black
in dark mode (1.44.1); "Graph View" title black on the empty card
(1.45.1); the live preview mangled `lim x->0` (1.45.1).

## Round 5 (against v1.46.0)

| Claim | Verdict | Release |
|---|---|---|
| Empty form, disabled Solve, no explanation | Confirmed | 1.47.0 (topic pre-selected, reason shown) |
| Examples below the fold on desktop | Partly (visible at 900 px) | 1.47.0 |
| Old results stay after an error | Confirmed | 1.47.0 |
| Topic dropdown stuck open | Not reproduced with a mouse | 1.47.0 (closes on an outside tap anyway) |
| Wrong topic gives "no simpler form" | Confirmed (the one routing gap) | 1.47.0 (bare-expression nudge) |
| Some steps plain text; cos italic | Confirmed | open (P1 markers) |
| Graph before the steps | Rejected: answer-first contradicts step-through | — |
| Toasts stack over the toggle | Rejected as a nitpick | — |
| Three-icon box looks like a placeholder | Rejected | — |
| "Solved locally" jargon | Kept | — |
| Small, low-contrast grey text | Rejected (passes AA, 7:1) | — |
| Narrow column on wide screens | Rejected (deliberate) | — |
| Header a quarter of the phone screen | Not reproduced (11%) | — |
| Casual users won't guess `lim x->0` | Confirmed | 1.47.0 (hint), 1.47.1 (Notation guide dialog) |

## Round 6 (against v1.47.1, two rounds)

| Claim | Verdict | Release |
|---|---|---|
| y'' + y = 0 "solved" as 0 | Confirmed, the worst kind | 1.48.0 (refused) |
| x² + y² = 25 solved for x under Derivatives | Confirmed | open (P1 implicit differentiation) |
| ∫1/(x²−1) jumps to a table formula | Confirmed | 1.48.0 (partial fractions first) |
| (1 + 1/x)^x found by sampling | Confirmed | open (P2) |
| "determinantof is not a known function" | Confirmed | 1.48.0 |
| Old red error message stays | Confirmed (error toasts persist by design) | 1.48.0 (cleared by the next solve) |
| ∫(2x+1) dx = x(x+1) + C | Confirmed | 1.48.0 |
| log(x)/log(2) shown | Confirmed (first step) | 1.48.0 |
| Tips generic | Partly | open (P3) |
| ~20 tabs to the input box | Not reproduced (7; 2 via skip link) | — |
| ↑ repeats each problem; ↓ broken | Confirmed (caret guard); ↓ worked | 1.48.0 |
| Symbol buttons ~29 px | Not reproduced (44 CSS px) | — |
| "Reveal all" small; Show all / Step through 32 px | Confirmed | 1.48.0 (44 px) |
| Header and toast on phones | Rejected (see round 5) | — |
| Eleven example cards on a phone | Confirmed | 1.48.0 (four, then "Show all") |
| Footer "\|" orphaned | Confirmed at 640–700 px | 1.48.0 |
| Mixed formatting (u = x^3) | Confirmed | open (P1 markers) |
| PDF plain text, no graph | Confirmed | open (P2) |
| Policy dates differ | Not a bug | — |

## Round 7 (against v1.50.0, release readiness)

| Claim | Verdict | Release |
|---|---|---|
| Old result stays after the input or topic changes | Confirmed | 1.49.1 (cleared) |
| Progress and the exports count history differently | Confirmed | 1.49.1 ("M of N in history" in both) |
| Real-phone check needed | Agreed; not testable here (no WebKit) | open |

## Round 8 (against v1.52.0, Lighthouse page speed)

| Claim | Verdict | Release |
|---|---|---|
| Solver page loads ~345 kB JS, mostly mathjs and KaTeX | Confirmed, different cause: mathjs loaded twice — the worker's (deliberate pre-warm) and the page's own, pulled in by importing history helpers from api.js | 1.52.1 (problemHistory.js; 595 → 390 kB) |
| Favicon is 119 kB | Confirmed — and it was also the logo on every page | 1.52.1 (logo-192, favicon-32, apple-touch-icon) |
| max-age=0, returning visitors re-download everything | Header confirmed; re-download not (service worker serves /assets cache-first) | 1.52.1 (/assets immutable) |
| Solver CLS 0.176 | Confirmed exactly; cause was the footer below a short route placeholder | 1.52.1 (CLS 0) |
| CLS explains the home page flashing | Not reproduced (home CLS 0) | — |

## Round 9 (against v1.52.1, power notation)

| Claim | Verdict | Release |
|---|---|---|
| "x squared", "x cubed", "to the power of" fail | Confirmed — 7 of 56 everyday phrasings solved | 1.52.2 (plainEnglish.js: 56 of 56) |
| x**3 fails | Confirmed, worse: Algebrite's raw error shown; x**2 − 4 = 0 called "beyond this solver" | 1.52.2 |
| x² button inserts ^2 | Not a bug (^2 is the notation; the preview shows x²) | — |
| Warn in the preview before Solve | Partly: the preview now shows how the words were read | 1.52.2 |
| Found in the sweep: an unknown word read as a constant on the integral, limit and inequality paths, answered and marked Solved | — | 1.52.2 (refused on every path) |
| Owner: numbers written as words | — | 1.52.2 |

## Round 10 (against v1.52.2, owner: topic routing)

| Claim | Verdict | Release |
|---|---|---|
| A topic switch should be visible | Agreed | 1.52.3 ("Solved as …" notice + switch button) |
| "x^2 + 3x" under Limits says it could not be read | Confirmed | 1.52.3 |
| Found: sin(30) under Arithmetic ignored the angle setting (−0.988); sin(30°) a syntax error | — | 1.52.3 (to Trigonometry) |
| With radians, sin(30) = −0.99 beside the tip "sin(30°) = 1/2" | Confirmed | 1.52.3 (the tip explains) |

## Round 11 (against v1.52.3, 8.5/10)

| Claim | Verdict | Release |
|---|---|---|
| Starts on Integrals | Not reproduced: a new visitor starts on Algebra; the last topic used is remembered | — |
| x^2-5x+6 typed under Integrals is integrated | By design (no intent of its own: the chosen topic decides) | — |
| "factor …" under another topic fails | Confirmed (parse error) | 1.52.4 (verbs go to Algebra, or Trigonometry with a trig function) |
| x^2-5x+6 under Algebra comes back unchanged | Confirmed | 1.52.4 (with its factored form) |
| "32x − 8x + C" unsimplified | Confirmed, general: like terms never combined in an antiderivative | 1.52.4 |
| 1/0 says "Beyond this solver" | Confirmed, worse: wrong answers marked Solved under Functions and Limits | 1.52.4 (undefined on every topic) |
| Progress 15, export 19 | Not a bug: both read "15 of 19 in history" | — |
| Privacy Policy omits saved settings | Confirmed | 1.52.4 |
| Owner: text black in dark mode while solving | Confirmed: the Cancel button (no `outline` variant) | 1.52.4 |
| Found: brackets after ∫ dropped in the preview and steps | — | 1.52.4 |
| Found before shipping: "simplify tan(x)·cos(x)" under Trigonometry sent to Algebra, unchanged | — | 1.52.4 (verb + trig → Trigonometry) |

## Round 12 (the accuracy test list, written against v1.47.1, reproduced on 1.53.1)

95 cases with SymPy-checked expected values: [`test-cases.json`](test-cases.json),
results as written in [`test-list-v1.47.1.md`](test-list-v1.47.1.md). Every
case now runs in `tests/octoberTestList.test.js`.

| Claim | Verdict | Release |
|---|---|---|
| The list's failures on v1.47.1 (ODEs answered, matrices, x² + y² = 25 solved for x, partial-fraction and 1^∞ steps, log display, …) | Already fixed: 88 of 95 correct on 1.53.1 | 1.48.0 – 1.53.1 |
| #6 f''(x) + f(x) = 0 answered "f''(f) = 0" | Confirmed, **worse**: "f'(x) where f(x) = x^3" answered "x^3"; "f'(x)" answered "f'(f) = 1" | 1.53.2 |
| #12 y'(x) = 3x^2 refused with "one equation cannot fix 2 unknowns" | Confirmed | 1.53.2 (a differential equation; the tip names ∫ 3x^2 dx) |
| #19 x² + 1 = 0 tips mention (x − 2)(x − 3) | Confirmed | 1.53.2 (tips by method) |
| #20 \|2x − 1\| < 5 tips mention numerators | Confirmed | 1.53.2 |
| #49 e^(2x) = 7 as ln(√7) | Confirmed, **worse**: e^(3x) = 5 and e^(2x + 1) = 7 numeric only | 1.53.2 (isolate, then log) |
| #67 arcsin′ as 1/((-x^2 + 1)^(1/2)) | Confirmed, **worse**: its step named the power rule, as did sec, cot, sinh, arctan | 1.53.2 |
| #86–88 "lim … = Does not exist" | Wording | 1.53.2 |
| #21 tips and error banners carry over | Not reproduced (checked in the browser) | — |
| Found in the sweep: "d/dx f(x)", "∫ f(x) dx", "lim x->0 f(x)" answered as if f were a number | — | 1.53.2 (refused) |
| Found in the sweep: "g(x) = 2x + 1" solved for g; "f(x) = x^2" under Integrals unchanged | — | 1.53.2 |
| Found in the sweep: numeric roots written with = | — | 1.53.2 (≈) |

## Round 13 (outside review, 8.5/10, reproduced on 1.53.2)

| Claim | Verdict | Release |
|---|---|---|
| sqrt(50) only 7.0711, not 5√2 | Confirmed | 1.54.0 (simplest radical form, step shown) |
| log(8) treated as the natural log (2.0794) | Partly: the answer was base 10 (0.9031), but the steps showed "(log(8)/log(10))" and "log(8) = 2.0794"; log(8,2) by decimal ratios | 1.54.0 (worked in the notation typed, exact when it is) |
| Key Insights generic for logs, roots, (x²−1)/(x−1) | Confirmed for logs and the fraction; the root tips fit | 1.54.0 |
| Word problems: "itsspeed is not a known function" | Confirmed | 1.54.0 ("Word problems are not supported") |
| My Progress repeats a problem per solve | Confirmed (and the count with it) | 1.54.0 (one entry, "Solved N times") |
| PDF lacks the graph, spells ∞ "infinity" | Partly: the solution PDF is typeset with its graph; the My Progress PDF was plain text | 1.54.0 (typeset) |
| Light/dark switch takes about a second | Confirmed, **worse** and not rendering: the "Problem solved!" toast covered the theme button for six seconds | 1.54.0 (toasts below the header) |
| Steps on the narrow phone layout (not checked by the reviewer) | Checked at 360 px: nothing wider than the screen | — |
| Found in the sweep: "area under the curve …" refused with glued words | — | 1.54.0 (the definite integral) |
| Found in the sweep: request phrases glued to the maths — "simplify the expression (x^2-1)/(x-1)" answered "theexpression(x^2 - 1)/(x - 1)", Solved; "calculate the definite integral of x^2 from 0 to 3" refused as improper; "solve the quadratic equation …", "find the critical points of …" unreadable | — | 1.54.0 (read as what they ask; words still unreadable are said to be words) |

## Round 14 (outside review, 4.5/5, about 35 problems checked by hand, reproduced on 1.55.0)

| Claim | Verdict | Release |
|---|---|---|
| Every answer checked by hand correct (x² = −4, x² + 1 > 0, by parts, limits at infinity, trig in both units) | Confirmed | — |
| "int x^2 dx" refused: "int is not a known function" | Confirmed, slightly worse: under Auto-detect it read "intx" | 1.55.1 (int is ∫, with bounds and brackets too) |
| Found in the sweep: "integral of x^2 with respect to x" answered f′(x) = 0, Solved (any "with respect to" went to derivatives) | — | 1.55.1 (the dx of an integral) |
| Found in the sweep: "integral x^2 dx" answered ∫(integralx^2) dx = integralx^2·x + C, Solved | — | 1.55.1 (integral, antiderivative, derivative, deriv, diff with or without "of") |
| Found in the sweep: "integral from 0 to 1 of x^2 dx" refused; "derivative x^2" glued | — | 1.55.1 |
| Found in the sweep: ∫(x^2) shown as ∫((x^2)) dx | — | 1.55.1 |

## Round 15 (the same reviewer, about 55 problems, 4.5/5, reproduced on 1.55.1)

| Claim | Verdict | Release |
|---|---|---|
| 123456789·987654321 ends …260 (it is …269); 2^100 as 1.2676506002282294e+30 | Confirmed, wider: 2^64, −2^60, 2^53 + 1 rounded; 25! a float without ≈ | 1.55.2 (BigInt, the size alongside) |
| Found in the sweep: 2^-60, 1/3^30, 0.000001·3 answered 0, Solved | — | 1.55.2 (≈ m × 10^k); 1.55.3 (the exact fraction too) |
| Found in the sweep: the working wrote 1e+6 + 2 | — | 1.55.2 |
| (2+3i)(1−i), (1+i)^2, (3+4i)/(1−2i) "already in simplest form" | Confirmed, wider: i^3, 1/i, (1+i)/(1−i) too | 1.55.2 (worked under Arithmetic: FOIL, the conjugate, powers of i) |
| Domain step sets "for" in math italics | Confirmed: "and for" was inside one marked run | 1.55.2 (each condition marked; ln(x) no longer names x = 0 twice) |
| Markdown export titled "Functions Problem", PDF "Algebra Problem" | Confirmed: the PDF used the solved topic, Markdown and JSON the dropdown's | 1.55.2 (all three the solved topic) |
| Found in the sweep: "2 ^ 10 = 1024" typeset as 2¹0; a 31-digit number ran off a phone screen | — | 1.55.2 (exponent braced; digits grouped, breakable) |
| Series and Taylor expansions not supported | Agreed, scope: the User Manual does not claim them | Roadmap P4 |
| Not for practice drills or quizzes | Agreed, scope | Roadmap P4 (practice mode) |
| Found after 1.55.2: a complex answer ("−1 + 2i") shown as plain text; "376(≈ …)" with no space; 3i·2i shown as "6i·i = −6" | — | 1.55.3 |
| Found while building 1.56.0: x³ − 4x = 0 answered "x = 0" alone, Solved (the factor left after x^k was not solved below degree 3); repeated roots listed twice | — | 1.55.3 |
| Found while building 1.56.0: x^(1/3) = 0, x^(1/2) = 0, x^(1/3) = −2 answered "No real solution found" by a numeric search, Solved; x^(2/3) = 4 gave 8 alone; cbrt(x + 1) = −2 read as five unknowns | — | 1.55.3 (exact power equations; "no real solution" only with a reason) |

## Round 16 (the same reviewer, reproduced on 1.56.0 before release)

| Claim | Verdict | Release |
|---|---|---|
| For bad input the error is a 2-step "solution" with "Step 1 of 2" and a reveal button; step 2 is the raw parser message, repeated in the "What went wrong" box | Confirmed, worse: three times (step, box, the only tip); under Derivatives and Integrals Algebrite's "2+* ? Stop: syntax error" | 1.56.0 (errors all at once under "Notes", said once; engine messages put into words) |
| Found in the sweep (about 60 malformed inputs × 8 topics): "2+3)" integrated to 5x + C; "sin()" to sin(nil)·x + C; "2..5" differentiated to 0; "x^2 +" echoed as the answer under Trigonometry; "2 # 3" = 2; "3!!" = 6; "foo(x)" "already in simplest form"; "[1,2]" echoed; "limit of", "integral of", "derivative of" the limit/integral/derivative of a variable "of"; "50% of 80" under Integrals ∫(50%of80) do — all Solved | — | 1.56.0 (one syntax check before any solver; unknown function names; vectors refused; empty instructions) |
| Found in the sweep: e^−x, x^−2, 2^−x "beyond what this engine can compute" under Derivatives and Integrals | — | 1.56.0 (the negated exponent bracketed for Algebrite) |
| Teaching 8/10: the substitution step in systems skips the algebra; the function analysis never shows f′(x) | Confirmed: "Substitute that into equation 2 and simplify" showed nothing, and "x = (5 − 1·y) / 1"; "Local maximum at (−1, 2) (from f′(x) = 0)" with no f′; also (1, 0.3679) for (1, 1/e), and "No local extrema found in the analyzed window" for 1/(x − 2) where f′ is never 0 | 1.56.0 (isolate, substitute, clear, expand, collect, divide, back-substitute, check with the numbers; f′ shown and solved, exact values, "never 0" with the reason) |
| Found while building: x/2 + y/3 = 1; x − y = 1 answered x = 1333333/833333 (the sampled coefficient 1/3 rounded to six places) | — | 1.56.0 (coefficients read back as fractions) |

## Round 26 (second outside review of the limits content, before 1.63.0 shipped)

A second review of `LIMITS.md` ("approve with two small corrections"). Both reproduced; the sweep the reviewer asked for (domain boundaries, negative infinity, underflow) found one more wrong answer.

| Claim | Verdict | Release |
|---|---|---|
| "√(4x²) − x: the two parts grow at different rates" is imprecise: √(4x²) = 2x, the same rate with a different coefficient | Confirmed; and the solver sampled that very example | 1.63.0 (the insight now says the leading growth does not cancel, 2x − x = x → ∞; a root minus a linear term whose leading terms do not cancel is read off, √P − Q ≈ (√a ∓ q)·\|x\|) |
| lim x→−∞ x·eˣ is sampled; let t = −x, then x·eˣ = −t/eᵗ → 0, from below | Confirmed; every exponential at −∞ was sampled (eˣ, x²·eˣ, x·e^(−x)) | 1.63.0 (t = −x turns a limit at −∞ into one at +∞ for the growth methods; the last step says which side 0 is approached from; the worked line says it too) |
| Found in the sweep: lim x→−∞ ln(x) answered −∞ | Confirmed, a wrong answer: every sample was undefined, shown as "±∞", and the sign test read NaN as negative | 1.63.0 (outside the domain at ±∞ the limit does not exist, said so; undefined samples shown as "undefined") |
| Found in the sweep: x·e^(−x²) showed seven bare zeros with no underflow note | Confirmed (the note needed an earlier nonzero sample) | 1.63.0 (also noted when the function is nonzero nearer in) |
| The rest | Already right | — |

## Round 25 (outside review of the limits content, before 1.63.0 shipped)

A content review of `docs/future-work/insights-review/LIMITS.md` ("agree, with revisions"): a correct answer can rest on reasoning that does not prove it. Every claim was reproduced, and the same class swept.

| Claim | Verdict | Release |
|---|---|---|
| "0/0 means a common factor is hiding" is false in general (sin x/x is 0/0 with no factor) | Confirmed | 1.63.0 (stated for a quotient of polynomials: both have the factor (x − a); cancel it, allowed since x ≠ a near the point) |
| Do not present lim x→0 ln x as a two-sided answer; give lim x→0⁺ and say the convention depends on the course; the same for √x and x^x at 0 | Agreed. The steps said so, but the answer line read "lim (x→0)" | 1.63.0 (the answer is written lim (x→0⁺) …, and the last step says some courses accept the plain limit over the domain and others call it nonexistent; also arcsin x at 1 → x → 1⁻). A course-convention setting is not built |
| x^x at 0 is concluded from samples, though the insights hold the proof | Confirmed; sin(x)^x too | 1.63.0 ((x^a)^(c·x^p) at 0⁺ by logarithms: x^x = e^(x·ln x), x·ln x → 0 by L'Hôpital's rule, so e^0 = 1; what is still sampled says "an estimate, not a proof") |
| x·sin x at ∞ is concluded from seven samples; use x_n = π/2 + 2πn, y_n = 3π/2 + 2πn | Confirmed; the sweep found sin(1/x) at 0, sin x and cos(2x) at ∞ concluded from samples too | 1.63.0 (a two-sequence proof for c·(growing)·sin/cos(kx) at ∞ and c·sin/cos(k/x) at 0) |
| Found in the sweep: every vertical asymptote (1/x, 1/x², (x + 1)/(x − 2)) and ln(x) → −∞ at 0⁺ were concluded from samples | Confirmed | 1.63.0 (a rational function at a root of its denominator by sign analysis: near a it behaves like R/(x − a)^k, and the sign of (x − a)^k on each side decides; ln(x) → −∞ from ln increasing and ln(e^(−M)) = −M; c·x^p·ln(x)^m at 0⁺ read off when nothing pulls the other way) |
| L'Hôpital: show the chain, not only the number of rounds | Agreed | 1.63.0 (the worked line lists the bottom after each round: 3x², then 6x, then 6) |
| Conjugate at infinity: the insights switch from x² + 3x to x² + x | Agreed | 1.63.0 (the insights are general, √(x² + bx); the worked line is the student's) |
| x/2^x is sampled though the growth sections could prove it | Confirmed | 1.63.0 (b^x for whole b > 1 joins the exponential contest, with its ln(b) factors) |
| "Only an undefined result needs a technique" | Agreed | 1.63.0 ("When substitution gives a finite value by continuity, no other technique is needed; a 0/0 form or a division by 0 needs more analysis") |
| The rest (direct substitution, standard limits, conjugate at infinity, squeeze, series, growth rates, jumps, infinite limits) | Already right | — |

## Round 24 (outside review of the algebra content, before 1.62.0 shipped)

A content review of `docs/future-work/insights-review/ALGEBRA.md` ("agree, with revisions"). Every claim was reproduced, and the same class swept.

| Claim | Verdict | Release |
|---|---|---|
| The fractional-power rule is too general: reduce p/q to lowest terms and let the denominator's parity decide; teach x^(2/3) = 4 as (∛x)² = 4, ∛x = ±2, x = ±8 | Confirmed, and it was a wrong answer: x^(4/6) = 4 gave x = 8 only. The power solver found ±8, but its check (and the extraneous-root check after it, which then blamed "a denominator zero") evaluated (−8)^(4/6) as complex | 1.62.0 (exponents read in lowest terms, in `realOddRoots` for every evaluation; a step says "4/6 is 2/3 in lowest terms"; the even-power case worked through the root; the tips lead with root, domain, signs) |
| The common-factor mistakes repeat "dividing by x" | Confirmed (two wordings, so text de-duplication missed it) | 1.62.0 (the second replaced by "factoring when the equation is not set to 0") |
| \|x − 1\| = −3 is told about 1/x and logarithms | Confirmed; also eˣ = −2 and 1/(x − 1) = 0 shared one list | 1.62.0 (the no-solution lists lead with their own reason: absolute value, even root, positive exponential, a fraction's numerator) |
| Common logs are taught with natural logs | Confirmed | 1.62.0 (log(x) = c ⟺ x = 10^c; log rules in base 10) |
| Optional: x·eˣ = 1 has the exact x = W(1) | Agreed, behind Show more, and only for x·eˣ = c with c > 0 | 1.62.0 |
| Keep x = ∛2, not 1.2599 | Confirmed; the steps even said the roots "cannot be written in a closed form here" | 1.62.0 (xⁿ = c for n = 3, 4: the real root exact with ≈ beside it, the complex roots exact, each checked; x⁴ + 1 = 0 gives (±1 ± i)/√2) |
| factor x² − 9 and √72 should show their result in the insights | Agreed | 1.62.0 (factor, expand, simplify and radicals show "Here: x² − 9 = (x − 3)(x + 3)" second) |
| Found in the sweep: the extraneous-candidate step said "makes a denominator zero" for any undefined value | Confirmed | 1.62.0 ("leaves the original equation undefined (a denominator of zero, or an even root or logarithm of a negative number)") |
| The 28-equation sweep | Re-run with the power cases added (x^(2/4), x^(6/9), x^(4/3), x^(3/4), x⁴ = ±16, x⁵ = 2): all correct after the fixes | — |

## Round 23 (outside review of the integrals pilot, before 1.60.0 shipped)

A content review of `docs/future-work/insights-review/INTEGRALS.md` ("approve with revisions"). Every claim was reproduced; the fixes ship with 1.61.0, since 1.60.0 had not been pushed.

| Claim | Verdict | Release |
|---|---|---|
| Privacy: "the app sends those sites nothing" is inaccurate, since a click sends a request | Partly: the app itself sends nothing, but a click is a visit, and the site sees the IP address and browser. Said too briefly | 1.61.0 (Privacy and Terms say what a visit reveals and that no problem, solution or history is sent) |
| erf: the first insight does not state ∫e^(−x²) dx = (√π/2)·erf(x) + C; "check by differentiating" missing | Confirmed (both) | 1.61.0 (the result leads; the check closes the list) |
| ∫1/√(a² − x²) dx = arcsin(x/a) needs a > 0 | Confirmed | 1.61.0 ("for a > 0" before both formulas) |
| u-substitution: "divide by g′(x)" suggests dividing by a variable expression | Confirmed | 1.61.0 ("account for du = g′(x) dx: … up to a constant multiple") |
| tan and sec: "an odd tan power → u = sec θ" is too broad (tan³ alone has no sec to keep) | Confirmed | 1.61.0 (keep sec² for u = tan θ; keep sec·tan for u = sec θ, which needs a sec factor) |
| The second insight should work the student's integral (x³, e^(2x), cos(3x), x·cos(x²), x·eˣ, eˣ·sin x, x²·sin x, 1/(x² − 1), (2x + 3)/(x² + 1), √(1 − x²), tan²x) | Agreed. The steps already did; the insights did not | 1.61.0 ("Here: u = x², du = 2x dx, so …": the pieces the steps chose — u and du, u and dv, the 2I equation, the rounds, the partial-fraction split, the trig substitution — and the answer; for tan²x it leads) |
| Smaller qualifications: aˣ needs a > 0, a ≠ 1; n! for whole n ≥ 0; two step sizes agreeing is a check, not a proof; LIATE is a heuristic; an irreducible quadratic gives a log, an arctan or both | Confirmed (five of five) | 1.61.0 |
| Show the finite values of ∫₁^∞ 1/x² and ∫₀¹ 1/√x | Agreed | 1.61.0 ("Here the limit is finite, … = 1: an infinite interval can still have a finite area") |
| ∫₀¹ √(1 + x⁴) dx ≈ 1.0894; the p-integral criteria | Already right | — |
| The LIATE attribution to Kasube | Already checked: the DOI resolves to the article's page, title confirmed on October 29 | — |

**Second pass** (the same reviewer, on the revised document: "approve with two final corrections"):

| Claim | Verdict | Release |
|---|---|---|
| The numerical estimate says "there is no antiderivative", which is false for a continuous integrand | Confirmed: introduced by our own first-pass rewording ("gives … no antiderivative" became "there is no antiderivative") | 1.61.0 ("gives the value, not a formula"; a function continuous on an interval has an antiderivative there, possibly with no elementary formula, and this solver found none). The reviewer's wording "this integrand has no elementary antiderivative" is not used: the numerical path runs whenever this solver finds no formula, which proves nothing about the integrand |
| "A repeated factor gives a power" is too broad: its first power gives a logarithm | Confirmed | 1.61.0 ("one term per power: its first power a logarithm, the higher powers a power") |
| Optional: show ∫₀¹ x² dx = 1/3 second | Agreed | 1.61.0 ("Here F(x) = x³/3, so … = 1/3") |
| Optional: show lim ln b = ∞ for ∫₁^∞ 1/x dx | Agreed | 1.61.0 ("Here F(x) = ln\|x\|, and F(t) → ∞ as t → ∞") |
| Optional: cyclic and repeated parts should lead with their own mistake | Agreed | 1.61.0 (not recognising the returning integral; stopping after one round) |

## Round 22 (outside review of the derivatives insights, before 1.61.0 shipped)

A content review of `docs/future-work/insights-review/DERIVATIVES.md` ("approve with revisions"). Every claim was reproduced on the 1.61.0 branch; its spot-check cases are now `tests/insights.test.js`.

| Claim | Verdict | Release |
|---|---|---|
| The log-law example ln(x³(x + 1)) = 3ln x + ln(x + 1) needs a domain: the left side is also defined for x < −1 | Confirmed | 1.61.0 ("for x > 0", "on the domain where both sides are defined") |
| dy/dx = −F_x/F_y needs F_y ≠ 0 | Confirmed | 1.61.0 (says so, and what F_y = 0 means: a vertical tangent or a singular point) |
| "0 at a peak or a valley" is too absolute: x³ has f′(0) = 0 with no extremum, and a corner has no derivative | Confirmed | 1.61.0 ("where the derivative exists … 0 at a stationary point", with x³ as the example) |
| "Expanding first is rarely quicker" shown for sin(3x²), ln(x² + 1), e^(3x), where it means nothing | Confirmed | 1.61.0 (only for a power of a polynomial) |
| "The power rule holds for any real exponent" needs a domain | Confirmed | 1.61.0 ("wherever the function is differentiable (always for x > 0)") |
| d/dx aˣ = aˣ ln a "for any other base" needs a > 0 | Confirmed | 1.61.0 ("for a constant base a > 0") |
| The first three insights should show the rule applied to the student's problem | Agreed, and the most useful change | 1.61.0 (the second insight works this problem: the inside and u′ for the chain rule, u, w, u′, w′ for the product and quotient rules, the two slopes for \|ax + b\|; 2ˣ, log x, sec x, a polynomial and 1/x² lead with their own case) |
| A higher derivative and a value at a point are tasks and should lead | Agreed | 1.61.0 (the f″ insight and "stopping at f′" lead a higher derivative; "differentiate first, then substitute" leads at a point) |
| Missing mistakes: erf with an inside, the corner of \|2x − 4\|, the product rule for xy before the F_y shortcut, x > 0 for xˣ | Confirmed (four of four) | 1.61.0 |
| Deduplicate by idea, not by text | Confirmed: "forgetting the inside's derivative" could appear twice (product or exponential lead, chain secondary) | 1.61.0 (a mistake that names an idea already listed is not added again) |
| Rank by a weighted score (40/30/20/10) | Not adopted: the lists are ranked by hand per rule, and the worked example now fills the second place the score was meant to protect. The reviewer called the weights a heuristic, not a measurement | — |
| Expected (2x + 1)⁵ → 10(2x + 1)⁴ | The answer was 160x⁴ + 320x³ + 240x² + 80x + 10: equal, but the chain rule's form was lost | 1.61.0 (a power of a polynomial keeps the factored form when it is shorter and numerically the same; (3x − 1)⁴ → 12(3x − 1)³) |
| Found in the sweep ("invalid logarithm domains"): ln(x) at x = −1 answered f′(−1) = −1; log(x) at −2, √x at −4, arcsin(x) at 2 likewise gave a value | Confirmed, confidently wrong: f′ was evaluated without checking that f is defined there | 1.61.0 (f is evaluated first; not a real number → "does not exist: outside the domain of f") |
| Found in the sweep: x^(1/3) at x = −8 answered "undefined"; the real derivative is 1/12 | Confirmed (also on 1.60.0): mathjs takes the complex cube root of −8 | 1.61.0 (odd roots evaluated as real; the exact value kept as a fraction instead of Algebrite's (−1)^(1/3)) |
| Vertical tangents of the circle at (±5, 0); the corner of \|2x − 4\| at x = 2 | Already right | — |

**Second pass** (the same reviewer, on the revised document: "almost ready to ship", no wrong formula found):

| Claim | Verdict | Release |
|---|---|---|
| Outside the domain, the first mistake ("substituting before differentiating") is not the student's problem | Confirmed (also found in our own read-back) | 1.61.0 ("Applying the derivative's formula outside the domain of f" leads; the substitution warning is dropped there) |
| The second derivative's worked insight stops at f′ | Confirmed | 1.61.0 (every round shown: f′ = (x + 1)eˣ, then f″ = (x + 2)eˣ; the "stopping at f′" mistake quotes the student's own f′ and says how many rounds remain) |
| At a point, the root-rewriting insight is irrelevant; show f′(x) and then f′(a) | Confirmed | 1.61.0 ("Differentiate first, then evaluate: f′(x) = 3x², so f′(2) = 12" third) |
| For sec x, the first mistake is about cos | Confirmed | 1.61.0 ("Confusing the derivative of sec x with sec² x" leads for sec, csc, cot) |
| Optional: show the implicit slope at the point | Agreed | 1.61.0 ("dy/dx = −x/y, so at (3, 4) it is −3/4" second) |
| Optional: "each one part of the answer" for xˣ could suggest adding the two wrong rules is a general method | Partly: it is the general result, d/dx fᵍ = g·fᵍ⁻¹·f′ + fᵍ·ln f·g′, so the statement is true; but it should be said as that formula | 1.61.0 (states the formula for any f(x)^g(x), then xˣ) |
| Found in our read-back: the product rule's factoring example used e^(3x) for x²·sin x | — | 1.61.0 (the student's own factored answer, or no example) |

**Third pass** (the same reviewer):

| Claim | Verdict | Release |
|---|---|---|
| For 3x⁴ − 2x + 7, the negative- and variable-exponent mistakes come before the constant and the sign slips | Confirmed | 1.61.0 (a polynomial's own slips are second and third) |
| The second derivative repeats f″ = (x + 2)eˣ in a later insight | Confirmed: the factoring insight quoted the answer, which at order 2 is f″, not the product rule's result | 1.61.0 (the student's factored answer only at order 1) |
| The fᵍ formula assumes f(x) > 0 | Confirmed | 1.61.0 ("with f(x) > 0") |

## Round 21 (outside tester on the live site: (x² + 1)/(x⁴ + 1) hits the 10 s budget, 1.57.1)

| Claim | Verdict | Release |
|---|---|---|
| ∫(x² + 1)/(x⁴ + 1) dx "stopped after ~10 seconds" with the budget message | Confirmed on 1.56.4 (46 s in Node); on 1.57.0, deployed that morning, it solved — but Algebrite's `factor()` still ground for 2.3 s on x⁴ + 1 (4.3 s on x⁶ + 1) before the surd path answered in 24 ms, most of a phone's budget | 1.57.1 (the exact root finder factors in milliseconds; Algebrite's `factor()` only when it cannot decide; the integer-coefficient working kept, factors in the same order) |
| By parts, partial fractions (1/(x² − 1), 1/(x³ − 1)), √(1 − x²), rational-root cubics, Ei/Si refusals all correct | Confirmed | — |
| "Likely fragile": reduction formulas, repeated by parts, high-degree denominators | sec^n and csc^n were already worked in 1.57.0. Found in the sweep of 40 rational integrals: (2x + 3)/(x² + x + 1)² spent 250 s in Algebrite's `integral()` then refused; (x² + 2)/(x⁴ + 5x² + 6) 98 s then refused; 1/(x³ + x + 1) 16 s; 1/(x⁶ − 1), 1/(2x² + 2x + 1), 1/(x² + 1)³ and 1/(4x⁴ + 4x² + 1) refused | 1.57.1 (all 40 solve, none above 0.5 s; coefficients solved exactly; repeated quadratics by the reduction formula; the rational-k arctan argument fixed) |

## Round 20 (outside review: 30 Calculus II integrals, 1.57.0)

| Claim | Verdict | Release |
|---|---|---|
| 1/(x⁴ + 1) fails gracefully ("Beyond this solver"), indefinite and from 0 to ∞ | Confirmed | 1.57.0 (solved: factored over √2; ∫₀^∞ = π/(2√2)) |
| The tip "a definite version can still be computed numerically" disagrees with the refusal of the 0-to-∞ version | Confirmed, and worse: ∫₀¹ 1/(x⁴ + 1) dx — the tip's own example — was refused too ("I could not compute this definite integral exactly") | 1.57.0 (numerical estimate, two step sizes agreeing, reported "≈ … (numerical)"; first-person wording removed) |
| "Partial fractions with quadratic factors are the gap"; fixing x⁴ + 1 would also cover 1/(x⁴ + 4) | Not so: 1/(x⁴ + 4) already solved, fully worked (it factors over the rationals). The gap was factoring over a surd | 1.57.0 |
| sec³x, sin²x·cos³x, 1/(1 + eˣ), √x/(1 + x) refused | Confirmed (four of four) | 1.57.0 (reduction formula; odd-power split; u = eˣ; x = u²) |
| tan x, sin³x and 1/(x²√(x² + 9)) each had three steps that name no method | Confirmed; the last was labelled "u-substitution" with no u shown | 1.57.0 (tan derived; sin³x worked by the odd-power split; "Trigonometric substitution" with the substitution named) |
| Found in the sweep: tan²x and x³/(x − 1) refused; ∫sec x shown as ln\|tan(x/2 + π/4)\| | — | 1.57.0 |
| Second note (live site, 1.56.4): 1/(x⁴ + 1), 1/(x⁵ + 1), sec³x, tan³x refused; eˣ/x and sin x/x refused as non-elementary | 1/(x⁴ + 1), sec³x, tan³x were already in the 1.57.0 branch; 1/(x⁵ + 1) needed partial fractions over a real factorisation with surd coefficients; eˣ/x lacked its special-function note (Ei) | 1.57.0 |

## Round 19 (outside review: the contradictory notice, word problems, history on one device, 1.56.3)

| Claim | Verdict | Release |
|---|---|---|
| After "two x plus five equals eleven" the equation was solved but a notice said it looked like an expression | Confirmed: the page's nudge read the raw text and looked for "=", which "equals" is not; same for "x squared minus four equals zero" | 1.56.3 (the nudge reads the problem as the solver does) |
| Found in the sweep: "2x plus 5 > 11", "two x plus five is less than or equal to eleven", "x plus y = 2; x minus y = 0" refused ('"plus" is not a known function') | Confirmed: the infix words were read for a single expression or equation only | 1.56.3 (read before routing, on every path) |
| Found in the sweep: "2x + 5 is 11", "two x plus five is eleven", the FAQ's "a number plus 7 is 12" were parse errors ('"is" is not a known function') | Confirmed: a bare "is" was deliberately left alone for "what is …" | 1.56.3 ("is" between two sides of maths only) |
| Word problems are not translated into equations | Agreed; by design (the solver never guesses). The refusal could show the FAQ's translation examples | open |
| History stays in the current browser | Agreed; a consequence of the privacy design. A history export and import would carry it across devices without a server | open |

## Round 18 (roadmap: the e^x substitution and negative exponents, 1.56.2)

| Claim | Verdict | Release |
|---|---|---|
| Roadmap: e^x + e^(−x) = 1 is refused ("cannot show there is none") because the u = e^x substitution does not take negative exponents | Confirmed; e^x + e^(−x) = 3 and e^x − 2e^(−x) = 1 were answered by the numeric scan (≈ ±0.9624, ≈ 0.6931) where ln((3 ± √5)/2) and ln 2 are exact | 1.56.2 (a^(−kx) = 1/u^k, multiplied through by u^k since u > 0; no real solution proved from the discriminant or a complete root list) |

## Round 17 (tips, key insights and common mistakes: an audit of 338 problems, 1.56.1)

| Claim | Verdict | Release |
|---|---|---|
| Asked for: do the tips and common mistakes fit the specific problem? | 289 solved, every one with tips and mistakes; about a third had guidance that contradicted the problem, came from a different method than the steps used, or was one family's list served to every input (one PEMDAS list for 5 − 8, 17 mod 5 and the gcd; one complex-number list for a modulus, a sum and a division) | 1.56.1 (value-, method- and operation-specific lists; tests pin each to its problem) |
| Found in the audit: "math.js uses radians by default" in a tip | Confirmed, the only place a library is named | 1.56.1 |
| Found in the audit: d/dx arctan(2x) shown as 1/(2x² + 1/2) | Confirmed: Algebrite's monic-denominator form | 1.56.1 (2/(4x² + 1)) |

