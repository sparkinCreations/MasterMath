# Insights review: Limits (1.63.0)

**Written:** October 29, 2026
**For:** MJ, to spot-check before 1.63.0 is pushed
**Revised:** after two outside reviews ("agree, with revisions", then "approve with two small corrections"); every claim and verdict is Rounds 25 and 26 of [`../../evaluations/2026-10/REVIEW-LOG-2026-10.md`](../../evaluations/2026-10/REVIEW-LOG-2026-10.md)
**Plan:** [`../PLAN-INSIGHTS-AND-RESOURCES.md`](../PLAN-INSIGHTS-AND-RESOURCES.md) · **Before this:** [Integrals](INTEGRALS.md), [Derivatives](DERIVATIVES.md), [Algebra](ALGEBRA.md)

Generated from the solver, so it is exactly what a student sees for each
example (formulas as plain text here, typeset on the page). The first three
of each list show; **"Show more"** opens the rest. Where the solver itself
changed, the working is included (open "Working").

## What to check

1. **Order:** is the most useful insight first for each technique?
2. **Accuracy and wording**, especially the new working: growth rates, the
   conjugate at infinity, a function defined on one side only, and 0⁰.
3. **Missing:** an insight or mistake a student needs that is not here.
4. **The one-sided domain convention** (settled in the review): ln(x) at 0
   is answered lim (x→0⁺) ln(x) = −∞, and the last step says some courses
   accept the plain limit over the domain while others call it
   nonexistent.

## Built in from the start (the lessons of the first three topics)

- **The second insight works the student's own limit**, read from its
  steps: the cancelled form, the rewritten standard limit, the squeeze
  bounds, E·u in a 1^∞, the series' first terms, the number of L'Hôpital
  rounds, the degrees, each side of a jump or an asymptote.
- **Statements say where they hold:** a quotient is continuous where its
  denominator is not 0; standard limits as u → 0 and in radians;
  L'Hôpital's rule needs g′ ≠ 0 and the new limit to exist; √(x²) = −x for
  x < 0.
- **A sampled answer says it was sampled** and points to the technique that
  would prove it; it never wears a technique's insights.
- **Swept for wrong answers before writing:** about 60 limits across every
  technique and its edges. Found and fixed:
  - **lim x→∞ ln(x) said "does not exist"** (slow growth looked like not
    settling); it is ∞.
  - **lim x→∞ x·sin(x) said ∞**, from the sign of the last sample; it does
    not exist.
  - **ln(x) at 0:** "the one-sided limits disagree", with −18.42 read as
    the right-hand value; now −∞ from the right, said so.
  - **x^x at 0:** "defined and equals 1", then "simplify: x^x, substitute:
    1"; now 0⁰ is named as indeterminate.
  - **√x·ln(x) at 0⁺** was said not to exist (it settles too slowly to
    sample); now 0, by growth rates.
  - **x²·ln(x)** looked defined left of 0 (a tiny imaginary part rounded
    away); caught.
- **Worked, where it was sampled:** x/eˣ, x³/e^(2x), x²·e^(−x), ln(x)/x,
  x·ln(x), √(x² + x) − x, e^(−x). Still sampled, and saying so:
  x^(1/x), x·e^(−x²), x/1.5^x (each says it is an estimate).
- **Revised after the review:** proofs replace samples (x^x by
  logarithms; sin x, x·sin x, sin(1/x) by two sequences; x/2^x by growth
  rates; and, swept, every rational vertical asymptote by sign analysis and
  ln(x) → −∞ at 0⁺); one-sided domains answered as x → 0⁺; the factor rule stated for
  polynomials; the L'Hôpital worked line shows the chain; the conjugate
  insights made general. After the second review: limits at −∞ by t = −x,
  roots whose leading terms do not cancel read off, and lim x→−∞ ln(x),
  which was −∞, now does not exist (outside the domain).
- **No sources:** every insight here is a standard textbook fact.

## The lists, technique by technique

### Direct substitution

Example: `lim x->2 x^2+1` → lim (x→2) x^2 + 1 = 5

**Key Insights** (6)

1. Where a function is continuous, the limit is its value: start by substituting the value directly.
2. Here: x^2 + 1 is defined at x = 2, and substituting gives 5, a number, so no technique is needed.
3. Polynomials, and sin, cos, eˣ and roots on their domains, are continuous, so substitution works for them.

   *— Show more —*
4. When substitution gives a finite value by continuity, no other technique is needed; a 0/0 form or a division by 0 needs more analysis.
5. A sum, product or quotient of continuous functions is continuous (a quotient wherever its denominator is not zero), and so is a composition of them.
6. A limit describes the values near the point, not at it: for a continuous function the two agree, which is what continuity means.

**Common Mistakes** (4)

1. Reaching for a technique when direct substitution already gives a number.
2. Substituting into a function that is not defined at the point and reporting that value.
3. Assuming the limit equals the function value at a jump or a hole.

   *— Show more —*
4. Treating 0/0 as 0 or 1: it is a signal to simplify, not a value.

### End of the domain, defined there

Example: `lim x->0 sqrt(x)` → lim (x→0⁺) sqrt(x) = 0

<details><summary>Working</summary>

- Evaluate lim (x→0) sqrt(x)
- Substitute directly: at x = 0, the function is defined and equals 0.
- The function is not defined just to the left of x = 0, so x can only approach 0 from the right: the limit is the right-hand limit, x → 0⁺.
- From that side the function is continuous at 0, so the limit is its value there, 0.
- sqrt(x) is defined only to the right of 0 near it, so the answer is its right-hand limit, lim (x→0⁺) sqrt(x) = 0. Whether the plain lim (x→0) is accepted depends on your course: some take a limit over the function's domain, others require both sides and call it nonexistent.

