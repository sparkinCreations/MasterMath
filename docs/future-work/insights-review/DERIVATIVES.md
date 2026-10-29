# Insights review: Derivatives (1.61.0)

**Written:** October 29, 2026
**For:** MJ, to spot-check before 1.61.0 is pushed
**Revised:** three times, after an outside review ("approve with revisions", "almost ready to ship", then three small points); every claim and verdict is Round 22 of [`../../evaluations/2026-10/REVIEW-LOG-2026-10.md`](../../evaluations/2026-10/REVIEW-LOG-2026-10.md)
**Plan:** [`../PLAN-INSIGHTS-AND-RESOURCES.md`](../PLAN-INSIGHTS-AND-RESOURCES.md) · **Before this:** [Integrals](INTEGRALS.md)

Generated from the solver, so it is exactly what a student sees for each
example (formulas as plain text here, typeset on the page). The first three
of each list show; **"Show more"** opens the rest.

## What to check

1. **Order:** is the most useful insight first for each rule?
2. **Accuracy and wording.**
3. **Missing:** an insight or mistake a student needs that is not here.

## How the lists are built

- **Before:** one insight per rule the terms used, cut at four, so most
  problems showed one insight and one mistake.
- **Now, the first three insights:**
  1. The rule.
  2. The rule applied to this problem: the inside and its derivative for
     the chain rule (sin(3x²): u = 3x², u′ = 6x, so cos(3x²)·6x); u, w, u′,
     w′ for the product and quotient rules; the two slopes for |ax + b|.
  3. The next most useful idea.
- **Cases that lead with their own form:** 2ˣ leads with 2ˣ·ln 2, log(x)
  with 1/(x·ln 10), sec x with the co-function derivatives, a polynomial
  with term-by-term differentiation, and 1/x² with its worked example.
- **A task leads.** A higher derivative starts with what f″ means, then
  shows every round (f′ = (x + 1)eˣ, then f″ = (x + 2)eˣ); its first mistake
  is stopping at f′, quoting the student's own f′. A value at a point starts
  with "f′(a) is a number" and shows "differentiate first, then evaluate:
  f′(x) = 3x², so f′(2) = 12"; its first mistake is substituting before
  differentiating. A point outside the domain leads with that instead.
- **The rest of the list:** the lead rule's whole list, then the first item
  of every other rule used, unless the lead list already names the same idea
  (one "forgot the inside's derivative", not two). The last insight is the
  general one about slope, now qualified: "where the derivative exists … 0
  at a stationary point".
- **Qualified as the review asked:** log laws (for x > 0), −F_x/F_y (where
  F_y ≠ 0), real exponents (where the function is differentiable), aˣ
  (a > 0), xˣ (x > 0). "Expand first" appears only for a power of a
  polynomial.
- **Answers fixed on the way:**
  - A power of a polynomial keeps the chain rule's form: (2x + 1)⁵ gives
    10(2x + 1)⁴, not the expanded polynomial.
  - `ln(x) at x = -1` gave f′(−1) = −1. It now says f′(−1) does not exist,
    because −1 is outside the domain of f (the same for log, √ and arcsin).
  - `x^(1/3) at x = -8` said "undefined". It is now 1/12.
- **No sources:** every insight here is a standard textbook fact.

## The lists, rule by rule

### Power rule

Example: `x^3`

**Key Insights** (5)

1. Power rule: d/dx(x^n) = n·x^(n-1) — bring the exponent down as a factor, then lower it by one.
2. Rewrite roots and reciprocals as powers first: √x = x^(1/2), 1/x^n = x^(−n). The power rule holds for any real exponent wherever the function is differentiable (always for x > 0).
3. A sum is differentiated term by term, and constant factors carry through: d/dx(3x⁴ − 2x + 7) = 12x³ − 2.

   *— Show more —*
4. The derivative of a constant is 0: a constant does not change, so its slope is 0.
5. Where the derivative exists, f′(x) is the slope of the tangent line: positive where f is increasing, negative where it is decreasing, and 0 at a stationary point (a smooth peak or valley, or a level spot such as x = 0 on x³).

**Common Mistakes** (4)

1. Forgetting to lower the exponent by one after bringing it down as a factor.
2. Lowering a negative exponent the wrong way: d/dx(x^-2) = -2x^-3, not -2x^-1.
3. Using the power rule on a variable exponent: d/dx(2^x) is 2^x·ln(2), not x·2^(x−1).

   *— Show more —*
4. Keeping a lone constant instead of sending it to 0.

### A polynomial (sum and constants)

Example: `3x^4 - 2x + 7`

**Key Insights** (5)

