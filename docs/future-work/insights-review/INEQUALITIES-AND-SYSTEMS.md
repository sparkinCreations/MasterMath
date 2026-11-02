# Insights review: Inequalities and systems (1.66.0)

**Written:** November 1, 2026
**For:** MJ, to spot-check before 1.66.0 is pushed
**Revised:** after two outside reviews (the second: "conditional approval", one consistency correction); every claim and verdict is Rounds 34–35 of [`../../evaluations/2026-10/REVIEW-LOG-2026-10.md`](../../evaluations/2026-10/REVIEW-LOG-2026-10.md)
**Plan:** [`../PLAN-INSIGHTS-AND-RESOURCES.md`](../PLAN-INSIGHTS-AND-RESOURCES.md) · **Before this:** [Integrals](INTEGRALS.md), [Derivatives](DERIVATIVES.md), [Algebra](ALGEBRA.md), [Limits](LIMITS.md), [Functions](FUNCTIONS.md), [Trigonometry](TRIGONOMETRY.md)

Generated from the solver, so it is exactly what a student sees for each
example (formulas as plain text here, typeset on the page). The first three
of each list show; **"Show more"** opens the rest. Where the working
changed, it is included (open "Working").

## What to check

1. **Order:** is the most useful insight first for each method?
2. **Accuracy and wording**, especially the new working: the step that says
   why a list of zeros is complete (turning points, convexity, the
   half-angle polynomial), the boundary points decided at the point, the
   cancelled factor's hole, and the ≈ on numerically located endpoints.
3. **Missing:** an insight or mistake a student needs that is not here.

## Built in from the start (the lessons of the first six topics)

- **The second insight works the student's own problem**, from the values
  the steps were written from: the division that reverses or keeps the
  sign; the zeros and the sign on each interval, with a zero of even
  multiplicity named; the denominator's zero left out; |g| < c unfolded;
  where a logarithm or root is defined; the turning points; the zeros on
  one period; the two parts of a compound inequality; a system's
  substitution, contradiction (0 = 2), parameterised line, last pivot, or
  the polynomial left after substituting.
- **Every statement says where it holds**: the |g| < c shortcut needs a
  positive number c; a denominator's zero is out even for ≤; a domain's
  edge is in only when the inequality holds there.
- **Proofs over samples**, here as everywhere: the inequality solver's
  scan of −50 ≤ x ≤ 50 and the periodic solver's grid of 1440 points are
  gone, and so is the systems solver's linearity read off whole-number
  samples.