</details>

**Key Insights** (4)

1. At an end of the domain (√x at 0), the function lives on one side only, so the limit is taken from that side.
2. Here: sqrt(x) is not defined just to the left of 0, so x → 0 can only mean x → 0⁺.
3. The answer is written as the one-sided limit. Courses differ on the plain two-sided notation: some accept it (a limit taken over the domain), others require the function on both sides and call it nonexistent.

   *— Show more —*
4. Where a function is continuous from the side it lives on, that one-sided limit is its value at the point.

**Common Mistakes** (3)

1. Sampling the side where the function is not defined: √(−0.001) is not a real number.
2. Writing lim (x→0) where your course expects lim (x→0⁺) for a function defined on one side only.
3. Assuming a function defined at a point is defined on both sides of it.

### End of the domain, not defined there

Example: `lim x->0 ln(x)` → lim (x→0⁺) ln(x) = -∞

<details><summary>Working</summary>

- Evaluate lim (x→0) ln(x)
- The function is not defined just to the left of x = 0, so x can only approach 0 from the right: the limit is the right-hand limit, x → 0⁺.
- As x → 0⁺, ln(x) → −∞: ln is increasing and ln(e^(−M)) = −M, so ln(x) < −M once 0 < x < e^(−M), for every M.
- So ln(x) → -∞: the limit is -∞.
- ln(x) is defined only to the right of 0 near it, so the answer is its right-hand limit, lim (x→0⁺) ln(x) = -∞. Whether the plain lim (x→0) is accepted depends on your course: some take a limit over the function's domain, others require both sides and call it nonexistent.

</details>

**Key Insights** (4)

1. When a function is defined on one side of the point only (ln(x) near 0), the limit can only be approached from that side.
2. Here: ln(x) is not defined just to the left of 0, so x → 0 can only mean x → 0⁺.
3. The answer is written as the one-sided limit. Courses differ on the plain two-sided notation: some accept it (a limit taken over the domain), others require the function on both sides and call it nonexistent.

   *— Show more —*
4. ln(x) is defined only for x > 0 and √x only for x ≥ 0: check the domain before sampling a side.

**Common Mistakes** (3)

1. Calling the one-sided limits "different" when one side does not exist at all.
2. Reading a slow trend as a value: ln(10^(−8)) ≈ −18.4, but ln(x) → −∞ as x → 0⁺.
3. Writing lim (x→0) where your course expects lim (x→0⁺) for a function defined on one side only.

### Factor and cancel

Example: `lim x->1 (x^2-1)/(x-1)` → lim (x→1) (x^2 - 1)/(x - 1) = 2

**Key Insights** (6)

1. For a quotient of polynomials that gives 0/0 at x = a, both have the factor (x − a): factor them, cancel it (allowed, since x ≠ a near the point), then substitute.
2. Here: (x^2 - 1)/(x - 1) = x + 1 for x ≠ 1, and x + 1 → 2 as x → 1.
3. The cancelled form equals the original everywhere except at the point itself — that is exactly what a limit needs.

   *— Show more —*
4. On the graph, a cancelled factor is a hole (removable discontinuity), not an asymptote.
5. By the Factor Theorem, if a polynomial is 0 at x = a, then (x − a) is one of its factors: that is the factor to look for.
6. If 0/0 remains after one cancellation, the factor is repeated: factor and cancel again.

**Common Mistakes** (4)

1. Substituting the value before cancelling and stopping at 0/0.
2. Claiming the function "equals" the simplified form at the point — it is undefined there.
3. Cancelling terms instead of factors.

   *— Show more —*
4. Writing the limit as "undefined" because the function is undefined at the point: the limit can still exist.

### Standard limit sin(u)/u

Example: `lim x->0 sin(3x)/x` → lim (x→0) sin(3x)/x = 3

**Key Insights** (6)

1. The standard limits sin(u)/u → 1 and (1 − cos u)/u² → 1/2 (as u → 0) are the building blocks: rewrite so the argument of the trig function matches the denominator.
2. Here: sin(3x)/x = (3) · sin(3x)/(3x), and the fraction → 1, so the limit is 3.
3. A constant factor comes out: sin(5x)/(2x) = (5/2)·sin(5x)/(5x) → 5/2.

   *— Show more —*
4. tan(u)/u → 1 too, because tan(u)/u = (sin(u)/u)·(1/cos(u)), and cos(u) → 1.
5. These limits are the reason d/dx sin(x) = cos(x) — they sit under every trig derivative.
6. The angle must be in radians: in degrees, sin(u°)/u → π/180, not 1.

**Common Mistakes** (4)

1. Forgetting the constant factor when the argument is scaled (sin(3x)/x → 3, not 1).
2. Substituting x = 0 and stopping at 0/0 — the form is indeterminate, not an answer.
3. Applying the standard limit when the argument does not match the denominator.

   *— Show more —*
4. Using sin(u)/u → 1 away from u → 0: as u → ∞, sin(u)/u → 0.

### Standard limit (1 − cos u)/u²

Example: `lim x->0 (1-cos(2x))/x^2` → lim (x→0) (1 - cos(2x))/x^2 = 2

**Key Insights** (5)