1. A sum is differentiated term by term, and constant factors carry through: d/dx(3x⁴ − 2x + 7) = 12x³ − 2.
2. Power rule: d/dx(x^n) = n·x^(n-1) — bring the exponent down as a factor, then lower it by one.
3. Rewrite roots and reciprocals as powers first: √x = x^(1/2), 1/x^n = x^(−n). The power rule holds for any real exponent wherever the function is differentiable (always for x > 0).

   *— Show more —*
4. The derivative of a constant is 0: a constant does not change, so its slope is 0.
5. Where the derivative exists, f′(x) is the slope of the tangent line: positive where f is increasing, negative where it is decreasing, and 0 at a stationary point (a smooth peak or valley, or a level spot such as x = 0 on x³).

**Common Mistakes** (5)

1. Forgetting to lower the exponent by one after bringing it down as a factor.
2. Keeping a lone constant instead of sending it to 0.
3. Sign slips when differentiating negative or subtracted terms.

   *— Show more —*
4. Lowering a negative exponent the wrong way: d/dx(x^-2) = -2x^-3, not -2x^-1.
5. Using the power rule on a variable exponent: d/dx(2^x) is 2^x·ln(2), not x·2^(x−1).

### Negative exponent

Example: `1/x^2`

**Key Insights** (5)

1. Rewrite reciprocals as powers before differentiating: 1/x^n = x^(-n), so the power rule applies.
2. Power rule: d/dx(x^n) = n·x^(n-1) — bring the exponent down as a factor, then lower it by one.
3. Here: d/dx(1/x^2) = d/dx(x^(−2)) = −2x^(−3) = −2/x^3.

   *— Show more —*
4. A sum is differentiated term by term, and constant factors carry through: d/dx(3x⁴ − 2x + 7) = 12x³ − 2.
5. Where the derivative exists, f′(x) is the slope of the tangent line: positive where f is increasing, negative where it is decreasing, and 0 at a stationary point (a smooth peak or valley, or a level spot such as x = 0 on x³).

**Common Mistakes** (4)

1. Lowering a negative exponent the wrong way: d/dx(x^-2) = -2x^-3, not -2x^-1.
2. Forgetting to lower the exponent by one after bringing it down as a factor.
3. Using the power rule on a variable exponent: d/dx(2^x) is 2^x·ln(2), not x·2^(x−1).

   *— Show more —*
4. Keeping a lone constant instead of sending it to 0.

### Chain rule: a trig outside

Example: `sin(3x^2)`

**Key Insights** (5)

1. Chain rule: d/dx f(g(x)) = f′(g(x))·g′(x) — differentiate the outside function, keep the inside as it is, then multiply by the inside's derivative.
2. Here the inside is u = 3x^2, with u′ = 6x: d/dx sin(3x^2) = cos(3x^2)·6x.
3. For a trig function, d/dx sin(u) = cos(u)·u′, and the same pattern holds for each of the others.

   *— Show more —*
4. Several layers take one factor each: d/dx sin(e^(2x)) = cos(e^(2x))·e^(2x)·2.
5. Where the derivative exists, f′(x) is the slope of the tangent line: positive where f is increasing, negative where it is decreasing, and 0 at a stationary point (a smooth peak or valley, or a level spot such as x = 0 on x³).

**Common Mistakes** (3)

1. Forgetting to multiply by the derivative of the inside function.
2. Changing the inside too: the outside's derivative keeps the original inside, so here it is cos(3x^2), with 3x^2 unchanged inside it.
3. Stopping after one layer when there are several.

### Chain rule: a power outside

Example: `(2x+1)^5`

**Key Insights** (6)

1. Chain rule: d/dx f(g(x)) = f′(g(x))·g′(x) — differentiate the outside function, keep the inside as it is, then multiply by the inside's derivative.
2. Here the inside is u = 2x + 1, with u′ = 2: d/dx (2x + 1)^5 = 5·(2x + 1)^4·2.
3. For a power of an expression, d/dx u^n = n·u^(n−1)·u′: bring the power down, lower it by one, then multiply by u′.

   *— Show more —*
4. Several layers take one factor each: d/dx sin(e^(2x)) = cos(e^(2x))·e^(2x)·2.
5. A power of a polynomial could be expanded first, but the chain rule usually avoids the extra algebra: d/dx (2x + 1)^5 = 10(2x + 1)^4.
6. Where the derivative exists, f′(x) is the slope of the tangent line: positive where f is increasing, negative where it is decreasing, and 0 at a stationary point (a smooth peak or valley, or a level spot such as x = 0 on x³).

**Common Mistakes** (3)

1. Forgetting to multiply by the derivative of the inside function.
2. Changing the inside too: the outside's derivative keeps the original inside, so here it is 5·(2x + 1)^4, with 2x + 1 unchanged inside it.
3. Stopping after one layer when there are several.

### Chain rule: an exponential outside

Example: `e^(3x)`

**Key Insights** (5)

