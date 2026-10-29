# Insights review: Algebra (1.62.0)

**Written:** October 29, 2026
**For:** MJ, to spot-check before 1.62.0 is pushed
**Revised:** after an outside review ("agree, with revisions"); every claim and verdict is Round 24 of [`../../evaluations/2026-10/REVIEW-LOG-2026-10.md`](../../evaluations/2026-10/REVIEW-LOG-2026-10.md)
**Plan:** [`../PLAN-INSIGHTS-AND-RESOURCES.md`](../PLAN-INSIGHTS-AND-RESOURCES.md) · **Before this:** [Integrals](INTEGRALS.md), [Derivatives](DERIVATIVES.md)

Generated from the solver, so it is exactly what a student sees for each
example (formulas as plain text here, typeset on the page). The first three
of each list show; **"Show more"** opens the rest.

## What to check

1. **Order:** is the most useful insight first for each method?
2. **Accuracy and wording.**
3. **Missing:** an insight or mistake a student needs that is not here.

## What the reviews of integrals and derivatives taught, built in from the start

- **The second insight works the student's own equation**, read from its
  steps: the chain of steps for a linear equation (2x + 5 = 11 → 2x = 6 →
  x = 3); the factored form; a, b, c and the discriminant's sign; the two
  cases of |A| = b; the squared equation, its candidates and the
  extraneous one; the exponential form and the rejected log candidate;
  u = eˣ and its quadratic; the root p(r) = 0 and the quadratic left.
- **Statements say where they hold:** log rules for a, b > 0; aˣ = b for
  a > 0, a ≠ 1, b > 0; the Rational Root Theorem for integer
  coefficients; the discriminant's count for real coefficients; √(ab) =
  √a·√b for a, b ≥ 0; "two values settle it" for a linear equation only;
  "an even numerator gives two solutions" when the right side is positive.
- **More of each method behind Show more**: what a student meets next (a
  common factor first, reading a, b, c with their signs, cross-multiplying
  one fraction by one fraction, comparing exponents of the same base).
- **Swept for wrong answers before writing:** 28 equations across every
  method and its edges (excluded values, negative right sides, log domains,
  complex roots). The review then found one wrong answer the sweep missed:
  x^(4/6) = 4 gave x = 8 only (fixed: exponents read in lowest terms). x³ =
  2 now gives ∛2 exactly (x^(−1) = 4 still shows 0.25, which is exact).
- **Revised after the review:** fractional powers taught through the root;
  the no-solution lists lead with their own reason; common logs in base 10;
  factor, expand and radicals show their result second; x·eˣ = c names the
  Lambert W function.
- **No sources:** every insight here is a standard textbook fact.

## The lists, method by method

### Linear

Example: `2x + 5 = 11`

**Key Insights** (6)

1. Undo the operations in reverse order: add or subtract to isolate the variable term first, then multiply or divide.
2. Here: 2x + 5 = 11 → 2x = 6 → x = 6/2 = 3.
3. Whatever you do to one side, do to the other — the equation stays balanced.

   *— Show more —*
4. Check by substituting the solution into the original equation.
5. With the variable on both sides, collect it on one side first: 3(x − 2) = 2x + 4 becomes 3x − 6 = 2x + 4, then x = 10.
6. Fractions or decimals can be cleared first, by multiplying every term on both sides by the same number.

**Common Mistakes** (4)

1. Sign errors when moving a term across the equals sign.
2. Dividing only one term by the coefficient instead of the whole side.
3. Subtracting a number from one side only — both sides change together.

   *— Show more —*
4. Moving a term without changing its sign: x + 5 = 11 gives x = 6, not x = 16.

### Linear with brackets

Example: `3(x - 2) = 2x + 4`

**Key Insights** (6)

1. Undo the operations in reverse order: add or subtract to isolate the variable term first, then multiply or divide.
2. Here: 3(x - 2) = 2x + 4 → 3x - 6 = 2x + 4 → x - 6 = 4 → x = 10.
3. Whatever you do to one side, do to the other — the equation stays balanced.

   *— Show more —*