1. (1 − cos u)/u² → 1/2 as u → 0: it comes from sin(u)/u → 1 through 1 − cos u = 2sin²(u/2).
2. Here: (1 − cos(2x))/x^2 = (4) · (1 − cos(2x))/(2x)², and the fraction → 1/2, so the limit is 2.
3. Over u instead of u², (1 − cos u)/u → 0: the top shrinks like u²/2, faster than the bottom.

   *— Show more —*
4. The same answer comes from the series cos u = 1 − u²/2 + …: 1 − cos u ≈ u²/2 near 0.
5. Multiplying by 1 + cos u works too: (1 − cos u)(1 + cos u) = sin²u.

**Common Mistakes** (3)

1. Squaring the scale factor wrongly: (1 − cos(2x))/x² → 2, not 1/2 or 1.
2. Substituting x = 0 and stopping at 0/0 — the form is indeterminate, not an answer.
3. Mixing up the two forms: over u² the limit is 1/2, over u it is 0.

### Conjugate

Example: `lim x->4 (sqrt(x)-2)/(x-4)` → lim (x→4) (sqrt(x) - 2)/(x - 4) = 1/4

**Key Insights** (4)

1. A difference with a root, √a − b, is rationalised by its conjugate: multiply top and bottom by √a + b, using (√a − b)(√a + b) = a − b^2.
2. Here: after the conjugate and the cancelling, (sqrt(x) - 2)/(x - 4) becomes 1/(2 + x^(1/2)), which is defined at x = 4: substituting gives 1/4.
3. The product clears the root and usually exposes the factor that made 0/0; cancel it, then substitute.

   *— Show more —*
4. Leave the other side of the fraction factored: expanding it only hides the factor you are about to cancel.

**Common Mistakes** (3)

1. Multiplying only the numerator by the conjugate, which changes the value.
2. Expanding (√a − b)(√a + b) as a − b instead of a − b^2.
3. Substituting before cancelling, and getting 0/0 again.

### Conjugate at infinity (new)

Example: `lim x->infinity x - sqrt(x^2 + 3x)` → lim (x→∞) x - sqrt(x^2 + 3x) = -3/2 (≈ -1.5)

<details><summary>Working</summary>

- Evaluate lim (x→∞) x - sqrt(x^2 + 3x)
- Factor out the sign: x - sqrt(x^2 + 3x) = −(√(x^2 + 3x) − x).
- As x → ∞, both √(x^2 + 3x) and x grow without bound at the same rate: the form ∞ − ∞, which on its own says nothing.
- Multiply and divide by the conjugate √(x^2 + 3x) + x. Since (a − b)(a + b) = a² − b², the top becomes (x^2 + 3x) − (x)^2 = 3x: the square root is gone.
- Divide the top and the bottom by x. The top → 3; on the bottom, √(x^2 + 3x)/x → 1 (√(x^2) = x for x > 0) and x/x → 1, so the bottom → 2.
- So the limit is −(3/2) = -3/2.

</details>

**Key Insights** (5)

1. ∞ − ∞ is indeterminate: a root and a linear term that grow at the same rate can differ by any amount. The conjugate turns the difference into a quotient.
2. Here: x - sqrt(x^2 + 3x) = −3x/(√(x^2 + 3x) + x), a quotient whose top and bottom grow at the same rate.
3. After the conjugate, divide the top and the bottom by x; inside the root that is √(x² + bx)/x = √(1 + b/x) for x > 0, which → 1.

   *— Show more —*
4. As x → −∞, √(x²) = |x| = −x: the sign changes when x is taken inside the root.
5. When the leading growth does not cancel, there is no ∞ − ∞ to resolve and the difference diverges: as x → ∞, √(4x²) − x = 2x − x = x → ∞.

**Common Mistakes** (3)

1. Saying ∞ − ∞ = 0: two quantities that both grow can differ by any amount.
2. Writing √(x² + bx) ≈ x and concluding the limit is 0: the bx inside shifts the difference by b/2.
3. Forgetting that √(x²) = −x for negative x, which flips the sign of the answer at −∞.

### Squeeze theorem

Example: `lim x->0 x*sin(1/x)` → lim (x→0) x*sin(1/x) = 0

**Key Insights** (4)

1. The squeeze theorem: if g ≤ f ≤ h near the point and g and h have the same limit L, so does f.
2. Here: −|x| ≤ x·sin(1/x) ≤ |x|, and both bounds → 0, so the limit is 0.
3. A bounded factor times something going to 0 goes to 0, whatever the bounded factor does: |g·h| ≤ M·|h| when |g| ≤ M.

   *— Show more —*
4. The bounds come from facts like −1 ≤ sin(u) ≤ 1, which hold for every u.

**Common Mistakes** (4)

1. Concluding sin(1/x) itself has a limit at 0: it oscillates; only its product with x is squeezed.
2. Using bounds that have different limits, which squeeze nothing.
3. Forgetting that the bounds must hold on both sides of the point.

   *— Show more —*
4. Using the product rule for limits, lim x · lim sin(1/x): it needs both limits to exist, and the second does not.

### 1^∞ by logarithms

Example: `lim x->infinity (1+1/x)^(2x)` → lim (x→∞) (1 + 1/x)^(2x) = e^2 (≈ 7.3891)

**Key Insights** (5)

1. 1^∞ is indeterminate: a base just above 1 raised to a huge power can go anywhere. Take logarithms to bring the exponent down: ln(B^E) = E·ln(B).
2. Here: E·u = (2x)·(1/x) = 2, so ln L = 2 and the limit is e^2.
3. ln(1 + u) ≈ u for small u (the standard limit ln(1 + u)/u → 1), so lim B^E = e^(lim E·(B − 1)).

   *— Show more —*
