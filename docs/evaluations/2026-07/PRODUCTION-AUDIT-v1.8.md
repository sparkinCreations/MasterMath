# Production Audit — v1.8.0 (July 12, 2026)

A second external black-box evaluation, run against **production at
mastermath.app (v1.8.0)** through the real UI — topic dropdown, textarea,
Solve button — with **89 problems** across all seven topics, every answer
independently verified. It follows the mid-July 91-problem evaluation
([`ANALYSIS.md`](ANALYSIS.md)) and measures the app *after* fix Waves 1–3.

## Resolution status — ✅ all findings fixed in v1.8.1

Every reported failure was **reproduced locally, character-for-character**,
before being accepted, then fixed the same day:

| Finding | v1.8.0 behavior | Root cause (verified) | v1.8.1 |
|---|---|---|---|
| `sqrt(x) = 5` | five scan artifacts (x = −100 … −98) | mathjs returns *Complex* for √(negative); `Math.sign(Complex)` is NaN and `NaN !== NaN` is always true, so the scanner saw a phantom sign change at every step; `slice(0, 5)` served the first five grid points | **x = 25** — non-real values now count as out-of-domain; every candidate root must survive back-substitution |
| `2(x+3) = 2x+6` | same five artifacts | expression is 0 at every grid point; the near-zero push accepted them all | **All real numbers (identity)** — constant-difference detection before scanning |
| `\|x−3\| = 5` | "No real solution found" | nothing translated `\|…\|`; evaluation threw at every scan point | **x = −2 or x = 8** — the parser now rewrites `\|…\|` → `abs(…)` |
| `5x−7 = 5x+2` | right conclusion, hedged "in the searched range" wording | same missing constant detection | **"No solution (the two sides are never equal)"** — stated confidently |
| `x⁴ − 16 = 0` | correct but unreadable `(−1)^(1/4)` forms | the cubic-mangle recovery uses mathjs `polynomialRoot`, which caps at degree 3 | **x = ±2, ±2i** — symbolic roots evaluated through complex arithmetic, each verified by back-substitution |

All five (plus a `sqrt(x) = −2` never-invent-roots guard) are pinned in
`tests/regressions.test.js` and added as acceptance rows in
`tests/corpus/additions.csv`, which the corpus harness now loads alongside
the original 91-row evaluation CSV (97 rows total, 100%, zero
confident-wrong).

The audit's structural point stands and is worth remembering: **the
refuse-clearly guards cover unsupported topics, but this path slipped under
them because it *thought* it succeeded.** The numeric fallback was the last
solver path without a verification gate; as of v1.8.1 every path that can
emit an answer verifies it first.

Cosmetic nits — ✅ all three fixed in v1.9.1: removable limits now show the
exact fraction (−1/6, not −0.1667); `sin(1/x)`'s DNE is attributed to
oscillation (a jump like `|x|/x` still reads "sides disagree"); and
`(x²−9)/(x+3)` simplifies to `x−3` — the solver now picks the shortest
verified-equivalent form, so a "simplification" is never longer than the
input. Each fix preserves the correctness discipline: the exact fraction and
the simplified form are numerically re-checked before display.

---

## The audit report (as delivered)

**Tested:** production at https://mastermath.app, running v1.8.0 · 89
problems through the real UI, every answer independently verified.

### TL;DR

86 of 89 problems (96.6%) were correct or honestly refused *(includes 3
partials; 83/89 = 93.3% strictly correct-or-refused)*. All 3 failures are in
one place: the algebra equation solver's numeric fallback. The limit solver —
the historical weak spot — went 21/21 including every stress case. Calculus,
trig, functions, and arithmetic are clean. But the algebra fallback produces
confident wrong answers on radical equations, absolute-value equations, and
identities, which violates the app's own "never confidently wrong" standard.

### Accuracy by topic

| Topic | Tested | Correct | Partial | Incorrect | Refused (honest) | Accuracy |
|---|---|---|---|---|---|---|
| Derivatives | 9 | 9 | 0 | 0 | 0 | 100% |
| Integrals | 8 | 7 | 0 | 0 | 1 | 100%* |
| Limits | 21 | 21 | 0 | 0 | 0 | **100%** |
| Algebra | 16 | 10 | 3 | **3** | 0 | 62.5–81% |
| Trigonometry | 15 | 15 | 0 | 0 | 0 | 100% |
| Functions | 10 | 10 | 0 | 0 | 0 | 100% |
| Arithmetic | 10 | 9 | 0 | 0 | 1 | 100%* |
| **Total** | **89** | **81** | **3** | **3** | **2** | **91% strict / 96.6% incl. refusals** |

\* honest refusals ("Unable to compute") counted as passes per the app's own
trustworthiness standard.

### Limits — stress verdict: fixed, and genuinely good

All 21 correct, including `sin(x)/x`, `(1−cos x)/x²`, `(sin x−x)/x³`
(repeated L'Hôpital), one-sided `x→0⁺`/`x→0⁻` of `1/x` and `1/(x−1)`,
`√x` at `0⁺`, `|x|/x` (DNE, sides disagree), `sin(1/x)` (DNE), `sin(x)` at ∞
(DNE), `cos(x)/x` (DNE, opposite infinities), `1/x²` (∞), and leading-term
growth at infinity. Explanations are technique-aware (factor-and-cancel,
Taylor series, L'Hôpital, growth rates). The earlier limit reliability
issues are verifiably fixed.

### The three incorrect answers (all algebra, all the numeric fallback)

1. `sqrt(x) = 5` → five values near −100, none of which is a solution
   (correct: x = 25). The steps admit "search for values where the
   expression crosses zero" — scan artifacts reported as roots without
   substituting them back.
2. `2(x+3) = 2x+6` → the same five values. This is an identity (true for
   all real x); the identical output exposes the shared broken code path.
3. `|x−3| = 5` → "No real solution found" (correct: x = 8 or x = −2).

**Partials:** `simplify (x²−9)/(x+3)` → split-fraction form (less simplified
than the input); `x⁴−16 = 0` → all four roots correct but in unreadable
principal-root notation; `5x−7 = 5x+2` → right conclusion with hedged
searched-range wording.

### Everything else

- **Derivatives 9/9** — product, quotient, chain, nested chain, √(x²+1),
  tan → sec².
- **Integrals 7/7 + 1 honest refusal** — by parts, ∫1/x → ln|x|, arctan
  form; `x³·sin(x)` refuses rather than guessing.
- **Trig 15/15** — all asymptote cases "Undefined", exact special angles,
  degree detection, `sin²x + cos²x → 1`.
- **Functions 10/10** — no fabricated features; exact ±√3 extrema for
  `x³−3x`; `(x+1)/(x²−1)` lists x = 1 as an asymptote without mislabeling
  the hole at x = −1.
- **Arithmetic 9/9 + 1 refusal** — order of operations, `5!`, `C(5,2)`,
  float-epsilon-safe `0.1+0.2 = 0.3`; `15% of 80` refuses honestly.

### Rating: 8/10 (auditor)

"The two headline promises — 'never confidently wrong' and reliable limits —
hold everywhere except one fallback path… Fix that and this is a 9–9.5."
The fallback was fixed in v1.8.1 (see Resolution above).
