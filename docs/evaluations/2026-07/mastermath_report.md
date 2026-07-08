# Evaluation of MasterMath’s Math Solver (July 2026)

## Overview

To evaluate the reliability of MasterMath’s solver, I interacted with the live web app just as a student would—no code inspection.  Over ninety problems were entered across derivatives, integrals, limits, algebra, trigonometry, functions/graphing and arithmetic.  Each problem’s correct solution was verified independently (using SymPy) and the solver’s response was classified as **Correct**, **Partially Correct** or **Incorrect**.  The raw results are summarised in the tables below, followed by analysis and recommendations.

### Test coverage

| topic               | count | correct | partial | incorrect | notes |
|---------------------|------:|-------:|-------:|---------:|------:|
| **Derivatives**     | 9    | 8      | 0      | 1        | Most standard derivatives handled; failure on `arctan(x)` (returned 0 or unresolved) |
| **Integrals**       | 8    | 6      | 1      | 1        | Indefinite integrals mostly correct; missed absolute value in ∫1/x and mis‑interpreted definite integrals |
| **Limits**          | 17   | 15     | 0      | 2        | Wide range of indeterminate forms solved correctly; failed on limits involving `abs(...)` and one‑sided notation |
| **Algebra**         | 21   | 17     | 1      | 3        | Equations, quadratics, cubics and numeric expressions solved correctly; systems, inequalities and factorisation unsupported |
| **Trigonometry**    | 15   | 14     | 0      | 1        | Special angles and identities handled; identity `sin^2 x+cos^2 x` not simplified |
| **Functions/Graphs**| 10   | 2      | 2      | 6        | The solver mostly repeated the input and guessed “vertices” and intercepts; many results were wrong |
| **Arithmetic/Other**| 11   | 9      | 0      | 2        | Basic arithmetic and exponentiation worked; factorial and combinations unsupported |
| **Total**           | 91   | 71     | 4      | 16       | **Overall accuracy ≈78 %** |

## Detailed findings by topic

### Derivatives

The derivative module performed well on most common expressions:

- Chain rule and product/quotient rules were applied correctly.  Examples such as `d/dx sin(x**2) = 2*x*cos(x**2)` and `d/dx ((x**2+1)/x) = 1 – 1/x**2` matched the expected results.
- Power and root functions were differentiated properly (e.g., `sqrt(x)` gives `1/(2*sqrt(x))` and `x**(3/2)` gives `(3/2)*x**(1/2)`).
- The solver handled exponential and trigonometric functions (`exp(x**2)`, `tan(x)`) correctly.

**Problems:** the only major derivative failure was `d/dx arctan(x)`.  MasterMath returned either `0` or an unresolved derivative symbol instead of the correct `1/(1+x**2)`.  This suggests inverse trigonometric derivatives are not implemented.

### Integrals

Indefinite integrals were mostly reliable.  The solver correctly integrated polynomials, sine and cosine, exponentials and rational functions such as `2*x/(x**2+4)` and `1/(x**2+1)`.  However, two issues surfaced:

- **Missing absolute value:** ∫1/x dx should be `ln|x|+C`, but the solver returned `log(x)+C`, omitting the absolute value.  In practice this gives the wrong antiderivative for negative x.
- **No support for definite integrals:** attempts to enter expressions like `int_0^1 x dx` were mis‑parsed.  The solver treated `int_0` as a variable and produced nonsense, indicating definite integral syntax is not recognised.

### Limits

The limit solver appears to have undergone recent improvements.  It correctly evaluated a wide variety of indeterminate forms:

- **Basic indeterminate forms** such as `lim_{x→0} sin(x)/x`, `(1−cos x)/x**2`, `(sin x−x)/x**3` and `(exp(x)−1)/x` were solved using series expansions or L’Hôpital’s rule.
- **Polynomial and rational forms:** limits as x→1 and x→∞ were reduced algebraically, giving the correct finite limits.
- **More challenging forms:** it correctly handled `(tan(x)−x)/x**3`, `(1−cos(2x))/x**2`, `x*sin(1/x)` and oscillatory `sin(1/x)` (reporting “Does not exist” because of oscillation).

**Failures:** limits involving absolute value remain unsolved.  For example, `lim_{x→0} abs(x)/x` should not exist because the one‑sided limits are ±1, yet MasterMath returned `0`【110160521400991†screenshot】.  Similarly `lim_{x→2} (x−2)/abs(x−2)` (which should not exist) was reported as `–1`【296647532626328†screenshot】.  One‑sided notation `x→a+` or `x→a−` was ignored; the solver still produced the two‑sided answer.

### Algebra

General algebraic capabilities were strong:

- The solver solved linear, quadratic and cubic equations, including those with complex roots, and performed numeric evaluation with correct order of operations.
- Simplification and rational expression reduction worked (e.g., `(2*x**2−8)/(4*x)` simplified to `(1/2)*x – 2/x`).
- Absolute value, exponents and negative powers were handled.

**Deficiencies:**

- **Systems of equations** were not supported.  When two equations were entered (separated by a newline), the solver simply returned an unrelated number【742570525108622†screenshot】.
- **Inequalities** were returned unsolved (e.g., `x^2−4x+3 > 0` remained unchanged).  There was no sign‑chart analysis.
- **Factorisation** commands such as `factor x^2 - 9` were ignored; the input was echoed back unchanged.
- **Exact simplification of radicals:** entering `sqrt(50)` produced the decimal 7.071…, rather than the simplified form `5*sqrt(2)`, so the solver appears limited to numerical evaluation in such cases.

### Trigonometry

