# MasterMath v1.12.0 — black-box solver review

Tested: July 21, 2026  
Target: https://mastermath.app/solver  
Method: live-browser, real-user testing only; no source-code review  
Scope: 66 unique topic/input combinations, including standard problems, difficult cases, malformed inputs, and domain-sensitive edge cases.

## Executive summary

**Overall rating: 7.2/10.** MasterMath is a capable precalculus/calculus practice tool for conventional textbook inputs. Standard derivatives, definite and elementary indefinite integrals, algebraic equations and systems, special-angle trigonometry, and especially limits generally work well. The UI is clean, responsive after load, and the step-by-step presentation is approachable.

The main reliability problem is not lack of breadth; it is overconfidence at boundaries. Several invalid, undefined, or context-sensitive inputs receive a green “Problem solved successfully!” notification. A few answers are mathematically wrong or omit decisive domain qualifications. Most importantly, `sin(30)` returns `0.5` even though the same solution says radians are used by default; `1/0` is presented as infinity; removable holes and nondifferentiable points are not consistently identified; and malformed syntax can be reinterpreted silently.

The app is suitable for checking routine work, but students should not yet treat it as authoritative for ambiguous notation, domain restrictions, discontinuities, nonsmooth functions, or malformed input.

## Category scores

| Category | Score | Assessment |
|---|---:|---|
| Derivatives | 8.2/10 | Strong standard symbolic rules; misses the nondifferentiability of `abs(x)` at 0. |
| Integrals | 6.7/10 | Good elementary and definite cases; weak messaging for non-elementary integrals and missing real-domain absolute values. |
| Limits | 9.1/10 | Best category; correctly distinguishes one-sided and two-sided behavior, removable discontinuities, asymptotes, and several 0/0 forms. |
| Algebra | 8.5/10 | Correct equations, quadratics, systems, inequalities, identities, and contradictions; malformed syntax can be mislabeled as “no solution.” |
| Trigonometry | 7.2/10 | Good identities and special angles, but bare-number angle interpretation is internally contradictory and can be wrong. |
| Functions / graphing | 6.8/10 | Useful domain/asymptote summaries; misses a removable hole and incorrectly attributes the `abs(x)` minimum to `f′(0)=0`. |
| Arithmetic | 6.8/10 | Correct precedence and nested expressions; mishandles division by zero, `0^0`, overflow, and non-finite results. |
| Malformed-input handling | 4.5/10 | Empty input is blocked and many parse errors are caught, but error states still look successful and some malformed inputs are silently reinterpreted. |
| Explanation quality | 6.6/10 | Clear visual organization and helpful standard tips; some explanations are generic, misleading, or mathematically incomplete. |

## Severity-ranked bugs

### Critical / high

1. **Bare-angle trigonometry can return the wrong value.**
   - Reproduce: Trigonometry → `sin(30)`
   - Expected under the app’s stated “radians by default” rule: `sin(30) ≈ -0.9880`.
   - Actual: `0.5`, while the explanation simultaneously says radians are the default.
   - Impact: a correct-looking special-angle answer hides a unit/interpretation error.

2. **Division by zero is presented as a valid infinity result.**
   - Reproduce: Arithmetic → `1/0`
   - Expected: undefined in ordinary real/complex arithmetic; infinity is a limit concept, not the quotient’s value.
   - Actual: `∞ (1/0)` with a success notification.

3. **Failure states are styled and announced as successes.**
   - Reproduce: Derivatives → `x^^2`, Integrals → `x^^2`, Trigonometry → `sin()`, Arithmetic → `(2+3`.
   - Expected: explicit parse/validation error, no success state.
   - Actual: final answer says “Unable to compute/evaluate,” but the notification says “Problem solved successfully!”
   - Impact: undermines trust and makes automation/accessibility announcements misleading.

4. **Malformed algebra is converted into a false mathematical conclusion.**
   - Reproduce: Algebra → `2**x=4`
   - Expected: syntax error (or a clear explanation of supported exponent syntax).
   - Actual: “No real solution found,” which is not equivalent to “could not parse.”

### Medium

5. **Removable discontinuity is not identified as a hole.**
   - Reproduce: Functions → `(x^2-1)/(x-1)`
   - Expected: equivalent to `x+1` for `x≠1`, with a hole at `(1,2)`; domain excludes `x=1`.
   - Actual: correctly says undefined at `x=1`, but does not identify the removable hole or its coordinate. The analysis stops before the most important graph feature.

6. **`abs(x)` derivative/function explanations mishandle the cusp.**
   - Derivatives → `abs(x)` returns `sgn(x)` without saying the derivative is undefined at `x=0`.
   - Functions → `abs(x)` says the minimum at `(0,0)` comes “from `f′(x)=0`,” but `f′(0)` does not exist.

