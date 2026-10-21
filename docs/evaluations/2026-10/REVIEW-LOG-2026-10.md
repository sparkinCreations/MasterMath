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