1. Chain rule: d/dx f(g(x)) = f′(g(x))·g′(x) — differentiate the outside function, keep the inside as it is, then multiply by the inside's derivative.
2. Here the inside is u = 3x, with u′ = 3: d/dx e^(3x) = e^(3x)·3.
3. For an exponential, d/dx e^u = e^u·u′.

   *— Show more —*
4. Several layers take one factor each: d/dx sin(e^(2x)) = cos(e^(2x))·e^(2x)·2.
5. Where the derivative exists, f′(x) is the slope of the tangent line: positive where f is increasing, negative where it is decreasing, and 0 at a stationary point (a smooth peak or valley, or a level spot such as x = 0 on x³).

**Common Mistakes** (3)

1. Forgetting to multiply by the derivative of the inside function.
2. Changing the inside too: the outside's derivative keeps the original inside, so here it is e^(3x), with 3x unchanged inside it.
3. Stopping after one layer when there are several.

### Chain rule: a logarithm outside

Example: `ln(x^2+1)`

**Key Insights** (5)

1. Chain rule: d/dx f(g(x)) = f′(g(x))·g′(x) — differentiate the outside function, keep the inside as it is, then multiply by the inside's derivative.
2. Here the inside is u = x^2 + 1, with u′ = 2x: d/dx ln(x^2 + 1) = 1/(x^2 + 1)·2x.
3. For a logarithm, d/dx ln(u) = u′/u: the derivative of the inside over the inside.

   *— Show more —*
4. Several layers take one factor each: d/dx sin(e^(2x)) = cos(e^(2x))·e^(2x)·2.
5. Where the derivative exists, f′(x) is the slope of the tangent line: positive where f is increasing, negative where it is decreasing, and 0 at a stationary point (a smooth peak or valley, or a level spot such as x = 0 on x³).

**Common Mistakes** (3)

1. Forgetting to multiply by the derivative of the inside function.
2. Changing the inside too: the outside's derivative keeps the original inside, so here it is 1/(x^2 + 1), with x^2 + 1 unchanged inside it.
3. Stopping after one layer when there are several.

### Chain rule: an inverse trig outside

Example: `arctan(2x)`

**Key Insights** (5)

1. Chain rule: d/dx f(g(x)) = f′(g(x))·g′(x) — differentiate the outside function, keep the inside as it is, then multiply by the inside's derivative.
2. Here the inside is u = 2x, with u′ = 2: d/dx arctan(2x) = 1/(1 + (2x)²)·2.
3. For an inverse trig function, d/dx arctan(u) = u′/(1 + u²) and d/dx arcsin(u) = u′/√(1 − u²).

   *— Show more —*
4. Several layers take one factor each: d/dx sin(e^(2x)) = cos(e^(2x))·e^(2x)·2.
5. Where the derivative exists, f′(x) is the slope of the tangent line: positive where f is increasing, negative where it is decreasing, and 0 at a stationary point (a smooth peak or valley, or a level spot such as x = 0 on x³).

**Common Mistakes** (3)

1. Forgetting to multiply by the derivative of the inside function.
2. Changing the inside too: the outside's derivative keeps the original inside, so here it is 1/(1 + (2x)²), with 2x unchanged inside it.
3. Stopping after one layer when there are several.

### Product rule

Example: `x^2*sin(x)`

**Key Insights** (6)

1. Product rule: (u·w)′ = u′·w + u·w′ — the derivative of a product is NOT the product of the derivatives.
2. Here u = x^2 and w = sin(x), so u′ = 2x and w′ = cos(x): the derivative is 2x·sin(x) + x^2·cos(x).
3. Tidy the result by factoring out what the two terms share, such as a power of x or an exponential.

   *— Show more —*
4. With three factors, each takes a turn being differentiated: (u·v·w)′ = u′·v·w + u·v′·w + u·v·w′.
5. A constant factor needs no product rule: d/dx(5x²) = 10x.
6. Where the derivative exists, f′(x) is the slope of the tangent line: positive where f is increasing, negative where it is decreasing, and 0 at a stationary point (a smooth peak or valley, or a level spot such as x = 0 on x³).

**Common Mistakes** (3)

1. Differentiating each factor and multiplying the results — (u·w)′ is not u′·w′.
2. Missing a chain rule inside a factor: in x²·e^(3x), the factor e^(3x) differentiates to 3e^(3x), not e^(3x).
3. Dropping one of the two terms: both u′·w and u·w′ are needed.

### Product with a chain inside

Example: `x^2*e^(3x)`

**Key Insights** (6)

1. Product rule: (u·w)′ = u′·w + u·w′ — the derivative of a product is NOT the product of the derivatives.
2. Here u = x^2 and w = e^(3x), so u′ = 2x and w′ = 3e^(3x) (one factor needs the chain rule): the derivative is 2x·e^(3x) + x^2·3e^(3x).
3. Tidy the result by factoring out what the two terms share: here it becomes x*e^(3x)*(3x + 2).

   *— Show more —*