7. **A real antiderivative omits required absolute values.**
   - Reproduce: Integrals → `1/(x^2-1)`
   - Expected: `1/2 ln |(x-1)/(x+1)| + C` on intervals not crossing `±1`.
   - Actual simplifies to `1/2 log((x-1)/(x+1)) + C`, with no absolute value or interval/domain qualification.

8. **Malformed input may be silently concatenated.**
   - Reproduce: Arithmetic → `2 2`
   - Expected: syntax error or an explicit rule explaining whitespace concatenation.
   - Actual: `22`.

9. **`0^0` is returned as unqualified `1`.**
   - Expected: explain that conventions vary; it is undefined/indeterminate in many elementary contexts, though defined as 1 in some combinatorial and programming contexts.
   - Actual: `1`, with no qualification.

### Low / explanation-quality

10. `sin(x^2)` under Integrals says “Unable to compute integral” and suggests formatting is wrong. The input is valid; the indefinite integral is non-elementary and should be explained as such (optionally via the Fresnel S function).
11. `1e308*10` says “Unable to evaluate” and gives syntax tips. The input is valid scientific notation; the issue is numeric overflow/range.
12. `sqrt(x)=-1` gives the correct “no real solution” result but justifies it via a numerical search over `[-100,100]`, not the defining range of the real square root.
13. `arcsin(1/2)` returns only `0.5236`; `π/6` and the principal-value range would be more instructive.
14. `lim x->0 (0/0)` returns DNE but says the one-sided limits disagree. The expression is undefined at every nearby point; there are no function values from which those one-sided limits can be inferred.

## Complete test record

Legend: **Pass** = correct and materially complete; **Partial** = core value is usable but an important qualification/explanation is missing; **Fail** = incorrect result, false conclusion, misleading parse behavior, or unacceptable failure semantics.

### Derivatives

| # | Input | Expected | Actual | Result / notes |
|---:|---|---|---|---|
| D1 | `x^2 + 3*x` | `2x+3` | `2x+3` | **Pass** — clear power/sum-rule steps. |
| D2 | `sin(x^2)` | `2x cos(x^2)` | `2x cos(x^2)` | **Pass** — chain rule correct. |
| D3 | `x^2*sin(x)` | `2x sin(x)+x^2 cos(x)` | Same | **Pass** — product rule correct. |
| D4 | `(x^2+1)/(x-1)` | `2x/(x-1) - (x^2+1)/(x-1)^2`, or equivalent | `-1/(x-1)^2 + 2x/(x-1) - x^2/(x-1)^2` | **Pass** — equivalent but not simplified. |
| D5 | `ln(x)` | `1/x` for `x>0` | `1/x` | **Pass** — value correct; domain not emphasized. |
| D6 | `abs(x)` | `sgn(x)` for `x≠0`; undefined at 0 | `sgn(x)` | **Partial** — decisive exception at 0 omitted. |
| D7 | `x^^2` | Parse error | “Unable to compute derivative” plus success notification | **Fail** — final fallback is reasonable, status is not. |

### Integrals

| # | Input | Expected | Actual | Result / notes |
|---:|---|---|---|---|
| I1 | `2*x + 1` | `x^2+x+C` | `x(x+1)+C` | **Pass** — equivalent. |
| I2 | `∫_0^1 x^2 dx` | `1/3` | `1/3 (≈0.3333)` | **Pass** — exact and numerical verification. |
| I3 | `1/x` | `ln|x|+C` | `ln|x|+C` | **Pass**. |
| I4 | `x/(x^2+1)` | `1/2 ln(x^2+1)+C` | Same | **Pass**. |
| I5 | `sin(x^2)` | Non-elementary; explain Fresnel form or limitation | “Unable to compute integral”; says check formatting | **Fail** — valid difficult input misdiagnosed as formatting. |
| I6 | `1/(x^2-1)` | `1/2 ln|(x-1)/(x+1)|+C`, interval-qualified | Log form without absolute value/domain | **Fail** — incomplete as a real antiderivative. |
| I7 | `x^^2` | Parse error | “Unable to compute integral” plus success notification | **Fail**. |

### Limits