4. The family to know: (1 + a/x)^(bx) → e^(ab) as x → ∞, and (1 + ax)^(b/x) → e^(ab) as x → 0.
5. e itself is defined this way: (1 + 1/n)^n → e, the limit of compound interest compounded ever more often.

**Common Mistakes** (3)

1. Saying 1^∞ = 1: the base is only approaching 1, and the exponent magnifies the difference.
2. Forgetting to undo the logarithm at the end: ln L = 2 means L = e², not 2.
3. Dropping the constant in the exponent: (1 + 1/x)^(2x) → e², not e.

### Taylor series

Example: `lim x->0 (e^x-1-x)/x^2` → lim (x→0) (e^x - 1 - x)/x^2 = 1/2

<details><summary>Working</summary>

- Evaluate lim (x→0) (e^x - 1 - x)/x^2
- Direct substitution gives 0/0, so expand the numerator and denominator as Taylor series about x = 0.
- Numerator ≈ x^2/2 + x^3/6 + x^4/24 + …; denominator ≈ x^2.
- Divide the series and cancel the common factor; the limit is 1/2.

</details>

**Key Insights** (5)

1. Near 0, replace each function by the start of its series: e^x = 1 + x + x^2/2 + …, sin x = x − x^3/6 + …, cos x = 1 − x^2/2 + ….
2. Here: the numerator starts x^2/2 and the denominator x^2; after cancelling, the limit is 1/2.
3. Keep terms up to the lowest power that survives in the denominator; after cancelling it, the constant left is the limit.

   *— Show more —*
4. A 0/0 form that L'Hôpital's rule needs several rounds for is often one line with series.
5. ln(1 + x) = x − x^2/2 + … and tan x = x + x^3/3 + … complete the set most limits need.

**Common Mistakes** (3)

1. Stopping the series too early, so everything cancels and the true leading term is lost.
2. Expanding about the wrong point: the series must be about the value x approaches.
3. Dropping a sign in an alternating series such as the one for sin.

### L'Hôpital's rule

Example: `lim x->0 (tan(x)-x)/x^3` → lim (x→0) (tan(x) - x)/x^3 = 1/3

**Key Insights** (6)

1. L'Hôpital's rule applies only to 0/0 or ∞/∞: then lim f/g = lim f′/g′.
2. Here: the bottom goes 3x^2, then 6x, then 6; only after round 3 is it not 0 at x = 0, and substitution gives 1/3.
3. Differentiate the top and the bottom separately, then substitute again; repeat while the form stays indeterminate.

   *— Show more —*
4. Check the form before every round: once substitution gives a number, stop.
5. It also needs g′ ≠ 0 near the point, and the new limit to exist (or be infinite); when it fails, the original limit can still exist.
6. Another form (0·∞, ∞ − ∞, 1^∞) must be rewritten as a quotient first.

**Common Mistakes** (3)

1. Using the quotient rule on f/g: the rule differentiates the numerator and the denominator separately.
2. Applying it when the form is not 0/0 or ∞/∞, which gives a wrong answer.
3. Going round once too many and differentiating a form that was already a number.

### Growth: exponential against a power (new)

Example: `lim x->infinity x^3/e^(2x)` → lim (x→∞) x^3/e^(2x) = 0

<details><summary>Working</summary>

- Evaluate lim (x→∞) x^3/e^(2x)
- As x → ∞, the top and the bottom both grow without bound: the form ∞/∞, which on its own says nothing.
- Apply L'Hôpital's rule 3 times: each round lowers the power of x by one, and the derivative of e^(2x) is a multiple of e^(2x) itself: 3x^2/(2e^(2x)), then 6x/(4e^(2x)), then 6/(8e^(2x)).
- Now the top no longer grows while e^(2x) → ∞, so the quotient → 0. The limit is 0: an exponential outgrows every power of x.

</details>

**Key Insights** (5)

1. An exponential outgrows every power: x^n/e^(kx) → 0 as x → ∞ for every n and every k > 0, and x^n/b^x → 0 for every base b > 1.
2. Here: 3 rounds of L'Hôpital's rule, one per power of x, left a top that no longer grows, so the limit is 0.
3. Each round of L'Hôpital's rule lowers the power of x by one and leaves e^(kx) a multiple of itself, so n rounds finish the job.

   *— Show more —*
4. Turned over, e^(kx)/x^n → ∞: the same fact read the other way.
5. A product such as x^2·e^(−x) is the same contest: write it as x^2/e^x first.

**Common Mistakes** (3)

1. Plugging in x = 100, seeing a huge or tiny number, and stopping: a few values suggest the answer but do not prove it.
2. Thinking a high power such as x^10 can beat e^x: it leads for a while, but e^x always wins.
3. Calling ∞/∞ equal to 1.

### Growth: a power against ln x (new)

Example: `lim x->infinity ln(x)^2/sqrt(x)` → lim (x→∞) ln(x)^2/sqrt(x) = 0

<details><summary>Working</summary>

- Evaluate lim (x→∞) ln(x)^2/sqrt(x)
- As x → ∞, the top and the bottom both grow without bound: the form ∞/∞, which on its own says nothing.
- Apply L'Hôpital's rule 2 times: the derivative of ln(x)^j is j·ln(x)^(j − 1)/x, and the extra 1/x cancels against the derivative of √x, so each round lowers the power of ln(x) by one: 4ln(x)/√x, then 8/√x.
- A constant over √x → 0. The limit is 0: every power of x outgrows every power of ln(x).

</details>

