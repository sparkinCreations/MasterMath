# Insights review: Functions (1.64.0)

**Written:** October 31, 2026
**For:** MJ, to spot-check before 1.64.0 is pushed
**Revised:** after two outside reviews ("approve with revisions", then "conditional approval, one correction"); every claim and verdict is Rounds 27 and 28 of [`../../evaluations/2026-10/REVIEW-LOG-2026-10.md`](../../evaluations/2026-10/REVIEW-LOG-2026-10.md)
**Plan:** [`../PLAN-INSIGHTS-AND-RESOURCES.md`](../PLAN-INSIGHTS-AND-RESOURCES.md) · **Before this:** [Integrals](INTEGRALS.md), [Derivatives](DERIVATIVES.md), [Algebra](ALGEBRA.md), [Limits](LIMITS.md)

Generated from the solver, so it is exactly what a student sees for each
example (formulas as plain text here, typeset on the page). The first three
of each list show; **"Show more"** opens the rest. Where the analysis itself
changed, the working is included (open "Working").

## What to check

1. **Order:** is the most useful insight first for each family?
2. **Accuracy and wording**, especially the new working: exact values, the
   sine and cosine patterns, slant asymptotes, and the proved ranges and
   domains.
3. **Missing:** an insight or mistake a student needs that is not here.

## Built in from the start (the lessons of the first four topics)

- **The second insight works the student's own function**, read from its
  features: a, b and the vertex; the corner where the inside of |…| is 0;
  A, k and d of a wave; the log's inside and its asymptote; the division
  that gives a slant asymptote; the cancelled factor of a hole; f′ and the
  sign change at each extremum.
- **Exact where proved, ≈ where not.** A value located numerically is shown
  as exact only when Algebrite substitutes the exact form back and gets 0
  (ln 2, 1/e, 1 ± √2, 1/∜5, (1 ± √5)/2); otherwise it carries ≈.
- **Statements say where they hold:** the range of a|g| + k when g takes
  the value 0; xᵖᐟᵠ by the parity of q; sec and csc never strictly between
  −1 and 1; a·bˣ + k for b > 0, b ≠ 1.