| # | Input | Expected | Actual | Result / notes |
|---:|---|---|---|---|
| L1 | `lim x->0 (sin(x)/x)` | `1` | `1` | **Pass**. |
| L2 | `lim x->1 ((x^2-1)/(x-1))` | `2` | `2` | **Pass** — correctly handles removable form. |
| L3 | `lim x->0 ((1-cos(x))/x^2)` | `1/2` | `1/2` | **Pass**. |
| L4 | `lim x->0 (1/x)` | DNE; left `-∞`, right `+∞` | DNE with opposite-side explanation | **Pass**. |
| L5 | `lim x->0+ (1/x)` | `+∞` | `+∞` | **Pass** — right-hand interpretation correct. |
| L6 | `lim x->0- (1/x)` | `-∞` | `-∞` | **Pass** — left-hand interpretation correct. |
| L7 | `lim x->infinity ((3*x^2+1)/(x^2-4))` | `3` | `3` | **Pass**. |
| L8 | `lim x->0 ((sqrt(1+x)-1)/x)` | `1/2` | `1/2` | **Pass**. |
| L9 | `lim x->0 (0/0)` | Invalid/nowhere-defined expression; explain that 0/0 is an indeterminate *form*, not a function | DNE; says one-sided limits disagree | **Fail** — conclusion defensible only as invalid/DNE, explanation is false. |

### Algebra

| # | Input | Expected | Actual | Result / notes |
|---:|---|---|---|---|
| A1 | `2*x + 5 = 11` | `x=3` | `x=3` | **Pass**. |
| A2 | `x^2 - 5*x + 6 = 0` | `x=2,3` | `x=2 or x=3` | **Pass**. |
| A3 | `2x + 3y = 6; x - y = 4` | `x=18/5, y=-2/5` | Same | **Pass** — check included. |
| A4 | `x^2 - 4 > 0` | `(-∞,-2)∪(2,∞)` | Same | **Pass**. |
| A5 | `(x-1)/(x+2)=0` | `x=1` (with domain `x≠-2`) | `x=1` | **Pass** — result correct; domain could be explicit. |
| A6 | `sqrt(x) = -1` | No real solution | No real solution | **Partial** — correct, but proof relies on a finite numerical search. |
| A7 | `2*(x+3)=2*x+6` | All real numbers | Identity; all real numbers | **Pass**. |
| A8 | `2*(x+3)=2*x+7` | No solution | No solution | **Pass**. |
| A9 | `2**x=4` | Parse error | “No real solution found” | **Fail** — parser failure becomes false mathematics. |

### Trigonometry

| # | Input | Expected | Actual | Result / notes |
|---:|---|---|---|---|
| T1 | `sin(pi/4)` | `√2/2 ≈ 0.7071` | Same | **Pass**. |
| T2 | `cos(pi)` | `-1` | `-1` | **Pass**. |
| T3 | `tan(pi/2)` | Undefined | Undefined; vertical-asymptote explanation | **Pass**. |
| T4 | `sin(30)` | Under stated radian default, `≈-0.9880` | `0.5` | **Fail** — silently treated as 30°. |
| T5 | `sin(30 degrees)` | `1/2` | `1/2` | **Pass**. |
| T6 | `sin(x)^2 + cos(x)^2` | `1` | `1` | **Pass** — identity recognized. |
| T7 | `arcsin(1/2)` | Principal value `π/6 ≈0.5236` | `0.5236` | **Partial** — numerically correct, exact form/range omitted. |
| T8 | `sec(pi/3)` | `2` | `2` | **Pass**. |
| T9 | `sin(pi/6 + pi/3)` | `1` | `1` | **Pass** — nested expression correct. |
| T10 | `sin()` | Parse error | “Unable to evaluate” plus success notification | **Fail**. |

### Functions and graph analysis

| # | Input | Expected | Actual | Result / notes |
|---:|---|---|---|---|
| F1 | `x^2 - 4*x + 3` | Parabola; roots 1,3; vertex `(2,-1)` | Correct function analysis/graph workflow | **Pass**. |
| F2 | `1/(x-2)` | Domain excludes 2; VA `x=2`; HA `y=0`; y-int `-1/2` | All listed correctly | **Pass**. |
| F3 | `(x^2-1)/(x-1)` | Line `y=x+1` with hole `(1,2)` | Says undefined at 1 but omits removable hole/coordinate | **Fail** — key graph feature missing. |
| F4 | `sqrt(x-2)` | Domain `[2,∞)`; x-int 2 | Says undefined for `x<2`; x-int 2 | **Pass**. |
| F5 | `abs(x)` | V-shape; minimum `(0,0)`; nondifferentiable at 0 | Correct shape/minimum, but says minimum is “from `f′(x)=0`” | **Fail** — false calculus explanation. |
| F6 | `sin(x)` | Periodic sine graph | Recognized periodic function and graphed it | **Pass**. |
| F7 | `x^^2` | Parse error, no graph | Echoes `f(x)=x^^2` and success state | **Fail**. |

### Arithmetic and difficult numeric cases