**Key Insights** (5)

1. Every power of x outgrows every power of ln x: (ln x)^m/x^p → 0 as x → ∞ for every p > 0.
2. Here: 2 rounds of L'Hôpital's rule, one per power of ln(x), left a power of x alone, so the limit is 0.
3. Each round of L'Hôpital's rule lowers the power of ln x by one: the 1/x from d/dx ln x cancels the power of x lost below.

   *— Show more —*
4. The growth ladder, slowest to fastest: ln x, then powers x^p, then exponentials e^(kx).
5. ln x does grow without bound, just slowly: ln(10^6) ≈ 13.8.

**Common Mistakes** (3)

1. Thinking ln x levels off: it grows forever, only more and more slowly.
2. Plugging in a few large values and stopping: (ln x)^3/x is still above 0.03 at x = 10^4, yet the limit is 0.
3. Calling ∞/∞ equal to 1.

### Growth: 0·∞ at 0⁺ (new)

Example: `lim x->0 x*ln(x)` → lim (x→0⁺) x*ln(x) = 0

<details><summary>Working</summary>

- Evaluate lim (x→0) x*ln(x)
- The function is not defined just to the left of x = 0, so x can only approach 0 from the right: the limit is the right-hand limit, x → 0⁺.
- As x → 0⁺, x → 0 while ln(x) → −∞: the form 0·∞, which on its own says nothing.
- Rewrite the product as a quotient, ln(x)/x^(-1), which is ∞/∞.
- Apply L'Hôpital's rule: the derivative of ln(x)^j is j·ln(x)^(j − 1)/x and of x^(-1) is -x^(-2), so each round gives back a power of x with one power of ln(x) fewer: -x.
- -x → 0 as x → 0⁺. The limit is 0: near 0, a power of x shrinks faster than a power of ln(x) grows in size.
- x*ln(x) is defined only to the right of 0 near it, so the answer is its right-hand limit, lim (x→0⁺) x*ln(x) = 0. Whether the plain lim (x→0) is accepted depends on your course: some take a limit over the function's domain, others require both sides and call it nonexistent.

</details>

**Key Insights** (5)

1. 0·∞ is indeterminate: rewrite the product as a quotient (x·ln x = ln x/(1/x)) so L'Hôpital's rule applies.
2. Here: x*ln(x) = ln(x)/x^(-1) for x > 0, the form ∞/∞.
3. Near 0, any positive power of x shrinks faster than any power of ln x grows in size: x^p·(ln x)^m → 0 as x → 0⁺.

   *— Show more —*
4. Put the logarithm on top: differentiating 1/ln x would make the quotient harder, not easier.
5. x^x = e^(x·ln x) → e^0 = 1 as x → 0⁺ uses this same limit.

**Common Mistakes** (3)

1. Saying 0·∞ = 0: a factor going to 0 can be beaten by one growing fast enough.
2. Rewriting as x/(1/ln x): it is 0/0, but each round makes it more complicated.
3. Taking x → 0⁻ as well: ln x is not defined for x < 0.

### Nothing pulls the other way (new)

Example: `lim x->infinity e^(-x)/x` → lim (x→∞) e^(-x)/x = 0

<details><summary>Working</summary>

- Evaluate lim (x→∞) e^(-x)/x
- Write it as 1/(x·e^x). As x → ∞, x and e^x both grow without bound, and nothing pulls the other way: this is not an indeterminate form.
- A constant over something that grows without bound → 0, so the limit is 0.

</details>

**Key Insights** (4)

1. When every part pulls the same way (e^(−x) = 1/e^x), there is no indeterminate form: the limit is read off directly.
2. Here: e^(-x)/x has nothing pulling against it, so the limit is 0 without any technique.
3. Indeterminate forms are the ones where parts pull against each other: 0/0, ∞/∞, 0·∞, ∞ − ∞, 1^∞, 0^0, ∞^0.

   *— Show more —*
4. A constant over something that grows without bound → 0; a product of things that all grow → ∞.

**Common Mistakes** (3)

1. Reaching for L'Hôpital's rule when the form is not 0/0 or ∞/∞.
2. Treating 1/∞ as indeterminate: it is 0.
3. Losing the sign: −2e^x → −∞, not ∞.

### Leading terms

Example: `lim x->infinity (3x^2+1)/(2x^2-5)` → lim (x→∞) (3x^2 + 1)/(2x^2 - 5) = 3/2 (≈ 1.5)

**Key Insights** (5)

1. For a limit at infinity, the highest power dominates: divide numerator and denominator by it.
2. Here: top and bottom both have degree 2, so the limit is the ratio of the leading coefficients, 3/2.
3. Equal degrees → the ratio of leading coefficients; lower degree on top → 0; higher on top → ±∞.

   *— Show more —*
4. Exponentials outgrow every polynomial, and polynomials outgrow every logarithm.
5. The same degrees decide the horizontal asymptote of the graph: the limit at infinity is its height.

**Common Mistakes** (4)

1. Plugging in a large number and rounding — that suggests the value but does not prove it.
2. Forgetting the sign when the leading term is odd and x → −∞.
3. Treating ∞/∞ as 1.

   *— Show more —*
4. Comparing the first terms as typed instead of the highest powers.

### A polynomial at infinity

Example: `lim x->-infinity x^3-2x` → lim (x→-∞) x^3 - 2x = -∞

<details><summary>Working</summary>

- Evaluate lim (x→-∞) x^3 - 2x
- For a limit at −∞, a polynomial behaves like its highest-power term, x^3: the other terms grow more slowly.
- As x → −∞, x^3 → -∞, so the limit is -∞.