4. With three factors, each takes a turn being differentiated: (u·v·w)′ = u′·v·w + u·v′·w + u·v·w′.
5. A constant factor needs no product rule: d/dx(5x²) = 10x.
6. Where the derivative exists, f′(x) is the slope of the tangent line: positive where f is increasing, negative where it is decreasing, and 0 at a stationary point (a smooth peak or valley, or a level spot such as x = 0 on x³).

**Common Mistakes** (3)

1. Differentiating each factor and multiplying the results — (u·w)′ is not u′·w′.
2. Missing a chain rule inside a factor: in x²·e^(3x), the factor e^(3x) differentiates to 3e^(3x), not e^(3x).
3. Dropping one of the two terms: both u′·w and u·w′ are needed.

### Quotient rule

Example: `(x+1)/(x-1)`

**Key Insights** (6)

1. Quotient rule: (u/w)′ = (u′·w − u·w′)/w² — "low d-high minus high d-low, over low squared".
2. Here u = x + 1 and w = x - 1, so u′ = 1 and w′ = 1: the derivative is (1·(x - 1) − (x + 1)·1)/(x - 1)².
3. Leave the denominator squared rather than expanding it: w² shows at a glance where the derivative is undefined.

   *— Show more —*
4. A constant numerator is quicker as a power: d/dx(3/x²) = d/dx(3x^(−2)) = −6x^(−3).
5. Writing u/w as u·w^(−1) and using the product and chain rules gives the same answer, a useful check.
6. Where the derivative exists, f′(x) is the slope of the tangent line: positive where f is increasing, negative where it is decreasing, and 0 at a stationary point (a smooth peak or valley, or a level spot such as x = 0 on x³).

**Common Mistakes** (3)

1. Swapping the order in the numerator of the quotient rule; the subtraction makes the order matter.
2. Forgetting to square the denominator: it is w², not w.
3. Differentiating top and bottom separately: (u/w)′ is not u′/w′.

### Trig

Example: `sin(x)`

**Key Insights** (5)

1. d/dx sin(x) = cos(x), d/dx cos(x) = −sin(x), d/dx tan(x) = sec²(x) — the trig derivatives are worth memorising as a set.
2. d/dx sec(x) = sec(x)·tan(x), d/dx csc(x) = −csc(x)·cot(x), d/dx cot(x) = −csc²(x): the co-functions carry the minus sign.
3. sin and cos come back every four derivatives: sin → cos → −sin → −cos → sin.

   *— Show more —*
4. These rules hold for angles in radians; in degrees every derivative picks up a factor π/180.
5. Where the derivative exists, f′(x) is the slope of the tangent line: positive where f is increasing, negative where it is decreasing, and 0 at a stationary point (a smooth peak or valley, or a level spot such as x = 0 on x³).

**Common Mistakes** (3)

1. Losing the minus sign in d/dx cos(x) = −sin(x).
2. Writing d/dx tan(x) as sec(x) instead of sec²(x).
3. Working in degrees: the derivatives above assume radians.

### Trig co-function

Example: `sec(x)`

**Key Insights** (5)

1. d/dx sec(x) = sec(x)·tan(x), d/dx csc(x) = −csc(x)·cot(x), d/dx cot(x) = −csc²(x): the co-functions carry the minus sign.
2. d/dx sin(x) = cos(x), d/dx cos(x) = −sin(x), d/dx tan(x) = sec²(x) — the trig derivatives are worth memorising as a set.
3. sin and cos come back every four derivatives: sin → cos → −sin → −cos → sin.

   *— Show more —*
4. These rules hold for angles in radians; in degrees every derivative picks up a factor π/180.
5. Where the derivative exists, f′(x) is the slope of the tangent line: positive where f is increasing, negative where it is decreasing, and 0 at a stationary point (a smooth peak or valley, or a level spot such as x = 0 on x³).

**Common Mistakes** (4)

1. Confusing the derivative of sec(x) with sec²(x): d/dx sec(x) = sec(x)·tan(x), while d/dx tan(x) = sec²(x).
2. Losing the minus sign in d/dx cos(x) = −sin(x).
3. Writing d/dx tan(x) as sec(x) instead of sec²(x).

   *— Show more —*
4. Working in degrees: the derivatives above assume radians.

### Inverse trig

Example: `arcsin(x)`

**Key Insights** (5)

1. d/dx arcsin(x) = 1/√(1 − x^2), d/dx arccos(x) = −1/√(1 − x^2), d/dx arctan(x) = 1/(1 + x^2) — arcsin and arccos differ only in sign.
2. Each comes from implicit differentiation: y = arcsin(x) means sin(y) = x, so cos(y)·y′ = 1 and y′ = 1/cos(y) = 1/√(1 − x²).
3. With an inside: d/dx arctan(u) = u′/(1 + u²), d/dx arcsin(u) = u′/√(1 − u²).

   *— Show more —*