4. Check by substituting the solution into the original equation.
5. With the variable on both sides, collect it on one side first: 3(x − 2) = 2x + 4 becomes 3x − 6 = 2x + 4, then x = 10.
6. Fractions or decimals can be cleared first, by multiplying every term on both sides by the same number.

**Common Mistakes** (4)

1. Sign errors when moving a term across the equals sign.
2. Dividing only one term by the coefficient instead of the whole side.
3. Forgetting to distribute a factor across every term in the parentheses.

   *— Show more —*
4. Moving a term without changing its sign: x + 5 = 11 gives x = 6, not x = 16.

### Fractions (LCD)

Example: `x/3 + 1/2 = 5/6`

**Key Insights** (5)

1. Clear the fractions first: multiply every term on both sides by the least common denominator, then solve the whole-number equation that remains.
2. Here: x/3 + 1/2 = 5/6 → 2x + 3 = 5 → 2x = 2 → x = 2/2 = 1.
3. Every term is multiplied, including the ones that are not fractions: x/3 + 1/2 = 5/6 times 6 is 2x + 3 = 5.

   *— Show more —*
4. Check by substituting into the original equation, fractions and all.
5. The LCD is the smallest number every denominator divides: for 3, 2 and 6 it is 6.

**Common Mistakes** (3)

1. Multiplying only the fractional terms by the LCD and leaving the others as they were.
2. Using the product of the denominators when a smaller common denominator exists (6, not 36, for thirds, halves and sixths).
3. Adding the denominators instead of finding a common one.

### Contradiction

Example: `5x - 7 = 5x + 2`

**Key Insights** (5)

1. When the variable terms cancel, what is left is about the constants alone: 5x − 7 = 5x + 2 leaves −7 = 2, false, so no solution; 2(x + 3) = 2x + 6 leaves 6 = 6, true for every x.
2. Here the x terms cancel and the two sides always differ by -9, never 0: no x is a solution.
3. A contradiction has no solution — the two sides differ by a fixed amount whatever x is.

   *— Show more —*
4. For a linear equation two values settle it: substitute x = 0 and x = 1, and an identity holds both times, a contradiction fails both times.
5. Simplify both sides fully before deciding: distribute, collect like terms, then compare what is left.

**Common Mistakes** (2)

1. Dividing by 0 (the coefficient left after the terms cancel) and reporting a number.
2. Writing x = 0 or 0 = 0 for a contradiction: there is no solution at all.

### Identity

Example: `2(x+3) = 2x+6`

**Key Insights** (5)

1. When the variable terms cancel, what is left is about the constants alone: 5x − 7 = 5x + 2 leaves −7 = 2, false, so no solution; 2(x + 3) = 2x + 6 leaves 6 = 6, true for every x.
2. Here the x terms cancel and the two sides are the same expression: every x is a solution.
3. An identity holds for every real number — the two sides are the same expression written differently.

   *— Show more —*
4. For a linear equation two values settle it: substitute x = 0 and x = 1, and an identity holds both times, a contradiction fails both times.
5. Simplify both sides fully before deciding: distribute, collect like terms, then compare what is left.

**Common Mistakes** (2)

1. Dividing by 0 (the coefficient left after the terms cancel) and reporting a number.
2. Writing x = 0 for an identity: every number works, not just 0.

### Factoring

Example: `x^2 - 5x + 6 = 0`

**Key Insights** (6)

1. A quadratic has up to two solutions: factor, take square roots, or use x = (−b ± √(b² − 4ac))/(2a).
2. Here: x^2 - 5x + 6 = (x - 2)(x - 3) = 0, so x = 2 or x = 3.
3. Set the equation to 0 before factoring: (x − a)(x − b) = 0 gives x = a or x = b; (x − a)(x − b) = k with k ≠ 0 does not.

   *— Show more —*
4. Check by substituting each root into the original equation.
5. Take out a common factor first: x² − 3x = 0 is x(x − 3) = 0, so x = 0 or x = 3.
6. A quadratic that does not factor over the integers can still be solved by the formula.

**Common Mistakes** (3)