</details>

**Key Insights** (4)

1. A polynomial at ±∞ behaves like its highest-power term: x^3 − 2x like x^3.
2. Here: x^3 decides, so the limit is -∞.
3. The sign of the answer comes from the leading coefficient and, at −∞, whether the power is odd or even.

   *— Show more —*
4. Factoring out the highest power shows why: x^3 − 2x = x^3(1 − 2/x^2), and the bracket → 1.

**Common Mistakes** (3)

1. Saying ∞ − ∞ = 0 for x^3 − 2x: the higher power wins.
2. Forgetting that an odd power of a negative number is negative: x^3 → −∞ as x → −∞.
3. Letting a large coefficient on a lower power decide the answer: the highest power always wins eventually.

### 0⁰ by logarithms

Example: `lim x->0 x^x` → lim (x→0⁺) x^x = 1

<details><summary>Working</summary>

- Evaluate lim (x→0) x^x
- The function is not defined just to the left of x = 0, so x can only approach 0 from the right: the limit is the right-hand limit, x → 0⁺.
- Direct substitution gives 0^0: an indeterminate form, not 1.
- Take logarithms: for x > 0, x^x = e^(x·ln(x)), so the limit of the exponent, x·ln(x), decides.
- As x → 0⁺, x → 0 while ln(x) → −∞: the form 0·∞, which on its own says nothing.
- Rewrite the product as a quotient, ln(x)/x^(-1), which is ∞/∞.
- Apply L'Hôpital's rule: the derivative of ln(x)^j is j·ln(x)^(j − 1)/x and of x^(-1) is -x^(-2), so each round gives back a power of x with one power of ln(x) fewer: -x.
- So x·ln(x) → 0, and x^x → e^0 = 1. The limit is 1.
- x^x is defined only to the right of 0 near it, so the answer is its right-hand limit, lim (x→0⁺) x^x = 1. Whether the plain lim (x→0) is accepted depends on your course: some take a limit over the function's domain, others require both sides and call it nonexistent.

</details>

**Key Insights** (4)

1. 0^0 is indeterminate in a limit: take logarithms, find the limit of ln f, then raise e to it.
2. Here: x^x = e^(x·ln(x)) and x·ln(x) → 0, so the limit is e^0 = 1.
3. 0^0 and ∞^0 are handled like 1^∞: bring the exponent down with ln(B^E) = E·ln B.

   *— Show more —*
4. Some calculators and programs define 0^0 = 1; that is a convention for the value, not a limit.

**Common Mistakes** (3)

1. Substituting and writing 0^0 = 1 as if it were a value.
2. Forgetting to undo the logarithm at the end.
3. Sampling x < 0: x^x is not a real number there for most x.

### Oscillation, by two sequences

Example: `lim x->0 sin(1/x)` → lim (x→0) sin(1/x) does not exist

<details><summary>Working</summary>

- Evaluate lim (x→0) sin(1/x)
- sin(1/x) oscillates, swinging between −1 and 1 as x → 0. A limit would have to be the same along every sequence that approaches 0, so follow two of them.
- Along x_n = 1/(π/2 + 2πn) (x_n → 0⁺ as n → ∞), sin(1/x_n) = 1.
- Along y_n = 1/(3π/2 + 2πn), sin(1/y_n) = −1.
- The two sequences give different values, 1 and -1, so the limit does not exist.

</details>

**Key Insights** (5)

1. A function that keeps swinging, such as sin(1/x) near 0, has no limit: the values never settle on one number.
2. Here: x_n = 1/(π/2 + 2πn) and y_n = 1/(3π/2 + 2πn) both → 0⁺, but sin(1/x) is 1 along one and -1 along the other.
3. To show it, find two sequences approaching the point along which the function tends to different values (for sin(1/x), 1 and −1).

   *— Show more —*
4. Multiplying an oscillating, bounded function by something that goes to 0 does give a limit (the squeeze theorem).
5. Swings that grow, as in x·sin x at ∞, have no limit either: not a number, and not ∞.

**Common Mistakes** (4)

1. Reporting a value read off a few sample points: an oscillating function can give any value that way.
2. Confusing "bounded" with "has a limit".
3. Saying the limit is 0 because the average of the swings is 0.

   *— Show more —*
4. Calling growing swings ∞: an infinite limit must eventually stay large and of one sign.

### Growing swings, by two sequences

Example: `lim x->infinity x*sin(x)` → lim (x→∞) x*sin(x) does not exist

<details><summary>Working</summary>

- Evaluate lim (x→∞) x*sin(x)
- sin(x) oscillates, swinging between −1 and 1 as x → ∞, while x grows without bound. A limit would have to be the same along every sequence that approaches ∞, so follow two of them.
- Along x_n = π/2 + 2πn (x_n → ∞ as n → ∞), sin(x_n) = 1, so x_n*sin(x_n) = x_n → ∞.
- Along y_n = 3π/2 + 2πn, sin(y_n) = −1, so y_n*sin(y_n) = -y_n → -∞.
- One sequence gives ∞, the other -∞, so the limit does not exist: not as a number, and not as ∞ or −∞ either.

</details>

**Key Insights** (5)

1. A function that keeps swinging, such as sin(1/x) near 0, has no limit: the values never settle on one number.
2. Here: x_n = π/2 + 2πn and y_n = 3π/2 + 2πn both → ∞, but x*sin(x) → ∞ along one and → -∞ along the other.
3. To show it, find two sequences approaching the point along which the function tends to different values (for sin(1/x), 1 and −1).

   *— Show more —*