4. arcsin and arccos are defined for −1 ≤ x ≤ 1, and their derivatives only for −1 < x < 1.
5. Where the derivative exists, f′(x) is the slope of the tangent line: positive where f is increasing, negative where it is decreasing, and 0 at a stationary point (a smooth peak or valley, or a level spot such as x = 0 on x³).

**Common Mistakes** (3)

1. Reading arcsin(x) (also written sin^(-1)(x)) as 1/sin(x): it is the inverse function, not the reciprocal.
2. Forgetting the minus sign on arccos.
3. Dropping the square root: d/dx arcsin(x) is 1/√(1 − x²), not 1/(1 − x²).

### Hyperbolic

Example: `sinh(x)`

**Key Insights** (4)

1. d/dx sinh(x) = cosh(x) and d/dx cosh(x) = sinh(x), with no minus sign; d/dx tanh(x) = 1 − tanh^2(x).
2. They follow from sinh(x) = (e^x − e^(−x))/2 and cosh(x) = (e^x + e^(−x))/2, differentiated term by term.
3. cosh²(x) − sinh²(x) = 1 plays the part that sin²(x) + cos²(x) = 1 plays for trig functions.

   *— Show more —*
4. Where the derivative exists, f′(x) is the slope of the tangent line: positive where f is increasing, negative where it is decreasing, and 0 at a stationary point (a smooth peak or valley, or a level spot such as x = 0 on x³).

**Common Mistakes** (2)

1. Adding a minus sign to d/dx cosh(x) by analogy with cos(x).
2. Writing d/dx tanh(x) as 1 + tanh²(x), by analogy with tan(x).

### Exponential

Example: `e^x`

**Key Insights** (4)

1. d/dx e^x = e^x: the exponential is its own derivative, and d/dx a^x = a^x·ln(a) for a constant base a > 0 (with a = e it is the same rule, since ln(e) = 1).
2. With an inside: d/dx e^u = e^u·u′, so d/dx e^(3x) = 3e^(3x).
3. e^x is the function whose slope at every point equals its height; that is what makes e the natural base.

   *— Show more —*
4. Where the derivative exists, f′(x) is the slope of the tangent line: positive where f is increasing, negative where it is decreasing, and 0 at a stationary point (a smooth peak or valley, or a level spot such as x = 0 on x³).

**Common Mistakes** (3)

1. Treating e^x like a power and writing x·e^(x-1) — the power rule is for a variable BASE, not a variable exponent.
2. Forgetting the ln(a) for a base other than e: d/dx 2^x = 2^x·ln(2).
3. Leaving out the inside's derivative: d/dx e^(3x) is 3e^(3x).

### Exponential, another base

Example: `2^x`

**Key Insights** (5)

1. For a constant base a > 0, d/dx a^x = a^x·ln(a): here d/dx 2^x = 2^x·ln(2).
2. d/dx e^x = e^x: the exponential is its own derivative, and d/dx a^x = a^x·ln(a) for a constant base a > 0 (with a = e it is the same rule, since ln(e) = 1).
3. With an inside: d/dx e^u = e^u·u′, so d/dx e^(3x) = 3e^(3x).

   *— Show more —*
4. e^x is the function whose slope at every point equals its height; that is what makes e the natural base.
5. Where the derivative exists, f′(x) is the slope of the tangent line: positive where f is increasing, negative where it is decreasing, and 0 at a stationary point (a smooth peak or valley, or a level spot such as x = 0 on x³).

**Common Mistakes** (3)

1. Treating e^x like a power and writing x·e^(x-1) — the power rule is for a variable BASE, not a variable exponent.
2. Forgetting the ln(a) for a base other than e: d/dx 2^x = 2^x·ln(2).
3. Leaving out the inside's derivative: d/dx e^(3x) is 3e^(3x).

### Natural log

Example: `ln(x)`

**Key Insights** (5)

1. d/dx ln(x) = 1/x, valid on the domain x > 0; for log base b, divide by ln(b).
2. With an inside: d/dx ln(u) = u′/u, so d/dx ln(x² + 1) = 2x/(x² + 1).
3. Log laws can save work, on the domain where both sides are defined: for x > 0, ln(x³·(x + 1)) = 3ln(x) + ln(x + 1).

   *— Show more —*
4. ln|x| has derivative 1/x on both sides of 0.
5. Where the derivative exists, f′(x) is the slope of the tangent line: positive where f is increasing, negative where it is decreasing, and 0 at a stationary point (a smooth peak or valley, or a level spot such as x = 0 on x³).

**Common Mistakes** (3)