1. Stopping at the factored form without setting each factor to zero.
2. Reading (x − a)(x − b) = 0 as x = −a or x = −b: each factor is zero at x = a and x = b.
3. Factoring when the equation is not set to 0: (x − 1)(x − 2) = 6 does not give x − 1 = 6 or x − 2 = 6.

### Common factor

Example: `x^2 - 3x = 0`

**Key Insights** (6)

1. A quadratic has up to two solutions: factor, take square roots, or use x = (−b ± √(b² − 4ac))/(2a).
2. Here: x(x - 3) = 0, so x = 0 or x = 3.
3. Set the equation to 0 before factoring: (x − a)(x − b) = 0 gives x = a or x = b; (x − a)(x − b) = k with k ≠ 0 does not.

   *— Show more —*
4. Check by substituting each root into the original equation.
5. Take out a common factor first: x² − 3x = 0 is x(x − 3) = 0, so x = 0 or x = 3.
6. A quadratic that does not factor over the integers can still be solved by the formula.

**Common Mistakes** (3)

1. Dividing both sides by x and losing the x = 0 solution.
2. Reading (x − a)(x − b) = 0 as x = −a or x = −b: each factor is zero at x = a and x = b.
3. Factoring when the equation is not set to 0: (x − 1)(x − 2) = 6 does not give x − 1 = 6 or x − 2 = 6.

### Perfect square

Example: `x^2 - 6x + 9 = 0`

**Key Insights** (6)

1. A quadratic has up to two solutions: factor, take square roots, or use x = (−b ± √(b² − 4ac))/(2a).
2. Here: x^2 - 6x + 9 = (x - 3)^2 = 0, so x = 3.
3. Set the equation to 0 before factoring: (x − a)(x − b) = 0 gives x = a or x = b; (x − a)(x − b) = k with k ≠ 0 does not.

   *— Show more —*
4. Check by substituting each root into the original equation.
5. Take out a common factor first: x² − 3x = 0 is x(x − 3) = 0, so x = 0 or x = 3.
6. A quadratic that does not factor over the integers can still be solved by the formula.

**Common Mistakes** (3)

1. Stopping at the factored form without setting each factor to zero.
2. Reading (x − a)(x − b) = 0 as x = −a or x = −b: each factor is zero at x = a and x = b.
3. Factoring when the equation is not set to 0: (x − 1)(x − 2) = 6 does not give x − 1 = 6 or x − 2 = 6.

### Quadratic formula

Example: `x^2 + x - 1 = 0`

**Key Insights** (6)

1. For ax^2 + bx + c = 0: x = (−b ± √(b^2 − 4ac))/(2a).
2. Here a = 1, b = 1, c = -1 and b² − 4ac = 5, positive, so two real roots: x = (-1 - √5)/2 or x = (-1 + √5)/2.
3. With real coefficients, the discriminant b^2 − 4ac decides the count: positive gives two real roots, zero one (repeated), negative none real (a complex pair).

   *— Show more —*
4. Check by substituting each root into the original equation.
5. Set the equation to 0 first, then read a, b and c with their signs.
6. When b² − 4ac is a perfect square (and the coefficients are integers), the roots are rational and the quadratic also factors.

**Common Mistakes** (3)

1. Dropping the sign of b: the formula starts with −b.
2. Dividing only the square root by 2a instead of the whole numerator −b ± √(b^2 − 4ac).
3. Reading a, b, c before the equation is set to 0.

### Complex roots

Example: `x^2 + x + 1 = 0`

**Key Insights** (6)

1. For ax^2 + bx + c = 0: x = (−b ± √(b^2 − 4ac))/(2a).
2. Here a = 1, b = 1, c = 1 and b² − 4ac = -3, negative, so a complex pair: x = (-1 - i√3)/2 or x = (-1 + i√3)/2.
3. With real coefficients, the discriminant b^2 − 4ac decides the count: positive gives two real roots, zero one (repeated), negative none real (a complex pair).

   *— Show more —*