- **Swept for wrong answers before writing:** about 120 inequalities and 30
  systems. Found and fixed:
  - **x − ln(x) > 2 lost 0 < x < 0.1586** (a root next to the domain's
    edge, stepped over), and **e^(x/20) > x lost x > 89.995** (outside the
    scan's window). Now proved: between the turning points (the zeros of
    f′, themselves proved the same way, or exact) f only rises or only
    falls, so each stretch has at most one zero, decided by the signs at
    its ends; at ±∞ and at a logarithm's edge the fastest-growing term
    decides the sign. **log(x) < 2 was x > 0** and **ln(x) > x − 2** lost
    the same stretch as x − ln(x) > 2: both right now. Exponentials of one
    rate are a polynomial in t = eˣ, solved exactly (sinh(x) > 1 is
    x > ln(1 + √2)).
  - **(x² − 1)/(x − 1) > 0 was x > −1**, x = 1 included, and **x/x > 0 was
    "No solution"**: simplifying lost the point where the typed
    expression divides by 0.
  - **√(x − 1) ≤ 0 was "No solution"** (x = 1), **√x ≥ 0 was x > 0**: a
    square root's edge was always left out. Each boundary point is decided
    by the value there, exactly where the point has an exact form.
  - **A system with x(x − 1)(x − 2)(x + 1) in it was taken for linear** and
    one solution of two reported; **y = x⁵ − 3x; y = x** showed roots with
    i in them; **a 3×3 system with no y pivot** was refused as "not a 2×2
    system".
  - **1e-6 was 1·e − 6** outside Arithmetic (x² = 1e-6 had "two unknowns,
    e and x").
  - **Display:** an endpoint located numerically is marked ≈ in the answer;
    two that round alike get more digits (1.57079 and 1.57080);
    √2000001/1000, not √3√666667/1000; sin(10x) > 0 has the period π/5,
    written πn/5.
- **Revised after the review:** a numerically located endpoint is named
  (α, β) with its decimal, never written as a rounded boundary; the
  numerator-zero rule, the half-angle proof (x = π checked on its own) and
  the second inverse value (−1 < c < 1) each say where they hold; a square
  root's domain has its own insight; a system's root count names the
  degree; a pivot with nothing to swap in leaves a free variable.
- **After the second review:** the names are used in the working too: the
  zero is named where it is found (x = α ≈ 0.1586), and every solution set
  after it reads (0, α) ∪ (β, ∞); "no elementary closed form" replaces "no
  exact answer" (x − ln(x) = 2 has roots −W(−e⁻²)).
- **No sources:** every insight here is a standard textbook fact.

## The lists: inequalities, method by method

### Linear, dividing by a negative

Example: `-2x > 4` → x < -2

<details><summary>Working</summary>

- Solve the inequality -2x > 4.
- Divide both sides by -2. Dividing by a negative number REVERSES the inequality, so > becomes <: x < -2.
- Solution: x < -2.  In interval notation: (-∞, -2).
- Check: at x = -3 the original reads 6 > 4, true; at x = -1 it reads 2 > 4, false. ✓

</details>

**Key Insights** (6)

1. Solve a linear inequality like a linear equation, with one extra rule: multiplying or dividing both sides by a negative number reverses the inequality sign.
2. Here: dividing by -2, a negative number, reverses > to <: x < -2.
3. Adding or subtracting the same amount on both sides never changes the direction, and neither does multiplying or dividing by a positive number.

   *— Show more —*
4. Check with two numbers: one from the answer must make the original true, one from outside it must make it false.
5. The boundary is part of the answer for ≤ and ≥ (a closed dot, a square bracket) and not for < and > (an open dot, a round bracket).
6. Polynomial and rational inequalities (x² − 4 > 0) need a sign chart instead: move everything to one side and test each interval.

**Common Mistakes** (4)

1. Forgetting to reverse the sign when dividing by a negative number.
2. Reversing the sign when adding or subtracting: only multiplying or dividing by a negative flips it.
3. Reading −2 > x as x > −2: read from the x, it says x < −2.

   *— Show more —*
4. Using a closed endpoint (≤, a bracket) for a strict inequality, or an open one for ≤.

### Linear, dividing by a positive

Example: `2x + 3 <= 7` → x ≤ 2

**Key Insights** (6)

1. Solve a linear inequality like a linear equation, with one extra rule: multiplying or dividing both sides by a negative number reverses the inequality sign.
2. Here: dividing by 2, a positive number, keeps ≤: x ≤ 2.
3. Adding or subtracting the same amount on both sides never changes the direction, and neither does multiplying or dividing by a positive number.

   *— Show more —*
4. Check with two numbers: one from the answer must make the original true, one from outside it must make it false.
5. The boundary is part of the answer for ≤ and ≥ (a closed dot, a square bracket) and not for < and > (an open dot, a round bracket).
6. Polynomial and rational inequalities (x² − 4 > 0) need a sign chart instead: move everything to one side and test each interval.

**Common Mistakes** (4)

1. Forgetting to reverse the sign when dividing by a negative number.
2. Reversing the sign when adding or subtracting: only multiplying or dividing by a negative flips it.
3. Reading −2 > x as x > −2: read from the x, it says x < −2.

   *— Show more —*
4. Using a closed endpoint (≤, a bracket) for a strict inequality, or an open one for ≤.

### Polynomial sign chart

Example: `x^2 - 4 > 0` → x < -2  or  x > 2

<details><summary>Working</summary>

- Solve the inequality x^2 - 4 > 0.
- Find where the expression is zero: x = -2, 2.
- These split the number line into intervals. Test the sign of x^2 - 4 in each:
-   • On (-∞, -2): x^2 - 4 is positive.
-   • On (-2, 2): x^2 - 4 is negative.
-   • On (2, ∞): x^2 - 4 is positive.
- Collect the satisfying intervals, excluding the boundary roots: x < -2  or  x > 2.
- In interval notation: (-∞, -2) ∪ (2, ∞).

</details>

**Key Insights** (6)

1. A polynomial can change sign only at its real zeros: they split the number line into intervals, and on each interval the sign is the same throughout.
2. Here: x^2 - 4 is 0 at x = -2 and 2; testing the intervals gives (-∞, -2) positive, (-2, 2) negative, (2, ∞) positive, so x < -2  or  x > 2.
3. One test point per interval is enough: a polynomial cannot change sign without passing through 0, and there is no zero inside an interval.

   *— Show more —*
4. At a zero of odd multiplicity the sign changes; at a zero of even multiplicity, such as x = 1 in (x − 1)², it does not, and the intervals on both sides share a sign.
5. For ≤ and ≥ the zeros themselves are solutions; for < and > they are not.
6. Move everything to one side first and compare with 0: the sign of one expression is what the chart reads.

**Common Mistakes** (4)

1. Dividing both sides by an expression in x: x² > x divided by x gives x > 1 and loses x < 0, because the sign of x is unknown.
2. Reporting the zeros as the answer: they are only the places where the sign can change.
3. Assuming the signs alternate from interval to interval: at a zero of even multiplicity they do not.

   *— Show more —*
4. Taking square roots of x² > 4 as x > 2: it is |x| > 2, that is x < −2 or x > 2.

### Polynomial with a double zero

Example: `(x-1)^2*(x+2) >= 0` → x ≥ -2

<details><summary>Working</summary>

- Solve the inequality (x - 1)^2*(x + 2) ≥ 0.
- Find where the expression is zero: x = -2, 1.
- These split the number line into intervals. Test the sign of (x - 1)^2*(x + 2) in each:
-   • On (-∞, -2): (x - 1)^2*(x + 2) is negative.
-   • On (-2, 1): (x - 1)^2*(x + 2) is positive.
-   • On (1, ∞): (x - 1)^2*(x + 2) is positive.
- Collect the satisfying intervals, including the boundary roots: x ≥ -2.
- In interval notation: [-2, ∞).

</details>

**Key Insights** (6)

1. A polynomial can change sign only at its real zeros: they split the number line into intervals, and on each interval the sign is the same throughout.
2. Here: (x - 1)^2*(x + 2) is 0 at x = -2 and 1; testing the intervals gives (-∞, -2) negative, (-2, 1) positive, (1, ∞) positive, so x ≥ -2. The sign does not change at x = 1, a zero of even multiplicity.
3. One test point per interval is enough: a polynomial cannot change sign without passing through 0, and there is no zero inside an interval.

   *— Show more —*
4. At a zero of odd multiplicity the sign changes; at a zero of even multiplicity, such as x = 1 in (x − 1)², it does not, and the intervals on both sides share a sign.
5. For ≤ and ≥ the zeros themselves are solutions; for < and > they are not.
6. Move everything to one side first and compare with 0: the sign of one expression is what the chart reads.

**Common Mistakes** (4)

1. Dividing both sides by an expression in x: x² > x divided by x gives x > 1 and loses x < 0, because the sign of x is unknown.
2. Reporting the zeros as the answer: they are only the places where the sign can change.
3. Assuming the signs alternate from interval to interval: at a zero of even multiplicity they do not.

   *— Show more —*
4. Taking square roots of x² > 4 as x > 2: it is |x| > 2, that is x < −2 or x > 2.

### Rational sign chart

Example: `(x-1)/(x+2) <= 0` → -2 < x ≤ 1

<details><summary>Working</summary>

- Solve the inequality (x - 1)/(x + 2) ≤ 0.
- Find where the expression is zero: x = 1.
- Note where it is undefined (denominator zero): x = -2.
- These split the number line into intervals. Test the sign of (x - 1)/(x + 2) in each:
-   • On (-∞, -2): (x - 1)/(x + 2) is positive.
-   • On (-2, 1): (x - 1)/(x + 2) is negative.
-   • On (1, ∞): (x - 1)/(x + 2) is positive.
- Collect the satisfying intervals, including the boundary roots: -2 < x ≤ 1.
- In interval notation: (-2, 1].

</details>

**Key Insights** (5)

1. A rational expression can change sign at a zero of its numerator and at a zero of its denominator: both kinds of point go on the sign chart.
2. Here: the numerator is 0 at x = 1 and the denominator at x = -2; the sign is (-∞, -2) positive, (-2, 1) negative, (1, ∞) positive, so -2 < x ≤ 1, the denominator's zero left out.
3. A zero of the denominator is never in the solution, not even for ≤ or ≥: the expression is undefined there.

   *— Show more —*
4. Do not multiply both sides by the denominator: its sign changes from interval to interval. If you must clear it, multiply by its square, which is never negative.
5. For ≤ and ≥ a zero of the numerator is a solution where the denominator is not 0 (in (x² − 1)/(x − 1) ≥ 0, x = 1 zeroes both and is out); for < and > it is not.

**Common Mistakes** (3)

1. Multiplying both sides by the denominator as if it were positive.
2. Including a zero of the denominator because the inequality is ≤ or ≥.
3. Reporting the zeros as the answer: they are only the places where the sign can change.

### A factor that cancels (fixed: x = 1 was kept)

Example: `(x^2-1)/(x-1) > 0` → -1 < x < 1  or  x > 1

<details><summary>Working</summary>

- Solve the inequality (x^2 - 1)/(x - 1) > 0.
- Find where the expression is zero: x = -1.
- Note where it is undefined (denominator zero): x = 1.
- These split the number line into intervals. Test the sign of (x^2 - 1)/(x - 1) in each:
-   • On (-∞, -1): (x^2 - 1)/(x - 1) is negative.
-   • On (-1, 1): (x^2 - 1)/(x - 1) is positive.
-   • On (1, ∞): (x^2 - 1)/(x - 1) is positive.
- Collect the satisfying intervals, excluding the boundary roots: -1 < x < 1  or  x > 1.
- In interval notation: (-1, 1) ∪ (1, ∞).

</details>

**Key Insights** (4)

1. A factor that cancels still leaves its point out: (x² − 1)/(x − 1) is x + 1 everywhere except x = 1, where the expression as written divides by 0.
2. Here: the expression as written is undefined at x = 1, even though that factor cancels, so that point stays out: -1 < x < 1  or  x > 1.
3. Find where the expression is undefined before simplifying it; the simplified form no longer shows those points.

   *— Show more —*
4. A zero of the numerator and a zero of the denominator both go on the sign chart.

**Common Mistakes** (2)

1. Cancelling a common factor and forgetting the point where it was 0.
2. Solving the simplified inequality alone and reporting a value at which the original is undefined.

### Absolute value, less than

Example: `abs(2x-1) < 5` → -2 < x < 3

<details><summary>Working</summary>

- Solve the inequality |2x - 1| < 5.
- Move everything to one side: |2x - 1| - 5 < 0.
- Find where the expression is zero: x = -2, 3.
- These split the number line into intervals. Test the sign of |2x - 1| - 5 in each:
-   • On (-∞, -2): |2x - 1| - 5 is positive.
-   • On (-2, 3): |2x - 1| - 5 is negative.
-   • On (3, ∞): |2x - 1| - 5 is positive.
- Collect the satisfying intervals, excluding the boundary roots: -2 < x < 3.
- In interval notation: (-2, 3).

</details>

**Key Insights** (5)

1. |g| < c with c > 0 means −c < g < c, within c of 0; |g| > c means g < −c or g > c, farther than c from 0.
2. Here: |2x - 1| < 5 means −5 < 2x - 1 < 5, and solving that gives -2 < x < 3.
3. |a − b| is the distance between a and b: |x − 3| > 2 is every x more than 2 from 3.

   *— Show more —*
4. |g| < c has no solution when c ≤ 0, and |g| > c holds wherever g is defined when c < 0.
5. With a variable on the other side, the shortcut does not apply: split into the cases g ≥ 0 and g < 0, or use a sign chart.

**Common Mistakes** (3)

1. Writing |g| > c as the chain −c > g > c: no number is both, so the "greater than" case is two pieces joined by "or".
2. Dropping the bars and solving g < c alone: the values with g < −c are lost (for "less than", the values with g ≤ −c are wrongly kept).
3. Reversing a sign inside the chain only on one side when dividing by a negative.

### Absolute value, greater than

Example: `abs(x-3) > 2` → x < 1  or  x > 5

**Key Insights** (5)

1. |g| < c with c > 0 means −c < g < c, within c of 0; |g| > c means g < −c or g > c, farther than c from 0.
2. Here: |x - 3| > 2 means x - 3 < −2  or  x - 3 > 2, and solving that gives x < 1  or  x > 5.
3. |a − b| is the distance between a and b: |x − 3| > 2 is every x more than 2 from 3.

   *— Show more —*
4. |g| < c has no solution when c ≤ 0, and |g| > c holds wherever g is defined when c < 0.
5. With a variable on the other side, the shortcut does not apply: split into the cases g ≥ 0 and g < 0, or use a sign chart.

**Common Mistakes** (3)

1. Writing |g| > c as the chain −c > g > c: no number is both, so the "greater than" case is two pieces joined by "or".
2. Dropping the bars and solving g < c alone: the values with g < −c are lost (for "less than", the values with g ≤ −c are wrongly kept).
3. Reversing a sign inside the chain only on one side when dividing by a negative.

### Domain of a logarithm

Example: `ln(x) < 1` → 0 < x < e  (e ≈ 2.7183)

<details><summary>Working</summary>

- Solve the inequality ln(x) < 1.
- Move everything to one side: ln(x) - 1 < 0.
- Find where the expression is zero: x = e.
- Note where the expression stops being defined (a logarithm or square root of a negative number): its domain ends at x = 0.
- These split the number line into intervals. Test the sign of ln(x) - 1 in each:
-   • On (-∞, 0): ln(x) - 1 is undefined.
-   • On (0, e): ln(x) - 1 is negative.
-   • On (e, ∞): ln(x) - 1 is positive.
- Collect the satisfying intervals, excluding the boundary roots: 0 < x < e.
- In interval notation: (0, e).

</details>

**Key Insights** (5)

1. First find where the expression is defined: ln(u) needs u > 0, √u needs u ≥ 0. The answer can only come from there.
2. Here: the expression is defined only where x > 0, so the domain ends at x = 0; testing the intervals there gives 0 < x < e.
3. Then solve as usual on the domain: ln(x) < 1 is x < e there, because ln is increasing.

   *— Show more —*
4. An edge of the domain is in the answer only when the inequality holds there: √x ≥ 0 includes x = 0, while ln(x) is never defined at 0.
5. The edges of the domain go on the sign chart with the zeros.

**Common Mistakes** (3)

1. Solving ln(x) < 1 as x < e and keeping x ≤ 0, where ln is undefined.
2. Squaring both sides of √u < c and forgetting the condition u ≥ 0.
3. Leaving out the edge of a square root's domain when the inequality holds there (√(x − 1) ≤ 0 is x = 1).

### Edge of a square root (fixed: x = 1 was left out)

Example: `sqrt(x-1) <= 0` → x = 1

<details><summary>Working</summary>

- Solve the inequality sqrt(x - 1) ≤ 0.
- Note where the expression stops being defined (a logarithm or square root of a negative number): its domain ends at x = 1.
- These split the number line into intervals. Test the sign of sqrt(x - 1) in each:
-   • On (-∞, 1): sqrt(x - 1) is undefined.
-   • On (1, ∞): sqrt(x - 1) is positive.
- Collect the satisfying intervals, including the boundary roots: x = 1.
- In interval notation: [1, 1].

</details>

**Key Insights** (5)

1. First find where the expression is defined: ln(u) needs u > 0, √u needs u ≥ 0. The answer can only come from there.
2. Here: the expression is defined only where x - 1 ≥ 0, so the domain ends at x = 1; testing the intervals there gives x = 1.
3. A square root is never negative: √u ≤ 0 holds only where u = 0, √u < 0 nowhere, and √u ≥ 0 on the whole domain.

   *— Show more —*
4. An edge of the domain is in the answer only when the inequality holds there: √x ≥ 0 includes x = 0, while ln(x) is never defined at 0.
5. The edges of the domain go on the sign chart with the zeros.

**Common Mistakes** (3)

1. Solving ln(x) < 1 as x < e and keeping x ≤ 0, where ln is undefined.
2. Squaring both sides of √u < c and forgetting the condition u ≥ 0.
3. Leaving out the edge of a square root's domain when the inequality holds there (√(x − 1) ≤ 0 is x = 1).

### Exponential and logarithm, zeros proved (fixed: 0 < x < 0.1586 was lost)

Example: `x - ln(x) > 2` → 0 < x < α  or  x > β, where α ≈ 0.1586 and β ≈ 3.1462 are zeros of x - ln(x) - 2

<details><summary>Working</summary>

- Solve the inequality x - ln(x) > 2.
- Move everything to one side: x - ln(x) - 2 > 0.
- Find where the expression is zero: x = α ≈ 0.1586, x = β ≈ 3.1462 (located numerically, to the decimals shown).
- These are all of its zeros: its derivative is 0 only at x = 1, so between those points it is strictly increasing or decreasing and crosses 0 at most once on each stretch; the signs at the ends of each stretch say whether it does.
- Note where the expression stops being defined (a logarithm or square root of a negative number): its domain ends at x = 0.
- These split the number line into intervals. Test the sign of x - ln(x) - 2 in each:
-   • On (-∞, 0): x - ln(x) - 2 is undefined.
-   • On (0, α): x - ln(x) - 2 is positive.
-   • On (α, β): x - ln(x) - 2 is negative.
-   • On (β, ∞): x - ln(x) - 2 is positive.
- Collect the satisfying intervals, excluding the boundary roots: 0 < x < α  or  x > β.
- In interval notation: (0, α) ∪ (β, ∞).

</details>

**Key Insights** (5)

1. An inequality that mixes x with eˣ, ln(x) or a trig function usually has no boundary in elementary closed form: the zeros are located numerically, named and shown with ≈, and proved to be all of them.
2. Here: x - ln(x) - 2 turns only at x = 1, and is strictly increasing or decreasing between, so each stretch holds at most one zero, decided by the signs at its ends: x = α ≈ 0.1586, x = β ≈ 3.1462, and no others.
3. Between consecutive turning points the expression only rises or only falls, so it crosses zero at most once there: the signs at the two ends decide whether it does.

   *— Show more —*
4. At ±∞, and at the edge of a logarithm's domain, the fastest-growing term decides the sign: an exponential outgrows any power of x, and a power outgrows any power of ln(x).
5. A table of values can miss two zeros close together, or a zero far out; the turning points are what rule that out.

**Common Mistakes** (3)

1. Expecting an elementary closed form: x − ln(x) = 2 has none (its roots need the Lambert W function, x = −W(−e^(−2)) on its two branches), so the boundaries are located numerically, and the decimals are rounded.
2. Searching a fixed window: e^(x/20) > x fails again past x ≈ 89.995.
3. Forgetting the domain of ln(x): only x > 0 can be in the answer.

### A zero far out (fixed: x > 89.995 was lost)

Example: `e^(x/20) > x` → x < α  or  x > β, where α ≈ 1.0541 and β ≈ 89.9951 are zeros of e^(x/20) - x

**Key Insights** (5)

1. An inequality that mixes x with eˣ, ln(x) or a trig function usually has no boundary in elementary closed form: the zeros are located numerically, named and shown with ≈, and proved to be all of them.
2. Here: e^(x/20) - x turns only at x ≈ 59.9146, and is strictly increasing or decreasing between, so each stretch holds at most one zero, decided by the signs at its ends: x = α ≈ 1.0541, x = β ≈ 89.9951, and no others.
3. Between consecutive turning points the expression only rises or only falls, so it crosses zero at most once there: the signs at the two ends decide whether it does.

   *— Show more —*
4. At ±∞, and at the edge of a logarithm's domain, the fastest-growing term decides the sign: an exponential outgrows any power of x, and a power outgrows any power of ln(x).
5. A table of values can miss two zeros close together, or a zero far out; the turning points are what rule that out.

**Common Mistakes** (3)

1. Expecting an elementary closed form: x − ln(x) = 2 has none (its roots need the Lambert W function, x = −W(−e^(−2)) on its two branches), so the boundaries are located numerically, and the decimals are rounded.
2. Searching a fixed window: e^(x/20) > x fails again past x ≈ 89.995.
3. Forgetting the domain of ln(x): only x > 0 can be in the answer.

### Exponentials of one rate, t = eˣ (new)

Example: `e^(2x) - 3e^x + 2 > 0` → x < 0  or  x > ln(2)  (ln(2) ≈ 0.6931)

<details><summary>Working</summary>

- Solve the inequality e^(2x) - 3e^x + 2 > 0.
- Find where the expression is zero: x = 0, ln(2).
- These are all of its zeros: with t = e^x, which is always positive, it is the polynomial t^2 - 3t + 2, whose real roots come from the exact root finder, and each positive root gives one x.
- These split the number line into intervals. Test the sign of e^(2x) - 3e^x + 2 in each:
-   • On (-∞, 0): e^(2x) - 3e^x + 2 is positive.
-   • On (0, ln(2)): e^(2x) - 3e^x + 2 is negative.
-   • On (ln(2), ∞): e^(2x) - 3e^x + 2 is positive.
- Collect the satisfying intervals, excluding the boundary roots: x < 0  or  x > ln(2).
- In interval notation: (-∞, 0) ∪ (ln(2), ∞).

</details>

**Key Insights** (5)

1. With t = eˣ, which is always positive, an inequality in e^(2x), eˣ and constants is a polynomial inequality in t; each positive root t gives one x = ln(t).
2. Here: with t = e^x it is t^2 - 3t + 2 = 0, so t = 1, 2, and x = 0 and ln(2); the sign between them gives x < 0  or  x > ln(2).
3. A root t ≤ 0 gives no x: eˣ is never zero or negative.

   *— Show more —*
4. 2^x and 4^x = (2^x)² work the same way with t = 2^x; sinh, cosh and tanh are made of eˣ and e^(−x), so t = eˣ applies after multiplying through by t.
5. eˣ is increasing, so eˣ > c is x > ln(c) for c > 0; the direction is kept.

**Common Mistakes** (3)

1. Keeping a root t ≤ 0 and taking its logarithm.
2. Writing e^(2x) as 2eˣ: it is (eˣ)².
3. Solving for t and forgetting to turn each value back into x.

### sinh, exactly (new)

Example: `sinh(x) > 1` → x > ln(1 + √2)  (ln(1 + √2) ≈ 0.8814)

**Key Insights** (5)

1. With t = eˣ, which is always positive, an inequality in e^(2x), eˣ and constants is a polynomial inequality in t; each positive root t gives one x = ln(t).
2. Here: with t = e^x its numerator is t^2 - 2t - 1 = 0, so t = 1 + √2, and x = ln(1 + √2); the sign between them gives x > ln(1 + √2).
3. A root t ≤ 0 gives no x: eˣ is never zero or negative.

   *— Show more —*
4. 2^x and 4^x = (2^x)² work the same way with t = 2^x; sinh, cosh and tanh are made of eˣ and e^(−x), so t = eˣ applies after multiplying through by t.
5. eˣ is increasing, so eˣ > c is x > ln(c) for c > 0; the direction is kept.

**Common Mistakes** (3)

1. Keeping a root t ≤ 0 and taking its logarithm.
2. Writing e^(2x) as 2eˣ: it is (eˣ)².
3. Solving for t and forgetting to turn each value back into x.

### A derivative bounded away from 0 (new)

Example: `x^2 > sin(x)` → x < 0  or  x > α, where α ≈ 0.8767 is a zero of x^2 - sin(x)

<details><summary>Working</summary>

- Solve the inequality x^2 > sin(x).
- Move everything to one side: x^2 - sin(x) > 0.
- Find where the expression is zero: x = 0, x = α ≈ 0.8767 (located numerically, to the decimals shown).
- These are all of its zeros: its derivative is 0 only at x ≈ 0.4502, so between those points it is strictly increasing or decreasing and crosses 0 at most once on each stretch; the signs at the ends of each stretch say whether it does.
- These split the number line into intervals. Test the sign of x^2 - sin(x) in each:
-   • On (-∞, 0): x^2 - sin(x) is positive.
-   • On (0, α): x^2 - sin(x) is negative.
-   • On (α, ∞): x^2 - sin(x) is positive.
- Collect the satisfying intervals, excluding the boundary roots: x < 0  or  x > α.
- In interval notation: (-∞, 0) ∪ (α, ∞).

</details>

**Key Insights** (5)

1. An inequality that mixes x with eˣ, ln(x) or a trig function usually has no boundary in elementary closed form: the zeros are located numerically, named and shown with ≈, and proved to be all of them.
2. Here: x^2 - sin(x) turns only at x ≈ 0.4502, and is strictly increasing or decreasing between, so each stretch holds at most one zero, decided by the signs at its ends: x = 0, x = α ≈ 0.8767, and no others.
3. Between consecutive turning points the expression only rises or only falls, so it crosses zero at most once there: the signs at the two ends decide whether it does.

   *— Show more —*
4. At ±∞, and at the edge of a logarithm's domain, the fastest-growing term decides the sign: an exponential outgrows any power of x, and a power outgrows any power of ln(x).
5. A table of values can miss two zeros close together, or a zero far out; the turning points are what rule that out.

**Common Mistakes** (3)

1. Expecting an elementary closed form: x − ln(x) = 2 has none (its roots need the Lambert W function, x = −W(−e^(−2)) on its two branches), so the boundaries are located numerically, and the decimals are rounded.
2. Searching a fixed window: e^(x/20) > x fails again past x ≈ 89.995.
3. Forgetting the domain of ln(x): only x > 0 can be in the answer.

### Nested absolute values

Example: `abs(abs(x) - 1) < 1/2` → -3/2 < x < -1/2  or  1/2 < x < 3/2

**Key Insights** (4)

1. An absolute value changes form where its inside is 0: with a variable on both sides, the sign chart tests each interval on the original inequality.
2. Here: abs(|x| - 1) - 1/2 is 0 at x = -3/2, -1/2, 1/2 and 3/2; testing the intervals gives (-∞, -3/2) positive, (-3/2, -1/2) negative, (-1/2, 1/2) positive, (1/2, 3/2) negative, (3/2, ∞) positive, so -3/2 < x < -1/2  or  1/2 < x < 3/2.
3. The shortcut |g| < c ⇔ −c < g < c needs c to be a positive number; with anything else on the other side, the sign chart decides.

   *— Show more —*
4. Test one point in each interval; the whole interval shares that sign.

**Common Mistakes** (2)

1. Applying the shortcut for |g| < c when c is not a positive number.
2. Dropping the bars and solving without them: half of the cases are lost.

### A wave and a line, counted by convexity

Example: `sin(x) > x/2` → x < α  or  0 < x < β, where α ≈ -1.8955 and β ≈ 1.8955 are zeros of sin(x) - x/2

<details><summary>Working</summary>

- Solve the inequality sin(x) > x/2.
- Move everything to one side: sin(x) - x/2 > 0.
- Find where the expression is zero: x = α ≈ -1.8955, x = 0, x = β ≈ 1.8955 (located numerically, to the decimals shown).
- These are all of its zeros: |sin(x)| ≤ 1 confines them to -2 ≤ x ≤ 2, and between consecutive zeros of sin(x) the expression is concave or convex, so it has at most two zeros there: counted piece by piece, there are exactly 3.
- These split the number line into intervals. Test the sign of sin(x) - x/2 in each:
-   • On (-∞, α): sin(x) - x/2 is positive.
-   • On (α, 0): sin(x) - x/2 is negative.
-   • On (0, β): sin(x) - x/2 is positive.
-   • On (β, ∞): sin(x) - x/2 is negative.
- Collect the satisfying intervals, excluding the boundary roots: x < α  or  0 < x < β.
- In interval notation: (-∞, α) ∪ (0, β).

</details>

**Key Insights** (4)

1. A sine or cosine compared with a line usually has no boundary in closed form: since the wave stays between −1 and 1, every zero lies where the line does too, and there they are counted and located.
2. Here: |sin(x)| ≤ 1 keeps every zero in -2 ≤ x ≤ 2, and counting by convexity there gives exactly 3: x = α ≈ -1.8955, x = 0, x = β ≈ 1.8955.
3. Between consecutive zeros of the sine (or cosine) the difference is concave or convex, so it has at most two zeros there: counting them piece by piece gives all of them.

   *— Show more —*
4. Then test the sign between consecutive zeros, as on any sign chart.

**Common Mistakes** (2)

1. Searching for zeros without a bound: outside the strip where the line stays between −1 and 1 there are none, and inside it a scan can miss two that are close together.
2. Expecting a closed form: the zeros of sin(x) = x/2 other than 0 have none in elementary functions, so they are located numerically.

### Periodic, exact zeros on one period

Example: `sin(x) > 1/2` → π/6 + 2πn < x < 5π/6 + 2πn, for every integer n

<details><summary>Working</summary>

- Solve the inequality sin(x) > 1/2.
- Move everything to one side: sin(x) - 1/2 > 0.
- The left side is periodic with period 2π: its trig functions repeat every 2π. So solve on one period, 0 ≤ x < 2π, and the solution repeats.
- On that period it is 0 at x = π/6, 5π/6, and nowhere else: written in the tangent of the half-angle it becomes a polynomial, whose real roots give every zero except at the half-turn, where that tangent is undefined; that one angle is checked on its own.
- Test the sign between them: (0, π/6) negative; (π/6, 5π/6) positive; (5π/6, 2π) negative.
- Keep the positive parts, then add any whole number of periods: π/6 + 2πn < x < 5π/6 + 2πn, for every integer n.

</details>

**Key Insights** (5)

1. A periodic inequality has infinitely many solution intervals: solve it on one period, then add every multiple of the period to each interval.
2. Here: on 0 ≤ x < 2π the expression is 0 at π/6 and 5π/6; it is negative on (0, π/6), positive on (π/6, 5π/6), negative on (5π/6, 2π), so π/6 + 2πn < x < 5π/6 + 2πn, for every integer n.
3. Find where the expression is 0 on that period first; the sign can only change there.

   *— Show more —*
4. For sin(x) > c, the unit circle shows it at once: the arc of angles whose height is above c.
5. Each zero on the period is found exactly: written in t = tan(θ/2), where θ is the angle inside (x for sin(x)), the expression becomes a polynomial in t, whose real roots are counted. The one angle t never reaches, θ = π, is checked on its own, so none is missed.

**Common Mistakes** (4)

1. Giving only the intervals in one period and leaving out "+ a multiple of the period".
2. Finding one zero in the period and stopping: on one period the expression is 0 at π/6 and at 5π/6, and the sign can change at each.
3. Using arcsin alone: for −1 < c < 1, sin(x) = c has a second zero in each period, π − arcsin(c) (at c = ±1 the two are the same point, the top or the bottom of the wave).

   *— Show more —*
4. Using the wrong period: sin(2x) repeats every π, not every 2π.

### Periodic, a multiple angle (exact period, new)

Example: `sin(10x) > 0` → πn/5 < x < π/10 + πn/5, for every integer n

**Key Insights** (5)

1. A periodic inequality has infinitely many solution intervals: solve it on one period, then add every multiple of the period to each interval.
2. Here: on 0 ≤ x < π/5 the expression is 0 at 0 and π/10; it is positive on (0, π/10), negative on (π/10, π/5), so πn/5 < x < π/10 + πn/5, for every integer n.
3. Find where the expression is 0 on that period first; the sign can only change there.

   *— Show more —*
4. For sin(x) > c, the unit circle shows it at once: the arc of angles whose height is above c.
5. Each zero on the period is found exactly: written in t = tan(θ/2), where θ is the angle inside (x for sin(x)), the expression becomes a polynomial in t, whose real roots are counted. The one angle t never reaches, θ = π, is checked on its own, so none is missed.

**Common Mistakes** (4)

1. Giving only the intervals in one period and leaving out "+ a multiple of the period".
2. Finding one zero in the period and stopping: on one period the expression is 0 at 0 and at π/10, and the sign can change at each.
3. Using arcsin alone: for −1 < c < 1, sin(x) = c has a second zero in each period, π − arcsin(c) (at c = ±1 the two are the same point, the top or the bottom of the wave).

   *— Show more —*
4. Using the wrong period: sin(2x) repeats every π, not every 2π.

### Periodic, close zeros (proved, new)

Example: `sin(x) > 0.9999999` → α + 2πn < x < β + 2πn, for every integer n, where α ≈ 1.5703 and β ≈ 1.5712 are zeros of sin(x) - 0.9999999 in [0, 2π)

**Key Insights** (5)

1. A periodic inequality has infinitely many solution intervals: solve it on one period, then add every multiple of the period to each interval.
2. Here: on 0 ≤ x < 2π the expression is 0 at α ≈ 1.5703 and β ≈ 1.5712; it is negative on (0, α), positive on (α, β), negative on (β, 2π), so α + 2πn < x < β + 2πn, for every integer n.
3. Find where the expression is 0 on that period first; the sign can only change there.

   *— Show more —*
4. For sin(x) > c, the unit circle shows it at once: the arc of angles whose height is above c.
5. Each zero on the period is found exactly: written in t = tan(θ/2), where θ is the angle inside (x for sin(x)), the expression becomes a polynomial in t, whose real roots are counted. The one angle t never reaches, θ = π, is checked on its own, so none is missed.

**Common Mistakes** (4)

1. Giving only the intervals in one period and leaving out "+ a multiple of the period".
2. Finding one zero in the period and stopping: on one period the expression is 0 at α ≈ 1.5703 and at β ≈ 1.5712, and the sign can change at each.
3. Using arcsin alone: for −1 < c < 1, sin(x) = c has a second zero in each period, π − arcsin(c) (at c = ±1 the two are the same point, the top or the bottom of the wave).

   *— Show more —*
4. Using the wrong period: sin(2x) repeats every π, not every 2π.

### Periodic, absolute value

Example: `abs(sin(x)) > 1/2` → π/6 + 2πn < x < 5π/6 + 2πn  or  7π/6 + 2πn < x < 11π/6 + 2πn, for every integer n

**Key Insights** (5)

1. A periodic inequality has infinitely many solution intervals: solve it on one period, then add every multiple of the period to each interval.
2. Here: on 0 ≤ x < 2π the expression is 0 at π/6, 5π/6, 7π/6 and 11π/6; it is negative on (0, π/6), positive on (π/6, 5π/6), negative on (5π/6, 7π/6), positive on (7π/6, 11π/6), negative on (11π/6, 2π), so π/6 + 2πn < x < 5π/6 + 2πn  or  7π/6 + 2πn < x < 11π/6 + 2πn, for every integer n.
3. Find where the expression is 0 on that period first; the sign can only change there.

   *— Show more —*
4. For sin(x) > c, the unit circle shows it at once: the arc of angles whose height is above c.
5. Each zero on the period is found exactly: written in t = tan(θ/2), where θ is the angle inside (x for sin(x)), the expression becomes a polynomial in t, whose real roots are counted. The one angle t never reaches, θ = π, is checked on its own, so none is missed.

**Common Mistakes** (4)

1. Giving only the intervals in one period and leaving out "+ a multiple of the period".
2. Finding one zero in the period and stopping: on one period the expression is 0 at π/6 and at 5π/6 and at 7π/6 and at 11π/6, and the sign can change at each.
3. Using arcsin alone: for −1 < c < 1, sin(x) = c has a second zero in each period, π − arcsin(c) (at c = ±1 the two are the same point, the top or the bottom of the wave).

   *— Show more —*
4. Using the wrong period: sin(2x) repeats every π, not every 2π.

### Compound, a chain

Example: `-1 < 2x+1 <= 5` → -1 < x ≤ 2

<details><summary>Working</summary>

- Solve the compound inequality -1 < 2x+1 ≤ 5.
- A chain a < … ≤ b means BOTH comparisons must hold at once: solve each, then keep the values common to both (the intersection).
- Part 1: -1 < 2x+1  →  x > -1.
- Part 2: 2x+1 <= 5  →  x ≤ 2.
- Intersection: -1 < x ≤ 2.
- In interval notation: (-1, 2].

</details>

**Key Insights** (4)

1. "and", or a chain a < x < b, keeps only the values that satisfy every part; "or" keeps the values that satisfy any part.
2. Here: part 1 gives x > -1 and part 2 gives x ≤ 2; both must hold, so keep the overlap: -1 < x ≤ 2.
3. Solve each part on its own first, then combine them on a number line.

   *— Show more —*
4. A chain a < g < b with g linear can be solved all at once: do the same to all three parts, and reverse both signs when multiplying or dividing by a negative.

**Common Mistakes** (4)

1. Working on only one side of a chain.
2. Taking the union for "and", or the intersection for "or".
3. Writing a chain whose inequalities point in different directions (a < x > b): that is two separate statements, not a chain.

   *— Show more —*
4. Reversing only one of the two signs of a chain when dividing by a negative.

### Compound, "or"

Example: `x < 1 or x > 3` → x < 1  or  x > 3

**Key Insights** (4)

1. "and", or a chain a < x < b, keeps only the values that satisfy every part; "or" keeps the values that satisfy any part.
2. Here: part 1 gives x < 1 and part 2 gives x > 3; either may hold, so keep both: x < 1  or  x > 3.
3. Solve each part on its own first, then combine them on a number line.

   *— Show more —*
4. A chain a < g < b with g linear can be solved all at once: do the same to all three parts, and reverse both signs when multiplying or dividing by a negative.

**Common Mistakes** (4)

1. Working on only one side of a chain.
2. Taking the union for "and", or the intersection for "or".
3. Writing a chain whose inequalities point in different directions (a < x > b): that is two separate statements, not a chain.

   *— Show more —*
4. Reversing only one of the two signs of a chain when dividing by a negative.

## The lists: systems, method by method

### 2×2, one solution (substitution)

Example: `2x + 3y = 6; x - y = 4` → x = 18/5,  y = -2/5

<details><summary>Working</summary>

- Write the system: 2x + 3y = 6;  x - y = 4.
- From equation 1, solve for x: move the y term across, 2x = 6 - 3y, so x = (6 - 3y)/2.
- Substitute that into equation 2 in place of x: (6 - 3y)/2 - y = 4.
- Multiply both sides by 2 to clear the fraction: (6 - 3y) - 2y = 8.
- Expand: 6 - 3y - 2y = 8. Collect the y terms and move the constant across: -5y = 8 - 6 = 2.
- Divide by -5: y = 2/(-5) = -2/5.
- Back-substitute y = -2/5 into x = (6 - 3y)/2: x = (6 - 3·(-2/5))/2 = (36/5)/2 = 18/5.
- Check in both equations: 2·(18/5) + 3·(-2/5) = 6 ✓ and 18/5 - (-2/5) = 4 ✓.

</details>

**Key Insights** (6)

1. Substitution: solve one equation for one variable, put that into the other, and what is left is one equation in one unknown.
2. Here: equation 1 gives x = (6 - 3y)/2; put into equation 2 it leaves one equation in y, so y = -2/5, and then x = 18/5.
3. Two lines cross at exactly one point when the determinant a₁b₂ − a₂b₁ is not 0; when it is 0 they are parallel or the same line.

   *— Show more —*
4. Elimination is the other route: add or subtract multiples of the equations so that one variable cancels. Both routes give the same point.
5. Check the pair in both original equations, not only in the one you substituted into.
6. Clear fractions first: multiplying an equation by its common denominator gives the same line with whole-number coefficients.

**Common Mistakes** (4)

1. Substituting back into the equation the variable was solved from: it always gives 0 = 0 and says nothing.
2. A sign slip when moving a term across the equals sign, or when multiplying out a minus sign.
3. Solving for one variable and forgetting to find the other.

   *— Show more —*
4. Checking the answer in only one of the equations.

### 2×2, parallel lines

Example: `x + y = 1; x + y = 3` → No solution — the two lines are parallel

<details><summary>Working</summary>

- Write the system: x + y = 1;  x + y = 3.
- The left sides are identical. Subtract equation 1 from equation 2: (x + y) − (x + y) = 3 − 1, which gives 0 = 2.
- 0 = 2 is false for every (x, y): a contradiction. No pair satisfies both equations.
- Geometrically the two lines have the same slope but different intercepts — they are parallel and never meet.

</details>

**Key Insights** (4)

1. Lines with the same slope and different intercepts are parallel and never meet: the system has no solution (it is inconsistent).
2. Here: the two left sides are the same, but the constants differ; subtracting leaves 0 = 2, which is false.
3. In the equations this shows as left sides in proportion with the constants out of proportion; elimination then leaves a false statement such as 0 = 2.

   *— Show more —*
4. The determinant a₁b₂ − a₂b₁ is 0 both for parallel lines and for the same line: the constants decide which.

**Common Mistakes** (2)

1. Reading 0 = 2 as a value for a variable: it is a contradiction, so there is no solution.
2. Concluding there is one solution without checking whether the lines are parallel.

### 2×2, the same line

Example: `x + y = 2; 2x + 2y = 4` → Infinitely many solutions — the two equations describe the same line: (x, y) = (2 − t, t), t any real number

<details><summary>Working</summary>

- Write the system: x + y = 2;  2x + 2y = 4.
- Compare the equations: equation 2 is 2 × equation 1 — divide equation 2 by 2 and it becomes x + y = 2. Both describe the same line.
- That leaves one equation in two unknowns, x + y = 2, so one variable is free.
- Let y = t (any real number). Then from x + y = 2: x = (2 − 1·t)/1 = 2 − t.
- Solutions: (x, y) = (2 − t, t) for every real t — every point on the line.

</details>

**Key Insights** (4)

1. When one equation is a constant multiple of the other, both describe the same line, and every point on it is a solution.
2. Here: equation 2 is 2 × equation 1, so both are the line x + y = 2: every point (x, y) = (2 − t, t) is a solution.
3. Describe the solutions with a parameter: let one variable be t, solve for the other in terms of t, and each real t gives one point.

   *— Show more —*
4. Elimination leaves 0 = 0: true, and it says nothing new.

**Common Mistakes** (2)

1. Reading 0 = 0 as "no solution": it means infinitely many.
2. Stopping at "infinitely many" without saying which points: the parameterised line is the answer.

### 3×3, Gaussian elimination

Example: `x + y + z = 6; 2x - y + z = 3; x + 2y - z = 2` → x = 1,  y = 2,  z = 3

<details><summary>Working</summary>

- Read the input as a system of three linear equations in x, y, z:
-   (1)  x + y + z = 6
-   (2)  2x - y + z = 3
-   (3)  x + 2y - z = 2
- Solve by elimination: use one equation to remove a variable from the others, then repeat, then substitute back.
- Eliminate x from (2) and (3) using (1):
-   (2) ← (2) − (2)·(1):  -3y - z = -9
-   (3) ← (3) − (1)·(1):  y - 2z = -4
- Eliminate y from (3) using (2):
-   (3) ← (3) − (-1/3)·(2):  -(7/3)z = -7
- Back-substitute. From (3): z = -7 ÷ -7/3 = 3.
- From (2): y = (-9 − (-1)·3) ÷ -3 = 2.
- From (1): x = (6 − (1)·2 − (1)·3) ÷ 1 = 1.
- Check: substituting x = 1, y = 2, z = 3 into all three original equations balances each one.

</details>

**Key Insights** (5)

1. Elimination on a 3×3 system: use one equation to clear the first variable from the other two, then one of those to clear the second variable, then back-substitute.
2. Here: after the elimination the last equation has only z left, so z = 3; back-substituting gives y = 2, x = 1.
3. If a pivot is 0, swap in an equation below that has that variable; never divide by 0. If none has it, that variable is free, and the system has no single solution.

   *— Show more —*
4. Keep the arithmetic exact, in fractions: decimals collect rounding over the row operations.
5. Check the triple in all three original equations.

**Common Mistakes** (3)

1. Losing a sign when subtracting a multiple of one equation from another.
2. Forgetting to apply a row operation to the right-hand side as well.
3. Back-substituting in the wrong order: the last equation gives the last variable first.

### Line and circle (substitution)

Example: `y = x + 1; x^2 + y^2 = 25` → (x, y) = (-4, -3)  or  (3, 4)

<details><summary>Working</summary>

- Write the system: y = x + 1;  x^2 + y^2 = 25.
- Equation 1 is linear in y, so solve it for y: y = x + 1.
- Substitute into equation 2: 2x^2 + 2x - 24 = 0, which simplifies to 2(x^2 + x - 12) = 0.
- Solve for x: x = -4  or  x = 3.
- Back-substitute into y = x + 1: x = -4 → y = -3;  x = 3 → y = 4.
- Check: each pair satisfies both original equations. Solutions (x, y): (-4, -3)  or  (3, 4).

</details>

**Key Insights** (5)

1. Substitution: solve the equation that is linear in a variable for that variable, put it into the other, and what is left is one polynomial equation in one variable.
2. Here: y = x + 1 put into the other equation leaves 2(x^2 + x - 12) = 0, so x = -4  or  x = 3.
3. A line can meet a parabola or a circle at 0, 1 or 2 points: find every real root, then the partner value for each.

   *— Show more —*
4. Always substitute each pair back into BOTH original equations.
5. The polynomial left after substituting has at most as many real roots as its degree, so the curves meet at most that many times.

**Common Mistakes** (3)

1. Finding the x-values and forgetting to compute the matching y for each one.
2. Pairing every x with every y instead of the y that belongs to each x.
3. Reporting a complex root as an intersection point.

### Linearity proved, not sampled (fixed: a unique solution was claimed)

Example: `x + y + x*(x-1)*(x-2)*(x+1) = 3; x - y = 1` → (x, y) = ≈ (-1.5214, -2.5214)  or  (2, 1)

<details><summary>Working</summary>

- Write the system: x + y + x*(x-1)*(x-2)*(x+1) = 3;  x - y = 1.
- Equation 2 is linear in y, so solve it for y: y = x - 1.
- Substitute into equation 1: x^4 - 2x^3 - x^2 + 4x - 4 = 0, which simplifies to x^4 - 2x^3 - x^2 + 4x - 4 = 0.
- Solve for x: x ≈ -1.5214  or  x = 2 (located numerically, to the decimals shown).
- The other 2 roots are not real, so they give no real intersection.
- Back-substitute into y = x - 1: x ≈ -1.5214 → y ≈ -2.5214;  x = 2 → y = 1.
- Check: each pair satisfies both original equations. Solutions (x, y): ≈ (-1.5214, -2.5214)  or  (2, 1).

</details>

**Key Insights** (4)

1. Substitution: solve the equation that is linear in a variable for that variable, put it into the other, and what is left is one polynomial equation in one variable.
2. Here: y = x - 1 put into the other equation leaves x^4 - 2x^3 - x^2 + 4x - 4 = 0, so x ≈ -1.5214  or  x = 2.
3. After substituting, the polynomial left has degree 4, so the curves meet at most 4 times: find every real root, then the partner value for each.

   *— Show more —*
4. Always substitute each pair back into BOTH original equations.

**Common Mistakes** (3)

1. Finding the x-values and forgetting to compute the matching y for each one.
2. Pairing every x with every y instead of the y that belongs to each x.
3. Reporting a complex root as an intersection point.