1. Writing d/dx ln(x) as 1/ln(x) or as ln(x)/x.
2. Forgetting the 1/ln(b) for another base: d/dx log(x) = 1/(x·ln(10)).
3. Ignoring the domain: ln(x) and its derivative exist only for x > 0.

### Common log

Example: `log(x)`

**Key Insights** (7)

1. "log(…)" is read as the common logarithm, base 10, as on a calculator. Write "ln(…)" for the natural logarithm, or "log(x, b)" / "log_b(x)" for another base.
2. log(x) is base 10 here: d/dx log(x) = 1/(x·ln(10)), the natural-log derivative divided by ln(10).
3. d/dx ln(x) = 1/x, valid on the domain x > 0; for log base b, divide by ln(b).

   *— Show more —*
4. With an inside: d/dx ln(u) = u′/u, so d/dx ln(x² + 1) = 2x/(x² + 1).
5. Log laws can save work, on the domain where both sides are defined: for x > 0, ln(x³·(x + 1)) = 3ln(x) + ln(x + 1).
6. ln|x| has derivative 1/x on both sides of 0.
7. Where the derivative exists, f′(x) is the slope of the tangent line: positive where f is increasing, negative where it is decreasing, and 0 at a stationary point (a smooth peak or valley, or a level spot such as x = 0 on x³).

**Common Mistakes** (3)

1. Writing d/dx ln(x) as 1/ln(x) or as ln(x)/x.
2. Forgetting the 1/ln(b) for another base: d/dx log(x) = 1/(x·ln(10)).
3. Ignoring the domain: ln(x) and its derivative exist only for x > 0.

### Logarithmic differentiation

Example: `x^x`

**Key Insights** (4)

1. For x^x-type terms (real-valued for x > 0), take ln of both sides first: ln(y) = x·ln(x), differentiate implicitly, then multiply back by y.
2. Differentiating ln(y) = x·ln(x) gives y′/y = ln(x) + 1, so y′ = x^x·(ln(x) + 1).
3. Logarithmic differentiation also tames long products and quotients: the logarithm turns them into sums, differentiated term by term.

   *— Show more —*
4. Where the derivative exists, f′(x) is the slope of the tangent line: positive where f is increasing, negative where it is decreasing, and 0 at a stationary point (a smooth peak or valley, or a level spot such as x = 0 on x³).

**Common Mistakes** (3)

1. Applying the power rule or the exponential rule to a term where BOTH the base and the exponent contain the variable.
2. Forgetting to multiply back by y at the end.
3. Taking half of it. Logarithmic differentiation gives, for f(x)^g(x) with f(x) > 0, d/dx f^g = g·f^(g−1)·f′ + f^g·ln(f)·g′: a power-rule part and an exponential-rule part. For x^x that is x·x^(x−1) + x^x·ln(x); either part alone is wrong.

### Error function

Example: `erf(x)`

**Key Insights** (4)

1. erf(x) is defined by an integral, (2/√π)·∫_0^x e^(−t^2) dt: its derivative is the integrand times 2/√π, by the Fundamental Theorem of Calculus.
2. With an inside, the chain rule as usual: d/dx erf(u) = (2/√π)·e^(−u²)·u′.
3. The same reasoning differentiates any function defined as an integral: d/dx ∫_a^x f(t) dt = f(x).

   *— Show more —*
4. Where the derivative exists, f′(x) is the slope of the tangent line: positive where f is increasing, negative where it is decreasing, and 0 at a stationary point (a smooth peak or valley, or a level spot such as x = 0 on x³).

**Common Mistakes** (3)

1. Looking for an elementary antiderivative of e^(−x^2): there is none, which is why erf is defined as an integral.
2. Leaving out u′ when the inside is not x: d/dx erf(2x) = (2/√π)·e^(−4x²)·2.
3. Dropping the constant 2/√π.

### Absolute value

Example: `abs(2x-4)`

**Key Insights** (5)

1. |u| = u for u ≥ 0 and −u for u < 0: an absolute value is a piecewise function, and each piece is differentiated on its own.
2. Here: f'(x) = -2 for x < 2, f'(x) = 2 for x > 2, and no derivative at the corner x = 2.
3. A derivative exists at a point only if the left and right derivatives agree. At a corner they do not, so there is no tangent line there.

   *— Show more —*
4. Away from the corner, d/dx|u| = sgn(u)·u′ — the sign of u times the inner derivative.
5. A function can be continuous at a point without being differentiable there: |x| has no gap at 0, only a corner.

**Common Mistakes** (4)

1. Applying the power rule to |x| as if it were x.
2. Substituting the corner into a formula without checking the two sides first: at x = 2 the slopes -2 and 2 disagree, so there is no derivative there.
3. Reporting f'(2) = 0 because sgn(0) = 0 on a calculator — the derivative does not exist there.

   *— Show more —*
4. Forgetting the inner derivative: the slopes on the two sides are the inside's slope with each sign, not just ±1.