On trigonometric evaluations the solver excelled.  It correctly computed sine, cosine and tangent at special angles (π/6, π/4, π/3, π, etc.), including reciprocals like sec and csc.  It also handled negative angles correctly.  Simplifying expressions like `sin(pi/3)**2 + cos(pi/3)**2` yielded `1`, and ratios such as `sin(pi/6)/cos(pi/6)` were expressed numerically.

The only notable failure was that the identity `sin(x)**2 + cos(x)**2 = 1` for a symbolic variable could not be simplified; the solver returned “Unable to evaluate” when given `sin(x)**2 + cos(x)**2`.

### Functions/Graphing

This category was disappointing.  For a given function f(x) the solver’s “step‑by‑step” promised to find key features—domain, vertex/extrema, intercepts and a sketch.  However, only two of the ten tested functions were handled properly:

- **Quadratic** `x^2−4x+3`: the solver correctly identified the vertex at (2, −1) and the x‑intercepts at 1 and 3, and drew a graph.
- **Absolute value** `abs(x)`: it recognised the vertex at (0, 0) and the intercept at x = 0.

In all other cases the solver either made up “vertices” and intercepts or failed to identify key features:

- For rational functions such as `1/(x−2)` and `1/x**2` it reported fictitious x‑intercepts around −10, −9.5 and −9, while ignoring the vertical asymptotes at x = 2 and x = 0 respectively【535071494636116†screenshot】【109339962725339†screenshot】.
- For `sqrt(x−3)` it mis‑identified the domain and claimed the vertex was around (6.5, 1.87) rather than the correct starting point (3, 0)【107249073209499†screenshot】.
- For `ln(x)` it stated there were no x‑intercepts, ignoring the intercept at (1, 0)【488162493031129†screenshot】.
- The exponential `exp(x)` was said to have x‑intercepts near −10, −9.5 and −9 and a “vertex” at (−1.5, 0.22)【59796780083071†screenshot】—none of which are true.
- Similarly `log(x**2)` and `x^3−x` were mis‑analysed; the latter has turning points at ±1/sqrt(3) (≈0.577), but the solver claimed a vertex near −0.5, 0.375【160655644642773†screenshot】.

In short, the functions module appears to guess features by sampling a handful of points; it cannot compute exact domain, range, asymptotes or critical points reliably.

### Arithmetic/Other

Basic arithmetic was handled well.  Addition, subtraction, multiplication/division, parentheses and exponentiation followed PEMDAS/BODMAS rules.  The solver correctly evaluated expressions such as `(4+5)/(3-1) = 4.5`, `2/3 + 1/6 = 0.8333` and `2**10 = 1024`.

However, the module does **not** support factorials or combinatorics.  Entering `7!` returned `7` instead of `5040`, and `C(5,2)` produced “Unable to evaluate”.

## Patterns of failure

Across the categories several consistent weaknesses emerged:

1. **Absolute value and one‑sided limits:** limits involving `abs(x)` or `abs(x−a)` were mishandled; the solver returned a finite number when the limit should not exist, and it ignored one‑sided notation such as `x→a+` or `x→a−`【110160521400991†screenshot】【296647532626328†screenshot】.
2. **Inverse trigonometric derivatives:** `arctan(x)` (and likely other inverse trig functions) were not differentiated correctly; the solver returned 0 or left the derivative unevaluated【41887381700706†screenshot】.
3. **Definite integrals:** there is no support for definite integration.  Notation like `∫_0^1` was parsed incorrectly and produced nonsense output【866512505664447†screenshot】.
4. **Systems, inequalities and factorisation:** the algebra module could solve single equations but could not handle systems, inequalities or factorisation requests.  Such inputs were echoed back or mis‑interpreted【742570525108622†screenshot】.
5. **Functions/graphing:** this module often guessed “vertices” and intercepts based on a coarse sample instead of computing derivative‑based critical points.  Vertical and horizontal asymptotes were ignored, and domains were misidentified.
6. **Special arithmetic operations:** factorials and combinations were unsupported; using `!` or `C(n,k)` yielded incorrect or “unable to evaluate” results.

## Are the recent limit‑solver improvements effective?

Earlier complaints about MasterMath’s limit solver focused on incorrect evaluations of indeterminate forms and poor handling of L’Hôpital’s rule.  In this test the solver excelled on a wide range of challenging limits—applying L’Hôpital’s rule, Taylor expansions and algebraic simplifications correctly.  It successfully computed limits like `(tan(x)−x)/x**3` → 1/3【456634084799483†screenshot】 and `(1−cos(2x))/x**2` → 2【401343845843865†screenshot】, which require several derivative applications.  The improvements therefore appear genuine.

Nonetheless, the absolute‑value issue remains unresolved.  The solver still misreports limits of `abs(x)/x` and similar expressions, and it does not recognise one‑sided limit notation.  Future updates should address these edge cases to achieve full reliability.

## Confidence and recommendation

MasterMath is a promising tool for step‑by‑step solutions, and in many areas it performs admirably.  The solver’s strengths are derivatives, common indefinite integrals, most limit problems, basic algebraic equations and trigonometric evaluations.  Its explanations are clear and typically include key insights.

However, several areas prevent it from being fully trustworthy.  The functions/graphing module produces misleading information, and students relying on it could internalise incorrect notions of domain, intercepts or asymptotes.  Inverse trigonometric derivatives, definite integrals, systems of equations, inequalities, factorials and combinatorics are either unsupported or miscomputed.  Limits involving absolute value still return wrong answers.  Users therefore need a good mathematical background to detect these issues.

**Overall rating:** **6/10**.  I would recommend MasterMath as a supplementary tool for basic calculus and algebra practice, but not as a sole source of truth.  Students should cross‑check outputs, especially when working with absolute values, inverse functions, graphs or advanced algebraic structures.