4. Check by substituting each root into the original equation.
5. Set the equation to 0 first, then read a, b and c with their signs.
6. When b² − 4ac is a perfect square (and the coefficients are integers), the roots are rational and the quadratic also factors.

**Common Mistakes** (3)

1. Dropping the sign of b: the formula starts with −b.
2. Dividing only the square root by 2a instead of the whole numerator −b ± √(b^2 − 4ac).
3. Reading a, b, c before the equation is set to 0.

### Square roots

Example: `x^2 = 9`

**Key Insights** (5)

1. x^2 = c is solved by square roots: x = ±√c — two solutions when c > 0, one when c = 0.
2. Here: x = ±√(9) = ±3, so x = -3 or x = 3.
3. Isolate x^2 first: move the constant across, then divide by the coefficient.

   *— Show more —*
4. Check by substituting each root into the original equation.
5. With no x term (ax² + c = 0) square roots are quickest; with an x term, factor or use the formula.

**Common Mistakes** (2)

1. Taking only the positive square root and losing x = −√c.
2. Taking the root of each term separately: in x^2 + 7 = 16, isolate x^2 before the root.

### Square roots, negative

Example: `x^2 = -4`

**Key Insights** (5)

1. x^2 = c is solved by square roots: x = ±√c — two solutions when c > 0, one when c = 0.
2. Here: x = ±√(-4), so x = -2i or x = 2i.
3. When c < 0 there is no real solution; over the complex numbers √(−c)·i and its negative are the two roots (i = √(−1), i^2 = −1).

   *— Show more —*
4. Check by substituting each root into the original equation.
5. With no x term (ax² + c = 0) square roots are quickest; with an x term, factor or use the formula.

**Common Mistakes** (2)

1. Taking only the positive square root and losing x = −√c.
2. Writing √(−1) as −1, or stopping at "no solution" without saying it means no REAL solution.

### Absolute value

Example: `abs(2x-3) = 5`

**Key Insights** (5)

1. |A| = b splits into two equations, A = b or A = −b — two candidate solutions.
2. Here: 2x - 3 = 5 or 2x - 3 = -5, so x = -1 or x = 4.
3. If b < 0 there is no solution at all (an absolute value is never negative); if b = 0 there is exactly one case, A = 0.

   *— Show more —*
4. Isolate the absolute value first: 2|x − 1| + 1 = 7 becomes |x − 1| = 3 before the cases are written.
5. |x − a| = b says x is at distance b from a, so x = a ± b when b ≥ 0.

**Common Mistakes** (3)

1. Solving only the positive case and missing the second solution.
2. Dropping the bars as if |A| = b meant A = b.
3. Splitting into cases before the absolute value is isolated, or not checking both answers in the original.

### Absolute value, no solution

Example: `abs(x-1) = -3`

**Key Insights** (3)

1. An absolute value is never negative, so |A| = b with b < 0 has no solution: there is no need to split into cases.
2. Say why: name the value the expression cannot reach — that is the answer.
3. "No real solution" is a result, not a failure: the check is that no number could satisfy the equation, not that none was found.

**Common Mistakes** (3)

1. Splitting |x − 1| = −3 into cases anyway gives x = −2 and x = 4, and neither works: each makes |x − 1| = 3.
2. Dropping the bars and solving x − 1 = −3 as if it were the equation.
3. Reporting a number anyway because the algebra produced one.

### Radical

Example: `sqrt(x+2) = x`

**Key Insights** (5)

1. Isolate the root, then square both sides. Squaring can create extraneous solutions, so every candidate must be checked in the original.
2. Here squaring gives x + 2 = (x)² = x^2, with candidates x = -1 or x = 2; x = -1 is extraneous, so x = 2.
3. The radicand must be ≥ 0, and √(…) itself is ≥ 0: √(x + 1) = −3 has no solution before any algebra.

   *— Show more —*
4. If a root remains after squaring once, isolate it and square again.
5. √ means the principal (non-negative) root, which is why a candidate that makes the other side negative is extraneous.

**Common Mistakes** (3)

1. Squaring term by term: (√x + 1)² is not x + 1.
2. Keeping a candidate that fails the check in the original equation.
3. Forgetting that the radicand cannot be negative.