### Second derivative

Example: `second derivative of x*e^x`

**Key Insights** (8)

1. A higher derivative is the derivative of the derivative: differentiate f′ to get f″, and so on. f″ says how the slope is changing: positive where the graph bends up, negative where it bends down.
2. Product rule: (u·w)′ = u′·w + u·w′ — the derivative of a product is NOT the product of the derivatives.
3. Apply the rules once per order: f′(x) = e^x*(x + 1), then f″(x) = e^x*(x + 2).

   *— Show more —*
4. Here u = x and w = e^x, so u′ = 1 and w′ = e^x: the derivative is 1·e^x + x·e^x.
5. Tidy the result by factoring out what the two terms share, such as a power of x or an exponential.
6. With three factors, each takes a turn being differentiated: (u·v·w)′ = u′·v·w + u·v′·w + u·v·w′.
7. A constant factor needs no product rule: d/dx(5x²) = 10x.
8. Where the derivative exists, f′(x) is the slope of the tangent line: positive where f is increasing, negative where it is decreasing, and 0 at a stationary point (a smooth peak or valley, or a level spot such as x = 0 on x³).

**Common Mistakes** (4)

1. Stopping at f′: f′(x) = e^x*(x + 1) is only the first round, and f″ needs one more, with the same rules applied to the result each time.
2. Differentiating each factor and multiplying the results — (u·w)′ is not u′·w′.
3. Missing a chain rule inside a factor: in x²·e^(3x), the factor e^(3x) differentiates to 3e^(3x), not e^(3x).

   *— Show more —*
4. Dropping one of the two terms: both u′·w and u·w′ are needed.

### Third derivative

Example: `third derivative of sin(2x)`

**Key Insights** (7)

1. A higher derivative is the derivative of the derivative: differentiate f′ to get f″, and so on. f″ says how the slope is changing: positive where the graph bends up, negative where it bends down.
2. Chain rule: d/dx f(g(x)) = f′(g(x))·g′(x) — differentiate the outside function, keep the inside as it is, then multiply by the inside's derivative.
3. Apply the rules once per order: f′(x) = 2cos(2x), then f″(x) = -4sin(2x), then f‴(x) = -8cos(2x).

   *— Show more —*
4. Here the inside is u = 2x, with u′ = 2: d/dx sin(2x) = cos(2x)·2.
5. For a trig function, d/dx sin(u) = cos(u)·u′, and the same pattern holds for each of the others.
6. Several layers take one factor each: d/dx sin(e^(2x)) = cos(e^(2x))·e^(2x)·2.
7. Where the derivative exists, f′(x) is the slope of the tangent line: positive where f is increasing, negative where it is decreasing, and 0 at a stationary point (a smooth peak or valley, or a level spot such as x = 0 on x³).

**Common Mistakes** (4)

1. Stopping at f′: f′(x) = 2cos(2x) is only the first round, and f‴ needs 2 more, with the same rules applied to the result each time.
2. Forgetting to multiply by the derivative of the inside function.
3. Changing the inside too: the outside's derivative keeps the original inside, so here it is cos(2x), with 2x unchanged inside it.

   *— Show more —*
4. Stopping after one layer when there are several.

### Value at a point

Example: `x^3 at x = 2`

**Key Insights** (7)

1. f'(a) is a number — the slope at one point — while f'(x) is a function giving the slope everywhere.
2. Power rule: d/dx(x^n) = n·x^(n-1) — bring the exponent down as a factor, then lower it by one.
3. Differentiate first, then evaluate: f′(x) = 3x^2, so f′(2) = 12.

   *— Show more —*
4. Rewrite roots and reciprocals as powers first: √x = x^(1/2), 1/x^n = x^(−n). The power rule holds for any real exponent wherever the function is differentiable (always for x > 0).
5. A sum is differentiated term by term, and constant factors carry through: d/dx(3x⁴ − 2x + 7) = 12x³ − 2.
6. The derivative of a constant is 0: a constant does not change, so its slope is 0.
7. Where the derivative exists, f′(x) is the slope of the tangent line: positive where f is increasing, negative where it is decreasing, and 0 at a stationary point (a smooth peak or valley, or a level spot such as x = 0 on x³).

**Common Mistakes** (5)

1. Substituting the point before differentiating: f(a) is a constant, whose derivative is 0. Differentiate first, then substitute.
2. Forgetting to lower the exponent by one after bringing it down as a factor.
3. Lowering a negative exponent the wrong way: d/dx(x^-2) = -2x^-3, not -2x^-1.

   *— Show more —*
4. Using the power rule on a variable exponent: d/dx(2^x) is 2^x·ln(2), not x·2^(x−1).
5. Keeping a lone constant instead of sending it to 0.

### Outside the domain

Example: `ln(x) at x = -1`