4. Multiplying an oscillating, bounded function by something that goes to 0 does give a limit (the squeeze theorem).
5. Swings that grow, as in x·sin x at ∞, have no limit either: not a number, and not ∞.

**Common Mistakes** (4)

1. Reporting a value read off a few sample points: an oscillating function can give any value that way.
2. Confusing "bounded" with "has a limit".
3. Saying the limit is 0 because the average of the swings is 0.

   *— Show more —*
4. Calling growing swings ∞: an infinite limit must eventually stay large and of one sign.

### Opposite infinities, by signs

Example: `lim x->0 1/x` → lim (x→0) 1/x does not exist

<details><summary>Working</summary>

- Evaluate lim (x→0) 1/x
- Substituting x = 0 gives 1/0: the top is not 0 while the bottom is, so 1/x grows without bound near 0. The sign on each side decides which way.
- The bottom has the factor x once, so near x = 0 the function behaves like 1/x.
- From the left (x → 0⁻): x < 0, so the function diverges to -∞.
- From the right (x → 0⁺): x > 0, so the function diverges to ∞.
- The two sides run off to opposite infinities (a vertical asymptote), so the limit does not exist.

</details>

**Key Insights** (5)

1. When direct substitution blows up, check each side separately: the two-sided limit exists only if both sides agree.
2. Here: from the left 1/x → -∞, from the right → ∞.
3. A vertical asymptote gives infinite one-sided limits; opposite signs on the two sides mean the limit does not exist.

   *— Show more —*
4. Write "does not exist" (DNE) rather than a number when the sides disagree; write +∞ or −∞ when they agree on an infinity.
5. The sign on each side comes from the signs of the pieces: 1/x is negative just left of 0 and positive just right.

**Common Mistakes** (3)

1. Writing ∞ for a limit whose two sides go to +∞ and −∞.
2. Treating 1/0 as a number instead of describing how the function behaves nearby.
3. Checking only one side of the point.

### Infinite limit

Example: `lim x->0 1/x^2` → lim (x→0) 1/x^2 = ∞

**Key Insights** (4)

1. When both sides grow without bound in the same direction, the limit is ∞ (or −∞): the graph has a vertical asymptote and both branches go the same way.
2. Here: 1/x^2 → ∞ from both sides, so the limit is ∞.
3. An even power in the denominator, as in 1/x^2, keeps the sign the same on both sides.

   *— Show more —*
4. lim = ∞ still means the limit does not exist as a number: it says how it fails to exist.

**Common Mistakes** (3)

1. Writing 1/0 = ∞ as arithmetic instead of describing the behaviour near the point.
2. Checking only one side: with an odd power the other side would go the other way.
3. Calling the limit "undefined" when ∞ describes it exactly.

### A jump

Example: `lim x->0 abs(x)/x` → lim (x→0) |x|/x does not exist

**Key Insights** (4)

1. When the left and right limits are different numbers, the two-sided limit does not exist: the graph jumps.
2. Here: from the left |x|/x → -1, from the right → 1.
3. |x|/x is −1 for x < 0 and 1 for x > 0: split an absolute value at the point where its inside is 0.

   *— Show more —*
4. Each one-sided limit still exists; report them separately when a question asks.

**Common Mistakes** (3)

1. Averaging the two one-sided limits.
2. Checking only one side of the point.
3. Treating |x|/x as 1: that holds only for x > 0.

### One-sided

Example: `lim x->0+ 1/x` → lim (x→0⁺) 1/x = ∞

**Key Insights** (4)

1. A one-sided limit only follows the function along one side of the point — the other side is ignored entirely.
2. Here: only values of x just above 0 count, and there 1/x → ∞.
3. The two-sided limit exists exactly when the left- and right-hand limits agree.

   *— Show more —*
4. One-sided limits are the right tool at domain boundaries, jump discontinuities, and vertical asymptotes.

**Common Mistakes** (3)

1. Mixing up the notation: x → a⁺ approaches from the right (values above a), x → a⁻ from the left.
2. Reporting a two-sided limit when only one side was asked for (or exists).
3. Assuming a one-sided limit exists where the function is not even defined on that side.

### Growth: another base (new)

Example: `lim x->infinity x/2^x` → lim (x→∞) x/2^x = 0

<details><summary>Working</summary>

- Evaluate lim (x→∞) x/2^x
- As x → ∞, the top and the bottom both grow without bound: the form ∞/∞, which on its own says nothing.
- Apply L'Hôpital's rule once: each round lowers the power of x by one, and the derivative of 2^x is a multiple of 2^x itself: 1/(ln(2)·2^x).
- Now the top no longer grows while 2^x → ∞, so the quotient → 0. The limit is 0: an exponential outgrows every power of x.

</details>

**Key Insights** (5)

1. An exponential outgrows every power: x^n/e^(kx) → 0 as x → ∞ for every n and every k > 0, and x^n/b^x → 0 for every base b > 1.
2. Here: one round of L'Hôpital's rule, one per power of x, left a top that no longer grows, so the limit is 0.
3. Each round of L'Hôpital's rule lowers the power of x by one and leaves e^(kx) a multiple of itself, so n rounds finish the job.

   *— Show more —*
4. Turned over, e^(kx)/x^n → ∞: the same fact read the other way.
5. A product such as x^2·e^(−x) is the same contest: write it as x^2/e^x first.

**Common Mistakes** (3)