### Natural log

Example: `ln(x) = 1`

**Key Insights** (5)

1. ln(x) = c means x = e^c: undo a logarithm by exponentiating with its base.
2. Here: x = e^1, so x = e.
3. Combine several logs with the log rules first (ln a + ln b = ln(ab), ln a − ln b = ln(a/b), for a, b > 0), then rewrite in exponential form.

   *— Show more —*
4. Every solution must keep every log argument positive — check each one.
5. In exponential form, log_b(x) = c means x = b^c (for b > 0, b ≠ 1); log(x) typed bare is base 10, so log(x) = c means x = 10^c.

**Common Mistakes** (4)

1. Reading ln(x) = c as x = c, forgetting the exponential.
2. Keeping a candidate that makes a log argument zero or negative.
3. Splitting ln(a + b) into ln a + ln b — there is no such rule.

   *— Show more —*
4. Combining logs whose arguments are not all positive: the combined equation can have a candidate the original does not, and the check removes it.

### Common logs combined

Example: `log(x) + log(x - 3) = 1`

**Key Insights** (6)

1. "log(…)" is read as the common logarithm, base 10, as on a calculator. Write "ln(…)" for the natural logarithm, or "log(x, b)" / "log_b(x)" for another base.
2. log(x) = c means x = 10^c: undo a base-10 logarithm with a power of 10.
3. Here, combined and in exponential form: x(x - 3) = 10^1, with candidates x = -2 or x = 5; x = -2 is rejected (a logarithm's argument would not be positive), so x = 5.

   *— Show more —*
4. Combine several logs with the log rules first (log a + log b = log(ab), log a − log b = log(a/b), for a, b > 0), then rewrite in exponential form.
5. Every solution must keep every log argument positive — check each one.
6. In exponential form, log_b(x) = c means x = b^c (for b > 0, b ≠ 1); log(x) typed bare is base 10, so log(x) = c means x = 10^c.

**Common Mistakes** (4)

1. Reading log(x) = c as x = c, or as x = e^c: the base is 10.
2. Keeping a candidate that makes a log argument zero or negative.
3. Splitting log(a + b) into log a + log b — there is no such rule.

   *— Show more —*
4. Combining logs whose arguments are not all positive: the combined equation can have a candidate the original does not, and the check removes it.

### Exponential

Example: `2^x = 10`

**Key Insights** (5)

1. a^x = b (with a > 0, a ≠ 1 and b > 0) is solved by taking a logarithm of both sides: x = ln(b)/ln(a) = log_a(b).
2. Here, taking a logarithm of both sides: x = ln(10)/ln(2) ≈ 3.3219.
3. Any log base works as long as it is the same on both sides; ln is the usual choice.

   *— Show more —*
4. A polynomial in a^x (e^(2x) − 3e^x + 2) is a quadratic in u = a^x — solve for u first, then for x.
5. If both sides are powers of the same base, compare the exponents: 2^x = 8 = 2³ gives x = 3.

**Common Mistakes** (3)

1. Dividing instead of taking a log: 2^x = 10 does not give x = 5.
2. Writing ln(10)/ln(2) as ln(10/2).
3. Losing a solution of the quadratic in u, or keeping a negative u (a^x is always positive).

### Exponential substitution

Example: `e^x + e^(-x) = 3`

**Key Insights** (5)

1. a^x = b (with a > 0, a ≠ 1 and b > 0) is solved by taking a logarithm of both sides: x = ln(b)/ln(a) = log_a(b).
2. Here u = e^x turns it into 1 - 3u + u^2 = 0, so u = (3 - √5)/2 or u = (3 + √5)/2, and each positive u gives x = ln(u): x = ln((3 - √5)/2) or x = ln((3 + √5)/2).
3. Any log base works as long as it is the same on both sides; ln is the usual choice.

   *— Show more —*
4. A polynomial in a^x (e^(2x) − 3e^x + 2) is a quadratic in u = a^x — solve for u first, then for x.
5. If both sides are powers of the same base, compare the exponents: 2^x = 8 = 2³ gives x = 3.

**Common Mistakes** (4)

1. Dividing instead of taking a log: 2^x = 10 does not give x = 5.
2. Writing ln(10)/ln(2) as ln(10/2).
3. Losing a solution of the quadratic in u, or keeping a negative u (a^x is always positive).

   *— Show more —*
4. Writing a^(−x) as −u: a negative exponent is the reciprocal, 1/u.

### No real solution

Example: `e^x = -2`

**Key Insights** (3)

1. a^x with a > 0 is always positive, so it cannot equal 0 or a negative number.
2. Say why: name the value the expression cannot reach — that is the answer.
3. "No real solution" is a result, not a failure: the check is that no number could satisfy the equation, not that none was found.

**Common Mistakes** (2)

1. Taking a logarithm of a negative number to "solve" it: there is no such logarithm.
2. Reporting a number anyway because the algebra produced one.

### Rational

Example: `x/(x-1) = 2`

**Key Insights** (5)

1. Clear the denominators by multiplying both sides by them, then solve the polynomial equation that remains.
2. Here: clearing the denominators gives -x + 2 = 0, so x = 2.
3. Any value that makes a denominator zero is excluded from the start — it can never be a solution.

   *— Show more —*
4. Check every candidate in the original equation, not the cleared one.
5. One fraction equal to one fraction can be cross-multiplied: a/b = c/d gives ad = bc, with b, d ≠ 0.

**Common Mistakes** (3)

1. Multiplying only one side by the denominator.
2. Keeping a "solution" that makes a denominator zero (an extraneous root).
3. Cancelling a factor that could be zero.

### Rational, contradiction

Example: `x/(x+1) + 1/x = 1`

**Key Insights** (5)

1. Clear the denominators by multiplying both sides by them, then solve the polynomial equation that remains.
2. Here: clearing the denominators gives 1 = 0, so no real solution.
3. Any value that makes a denominator zero is excluded from the start — it can never be a solution.

   *— Show more —*
4. Check every candidate in the original equation, not the cleared one.
5. One fraction equal to one fraction can be cross-multiplied: a/b = c/d gives ad = bc, with b, d ≠ 0.

**Common Mistakes** (3)

1. Multiplying only one side by the denominator.
2. Keeping a "solution" that makes a denominator zero (an extraneous root).
3. Cancelling a factor that could be zero.

### Rational Root Theorem

Example: `x^3 - 6x^2 + 11x - 6 = 0`

**Key Insights** (5)

1. Rational Root Theorem: for a polynomial with integer coefficients, every rational root is ±(a factor of the constant term)/(a factor of the leading coefficient) — a finite list to test, so test it before anything else.
2. Here p(1) = 0, and dividing leaves x^2 - 5x + 6 = 0: x = 1 or x = 2 or x = 3.
3. Once p(r) = 0, divide by (x − r): synthetic division must leave remainder 0, and the quotient has degree one less. Repeat until a quadratic remains, then factor or use the formula.

   *— Show more —*
4. A degree-n polynomial has at most n real roots; count them (with multiplicity) and stop when the degree is used up.
5. If no candidate on the list is a root, there is no rational root: the roots are irrational or complex, and another method is needed.

**Common Mistakes** (3)

1. Testing only positive candidates — the negatives are on the list too.
2. An arithmetic slip in synthetic division: a non-zero remainder means r was not a root (or the division went wrong), not that the method failed.
3. Stopping after one root: the quotient still has to be solved, and a root can repeat.

### Fractional power

Example: `x^(2/3) = 4`

**Key Insights** (6)

1. Read x^(p/q) as a root, then a power, with p/q in lowest terms: x^(2/3) = (∛x)². Undo the power, then the root: (∛x)² = 4 gives ∛x = ±2, so x = ±8.
2. Here: (∛x)^2 = 4, so ∛x = ±2 and x = (±2)^3 = ±8.
3. The denominator q decides the domain: an odd root is real for every x (∛(−8) = −2), an even root only for x ≥ 0, and it is never negative (x^(1/2) = −3 has no real solution).

   *— Show more —*
4. The numerator p decides the signs: undoing an even power gives ± (when the right side is positive), an odd power one value.
5. Isolate the power before undoing it: 2x^(2/3) + 1 = 9 becomes x^(2/3) = 4 first.
6. Raising both sides to the reciprocal power (x = ±4^(3/2)) gives the same answer here, but only through the root does the domain and the ± show.

**Common Mistakes** (3)

1. Taking only the positive solution when the numerator of the exponent is even.
2. Reading an unreduced exponent literally: x^(4/6) is x^(2/3), real for negative x too.
3. Skipping the check: a raised power can introduce a value that fails in the original.

### Fractional power, unreduced

Example: `x^(4/6) = 4`

**Key Insights** (6)

1. Read x^(p/q) as a root, then a power, with p/q in lowest terms: x^(2/3) = (∛x)². Undo the power, then the root: (∛x)² = 4 gives ∛x = ±2, so x = ±8.
2. Here: (∛x)^2 = 4, so ∛x = ±2 and x = (±2)^3 = ±8.
3. The denominator q decides the domain: an odd root is real for every x (∛(−8) = −2), an even root only for x ≥ 0, and it is never negative (x^(1/2) = −3 has no real solution).

   *— Show more —*
4. The numerator p decides the signs: undoing an even power gives ± (when the right side is positive), an odd power one value.
5. Isolate the power before undoing it: 2x^(2/3) + 1 = 9 becomes x^(2/3) = 4 first.
6. Raising both sides to the reciprocal power (x = ±4^(3/2)) gives the same answer here, but only through the root does the domain and the ± show.

**Common Mistakes** (3)

1. Taking only the positive solution when the numerator of the exponent is even.
2. Reading an unreduced exponent literally: x^(4/6) is x^(2/3), real for negative x too.
3. Skipping the check: a raised power can introduce a value that fails in the original.

### Pure cube

Example: `x^3 = 2`

**Key Insights** (3)

1. x^n = c is solved by an n-th root: an odd n gives one real root (x³ = 2 gives x = ∛2); an even n gives x = ±ⁿ√c when c > 0 and no real root when c < 0.
2. A polynomial of degree n has n roots counted with multiplicity, so the others are complex: for a cube, ∛c·(−1 ± i√3)/2.
3. Keep the root exact (∛2) and show the decimal beside it (≈ 1.2599): the decimal is not the answer, only its size.

**Common Mistakes** (3)

1. Taking only the positive root of an even power: x⁴ = 5 also has x = −∜5.
2. Dividing instead of taking a root: x³ = 2 does not give x = 2/3.
3. Stopping at the real root when the question asks for every root: the complex ones count too.

### Pure fourth power, negative

Example: `x^4 + 1 = 0`

**Key Insights** (3)

1. x^n = c is solved by an n-th root: an odd n gives one real root (x³ = 2 gives x = ∛2); an even n gives x = ±ⁿ√c when c > 0 and no real root when c < 0.
2. A polynomial of degree n has n roots counted with multiplicity, so the others are complex: for a cube, ∛c·(−1 ± i√3)/2.
3. Keep the root exact (∛2) and show the decimal beside it (≈ 1.2599): the decimal is not the answer, only its size.

**Common Mistakes** (3)

1. Taking only the positive root of an even power: x⁴ = 5 also has x = −∜5.
2. Dividing instead of taking a root: x³ = 2 does not give x = 2/3.
3. Stopping at the real root when the question asks for every root: the complex ones count too.

### No solution, a fraction

Example: `1/(x-1) = 0`

**Key Insights** (3)

1. A fraction is 0 only when its numerator is; 1/(x − 1) has numerator 1, so it is never 0.
2. Say why: name the value the expression cannot reach — that is the answer.
3. "No real solution" is a result, not a failure: the check is that no number could satisfy the equation, not that none was found.

**Common Mistakes** (2)

1. Writing a value where the fraction is "nearly" 0: it gets small but never reaches 0.
2. Reporting a number anyway because the algebra produced one.

### Located numerically

Example: `x*e^x = 1`

**Key Insights** (4)

1. When the unknown sits both inside and outside a function (x·e^x = 1), no algebraic step isolates it; the root is located where the two sides cross and narrowed down.
2. ≈ means the root is known to the decimals shown, not exactly; substitute it back and the two sides agree to those decimals.
3. Sketch both sides: each crossing is a solution, and the picture says how many to expect.

   *— Show more —*
4. This one has a name: x·e^x = c with c > 0 is solved by x = W(c), the Lambert W function (the inverse of x·e^x). Most calculators do not have it, so a numerical value is the usual answer.

**Common Mistakes** (3)

1. Treating a located root as exact — its next digits are not zeros.
2. Taking logarithms to isolate x: ln(x·e^x) is ln x + x, which still has x in two places.
3. Stopping at one root when the graphs cross more than once.

### Simplify

Example: `3(x-2)+4`

**Key Insights** (4)

1. Distribute first, then collect like terms — terms with exactly the same variable part.
2. Here: 3(x - 2) + 4 = 3x - 2.
3. Like terms combine by adding their coefficients: 3x − 6 + 4 → 3x − 2.

   *— Show more —*
4. Check by substituting a value for the variable into both the original and the simplified form.

**Common Mistakes** (3)

1. Combining unlike terms (adding x and x²).
2. Forgetting to distribute a factor across every term in the parentheses.
3. Losing a sign when distributing a negative.

### Cancel

Example: `(x^2-1)/(x-1)`

**Key Insights** (4)

1. Factor the numerator and the denominator completely, then cancel the factors they share.
2. Here: (x^2 - 1)/(x - 1) = x + 1, for x ≠ 1.
3. Cancel factors, never terms: in (x^2 − 1)/(x − 1) the x − 1 cancels only after x^2 − 1 = (x − 1)(x + 1).

   *— Show more —*
4. A cancelled factor still counts: the original is undefined where it is zero, so the simplified form comes with that restriction (x ≠ 1).

**Common Mistakes** (3)

1. Cancelling a term across the fraction bar: (x + 2)/2 is x/2 + 1, not x + 1.
2. Dropping the restriction after cancelling: the simplified form is equal to the original only where the original is defined.
3. Cancelling before factoring completely, and missing a factor the numerator and denominator share.

### Expand

Example: `expand (x+1)^2`

**Key Insights** (4)

1. Expanding is the reverse of factoring; each term of one bracket multiplies each term of the other.
2. Here: (x + 1)^2 = x^2 + 2x + 1.
3. (a + b)² = a² + 2ab + b² — the middle term is the one students drop.

   *— Show more —*
4. Collect like terms at the end, and check by substituting a value into both forms: at x = 1, (x + 1)² = 4 and x² + 2x + 1 = 4.

**Common Mistakes** (2)

1. Writing (a + b)² as a² + b².
2. Losing a sign when a bracket is subtracted.

### Factor

Example: `factor x^2 - 9`

**Key Insights** (4)

1. Always pull out the greatest common factor first.
2. Here: x^2 - 9 = (x - 3)(x + 3).
3. a² − b² = (a − b)(a + b) — the difference-of-squares pattern.

   *— Show more —*
4. Check a factorization by expanding it back out.

**Common Mistakes** (3)

1. Stopping before the expression is fully factored.
2. Sign errors inside the factors — expand to verify.
3. Treating a sum of squares like a difference: a² + b² does not factor over the reals.

### Simplest radical form

Example: `sqrt(72)`

**Key Insights** (4)

1. Factor out the largest perfect square: √50 = √25 · √2 = 5√2.
2. Here: √72 = 6√2.
3. A radical is in simplest form when nothing under it has a square factor left.

   *— Show more —*
4. √(a·b) = √a · √b for a, b ≥ 0, but √(a + b) is NOT √a + √b.

**Common Mistakes** (3)

1. Splitting a radical across addition: √(a + b) ≠ √a + √b.
2. Missing the largest square factor (√72 = 6√2, not 2√18).
3. Stopping at a decimal when the exact simplified radical was the point.