**Key Insights** (6)

1. f'(a) can exist only where f itself is defined: check that the point is in the domain of f before evaluating the derivative's formula there.
2. d/dx ln(x) = 1/x, valid on the domain x > 0; for log base b, divide by ln(b).
3. With an inside: d/dx ln(u) = u′/u, so d/dx ln(x² + 1) = 2x/(x² + 1).

   *— Show more —*
4. Log laws can save work, on the domain where both sides are defined: for x > 0, ln(x³·(x + 1)) = 3ln(x) + ln(x + 1).
5. ln|x| has derivative 1/x on both sides of 0.
6. Where the derivative exists, f′(x) is the slope of the tangent line: positive where f is increasing, negative where it is decreasing, and 0 at a stationary point (a smooth peak or valley, or a level spot such as x = 0 on x³).

**Common Mistakes** (4)

1. Applying the derivative's formula outside the domain of f: the formula may give a number at x = -1, but f(-1) is not a real number, so f'(-1) does not exist.
2. Writing d/dx ln(x) as 1/ln(x) or as ln(x)/x.
3. Forgetting the 1/ln(b) for another base: d/dx log(x) = 1/(x·ln(10)).

   *— Show more —*
4. Ignoring the domain: ln(x) and its derivative exist only for x > 0.

### Implicit differentiation

Example: `x^2 + y^2 = 25`

**Key Insights** (5)

1. Treat y as an unknown function of x: differentiate a y-term as you would f(x), so y² gives 2y·dy/dx.
2. In one line: for F(x, y) = 0, dy/dx = −F_x/F_y wherever F_y ≠ 0, from the two partial derivatives — a useful check on the term-by-term working. Where F_y = 0 the tangent is vertical or the curve has a singular point.
3. Solve for dy/dx last: collect every term with dy/dx on one side, factor it out, and divide.

   *— Show more —*
4. There is no need to solve for y first, and often no way to: y⁵ + xy = 1 has no formula for y, yet its slope is found the same way.
5. The answer is checked at a point on the curve: the slope there must match the tangent line drawn at that point.

**Common Mistakes** (3)

1. Forgetting the dy/dx on a y-term: d/dx(y²) is 2y·dy/dx, not 2y.
2. Differentiating the constant side as anything but 0.
3. Factoring dy/dx out of only some of its terms before dividing.

### Implicit, with a product

Example: `x*y = 1`

**Key Insights** (6)

1. Treat y as an unknown function of x: differentiate a y-term as you would f(x), so y² gives 2y·dy/dx.
2. A term with both x and y is a product, so the product and chain rules work together: d/dx(xy) = y + x·dy/dx.
3. In one line: for F(x, y) = 0, dy/dx = −F_x/F_y wherever F_y ≠ 0, from the two partial derivatives — a useful check on the term-by-term working. Where F_y = 0 the tangent is vertical or the curve has a singular point.

   *— Show more —*
4. Solve for dy/dx last: collect every term with dy/dx on one side, factor it out, and divide.
5. There is no need to solve for y first, and often no way to: y⁵ + xy = 1 has no formula for y, yet its slope is found the same way.
6. The answer is checked at a point on the curve: the slope there must match the tangent line drawn at that point.

**Common Mistakes** (4)

1. Forgetting the dy/dx on a y-term: d/dx(y²) is 2y·dy/dx, not 2y.
2. Treating xy as a constant times x: d/dx(xy) is y + x·dy/dx, not just y.
3. Differentiating the constant side as anything but 0.

   *— Show more —*
4. Factoring dy/dx out of only some of its terms before dividing.

### Implicit, at a point

Example: `x^2 + y^2 = 25 at (3, 4)`

**Key Insights** (7)

1. An implicit dy/dx usually involves both x and y, so evaluating it needs the whole point (x, y), not just x.
2. Here dy/dx = -x/y, so at (3, 4) it is -3/4 ≈ -0.75.
3. Treat y as an unknown function of x: differentiate a y-term as you would f(x), so y² gives 2y·dy/dx.

   *— Show more —*
4. In one line: for F(x, y) = 0, dy/dx = −F_x/F_y wherever F_y ≠ 0, from the two partial derivatives — a useful check on the term-by-term working. Where F_y = 0 the tangent is vertical or the curve has a singular point.
5. Solve for dy/dx last: collect every term with dy/dx on one side, factor it out, and divide.
6. There is no need to solve for y first, and often no way to: y⁵ + xy = 1 has no formula for y, yet its slope is found the same way.
7. The answer is checked at a point on the curve: the slope there must match the tangent line drawn at that point.

**Common Mistakes** (3)

1. Forgetting the dy/dx on a y-term: d/dx(y²) is 2y·dy/dx, not 2y.
2. Differentiating the constant side as anything but 0.
3. Factoring dy/dx out of only some of its terms before dividing.