| # | Input | Expected | Actual | Result / notes |
|---:|---|---|---|---|
| R1 | `(5 + 3) * 4 - 2^3` | `24` | `24` | **Pass**. |
| R2 | `2^3^2` | `512` (right-associative exponentiation) | `512` | **Pass**. |
| R3 | `-2^2` | `-4` | `-4` | **Pass**. |
| R4 | `0^0` | Context-dependent/usually undefined in elementary arithmetic; explain convention | `1` | **Fail** — no qualification. |
| R5 | `1/0` | Undefined | `∞` | **Fail**. |
| R6 | `sqrt(-1)` | `i` if complex arithmetic is supported; otherwise “not real” | `i` | **Pass** — complex-domain note would help. |
| R7 | `((2+3)*(4-(1+1)))` | `10` | `10` | **Pass**. |
| R8 | `0.1+0.2` | `0.3` | `0.3` | **Pass**. |
| R9 | `1e308*10` | Overflow/infinity warning or exact arbitrary-precision result | “Unable to evaluate”; syntax tips | **Fail** — valid syntax misdiagnosed. |
| R10 | `3..4+1` | Parse error | “Unable to evaluate” | **Partial** — right outcome, but success status/generic guidance. |

### Additional malformed-input and non-finite-value checks

| # | Input / state | Expected | Actual | Result / notes |
|---:|---|---|---|---|
| M1 | Arithmetic `abc` | Unknown symbol / unsupported-variable error | “Unable to evaluate” | **Partial** — acceptable fallback; success notification is misleading. |
| M2 | Arithmetic `(2+3` | Unmatched-parenthesis error | “Unable to evaluate” | **Partial** — no specific diagnosis; success notification. |
| M3 | Arithmetic `2 2` | Syntax error or documented implicit behavior | `22` | **Fail** — silent concatenation. |
| M4 | Arithmetic `2/` | Incomplete-expression error | “Unable to evaluate” | **Partial** — generic only; success notification. |
| M5 | Arithmetic `NaN` | Explain non-number/invalid value | `NaN` as a successful final answer | **Fail**. |
| M6 | Arithmetic `Infinity-Infinity` | Indeterminate/undefined (`NaN`) with explanation | `NaN`, presented as successful arithmetic | **Fail** — raw engine value without interpretation. |
| M7 | Whitespace-only input | Solve disabled | Solve disabled | **Pass**. |

## Explanation and UX observations

### What works well

- The split graph/solution layout makes results easy to scan.
- Exact forms are often paired with decimal checks (`1/3`, `√2/2`).
- Limit explanations explicitly discuss one-sided limits, vertical asymptotes, 0/0 forms, and the need for left/right agreement.
- Algebra handles identities and contradictions—cases many simple solvers miss.
- Standard problems include useful “Key Insights” and “Common Mistakes” sections.
- Topic examples make onboarding immediate, and whitespace-only submissions are prevented.

### What reduces trust

- The green success toast does not correspond to actual success.
- Generic advice often survives into cases where it is inapplicable. For example, a non-elementary integral is described as a formatting issue, and numeric overflow receives operator-syntax tips.
- Some “step-by-step” solutions are result templates rather than derivations tailored to the specific problem.
- Domain and branch conventions are inconsistent: real vs complex arithmetic, radians vs degrees, logarithm absolute values, and undefined values need explicit policies.
- Several analyses appear bounded/numerical (“searched range,” “analyzed window”), but the UI sometimes phrases the resulting claim globally.

## Recommended fix order

1. Separate **success**, **unsupported**, **parse error**, **undefined**, and **numeric overflow** into distinct result states and notifications.
2. Make angle-unit behavior deterministic: default to radians exactly as documented, require `deg`/`degrees` for degrees, and display the interpreted unit beside the answer.
3. Add a semantic validation layer for `1/0`, `0^0`, `NaN`, infinities, malformed operator sequences, and incomplete expressions.
4. Add domain-aware postprocessing: absolute values in logarithmic antiderivatives, excluded points, branch/principal-value notes, and real-vs-complex mode.
5. Improve special-function/unsupported responses: distinguish “valid but non-elementary” from “bad formatting.”
6. For function analysis, explicitly classify discontinuities (removable/jump/infinite), mark holes on graphs, and do not equate extrema with `f′=0` when the derivative is undefined.
7. Replace finite-window evidence with symbolic reasoning where a global claim is made, or label the result clearly as a numerical observation within a stated window.

## Bottom line

MasterMath already performs better than a basic expression evaluator and is particularly impressive on limits, systems, inequalities, and standard calculus. The next release should prioritize mathematical state semantics over adding more problem types. Once the app reliably distinguishes “correct answer,” “undefined,” “unsupported,” and “could not parse,” its polished instructional presentation will be much more trustworthy.