1. Plugging in x = 100, seeing a huge or tiny number, and stopping: a few values suggest the answer but do not prove it.
2. Thinking a high power such as x^10 can beat e^x: it leads for a while, but e^x always wins.
3. Calling ∞/∞ equal to 1.

### Growth at −∞, by t = −x (new)

Example: `lim x->-infinity x*e^x` → lim (x→-∞) x*e^x = 0

<details><summary>Working</summary>

- Evaluate lim (x→-∞) x*e^x
- Let t = −x: as x → −∞, t → ∞, and x*e^x = -t*e^(-t). The question is now one at +∞.
- As t → ∞, one factor grows without bound while the other shrinks to 0: the form ∞·0, which on its own says nothing.
- Rewrite it as a quotient whose top and bottom both grow: -t/e^t, the form ∞/∞.
- Apply L'Hôpital's rule once: each round lowers the power of t by one, and the derivative of e^t is a multiple of e^t itself: -1/e^t.
- Now the top no longer grows while e^t → ∞, so the quotient → 0. The limit is 0: an exponential outgrows every power of t.
- x*e^x is negative for large negative x, so it approaches 0 from below.

</details>

**Key Insights** (5)

1. An exponential outgrows every power: x^n/e^(kx) → 0 as x → ∞ for every n and every k > 0, and x^n/b^x → 0 for every base b > 1.
2. Here: with t = −x → ∞, x*e^x = -t*e^(-t); the exponential outgrows the power of t, so the limit is 0, approached from below.
3. Each round of L'Hôpital's rule lowers the power of x by one and leaves e^(kx) a multiple of itself, so n rounds finish the job.

   *— Show more —*
4. Turned over, e^(kx)/x^n → ∞: the same fact read the other way.
5. A product such as x^2·e^(−x) is the same contest: write it as x^2/e^x first.

**Common Mistakes** (3)

1. Plugging in x = 100, seeing a huge or tiny number, and stopping: a few values suggest the answer but do not prove it.
2. Thinking a high power such as x^10 can beat e^x: it leads for a while, but e^x always wins.
3. Calling ∞/∞ equal to 1.

### A root whose leading terms do not cancel (new)

Example: `lim x->infinity sqrt(4x^2)-x` → lim (x→∞) sqrt(4x^2) - x = ∞

<details><summary>Working</summary>

- Evaluate lim (x→∞) sqrt(4x^2) - x
- As x → ∞, √(4x^2) behaves like 2x (√(x^2) = x for x > 0) and x like x: the leading terms do not cancel, so there is no ∞ − ∞ to resolve.
- sqrt(4x^2) - x ≈ (2 − 1)·|x|, a nonzero multiple of |x|, so the limit is ∞.

</details>

**Key Insights** (4)

1. A root behaves like its leading term at ±∞: √(ax² + bx + c) ≈ √a·|x|. When that does not cancel the other term, the difference diverges.
2. Here: sqrt(4x^2) - x ≈ a nonzero multiple of |x|, so the limit is ∞.
3. As x → ∞, √(4x²) − x = 2x − x = x → ∞; only when the leading terms cancel (√(x² + x) − x) is there an ∞ − ∞ that needs the conjugate.

   *— Show more —*
4. At −∞, √(x²) = |x| = −x, which can turn a cancellation into a sum or the reverse.

**Common Mistakes** (3)

1. Multiplying by the conjugate when nothing cancels: it works, but the leading terms already answer it.
2. Writing √(4x²) = 4x: the root of 4 is 2.
3. Forgetting that √(x²) = −x for negative x.

### Outside the domain at −∞

Example: `lim x->-infinity ln(x)` → lim (x→-∞) ln(x) does not exist

<details><summary>Working</summary>

- Evaluate lim (x→-∞) ln(x)
- Evaluate the function at increasingly large negative values of x.
- The function is not defined for large negative x (it is outside the domain), so there is nothing to approach: the limit does not exist.

</details>

**Key Insights** (3)

1. A limit at ±∞ needs the function defined for all large enough x on that side: ln(x) and √x are not defined for x < 0, so they have no limit as x → −∞.
2. Check the domain first: where a function is not defined, there are no values to approach.
3. ln(−x) or √(−x) is defined for x < 0, if that is the function you meant.

**Common Mistakes** (3)

1. Treating ln of a negative number as −∞: it is not a real number at all.
2. Reading a calculator error as an infinite value.
3. Answering a limit at a place where the function does not exist.

### Sampled at infinity

Example: `lim x->infinity x/1.5^x` → lim (x→∞) x/1.5^x = 0

<details><summary>Working</summary>

- Evaluate lim (x→∞) x/1.5^x
- Evaluate the function at increasingly large positive values of x.
- Samples: 2.46e-16, 8.10e-174, 0, 0, 0, 0, 0 (a value smaller than about 1e-308 cannot be represented in double precision and is computed as exactly 0)
- The values settle toward 0: the limit, as estimated from these samples (an estimate, not a proof).

</details>

**Key Insights** (3)

1. This limit was estimated by sampling large values, not proved by a technique: treat the number as a strong hint, and prove it with one of the methods in the next insights.
2. Compare growth rates: ln x is slower than any power of x, which is slower than any exponential.
3. For a ratio, divide the top and the bottom by the fastest-growing term; for ∞ − ∞ with a root, multiply by the conjugate.

**Common Mistakes** (3)

1. Plugging in a large number and rounding — that suggests the value but does not prove it.
2. Trusting a computed 0: a value below about 10^(−308) underflows to 0 in a computer.
3. Treating ∞/∞ as 1 or ∞ − ∞ as 0.