- **Swept for wrong answers before writing:** about 60 functions across
  every family. Found and fixed:
  - **(x² − 3)²** said "no x-intercepts", beside minima at (±√3, 0): a
    repeated irrational root. Polynomial intercepts now come from the exact
    root finder, so the list is complete.
  - **|x² − 2|** said "no x-intercepts" too: it touches 0 at ±√2 between
    grid points.
  - **eˣ − 2** gave "x = 0.6931" with an equals sign; it is ln 2.
  - **3cos(x) + 1** listed six window decimals as its x-intercepts (and its
    own tips call that a mistake); now ±arccos(−1/3) + 2πn, with every
    extremum as a pattern too.
  - **Decimals where an exact form exists:** (x² + 1)/(x − 1) (1 ± √2),
    x·ln x (1/e), −2x² + 4x + 1 (1 ± √6/2, was 1 − 1/2·√2·√3), x² − x − 1
    (vertex (1/2, −5/4), was (0.5, −1.25)), a hole at (−1, −3/2).
  - **Missing features:** the slant asymptote of (x² + 1)/(x − 1); the
    domain of x/(x² + 1) ("no restrictions found"); the range of a
    polynomial of degree 3 or more, now proved when every critical point is
    exact.
  - **sin(x)/x** was given the rational-function list ("factor the
    numerator"); it is not a quotient of polynomials.
  - **(x² − 1)/(x − 1)** said "f′(x) = 0 at x = 1" (a root of f′'s
    unsimplified numerator, where f′ is undefined); f′ = 1, never 0.
- **Revised after the review:** four general statements made exact
  (multiplicity, corners, the a|g| + k range, cancelled factors), periods
  with |k|; sin(x)/x's zeros as nπ (n ≠ 0) and its window extrema labelled;
  |sin x| and sin(−2x) as patterns; ranges proved for |x² − 2|, √(4 − x²),
  x·ln x, x/(x² + 1) and x·e^(−x); one-sided asymptotes; x·ln x has its own
  list.
- **No sources:** every insight here is a standard textbook fact.

## The lists, family by family

### Quadratic

Example: `x^2 - 4x + 3` → f(x) = x^2 - 4x + 3: domain: all real numbers; range: y ≥ -1; y-intercept (0, 3); x-intercepts at x = 1, 3; vertex (2, -1) (minimum), axis x = 2.

**Key Insights** (7)

1. For ax^2 + bx + c, the axis of symmetry is x = −b/(2a), and the vertex sits on it.
2. Here: a = 1 and b = -4, so x = −b/(2a) = 2, and f(2) = -1: the vertex is (2, -1), a minimum.
3. The sign of a gives the opening: a > 0 opens upward (the vertex is a minimum), a < 0 downward.

   *— Show more —*
4. The x-intercepts are the roots of ax^2 + bx + c = 0; the discriminant b^2 − 4ac says whether there are two, one or none.
5. Vertex form a(x − h)^2 + k shows the vertex (h, k) directly; completing the square turns ax^2 + bx + c into it.
6. The y-intercept is c, the value at x = 0; the parabola is symmetric about its axis, so (2h, c) is on it too.
7. The range starts at the vertex height: y ≥ k when a > 0, y ≤ k when a < 0.

**Common Mistakes** (4)

1. Dropping the minus sign in x = −b/(2a).
2. Giving the vertex as a single number: it is a point, (x, y).
3. Confusing an x-intercept (f(x) = 0) with the y-intercept (x = 0).

   *— Show more —*
4. Reading h with the wrong sign from a(x − h)^2 + k: (x + 3)^2 has h = −3.

### Quadratic, irrational roots

Example: `x^2 - x - 1` → f(x) = x^2 - x - 1: domain: all real numbers; range: y ≥ -5/4; y-intercept (0, -1); x-intercepts at x = (1 - √5)/2, (1 + √5)/2; vertex (1/2, -5/4) (minimum), axis x = 1/2.

<details><summary>Working</summary>

- Analyze the function: f(x) = x^2 - x - 1
- Domain: all real numbers — polynomials, sin, cos, eˣ and absolute values, and their sums, products and compositions, are defined for every real input.
- Range: y ≥ -5/4 — the parabola opens upward, so its lowest value is the vertex height -5/4 and it takes every value above it.
- This is a quadratic (parabola). Leading coefficient a = 1, so it opens upward.
- Axis of symmetry: x = −b/(2a) = 1/2.
- Vertex: (1/2, -5/4) — the minimum point.
- y-intercept: f(0) = -1, so the graph crosses the y-axis at (0, -1).
- x-intercepts: x = (1 - √5)/2, (1 + √5)/2.
- Plot the points and sketch the graph using these features.

</details>

**Key Insights** (7)

1. For ax^2 + bx + c, the axis of symmetry is x = −b/(2a), and the vertex sits on it.
2. Here: a = 1 and b = -1, so x = −b/(2a) = 1/2, and f(1/2) = -5/4: the vertex is (1/2, -5/4), a minimum.
3. The sign of a gives the opening: a > 0 opens upward (the vertex is a minimum), a < 0 downward.

   *— Show more —*
4. The x-intercepts are the roots of ax^2 + bx + c = 0; the discriminant b^2 − 4ac says whether there are two, one or none.
5. Vertex form a(x − h)^2 + k shows the vertex (h, k) directly; completing the square turns ax^2 + bx + c into it.
6. The y-intercept is c, the value at x = 0; the parabola is symmetric about its axis, so (2h, c) is on it too.
7. The range starts at the vertex height: y ≥ k when a > 0, y ≤ k when a < 0.

**Common Mistakes** (4)

1. Dropping the minus sign in x = −b/(2a).
2. Giving the vertex as a single number: it is a point, (x, y).
3. Confusing an x-intercept (f(x) = 0) with the y-intercept (x = 0).

   *— Show more —*
4. Reading h with the wrong sign from a(x − h)^2 + k: (x + 3)^2 has h = −3.

### Absolute value (corner)

Example: `abs(x-1)` → f(x) = abs(x - 1): domain: all real numbers; range: y ≥ 0; y-intercept (0, 1); x-intercept at x = 1; local minimum (1, 0) (cusp).

**Key Insights** (5)

1. An absolute value is piecewise: |g| is g where g ≥ 0 and −g where g < 0. The zeros of g are where corners can be: there is a corner where g changes sign with a nonzero slope (the slopes on the two sides then disagree), but |x^2| = x^2 is smooth at 0.
2. Here: the corner is where x - 1 = 0, at x = 1: a minimum (1, 0).
3. Critical points are where f′ = 0 OR where f′ does not exist; a corner can be a maximum or a minimum.

   *— Show more —*
4. Where g = 0, |g| touches 0: that point is an x-intercept, even though the graph does not cross there.
5. |g| ≥ 0 always: for a > 0, if g is 0 somewhere, then k is the least value of a|g| + k (for a < 0, the greatest). The rest of the range depends on how large |g| gets: |sin(x)| stays between 0 and 1.

**Common Mistakes** (4)

1. Saying there is no extremum because f′ is never 0: the minimum of |x| is at the corner.
2. Reporting f′ = 0 at a corner: the derivative does not exist there. (Not every zero of the inside is a corner: check the slopes on each side.)
3. Differentiating |x| as if it were x, giving 1 everywhere.

   *— Show more —*
4. Missing an intercept where the graph only touches the axis: a sign check finds crossings, not touches.

### Absolute value touching the axis (fixed)

Example: `abs(x^2-2)` → f(x) = abs(x^2 - 2): domain: all real numbers; range: y ≥ 0; y-intercept (0, 2); x-intercepts at x = -√2, √2; local minimum (-√2, 0) (cusp); local maximum (0, 2); local minimum (√2, 0) (cusp).

<details><summary>Working</summary>

- Analyze the function: f(x) = abs(x^2 - 2)
- Domain: all real numbers — polynomials, sin, cos, eˣ and absolute values, and their sums, products and compositions, are defined for every real input.
- Range: y ≥ 0 — |x^2 - 2| is 0 where x^2 - 2 = 0 and grows without bound, so the least value is 0 and there is no greatest.
- y-intercept: f(0) = 2, so the graph crosses the y-axis at (0, 2).
- x-intercepts: x = -√2, √2.
- Differentiate: f′(x) = -2x*sgn(-x^2 + 2). f′(x) is 0 at x = 0 (found where the slope changes sign).
- Local minimum at (-√2, 0) — at a corner/cusp: f′(x) does not exist there (the slopes on either side disagree), yet it is still a critical point and an extremum. Not a stationary point: this does NOT come from f′(x) = 0.
- Local maximum at (0, 2): f′(x) changes from positive to negative there.
- Local minimum at (√2, 0) — at a corner/cusp: f′(x) does not exist there (the slopes on either side disagree), yet it is still a critical point and an extremum. Not a stationary point: this does NOT come from f′(x) = 0.
- Plot the points and sketch the graph using these features.

</details>

**Key Insights** (5)

1. An absolute value is piecewise: |g| is g where g ≥ 0 and −g where g < 0. The zeros of g are where corners can be: there is a corner where g changes sign with a nonzero slope (the slopes on the two sides then disagree), but |x^2| = x^2 is smooth at 0.
2. Here: the corners are where x^2 - 2 = 0, at x = -√2, √2: a minimum (-√2, 0) and a minimum (√2, 0).
3. Critical points are where f′ = 0 OR where f′ does not exist; a corner can be a maximum or a minimum.

   *— Show more —*
4. Where g = 0, |g| touches 0: that point is an x-intercept, even though the graph does not cross there.
5. |g| ≥ 0 always: for a > 0, if g is 0 somewhere, then k is the least value of a|g| + k (for a < 0, the greatest). The rest of the range depends on how large |g| gets: |sin(x)| stays between 0 and 1.

**Common Mistakes** (4)

1. Saying there is no extremum because f′ is never 0: the minimum of |x| is at the corner.
2. Reporting f′ = 0 at a corner: the derivative does not exist there. (Not every zero of the inside is a corner: check the slopes on each side.)
3. Differentiating |x| as if it were x, giving 1 everywhere.

   *— Show more —*
4. Missing an intercept where the graph only touches the axis: a sign check finds crossings, not touches.

### Cusp

Example: `x^(2/3)` → f(x) = x^(2/3): domain: all real numbers; y-intercept (0, 0); x-intercept at x = 0; local minimum (0, 0) (cusp).

**Key Insights** (5)

1. A cusp is a critical point where f′ blows up: x^(2/3) has f′ = 2/(3∛x), undefined at 0, yet (0, 0) is a minimum.
2. Here: f′(x) = 2/(3∛x) does not exist at x = 0, and (0, 0) is a minimum.
3. Critical points are where f′ = 0 OR where f′ does not exist; check both kinds.

   *— Show more —*
4. x^(2/3) = (∛x)²: the odd root first, so it is defined for negative x too, and the square makes it never negative.
5. x^(p/q) with q odd is defined for every x; with q even, only for x ≥ 0.

**Common Mistakes** (3)

1. Reporting f′(0) = 0 at a cusp — the derivative does not exist there.
2. Treating x^(2/3) as undefined for negative x, or as negative there.
3. Saying there is no extremum because f′ is never 0.

### Sine wave (patterns, new)

Example: `sin(2x)` → f(x) = sin(2x): domain: all real numbers; range: -1 ≤ y ≤ 1; y-intercept (0, 0); x-intercepts at x = nπ/2; maxima at x = π/4 + nπ (value 1), minima at x = -π/4 + nπ (value -1), period π (n any integer); periodic.

<details><summary>Working</summary>

- Analyze the function: f(x) = sin(2x)
- Domain: all real numbers — polynomials, sin, cos, eˣ and absolute values, and their sums, products and compositions, are defined for every real input.
- Range: -1 ≤ y ≤ 1 — sin swings between −1 and 1, so a·sin(…) + k swings between k − |a| = -1 and k + |a| = 1.
- y-intercept: f(0) = 0, so the graph crosses the y-axis at (0, 0).
- x-intercepts: f(x) = 0 when sin(2x) = 0, so x = nπ/2 (n any integer).
- Differentiate: f′(x) = 2cos(2x). f′(x) is 0 at x = -5π/4, -3π/4, -π/4, π/4, 3π/4, 5π/4 (found where the slope changes sign).
- Maxima: sin = 1 at x = π/4 + nπ, where f = 1. Minima: sin = −1 at x = -π/4 + nπ, where f = -1 (n any integer). The period is π.
- This is a periodic function — its pattern of zeros and extrema repeats forever.
- Plot the points and sketch the graph using these features.

</details>

**Key Insights** (6)

1. A·sin(kx) + d and A·cos(kx) + d (with k ≠ 0) have amplitude |A|, period 2π/|k| and midline y = d.
2. Here: A = 1, k = 2 and d = 0, so the amplitude is 1, the period 2π/2 = π and the midline y = 0.
3. Analyse one period, then repeat: every intercept and extremum comes back each period, so give them as patterns in n.

   *— Show more —*
4. The range is the midline plus or minus the amplitude: d − |A| ≤ y ≤ d + |A|.
5. sin = c has two solutions per period when |c| < 1: arcsin(c) and π − arcsin(c); cos = c has ±arccos(c). None when |c| > 1.
6. Maxima are where the sine or cosine is 1 (or −1 when A < 0), minima the other way.

**Common Mistakes** (4)

1. Forgetting the k: the period of sin(2x) is π, not 2π; sin(−2x) has period π too, not −π.
2. Listing a few intercepts as if they were all of them, instead of giving the pattern with n.
3. Reading the amplitude off the first peak without the midline: A·sin(kx) + d peaks at d + |A|.

   *— Show more —*
4. Giving only arcsin(c): the second solution in each period, π − arcsin(c), is missed.

### Cosine wave with a shift (patterns, new)

Example: `3cos(x)+1` → f(x) = 3cos(x) + 1: domain: all real numbers; range: -2 ≤ y ≤ 4; y-intercept (0, 4); x-intercepts at x = ±arccos(-1/3) + 2πn (≈ ±1.9106 + 2πn); maxima at x = 2πn (value 4), minima at x = π + 2πn (value -2), period 2π (n any integer); periodic.

<details><summary>Working</summary>

- Analyze the function: f(x) = 3cos(x) + 1
- Domain: all real numbers — polynomials, sin, cos, eˣ and absolute values, and their sums, products and compositions, are defined for every real input.
- Range: -2 ≤ y ≤ 4 — cos swings between −1 and 1, so a·cos(…) + k swings between k − |a| = -2 and k + |a| = 4.
- y-intercept: f(0) = 4, so the graph crosses the y-axis at (0, 4).
- x-intercepts: f(x) = 0 when cos(x) = -1/3, so x = ±arccos(-1/3) + 2πn (n any integer), that is x ≈ ±1.9106 + 2πn.
- Differentiate: f′(x) = -3sin(x). f′(x) is 0 at x = -3π, -2π, -π, 0, π, 2π (found where the slope changes sign).
- Maxima: cos = 1 at x = 2πn, where f = 4. Minima: cos = −1 at x = π + 2πn, where f = -2 (n any integer). The period is 2π.
- This is a periodic function — its pattern of zeros and extrema repeats forever.
- Plot the points and sketch the graph using these features.

</details>

**Key Insights** (6)

1. A·sin(kx) + d and A·cos(kx) + d (with k ≠ 0) have amplitude |A|, period 2π/|k| and midline y = d.
2. Here: A = 3, k = 1 and d = 1, so the amplitude is 3, the period 2π and the midline y = 1.
3. Analyse one period, then repeat: every intercept and extremum comes back each period, so give them as patterns in n.

   *— Show more —*
4. The range is the midline plus or minus the amplitude: d − |A| ≤ y ≤ d + |A|.
5. sin = c has two solutions per period when |c| < 1: arcsin(c) and π − arcsin(c); cos = c has ±arccos(c). None when |c| > 1.
6. Maxima are where the sine or cosine is 1 (or −1 when A < 0), minima the other way.

**Common Mistakes** (4)

1. Forgetting the k: the period of sin(2x) is π, not 2π; sin(−2x) has period π too, not −π.
2. Listing a few intercepts as if they were all of them, instead of giving the pattern with n.
3. Reading the amplitude off the first peak without the midline: A·sin(kx) + d peaks at d + |A|.

   *— Show more —*
4. Giving only arcsin(c): the second solution in each period, π − arcsin(c), is missed.

### Tangent

Example: `tan(x)` → f(x) = tan(x): domain: all real numbers except x = π/2 + nπ (n any integer); y-intercept (0, 0); x-intercepts at x = nπ; vertical asymptotes at x = π/2 + nπ; periodic.

**Key Insights** (5)

1. tan(kx) and cot(kx) have period π/|k| (for k ≠ 0); sec and csc have 2π/|k|.
2. Here: the asymptotes nearest 0 are at x = -π/2, π/2, and the pattern repeats.
3. tan(x) and sec(x) have a vertical asymptote wherever cos(x) = 0; cot(x) and csc(x) wherever sin(x) = 0.

   *— Show more —*
4. Analyse one period, then repeat: the intercepts and asymptotes come back each period, so give them as patterns in n.
5. tan takes every real value on each period, so its range is all real numbers; sec and csc never take values strictly between −1 and 1.

**Common Mistakes** (3)

1. Using 2π as the period of tan: it repeats every π.
2. Listing a few asymptotes instead of the pattern with n.
3. Putting a tangent's asymptotes where sin = 0: those are its zeros.

### Logarithm

Example: `ln(x-2)` → f(x) = ln(x - 2): domain: x > 2; range: all real numbers; no y-intercept; x-intercept at x = 3; vertical asymptote x = 2.

**Key Insights** (5)

1. A logarithm is defined only for a positive argument: the domain is where the inside is > 0.
2. Here: the inside x - 2 must be > 0, so the domain is x > 2 and the vertical asymptote is x = 2.
3. ln(x) has a vertical asymptote at x = 0 and crosses the x-axis at x = 1; it grows without bound, slowly.

   *— Show more —*
4. Inside a shift, ln(x − a) moves the asymptote to x = a and the x-intercept to x = a + 1.
5. ln(g) = 0 exactly when g = 1: that gives the x-intercepts.

**Common Mistakes** (4)

1. Allowing x = 0 or negative values in the domain.
2. Saying a logarithm has a horizontal asymptote: it keeps growing, however slowly.
3. Splitting ln(a + b) into ln a + ln b.

   *— Show more —*
4. Setting ln(g) = 0 at g = 0: the logarithm is 0 at g = 1.

### Logarithm in a product (exact extremum, new)

Example: `x*ln(x)` → f(x) = x*ln(x): domain: x > 0; range: y ≥ -1/e; no y-intercept; x-intercept at x = 1; local minimum (1/e, -1/e).

<details><summary>Working</summary>

- Analyze the function: f(x) = x*ln(x)
- Domain restriction: f is undefined for x ≤ 0 — so the domain is x > 0.
- Range: y ≥ -1/e — f is continuous for x > 0; f′ = 0 only where ln(x) + 1 = 0, at x = 1/e, where f = -1/e; and f → 0 as x → 0⁺ (the power wins) and → ∞ as x → ∞.
- y-intercept: none — x = 0 is not in the domain.
- x-intercept: x = 1.
- Differentiate: f′(x) = 1 + ln(x). f′(x) is 0 at x = 1/e (found where the slope changes sign).
- Local minimum at (1/e, -1/e): f′(x) changes from negative to positive there.
- Plot the points and sketch the graph using these features.

</details>

**Key Insights** (5)

1. x·ln(x) is defined for x > 0, and as x → 0⁺ it tends to 0: the factor x shrinks faster than ln(x) grows in size, so there is no vertical asymptote at 0, unlike ln(x) alone.
2. Here: f′(x) = 1 + ln(x) is 0 at x = 1/e, the minimum (1/e, -1/e), so the range is y ≥ -1/e.
3. The product rule gives (x·ln(x))′ = ln(x) + 1, which is 0 only at x = 1/e: negative before, positive after.

   *— Show more —*
4. A single critical point that is a minimum on an interval, with the function rising away on both sides, is the least value: the range starts there.
5. The zeros are where a factor is 0 inside the domain: ln(x) = 0 at x = 1 (the factor x is 0 only at the excluded 0).

**Common Mistakes** (3)

1. Giving x·ln(x) a vertical asymptote at 0 because ln(x) has one.
2. Differentiating x·ln(x) as 1/x: the product rule adds ln(x)·1.
3. Listing x = 0 as an x-intercept: it is not in the domain.

### Rational, vertical asymptote

Example: `1/(x-2)` → f(x) = 1/(x - 2): domain: x ≠ 2; range: y ≠ 0; y-intercept (0, -1/2); no x-intercepts; vertical asymptote x = 2; horizontal asymptote y = 0.

**Key Insights** (6)

1. Factor the numerator and the denominator and cancel common factors. Then look at each excluded input in the simplified form: a finite value there is a hole; a zero of the simplified denominator is a vertical asymptote (x/x^2 = 1/x still has one at 0).
2. Here: the denominator is 0 at x = 2 and nothing cancels, so that is a vertical asymptote; the degrees give y = 0.
3. The horizontal asymptote comes from the degrees: top lower → y = 0; equal → the ratio of the leading coefficients; top higher by one → a slant asymptote, the quotient of the division.

   *— Show more —*
4. Test the sign on each side of a vertical asymptote to see whether the curve goes up or down there.
5. A denominator with no real roots (x^2 + 1) excludes nothing: the domain is all real numbers.
6. The x-intercepts are the zeros of the numerator that are not zeros of the denominator.

**Common Mistakes** (5)

1. Calling a hole an asymptote: after cancelling, the function is defined everywhere near the hole except at that one point.
2. Calling every cancelled factor a hole: x/x^2 cancels to 1/x, which still blows up at 0.
3. Thinking a graph can never cross its horizontal asymptote: it can, for finite x; the asymptote describes the ends.

   *— Show more —*
4. Taking a zero shared by the numerator and the denominator as an x-intercept: the original function is undefined there. Simplify, then check whether that point is a hole or a vertical asymptote.
5. Using the ratio of leading coefficients when the degrees differ: that rule is for equal degrees only.

### Rational, hole

Example: `(x^2-1)/(x-1)` → f(x) = (x^2 - 1)/(x - 1): domain: x ≠ 1; y-intercept (0, 1); x-intercept at x = -1; hole at (1, 2).

<details><summary>Working</summary>

- Analyze the function: f(x) = (x^2 - 1)/(x - 1)
- Domain restriction: f is undefined for x = 1 — so the domain is x ≠ 1.
- Hole (removable discontinuity) at (1, 2): the function is undefined at x = 1, but it does not blow up there — the graph is a single point short of continuous. Simplifying, f(x) = x + 1 for every x ≠ 1: a common factor cancels, but the original is still undefined at x = 1.
- y-intercept: f(0) = 1, so the graph crosses the y-axis at (0, 1).
- x-intercept: x = -1.
- Differentiate: f′(x) = 1. f′(x) is never 0 (it is the constant 1), so there are no stationary points.
- Plot the points and sketch the graph using these features.

</details>

**Key Insights** (7)

1. Factor the numerator and the denominator and cancel common factors. Then look at each excluded input in the simplified form: a finite value there is a hole; a zero of the simplified denominator is a vertical asymptote (x/x^2 = 1/x still has one at 0).
2. Here: (x^2 - 1)/(x - 1) = x + 1 for x ≠ 1, so there is a hole at (1, 2).
3. A hole sits where a cancelled factor was 0, when the simplified function has a finite value there; that value is its height.

   *— Show more —*
4. The horizontal asymptote comes from the degrees: top lower → y = 0; equal → the ratio of the leading coefficients; top higher by one → a slant asymptote, the quotient of the division.
5. Test the sign on each side of a vertical asymptote to see whether the curve goes up or down there.
6. A denominator with no real roots (x^2 + 1) excludes nothing: the domain is all real numbers.
7. The x-intercepts are the zeros of the numerator that are not zeros of the denominator.

**Common Mistakes** (5)

1. Calling a hole an asymptote: after cancelling, the function is defined everywhere near the hole except at that one point.
2. Calling every cancelled factor a hole: x/x^2 cancels to 1/x, which still blows up at 0.
3. Thinking a graph can never cross its horizontal asymptote: it can, for finite x; the asymptote describes the ends.

   *— Show more —*
4. Taking a zero shared by the numerator and the denominator as an x-intercept: the original function is undefined there. Simplify, then check whether that point is a hole or a vertical asymptote.
5. Using the ratio of leading coefficients when the degrees differ: that rule is for equal degrees only.

### Rational, slant asymptote (new)

Example: `(x^2+1)/(x-1)` → f(x) = (x^2 + 1)/(x - 1): domain: x ≠ 1; y-intercept (0, -1); no x-intercepts; local maximum (1 - √2, 2 - 2√2); local minimum (1 + √2, 2 + 2√2); vertical asymptote x = 1; slant asymptote y = x + 1.

<details><summary>Working</summary>

- Analyze the function: f(x) = (x^2 + 1)/(x - 1)
- Domain restriction: f is undefined for x = 1 — so the domain is x ≠ 1.
- y-intercept: f(0) = -1, so the graph crosses the y-axis at (0, -1).
- x-intercepts: none — the graph never crosses the x-axis.
- Differentiate: f′(x) = (x^2 - 2x - 1)/(x - 1)^2. Set f′(x) = 0: (x^2 - 2x - 1)/(x - 1)^2 = 0 at x = 1 - √2, 1 + √2.
- Local maximum at (1 - √2, 2 - 2√2): f′(x) changes from positive to negative there.
- Local minimum at (1 + √2, 2 + 2√2): f′(x) changes from negative to positive there.
- Vertical asymptote: x = 1 — the function blows up there.
- Slant asymptote: y = x + 1. The top's degree is one more than the bottom's, so divide: f(x) = x + 1 + 2/(x - 1), and the fraction → 0 as x → ±∞.
- Plot the points and sketch the graph using these features.

</details>

**Key Insights** (7)

1. Factor the numerator and the denominator and cancel common factors. Then look at each excluded input in the simplified form: a finite value there is a hole; a zero of the simplified denominator is a vertical asymptote (x/x^2 = 1/x still has one at 0).
2. Here: dividing, (x^2 + 1)/(x - 1) = x + 1 + 2/(x - 1), so the slant asymptote is y = x + 1.
3. When the top's degree is one more than the bottom's, divide: f = (ax + b) + r/q, and y = ax + b is the slant asymptote, since r/q → 0.

   *— Show more —*
4. The horizontal asymptote comes from the degrees: top lower → y = 0; equal → the ratio of the leading coefficients; top higher by one → a slant asymptote, the quotient of the division.
5. Test the sign on each side of a vertical asymptote to see whether the curve goes up or down there.
6. A denominator with no real roots (x^2 + 1) excludes nothing: the domain is all real numbers.
7. The x-intercepts are the zeros of the numerator that are not zeros of the denominator.

**Common Mistakes** (5)

1. Calling a hole an asymptote: after cancelling, the function is defined everywhere near the hole except at that one point.
2. Calling every cancelled factor a hole: x/x^2 cancels to 1/x, which still blows up at 0.
3. Thinking a graph can never cross its horizontal asymptote: it can, for finite x; the asymptote describes the ends.

   *— Show more —*
4. Taking a zero shared by the numerator and the denominator as an x-intercept: the original function is undefined there. Simplify, then check whether that point is a hole or a vertical asymptote.
5. Using the ratio of leading coefficients when the degrees differ: that rule is for equal degrees only.

### Rational, no real poles (domain proved, new)

Example: `x/(x^2+1)` → f(x) = x/(x^2 + 1): domain: all real numbers; range: -1/2 ≤ y ≤ 1/2; y-intercept (0, 0); x-intercept at x = 0; local minimum (-1, -1/2); local maximum (1, 1/2); horizontal asymptote y = 0.

<details><summary>Working</summary>

- Analyze the function: f(x) = x/(x^2 + 1)
- Domain: all real numbers — the denominator x^2 + 1 has no real roots (it is never 0), so nothing is excluded.
- Range: -1/2 ≤ y ≤ 1/2 — the denominator is never 0, so f is continuous on every real number; its critical points are x = -1, 1, with values -1/2, 1/2; and f → 0 as x → −∞ and → 0 as x → ∞. So f takes every value between its least and greatest.
- y-intercept: f(0) = 0, so the graph crosses the y-axis at (0, 0).
- x-intercept: x = 0.
- Differentiate: f′(x) = (-x^2 + 1)/(x^2 + 1)^2. Set f′(x) = 0: (-x^2 + 1)/(x^2 + 1)^2 = 0 at x = -1, 1.
- Local minimum at (-1, -1/2): f′(x) changes from negative to positive there.
- Local maximum at (1, 1/2): f′(x) changes from positive to negative there.
- Horizontal asymptote: y = 0 as x → ±∞.
- Plot the points and sketch the graph using these features.

</details>

**Key Insights** (6)

1. Factor the numerator and the denominator and cancel common factors. Then look at each excluded input in the simplified form: a finite value there is a hole; a zero of the simplified denominator is a vertical asymptote (x/x^2 = 1/x still has one at 0).
2. Here: the denominator x^2 + 1 has no real roots (it is never 0), so nothing is excluded.
3. The horizontal asymptote comes from the degrees: top lower → y = 0; equal → the ratio of the leading coefficients; top higher by one → a slant asymptote, the quotient of the division.

   *— Show more —*
4. Test the sign on each side of a vertical asymptote to see whether the curve goes up or down there.
5. A denominator with no real roots (x^2 + 1) excludes nothing: the domain is all real numbers.
6. The x-intercepts are the zeros of the numerator that are not zeros of the denominator.

**Common Mistakes** (5)

1. Calling a hole an asymptote: after cancelling, the function is defined everywhere near the hole except at that one point.
2. Calling every cancelled factor a hole: x/x^2 cancels to 1/x, which still blows up at 0.
3. Thinking a graph can never cross its horizontal asymptote: it can, for finite x; the asymptote describes the ends.

   *— Show more —*
4. Taking a zero shared by the numerator and the denominator as an x-intercept: the original function is undefined there. Simplify, then check whether that point is a hole or a vertical asymptote.
5. Using the ratio of leading coefficients when the degrees differ: that rule is for equal degrees only.

### Exponential

Example: `e^x - 2` → f(x) = e^x - 2: domain: all real numbers; range: y > -2; y-intercept (0, -1); x-intercept at x = ln(2); strictly increasing, no extrema; horizontal asymptote y = -2 as x → −∞.

<details><summary>Working</summary>

- Analyze the function: f(x) = e^x - 2
- Domain: all real numbers — polynomials, sin, cos, eˣ and absolute values, and their sums, products and compositions, are defined for every real input.
- Range: y > -2 — e^u is always positive and takes every positive value, so a·e^u − 2 with a > 0 stays above its asymptote y = -2.
- y-intercept: f(0) = -1, so the graph crosses the y-axis at (0, -1).
- x-intercept: x = ln(2).
- Differentiate: f′(x) = e^x. f′(x) is never 0 (a positive base to any power is positive), so there are no stationary points: f is strictly increasing.
- Horizontal asymptote: y = -2 as x → −∞ only.
- Plot the points and sketch the graph using these features.

</details>

**Key Insights** (5)

1. a·b^x + k (with b > 0, b ≠ 1) has the horizontal asymptote y = k on one side, and never reaches it: b^x is positive for every x.
2. Here: the horizontal asymptote is y = -2, the range is y > -2, and it crosses the x-axis at x = ln(2).
3. b^x grows for b > 1 and decays for 0 < b < 1; it passes through (0, 1).

   *— Show more —*
4. The x-intercept of a·b^x + k solves b^x = −k/a: one when −k/a > 0, by a logarithm, and none otherwise.
5. A shift up or down moves the horizontal asymptote with it; the range is everything on one side of it.

**Common Mistakes** (3)

1. Giving e^x an x-intercept: e^x = 0 has no solution.
2. Treating exponential growth like a power: it eventually outgrows every polynomial.
3. Forgetting that e^(−x) decays: the minus sign flips the graph.

### Product with an exponential

Example: `x*e^(-x)` → f(x) = x*e^(-x): domain: all real numbers; range: y ≤ 1/e; y-intercept (0, 0); x-intercept at x = 0; local maximum (1, 1/e); horizontal asymptote y = 0 as x → ∞.

**Key Insights** (5)

1. e^(…) is never 0, so the zeros of a product with it are the zeros of the other factor, and so are the zeros of its derivative once e^(…) is factored out.
2. Here: f′(x) = e^(-x)*(-x + 1), and only the factor without the exponential can be 0: a maximum (1, 1/e).
3. A polynomial times e^(−x) tends to 0 as x → ∞: the exponential wins over every power, which is the horizontal asymptote on that side.

   *— Show more —*
4. Extrema come from f′ = 0 with the product rule: (x·e^(−x))′ = e^(−x)(1 − x).
5. The two ends differ: x·e^(−x) → 0 on the right and → −∞ on the left.

**Common Mistakes** (3)

1. Giving e^(…) a zero: the x-intercepts come from the other factor only.
2. Dropping the product rule: (x·e^(−x))′ is e^(−x) − x·e^(−x), not −e^(−x).
3. Assuming the same end behaviour on both sides: e^(−x) shrinks on the right and grows on the left.

### Square root

Example: `sqrt(x-2)` → f(x) = sqrt(x - 2): domain: x ≥ 2; range: y ≥ 0; no y-intercept; x-intercept at x = 2; absolute minimum (2, 0) at the domain endpoint.

**Key Insights** (5)

1. A square root needs a radicand ≥ 0: solve that inequality for the domain.
2. Here: the radicand is ≥ 0 on the domain, and the graph starts at (2, 0), its minimum there.
3. √x starts at the edge of its domain and rises slowly; that starting point is its minimum.

   *— Show more —*
4. The range starts at 0 (or the shift) and has no upper bound.
5. √(r^2 − x^2) is the top half of a circle of radius r: its domain is −r ≤ x ≤ r and its range 0 ≤ y ≤ r.

**Common Mistakes** (3)

1. Including values that make the radicand negative.
2. Missing the endpoint minimum because there is no turning point there.
3. Writing √(a + b) as √a + √b.

### Semicircle

Example: `sqrt(4-x^2)` → f(x) = sqrt(4 - x^2): domain: -2 ≤ x ≤ 2; range: 0 ≤ y ≤ 2; y-intercept (0, 2); x-intercepts at x = -2, 2; local maximum (0, 2); minimum (-2, 0) at the domain endpoint; minimum (2, 0) at the domain endpoint.

**Key Insights** (5)

1. A square root needs a radicand ≥ 0: solve that inequality for the domain.
2. Here: the graph runs from (-2, 0) up to its highest point (0, 2) and down to (2, 0), so the range is 0 ≤ y ≤ 2.
3. √x starts at the edge of its domain and rises slowly; that starting point is its minimum.

   *— Show more —*
4. The range starts at 0 (or the shift) and has no upper bound, unless the radicand is bounded above, as in a semicircle.
5. √(r^2 − x^2) is the top half of a circle of radius r: its domain is −r ≤ x ≤ r and its range 0 ≤ y ≤ r.

**Common Mistakes** (3)

1. Including values that make the radicand negative.
2. Missing the endpoint minimum because there is no turning point there.
3. Writing √(a + b) as √a + √b.

### Polynomial, odd degree (range proved, new)

Example: `x^3 - 3x` → f(x) = x^3 - 3x: domain: all real numbers; range: all real numbers; y-intercept (0, 0); x-intercepts at x = -√3, 0, √3; local maximum (-1, 2); local minimum (1, -2); inflection at x = 0.

<details><summary>Working</summary>

- Analyze the function: f(x) = x^3 - 3x
- Domain: all real numbers — polynomials, sin, cos, eˣ and absolute values, and their sums, products and compositions, are defined for every real input.
- Range: all real numbers — an odd-degree polynomial goes to −∞ at one end and +∞ at the other, and it is continuous, so it takes every value in between.
- y-intercept: f(0) = 0, so the graph crosses the y-axis at (0, 0).
- x-intercepts: x = -√3, 0, √3.
- Differentiate: f′(x) = 3x^2 - 3. Set f′(x) = 0: 3x^2 - 3 = 0 at x = -1, 1.
- Local maximum at (-1, 2): f′(x) changes from positive to negative there.
- Local minimum at (1, -2): f′(x) changes from negative to positive there.
- Inflection point (concavity changes): x = 0.
- Plot the points and sketch the graph using these features.

</details>

**Key Insights** (6)

1. Critical points come from solving f′(x) = 0; the sign of f′ on each side says maximum, minimum or neither.
2. Here: f′(x) = 3x^2 - 3 is 0 at x = -1, 1, and it changes sign at each: a maximum (-1, 2), a minimum (1, -2).
3. The leading term decides the ends: x^3 falls on the left and rises on the right; −x^4 falls on both sides.

   *— Show more —*
4. A polynomial of degree n has at most n real roots and at most n − 1 turning points; inflection points are where f″ changes sign.
5. An odd-degree polynomial takes every real value; an even-degree one has a least value (positive leading coefficient) or a greatest, at a critical point.
6. A root of even multiplicity touches the axis without crossing ((x − 1)^2 at x = 1); a root of odd multiplicity crosses, even when repeated ((x − 1)^3).

**Common Mistakes** (5)

1. Calling every root of f′ an extremum: x^3 has f′(0) = 0 but no turning point.
2. Reading the end behaviour from the constant term instead of the leading term.
3. Confusing an x-intercept (f(x) = 0) with the y-intercept (x = 0).

   *— Show more —*
4. Missing a root where the graph only touches the axis: a sign change finds crossings, not touches.
5. Thinking every repeated root only touches the axis: (x − 1)^3 crosses it at x = 1.

### Polynomial, even degree (range proved, new)

Example: `x^4 - 2x^2` → f(x) = x^4 - 2x^2: domain: all real numbers; range: y ≥ -1; y-intercept (0, 0); x-intercepts at x = -√2, 0, √2; local minimum (-1, -1); local maximum (0, 0); local minimum (1, -1); inflection at x = -1/√3, 1/√3.

<details><summary>Working</summary>

- Analyze the function: f(x) = x^4 - 2x^2
- Domain: all real numbers — polynomials, sin, cos, eˣ and absolute values, and their sums, products and compositions, are defined for every real input.
- Range: y ≥ -1 — an even-degree polynomial with a positive leading coefficient rises at both ends, so its least value is at a critical point; the real roots of f′ are all found, and the lowest value there is -1.
- y-intercept: f(0) = 0, so the graph crosses the y-axis at (0, 0).
- x-intercepts: x = -√2, 0, √2.
- Differentiate: f′(x) = 4x^3 - 4x. Set f′(x) = 0: 4x^3 - 4x = 0 at x = -1, 0, 1.
- Local minimum at (-1, -1): f′(x) changes from negative to positive there.
- Local maximum at (0, 0): f′(x) changes from positive to negative there.
- Local minimum at (1, -1): f′(x) changes from negative to positive there.
- Inflection points (concavity changes): x = -1/√3, 1/√3.
- Plot the points and sketch the graph using these features.

</details>

**Key Insights** (6)

1. Critical points come from solving f′(x) = 0; the sign of f′ on each side says maximum, minimum or neither.
2. Here: f′(x) = 4x^3 - 4x is 0 at x = -1, 0, 1, and it changes sign at each: a minimum (-1, -1), a maximum (0, 0), a minimum (1, -1).
3. The leading term decides the ends: x^3 falls on the left and rises on the right; −x^4 falls on both sides.

   *— Show more —*
4. A polynomial of degree n has at most n real roots and at most n − 1 turning points; inflection points are where f″ changes sign.
5. An odd-degree polynomial takes every real value; an even-degree one has a least value (positive leading coefficient) or a greatest, at a critical point.
6. A root of even multiplicity touches the axis without crossing ((x − 1)^2 at x = 1); a root of odd multiplicity crosses, even when repeated ((x − 1)^3).

**Common Mistakes** (5)

1. Calling every root of f′ an extremum: x^3 has f′(0) = 0 but no turning point.
2. Reading the end behaviour from the constant term instead of the leading term.
3. Confusing an x-intercept (f(x) = 0) with the y-intercept (x = 0).

   *— Show more —*
4. Missing a root where the graph only touches the axis: a sign change finds crossings, not touches.
5. Thinking every repeated root only touches the axis: (x − 1)^3 crosses it at x = 1.

### Repeated root (fixed)

Example: `(x^2-3)^2` → f(x) = (x^2 - 3)^2: domain: all real numbers; range: y ≥ 0; y-intercept (0, 9); x-intercepts at x = -√3, √3; local minimum (-√3, 0); local maximum (0, 9); local minimum (√3, 0); inflection at x = -1, 1.

<details><summary>Working</summary>

- Analyze the function: f(x) = (x^2 - 3)^2
- Domain: all real numbers — polynomials, sin, cos, eˣ and absolute values, and their sums, products and compositions, are defined for every real input.
- Range: y ≥ 0 — an even-degree polynomial with a positive leading coefficient rises at both ends, so its least value is at a critical point; the real roots of f′ are all found, and the lowest value there is 0.
- y-intercept: f(0) = 9, so the graph crosses the y-axis at (0, 9).
- x-intercepts: x = -√3, √3.
- Differentiate: f′(x) = 4x^3 - 12x. Set f′(x) = 0: 4x^3 - 12x = 0 at x = 0, -√3, √3.
- Local minimum at (-√3, 0): f′(x) changes from negative to positive there.
- Local maximum at (0, 9): f′(x) changes from positive to negative there.
- Local minimum at (√3, 0): f′(x) changes from negative to positive there.
- Inflection points (concavity changes): x = -1, 1.
- Plot the points and sketch the graph using these features.

</details>

**Key Insights** (6)

1. Critical points come from solving f′(x) = 0; the sign of f′ on each side says maximum, minimum or neither.
2. Here: f′(x) = 4x^3 - 12x is 0 at x = -√3, 0, √3, and it changes sign at each: a minimum (-√3, 0), a maximum (0, 9), a minimum (√3, 0).
3. The leading term decides the ends: x^3 falls on the left and rises on the right; −x^4 falls on both sides.

   *— Show more —*
4. A polynomial of degree n has at most n real roots and at most n − 1 turning points; inflection points are where f″ changes sign.
5. An odd-degree polynomial takes every real value; an even-degree one has a least value (positive leading coefficient) or a greatest, at a critical point.
6. A root of even multiplicity touches the axis without crossing ((x − 1)^2 at x = 1); a root of odd multiplicity crosses, even when repeated ((x − 1)^3).

**Common Mistakes** (5)

1. Calling every root of f′ an extremum: x^3 has f′(0) = 0 but no turning point.
2. Reading the end behaviour from the constant term instead of the leading term.
3. Confusing an x-intercept (f(x) = 0) with the y-intercept (x = 0).

   *— Show more —*
4. Missing a root where the graph only touches the axis: a sign change finds crossings, not touches.
5. Thinking every repeated root only touches the axis: (x − 1)^3 crosses it at x = 1.

### Not a polynomial: sin(x)/x

Example: `sin(x)/x` → f(x) = sin(x)/x: domain: x ≠ 0; no y-intercept; x-intercepts at x = nπ (n any nonzero integer); in -10 ≤ x ≤ 10: local maximum ≈ (-7.7253, 0.1284), local minimum ≈ (-4.4934, -0.2172), local minimum ≈ (4.4934, -0.2172), local maximum ≈ (7.7253, 0.1284); hole at (0, 1); horizontal asymptote y = 0.

<details><summary>Working</summary>

- Analyze the function: f(x) = sin(x)/x
- Domain restriction: f is undefined for x = 0 — so the domain is x ≠ 0.
- Hole (removable discontinuity) at (0, 1): the function is undefined at x = 0, but it does not blow up there — the graph is a single point short of continuous.
- y-intercept: none — x = 0 is not in the domain; the graph approaches (0, 1) without containing it.
- x-intercepts: the numerator is 0 at x = nπ, but the function is undefined where the denominator is 0 too, so x = nπ (n any nonzero integer).
- Differentiate: f′(x) = -sin(x)/(x^2) + cos(x)/x. f′(x) is 0 at x ≈ -7.7253, -4.4934, 4.4934, 7.7253 (found where the slope changes sign, and located numerically).
- Local extrema found in the analysed window -10 ≤ x ≤ 10 (there may be more outside it):
- Local maximum at ≈ (-7.7253, 0.1284): f′(x) changes from positive to negative there.
- Local minimum at ≈ (-4.4934, -0.2172): f′(x) changes from negative to positive there.
- Local minimum at ≈ (4.4934, -0.2172): f′(x) changes from negative to positive there.
- Local maximum at ≈ (7.7253, 0.1284): f′(x) changes from positive to negative there.
- Horizontal asymptote: y = 0 as x → ±∞.
- Plot the points and sketch the graph using these features.

</details>

**Key Insights** (5)

1. Domain first, then intercepts, then the derivative for extrema and the second derivative for concavity, then what happens at the ends.
2. Here: f′(x) = -sin(x)/(x^2) + cos(x)/x is 0 at x ≈ -7.7253, -4.4934, 4.4934, 7.7253 (located numerically), and it changes sign at each: a maximum ≈ (-7.7253, 0.1284), a minimum ≈ (-4.4934, -0.2172), a minimum ≈ (4.4934, -0.2172), a maximum ≈ (7.7253, 0.1284).
3. Critical points come from solving f′(x) = 0 and from where f′ does not exist; the sign of f′ on each side says maximum, minimum or neither.

   *— Show more —*
4. A point located numerically is shown with ≈: its exact value may have no closed form (the extrema of sin(x)/x solve tan(x) = x).
5. Check each feature by substituting: a claimed intercept must give 0, a claimed extremum must beat its neighbours.

**Common Mistakes** (3)

1. Calling every root of f′ an extremum: f′ must change sign there.
2. Reading the end behaviour from a few plotted points instead of the dominant term for large x.
3. Confusing an x-intercept (f(x) = 0) with the y-intercept (x = 0).

### A cancelled factor that leaves an asymptote

Example: `x/x^2` → f(x) = x/x^2: domain: x ≠ 0; no y-intercept; no x-intercepts; vertical asymptote x = 0; horizontal asymptote y = 0.

<details><summary>Working</summary>

- Analyze the function: f(x) = x/x^2
- Domain restriction: f is undefined for x = 0 — so the domain is x ≠ 0.
- y-intercept: none — x = 0 is not in the domain.
- x-intercepts: none — the graph never crosses the x-axis.
- Differentiate: f′(x) = -1/(x^2). f′(x) is never 0 (a fraction is 0 only when its numerator is, and this numerator never is), so there are no stationary points.
- Vertical asymptote: x = 0 — the function blows up there.
- Horizontal asymptote: y = 0 as x → ±∞.
- Plot the points and sketch the graph using these features.

</details>

**Key Insights** (6)

1. Factor the numerator and the denominator and cancel common factors. Then look at each excluded input in the simplified form: a finite value there is a hole; a zero of the simplified denominator is a vertical asymptote (x/x^2 = 1/x still has one at 0).
2. Here: x/x^2 = 1/x for x ≠ 0, and the simplified denominator is still 0 there, so that is a vertical asymptote, not a hole.
3. The horizontal asymptote comes from the degrees: top lower → y = 0; equal → the ratio of the leading coefficients; top higher by one → a slant asymptote, the quotient of the division.

   *— Show more —*
4. Test the sign on each side of a vertical asymptote to see whether the curve goes up or down there.
5. A denominator with no real roots (x^2 + 1) excludes nothing: the domain is all real numbers.
6. The x-intercepts are the zeros of the numerator that are not zeros of the denominator.

**Common Mistakes** (5)

1. Calling a hole an asymptote: after cancelling, the function is defined everywhere near the hole except at that one point.
2. Calling every cancelled factor a hole: x/x^2 cancels to 1/x, which still blows up at 0.
3. Thinking a graph can never cross its horizontal asymptote: it can, for finite x; the asymptote describes the ends.

   *— Show more —*
4. Taking a zero shared by the numerator and the denominator as an x-intercept: the original function is undefined there. Simplify, then check whether that point is a hole or a vertical asymptote.
5. Using the ratio of leading coefficients when the degrees differ: that rule is for equal degrees only.

### Absolute value of a wave (fixed)

Example: `abs(sin(x))` → f(x) = abs(sin(x)): domain: all real numbers; range: 0 ≤ y ≤ 1; y-intercept (0, 0); x-intercepts at x = nπ; maxima at x = π/2 + nπ (value 1), minima at x = nπ (value 0), period π (n any integer); periodic.

<details><summary>Working</summary>

- Analyze the function: f(x) = abs(sin(x))
- Domain: all real numbers — polynomials, sin, cos, eˣ and absolute values, and their sums, products and compositions, are defined for every real input.
- Range: 0 ≤ y ≤ 1 — |sin(x)| is 0 where the inside is 0 and at most 1, where sin is ±1.
- y-intercept: f(0) = 0, so the graph crosses the y-axis at (0, 0).
- x-intercepts: |sin(x)| = 0 exactly where sin(x) = 0, so x = nπ (n any integer). The graph touches the axis there without crossing.
- Differentiate: f′(x) = cos(x)*sgn(sin(x)). f′(x) is 0 at x = -3π/2, -π/2, π/2 (found where the slope changes sign).
- Maxima: |sin(x)| = 1 at x = π/2 + nπ. Minima: 0 at the corners x = nπ (n any integer). The period is π.
- This is a periodic function — its pattern of zeros and extrema repeats forever.
- Plot the points and sketch the graph using these features.

</details>

**Key Insights** (5)

1. An absolute value is piecewise: |g| is g where g ≥ 0 and −g where g < 0. The zeros of g are where corners can be: there is a corner where g changes sign with a nonzero slope (the slopes on the two sides then disagree), but |x^2| = x^2 is smooth at 0.
2. Here: the corners are where sin(x) = 0, at x = nπ: minima of value 0, with maxima 1 halfway between, so the range is 0 ≤ y ≤ 1.
3. Critical points are where f′ = 0 OR where f′ does not exist; a corner can be a maximum or a minimum.

   *— Show more —*
4. Where g = 0, |g| touches 0: that point is an x-intercept, even though the graph does not cross there.
5. |g| ≥ 0 always: for a > 0, if g is 0 somewhere, then k is the least value of a|g| + k (for a < 0, the greatest). The rest of the range depends on how large |g| gets: |sin(x)| stays between 0 and 1.

**Common Mistakes** (4)

1. Saying there is no extremum because f′ is never 0: the minimum of |x| is at the corner.
2. Reporting f′ = 0 at a corner: the derivative does not exist there. (Not every zero of the inside is a corner: check the slopes on each side.)
3. Differentiating |x| as if it were x, giving 1 everywhere.

   *— Show more —*
4. Missing an intercept where the graph only touches the axis: a sign check finds crossings, not touches.

### A negative frequency (fixed)

Example: `sin(-2x)` → f(x) = sin(-2x): domain: all real numbers; range: -1 ≤ y ≤ 1; y-intercept (0, 0); x-intercepts at x = nπ/2; maxima at x = -π/4 + nπ (value 1), minima at x = π/4 + nπ (value -1), period π (n any integer); periodic.

<details><summary>Working</summary>

- Analyze the function: f(x) = sin(-2x)
- Domain: all real numbers — polynomials, sin, cos, eˣ and absolute values, and their sums, products and compositions, are defined for every real input.
- Range: -1 ≤ y ≤ 1 — sin swings between −1 and 1, so a·sin(…) + k swings between k − |a| = -1 and k + |a| = 1.
- y-intercept: f(0) = 0, so the graph crosses the y-axis at (0, 0).
- x-intercepts: f(x) = 0 when sin(-2x) = 0, so x = nπ/2 (n any integer).
- Differentiate: f′(x) = -2cos(2x). f′(x) is 0 at x = -5π/4, -3π/4, -π/4, π/4, 3π/4, 5π/4 (found where the slope changes sign).
- Maxima: sin = −1 at x = -π/4 + nπ, where f = 1. Minima: sin = 1 at x = π/4 + nπ, where f = -1 (n any integer). The period is π.
- This is a periodic function — its pattern of zeros and extrema repeats forever.
- Plot the points and sketch the graph using these features.

</details>

**Key Insights** (6)

1. A·sin(kx) + d and A·cos(kx) + d (with k ≠ 0) have amplitude |A|, period 2π/|k| and midline y = d.
2. Here: A = 1, k = -2 and d = 0, so the amplitude is 1, the period 2π/|-2| = π and the midline y = 0.
3. Analyse one period, then repeat: every intercept and extremum comes back each period, so give them as patterns in n.

   *— Show more —*
4. The range is the midline plus or minus the amplitude: d − |A| ≤ y ≤ d + |A|.
5. sin = c has two solutions per period when |c| < 1: arcsin(c) and π − arcsin(c); cos = c has ±arccos(c). None when |c| > 1.
6. Maxima are where the sine or cosine is 1 (or −1 when A < 0), minima the other way.

**Common Mistakes** (4)

1. Forgetting the k: the period of sin(2x) is π, not 2π; sin(−2x) has period π too, not −π.
2. Listing a few intercepts as if they were all of them, instead of giving the pattern with n.
3. Reading the amplitude off the first peak without the midline: A·sin(kx) + d peaks at d + |A|.

   *— Show more —*
4. Giving only arcsin(c): the second solution in each period, π − arcsin(c), is missed.

### A triple root crosses

Example: `(x-1)^3` → f(x) = (x - 1)^3: domain: all real numbers; range: all real numbers; y-intercept (0, -1); x-intercept at x = 1; strictly increasing, no extrema; inflection at x = 1.

**Key Insights** (6)

1. Critical points come from solving f′(x) = 0; the sign of f′ on each side says maximum, minimum or neither.
2. Here: f′(x) = 3(x - 1)^2 is 0 at x = 1 but does not change sign there, so there is no maximum or minimum, and the graph crosses the x-axis at x = 1.
3. The leading term decides the ends: x^3 falls on the left and rises on the right; −x^4 falls on both sides.

   *— Show more —*
4. A polynomial of degree n has at most n real roots and at most n − 1 turning points; inflection points are where f″ changes sign.
5. An odd-degree polynomial takes every real value; an even-degree one has a least value (positive leading coefficient) or a greatest, at a critical point.
6. A root of even multiplicity touches the axis without crossing ((x − 1)^2 at x = 1); a root of odd multiplicity crosses, even when repeated ((x − 1)^3).

**Common Mistakes** (5)

1. Calling every root of f′ an extremum: x^3 has f′(0) = 0 but no turning point.
2. Reading the end behaviour from the constant term instead of the leading term.
3. Confusing an x-intercept (f(x) = 0) with the y-intercept (x = 0).

   *— Show more —*
4. Missing a root where the graph only touches the axis: a sign change finds crossings, not touches.
5. Thinking every repeated root only touches the axis: (x − 1)^3 crosses it at x = 1.

