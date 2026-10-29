# Insights review: Integrals (pilot, 1.60.0)

**Written:** October 29, 2026
**For:** MJ, to spot-check before 1.60.0 is pushed
**Revised:** twice, after an outside review ("approve with revisions", then "approve with two final corrections"), with the fixes in 1.61.0; every claim and verdict is Round 23 of [`../../evaluations/2026-10/REVIEW-LOG-2026-10.md`](../../evaluations/2026-10/REVIEW-LOG-2026-10.md)
**Plan:** [`../PLAN-INSIGHTS-AND-RESOURCES.md`](../PLAN-INSIGHTS-AND-RESOURCES.md)

Everything below is generated from the solver itself, so it is exactly what a
student sees for each example. Formulas are shown as plain text here; on the
page they are typeset. The page shows the first three of each list, and
**"Show more"** opens the rest. Exports (PDF, Markdown, JSON) and history keep
every item.

## What to check

1. **Order:** is the most useful insight first for each method? Only the
   first three are visible until "Show more" is tapped.
2. **Accuracy and wording:** anything wrong, unclear, or not how you would
   say it.
3. **Missing:** an insight or mistake a student needs that is not here.

## Decisions made while writing (say if you disagree)

- **The second insight works the student's integral** (revised): "Here:
  u = x², du = 2x dx, so ∫x·cos(x²) dx = ½·sin(x²) + C", with u and dv, the
  2I equation, the rounds of parts, the partial-fraction split or the trig
  substitution the steps chose. For tan²x it leads; ∫e^(−x²) dx leads with
  its result; improper integrals show their finite value.
- **"+C" moved behind Show more as an insight**, but **"Forgetting +C" stays
  a visible mistake** for every indefinite integral, so it is never hidden.
  The first three insights are now all about the method used.
- **"Check by differentiating"** closes every indefinite list (behind Show
  more): it is true of every method, so it never takes a visible place.
- **By parts has four variants**, each leading with what that problem needs:
  plain (LIATE), ∫ln(x) dx (dv = dx), the integral comes back (e^x·sin x),
  repeated (x²·sin x). All four still show LIATE with its source.
- **One source only, LIATE**, linked by DOI to Kasube's 1983 article. The
  article page is the publisher's (Taylor & Francis), and reading the full text
  there needs a subscription; the citation is still the right one. Everything
  else is a standard textbook fact and carries no citation.
- **Wrong-method insights fixed** (found while writing):
  - `2^x` and `sinh(x)` used to lead with ∫tan, ∫cot, ∫sec.
  - `tan(x)^2` was given the sec^n reduction formula.
  - Partial fractions listed "the power rule on 1/x" as a mistake, as filler.
- **Definite and improper integrals show their own values:** ∫₀¹ x² dx = 1/3
  second; a convergent improper integral its finite value; ∫₁^∞ 1/x dx its
  antiderivative running to ∞. An asymptote inside the interval keeps its
  short list.

## Learn more links (every topic, not only integrals)

Shown under every solved problem, chosen by the topic it was solved as. Every
link was opened and its title checked on October 29, 2026. They open in a new
tab with no referrer and say they need an internet connection.

| Topic | Links |
|---|---|
| Integrals | Khan Academy, Integral calculus · Paul's Notes, Calculus I: Integrals · Paul's Notes, Calculus II: Integration techniques · OpenStax, Calculus Vol. 1 Ch. 5 · OpenStax, Calculus Vol. 2 Ch. 3 · 3Blue1Brown, Integration and the fundamental theorem · Wolfram\|Alpha, Examples: integrals |
| Derivatives | Khan, Differential calculus · Paul's, Calculus I: Derivatives · OpenStax, Calculus Vol. 1 Ch. 3 · 3Blue1Brown, The paradox of the derivative · Wolfram\|Alpha, Examples: derivatives |
| Limits | Khan, Limits and continuity · Paul's, Calculus I: Limits · OpenStax, Calculus Vol. 1 Ch. 2 · 3Blue1Brown, Limits and the definition of derivatives · Wolfram\|Alpha, Examples: limits |
| Functions | Khan, Functions · Paul's, The definition of a function · OpenStax, Precalculus Ch. 1 · Wolfram\|Alpha, Examples: mathematical functions |
| Trigonometry | Khan, Trigonometry · Paul's, Algebra/Trig review: Trigonometry · OpenStax, Precalculus Ch. 5 · Wolfram\|Alpha, Examples: trigonometry |
| Algebra | Khan, Algebra 1 · Paul's, Solutions and solution sets · OpenStax, College Algebra Ch. 2 · Wolfram\|Alpha, Examples: algebra |
| Arithmetic | Khan, Arithmetic · OpenStax, Prealgebra Ch. 1 · Wolfram\|Alpha, Examples: elementary math |

- **Wolfram|Alpha:** its example pages are free, but step-by-step solutions
  need a paid Pro account. It is linked for its examples only; no problem is
  sent to it.
- **3Blue1Brown** has lessons only for the calculus topics; Paul's Notes has
  no arithmetic page.

## Privacy and Terms

- **Privacy Policy, Third-Party Services:** a new item, "Links to other
  websites". MasterMath never sends those sites a problem, solution or
  history. A click opens the site in a new tab without a referrer; like any
  visit, the site sees the request (IP address, browser), and its own policy
  applies.
- **Terms, Intellectual Property:** "Links to Other Websites". Those sites are
  not part of MasterMath, and we are not responsible for their content.
- Both "Last Updated" dates are now October 29, 2026.

## The lists, method by method

### Power rule

Example: `x^3`

**Key Insights** (6)

1. Power rule: ∫x^n dx = x^(n+1)/(n+1) + C  (n ≠ -1)
2. Here: ∫(x^3) dx = 1/4*x^4 + C.
3. Rewrite roots and reciprocals as powers first: √x = x^(1/2), 1/x³ = x^(−3); then the power rule applies.

   *— Show more —*
4. A sum integrates term by term, and constant factors pull out front: ∫(a·f + b·g) dx = a·∫f dx + b·∫g dx.
5. Always add the constant of integration (+C) for an indefinite integral: any two antiderivatives of the same function differ by a constant.
6. Check any antiderivative by differentiating it: the derivative must give back the integrand exactly.

**Common Mistakes** (4)

1. Dividing by n instead of n + 1: ∫x³ dx = x⁴/4, not x⁴/3.
2. Forgetting the constant of integration (+C).
3. Applying the power rule to 1/x — that integrates to ln|x|, not x⁰/0.

   *— Show more —*
4. Integrating a product factor by factor: ∫x·x² dx is ∫x³ dx = x⁴/4, not (x²/2)·(x³/3). Multiply out first.

### Trig rule

Example: `sin(x)`

**Key Insights** (6)

1. The trig antiderivatives are the trig derivatives read backwards: ∫cos = sin, ∫sin = −cos, ∫sec² = tan, ∫sec·tan = sec.
2. Here: ∫(sin(x)) dx = -cos(x) + C.
3. The signs come from the derivatives: d/dx cos(x) = −sin(x), so ∫sin(x) dx = −cos(x); d/dx cot(x) = −csc²(x), so ∫csc²(x) dx = −cot(x).

   *— Show more —*
4. A linear inside brings out its reciprocal: ∫sin(3x) dx = −cos(3x)/3 + C.
5. Always add the constant of integration (+C) for an indefinite integral: any two antiderivatives of the same function differ by a constant.
6. Check any antiderivative by differentiating it: the derivative must give back the integrand exactly.

**Common Mistakes** (4)

1. Sign slips: ∫sin(x) dx = −cos(x), while ∫cos(x) dx = +sin(x).
2. Forgetting the constant of integration (+C).
3. Using this table for sin²(x) or tan(x): neither is on it. sin²(x) needs a half-angle identity, and ∫tan(x) dx = −ln|cos(x)|.

   *— Show more —*
4. Working in degrees: these rules hold for an angle in radians.

### Exponential rule

Example: `e^(2x)`

**Key Insights** (6)

1. ∫e^x dx = e^x — the exponential is its own antiderivative; ∫a^x dx = a^x/ln(a) for a > 0, a ≠ 1.
2. Here: ∫(e^(2x)) dx = 1/2*e^(2x) + C.
3. A linear exponent brings out its reciprocal: ∫e^(kx) dx = e^(kx)/k + C for k ≠ 0.

   *— Show more —*
4. Another base becomes e: a^x = e^(x·ln a), which is where the 1/ln(a) comes from.
5. Always add the constant of integration (+C) for an indefinite integral: any two antiderivatives of the same function differ by a constant.
6. Check any antiderivative by differentiating it: the derivative must give back the integrand exactly.

**Common Mistakes** (4)

1. Treating e^x like a power and writing e^(x+1)/(x+1).
2. Forgetting the constant of integration (+C).
3. Forgetting the 1/k: ∫e^(2x) dx = e^(2x)/2, not e^(2x).

   *— Show more —*
4. Using the 1/k shortcut on an exponent that is not linear: e^(x²)/(2x) does not differentiate back to e^(x²), which has no elementary antiderivative.

### Exponential base a^x

Example: `2^x`

**Key Insights** (5)

1. ∫a^x dx = a^x/ln(a) + C for a > 0, a ≠ 1: write a^x = e^(x·ln a) and use the exponential rule with k = ln a.
2. Here: ∫(2^x) dx = 2^x/ln(2) + C.
3. Differentiating checks it: d/dx a^x = a^x·ln(a), and dividing by ln(a) undoes that factor.

   *— Show more —*
4. Always add the constant of integration (+C) for an indefinite integral: any two antiderivatives of the same function differ by a constant.
5. Check any antiderivative by differentiating it: the derivative must give back the integrand exactly.

**Common Mistakes** (3)

1. Using the power rule on a^x: the variable is in the exponent, so ∫2^x dx is not 2^(x+1)/(x+1).
2. Forgetting the constant of integration (+C).
3. Dropping the ln(a): ∫2^x dx = 2^x/ln(2), not 2^x.

### Reciprocal 1/x

Example: `1/x`

**Key Insights** (6)

1. ∫1/x dx = ln|x| + C — the one power the power rule cannot do (n = −1 would divide by 0).
2. Here: ∫(1/x) dx = ln|x| + C.
3. The absolute value keeps the answer right for negative x too: d/dx ln|x| = 1/x for every x ≠ 0.

   *— Show more —*
4. The same pattern in general: ∫f′(x)/f(x) dx = ln|f(x)| + C.
5. Always add the constant of integration (+C) for an indefinite integral: any two antiderivatives of the same function differ by a constant.
6. Check any antiderivative by differentiating it: the derivative must give back the integrand exactly.

**Common Mistakes** (4)

1. Writing ∫1/x dx as x⁰/0 — use ln|x| instead, with the absolute value.
2. Forgetting the constant of integration (+C).
3. Dropping the absolute value: ln(x) only covers x > 0.

   *— Show more —*
4. Integrating 1/x across x = 0 in a definite integral: it is undefined there, so ∫_{−1}^{1} 1/x dx is improper.

### Linear substitution 1/(ax + b)

Example: `1/(2x+1)`

**Key Insights** (6)

1. For 1/(ax + b), let u = ax + b: the 1/a from du = a dx is the only extra factor.
2. Here: ∫(1/(2x + 1)) dx = 1/2*ln|2x + 1| + C.
3. The result is a logarithm with an absolute value: ∫1/(ax + b) dx = (1/a)·ln|ax + b| + C.

   *— Show more —*
4. The same 1/a appears for any function of a linear inside: ∫f(ax + b) dx = (1/a)·F(ax + b) + C.
5. Always add the constant of integration (+C) for an indefinite integral: any two antiderivatives of the same function differ by a constant.
6. Check any antiderivative by differentiating it: the derivative must give back the integrand exactly.

**Common Mistakes** (3)

1. Forgetting the 1/a factor that comes from du = a dx.
2. Forgetting the constant of integration (+C).
3. Using the 1/a shortcut when the inside is not linear: ∫1/(x² + 1) dx is arctan(x), not a logarithm.

### Linear inside f(ax + b)

Example: `cos(3x)`

**Key Insights** (6)

1. A linear inside, cos(ax + b): let u = ax + b, so du = a dx and a factor 1/a comes out.
2. Here: ∫(cos(3x)) dx = 1/3*sin(3x) + C.
3. In general ∫f(ax + b) dx = (1/a)·F(ax + b) + C, where F is an antiderivative of f.

   *— Show more —*
4. Differentiating checks the factor: the chain rule multiplies by a, and the 1/a cancels it.
5. Always add the constant of integration (+C) for an indefinite integral: any two antiderivatives of the same function differ by a constant.
6. Check any antiderivative by differentiating it: the derivative must give back the integrand exactly.

**Common Mistakes** (3)

1. Forgetting the 1/a: ∫cos(2x) dx is (1/2)·sin(2x), not sin(2x).
2. Forgetting the constant of integration (+C).
3. Multiplying by a instead of dividing: that is the chain rule for derivatives, read the wrong way round.

### Half-angle identity

Example: `sin(x)^2`

**Key Insights** (6)

1. sin²(x) and cos²(x) integrate through the half-angle identities: sin²(x) = (1 − cos(2x))/2, cos²(x) = (1 + cos(2x))/2 — a sum of a constant and a cosine, each easy.
2. Here: ∫(sin(x)^2) dx = 1/2*(x - 1/2*sin(2x)) + C.
3. The identities come from the double-angle formula cos(2x) = 1 − 2sin²(x) = 2cos²(x) − 1.

   *— Show more —*
4. ∫sin²(x) dx = x/2 − sin(2x)/4 + C and ∫cos²(x) dx = x/2 + sin(2x)/4 + C; over a whole period each averages 1/2.
5. Always add the constant of integration (+C) for an indefinite integral: any two antiderivatives of the same function differ by a constant.
6. Check any antiderivative by differentiating it: the derivative must give back the integrand exactly.

**Common Mistakes** (3)

1. Applying the power rule to sin²(x): sin³(x)/3 is not its antiderivative — differentiating that leaves a cos(x) behind.
2. Forgetting the constant of integration (+C).
3. Forgetting the 1/2 from the inside when integrating cos(2x): ∫cos(2x) dx = sin(2x)/2.

### Trig identity (even powers)

Example: `sin(x)^2*cos(x)^2`

**Key Insights** (6)

1. Even powers of sin and cos are lowered with the half-angle identities (sin²θ = (1 − cos 2θ)/2, cos²θ = (1 + cos 2θ)/2); a product sin θ cos θ is (sin 2θ)/2. Repeat until only first powers of cosines remain.
2. Here: ∫(sin(x)^2*cos(x)^2) dx = 1/8*(x - 1/4*sin(4x)) + C.
3. So sin²θ·cos²θ = sin²(2θ)/4, and one more half-angle step finishes it.

   *— Show more —*
4. With an odd power, none of this is needed: keep one factor for du and substitute instead.
5. Always add the constant of integration (+C) for an indefinite integral: any two antiderivatives of the same function differ by a constant.
6. Check any antiderivative by differentiating it: the derivative must give back the integrand exactly.

**Common Mistakes** (3)

1. Applying the power rule to sin²(x) or cos²(x): sin³(x)/3 is not an antiderivative of sin²(x) — differentiating it leaves a cos(x) behind.
2. Forgetting the constant of integration (+C).
3. Stopping too early: a remaining cos²(2θ) still needs the identity before it can be integrated.

### Trig quotient (tan, cot, sec, csc)

Example: `tan(x)`

**Key Insights** (6)

1. The table entries ∫tan = −ln|cos|, ∫cot = ln|sin|, ∫sec = ln|sec + tan|, ∫csc = ln|csc − cot| all come from one idea: write the integrand as (derivative of a function)/(that function), and ∫u′/u = ln|u|.
2. Here: ∫(tan(x)) dx = -ln|cos(x)| + C.
3. −ln|cos(x)| and ln|sec(x)| are the same function, so either form of ∫tan(x) dx is right.

   *— Show more —*
4. ∫sec(x) dx comes from multiplying by (sec x + tan x)/(sec x + tan x): the numerator becomes the derivative of the denominator.
5. Always add the constant of integration (+C) for an indefinite integral: any two antiderivatives of the same function differ by a constant.
6. Check any antiderivative by differentiating it: the derivative must give back the integrand exactly.

**Common Mistakes** (3)

1. Writing ∫tan(x) dx as sec²(x) — that is the derivative of tan, read the wrong way round — or dropping the minus sign from du = −sin(x) dx.
2. Forgetting the constant of integration (+C).
3. Dropping the absolute value inside the logarithm: cos(x) is negative on part of every period.

### Hyperbolic

Example: `sinh(x)`

**Key Insights** (5)

1. The hyperbolic antiderivatives mirror the trig ones without the sign change: ∫sinh(x) dx = cosh(x), ∫cosh(x) dx = sinh(x).
2. Here: ∫(sinh(x)) dx = cosh(x) + C.
3. They follow from the definitions sinh(x) = (e^x − e^(−x))/2 and cosh(x) = (e^x + e^(−x))/2, integrated term by term.

   *— Show more —*
4. Always add the constant of integration (+C) for an indefinite integral: any two antiderivatives of the same function differ by a constant.
5. Check any antiderivative by differentiating it: the derivative must give back the integrand exactly.

**Common Mistakes** (2)

1. Carrying the trig minus sign over: ∫sinh(x) dx = +cosh(x), not −cosh(x).
2. Forgetting the constant of integration (+C).

### Inverse trig

Example: `1/(1+x^2)`

**Key Insights** (6)

1. Inverse-trig antiderivatives come from derivatives you know: d/dx arctan(x) = 1/(1 + x²) and d/dx arcsin(x) = 1/√(1 − x²). A constant a² in the pattern is factored out first.
2. Here: ∫(1/(1 + x^2)) dx = arctan(x) + C.
3. With the constant in place, for a > 0: ∫1/(a² + x²) dx = (1/a)·arctan(x/a) + C and ∫1/√(a² − x²) dx = arcsin(x/a) + C.

   *— Show more —*
4. A quadratic with an x term is completed to a square first: x² + 2x + 5 = (x + 1)² + 4, then the pattern applies with x + 1 in place of x.
5. Always add the constant of integration (+C) for an indefinite integral: any two antiderivatives of the same function differ by a constant.
6. Check any antiderivative by differentiating it: the derivative must give back the integrand exactly.

**Common Mistakes** (4)

1. Reading 1/(1 + x²) as a power of x — it is not x^(−2), and the power rule does not apply.
2. Forgetting the constant of integration (+C).
3. Forgetting the 1/a in front of arctan(x/a) (the arcsin form has none).

   *— Show more —*
4. Using arcsin for √(a² + x²): a plus sign under the root is a different pattern.

### u-substitution

Example: `x*cos(x^2)`

**Key Insights** (7)

1. u-substitution: look for an inner function whose derivative appears as a factor — ∫g′(x)·h(g(x)) dx = ∫h(u) du with u = g(x).
2. Here: u = x^2, du = 2x dx, so ∫(x*cos(x^2)) dx = 1/2*sin(x^2) + C.
3. Good choices for u: the inside of a composite, a denominator, or the base of a power, whichever has its derivative elsewhere in the integrand (up to a constant factor).

   *— Show more —*
4. After substituting, no x may be left. If one is, that u does not work, or the leftover x has to be written in terms of u.
5. In a definite integral, change the bounds to values of u as well; then there is no need to substitute back.
6. Always add the constant of integration (+C) for an indefinite integral: any two antiderivatives of the same function differ by a constant.
7. Check any antiderivative by differentiating it: the derivative must give back the integrand exactly.

**Common Mistakes** (4)

1. Forgetting to account for du = g′(x) dx: the inside's derivative must match a factor of the integrand, up to a constant multiple, and that constant is carried into the new integral.
2. Forgetting the constant of integration (+C).
3. Leaving the answer in u: substitute u = g(x) back at the end.

   *— Show more —*
4. Keeping the old bounds after changing variables in a definite integral.

### Integration by parts

Example: `x*e^x`

**Key Insights** (8)

1. Integration by parts: ∫u dv = uv − ∫v du. Pick u by LIATE (Log, Inverse-trig, Algebraic, Trig, Exponential), a rule of thumb: the best u is the one that makes ∫v du simpler.
   Source: [Herbert E. Kasube, "A Technique for Integration by Parts", The American Mathematical Monthly 90(3), 1983](https://doi.org/10.1080/00029890.1983.11971195)
2. Here: u = x, dv = e^x dx, so ∫(x*e^x) dx = e^x*(x - 1) + C.
3. u should get simpler when it is differentiated, and dv must be something you can integrate; du and v then follow.

   *— Show more —*
4. A power of x times a trig function or an exponential needs one round per power: x²·sin(x) takes two, each lowering the power by one. A table of derivatives of u and integrals of dv, with alternating signs (tabular integration), keeps the rounds straight.
5. When the original integral comes back (∫e^x·sin(x) dx after two rounds), move it to the left side and solve for it like an unknown.
6. ∫ln(x) dx is by parts with u = ln(x) and dv = dx: ∫ln(x) dx = x·ln(x) − x + C.
7. Always add the constant of integration (+C) for an indefinite integral: any two antiderivatives of the same function differ by a constant.
8. Check any antiderivative by differentiating it: the derivative must give back the integrand exactly.

**Common Mistakes** (4)

1. Choosing u and dv the wrong way round — LIATE picks the u that gets simpler when differentiated.
2. Forgetting the constant of integration (+C).
3. Sign slips in uv − ∫v du, above all on a second round: the signs alternate.

   *— Show more —*
4. Swapping u and dv on the second round: that undoes the first round and leads back to the start.

### By parts: ln(x)

Example: `ln(x)`

**Key Insights** (8)

1. ∫ln(x) dx is by parts with u = ln(x) and dv = dx: ∫ln(x) dx = x·ln(x) − x + C.
2. Here: u = ln(x), dv = 1 dx, so ∫(ln(x)) dx = x*ln(x) - x + C.
3. Integration by parts: ∫u dv = uv − ∫v du. Pick u by LIATE (Log, Inverse-trig, Algebraic, Trig, Exponential), a rule of thumb: the best u is the one that makes ∫v du simpler.

   *— Show more —*
   Source: [Herbert E. Kasube, "A Technique for Integration by Parts", The American Mathematical Monthly 90(3), 1983](https://doi.org/10.1080/00029890.1983.11971195)
4. u should get simpler when it is differentiated, and dv must be something you can integrate; du and v then follow.
5. A power of x times a trig function or an exponential needs one round per power: x²·sin(x) takes two, each lowering the power by one. A table of derivatives of u and integrals of dv, with alternating signs (tabular integration), keeps the rounds straight.
6. When the original integral comes back (∫e^x·sin(x) dx after two rounds), move it to the left side and solve for it like an unknown.
7. Always add the constant of integration (+C) for an indefinite integral: any two antiderivatives of the same function differ by a constant.
8. Check any antiderivative by differentiating it: the derivative must give back the integrand exactly.

**Common Mistakes** (4)

1. Choosing u and dv the wrong way round — LIATE picks the u that gets simpler when differentiated.
2. Forgetting the constant of integration (+C).
3. Sign slips in uv − ∫v du, above all on a second round: the signs alternate.

   *— Show more —*
4. Swapping u and dv on the second round: that undoes the first round and leads back to the start.

### By parts: the integral comes back

Example: `e^x*sin(x)`

**Key Insights** (8)

1. When the original integral comes back (∫e^x·sin(x) dx after two rounds), move it to the left side and solve for it like an unknown.
2. Here: u = sin(x), dv = e^x dx and the integral comes back: 2I = e^x*(-cos(x) + sin(x)), so ∫(e^x*sin(x)) dx = 1/2*e^x*(-cos(x) + sin(x)) + C.
3. Integration by parts: ∫u dv = uv − ∫v du. Pick u by LIATE (Log, Inverse-trig, Algebraic, Trig, Exponential), a rule of thumb: the best u is the one that makes ∫v du simpler.

   *— Show more —*
   Source: [Herbert E. Kasube, "A Technique for Integration by Parts", The American Mathematical Monthly 90(3), 1983](https://doi.org/10.1080/00029890.1983.11971195)
4. u should get simpler when it is differentiated, and dv must be something you can integrate; du and v then follow.
5. A power of x times a trig function or an exponential needs one round per power: x²·sin(x) takes two, each lowering the power by one. A table of derivatives of u and integrals of dv, with alternating signs (tabular integration), keeps the rounds straight.
6. ∫ln(x) dx is by parts with u = ln(x) and dv = dx: ∫ln(x) dx = x·ln(x) − x + C.
7. Always add the constant of integration (+C) for an indefinite integral: any two antiderivatives of the same function differ by a constant.
8. Check any antiderivative by differentiating it: the derivative must give back the integrand exactly.

**Common Mistakes** (5)

1. Not recognising the original integral when it comes back: instead of a third round, call it I, move it to the left side and solve for it.
2. Forgetting the constant of integration (+C).
3. Swapping u and dv on the second round: that undoes the first round and leads back to the start.

   *— Show more —*
4. Choosing u and dv the wrong way round — LIATE picks the u that gets simpler when differentiated.
5. Sign slips in uv − ∫v du, above all on a second round: the signs alternate.

### By parts: repeated

Example: `x^2*sin(x)`

**Key Insights** (8)

1. A power of x times a trig function or an exponential needs one round per power: x²·sin(x) takes two, each lowering the power by one. A table of derivatives of u and integrals of dv, with alternating signs (tabular integration), keeps the rounds straight.
2. Here: u = x^2, dv = sin(x) dx and 2 rounds, so ∫(x^2*sin(x)) dx = 2cos(x) + 2x*sin(x) - x^2*cos(x) + C.
3. Integration by parts: ∫u dv = uv − ∫v du. Pick u by LIATE (Log, Inverse-trig, Algebraic, Trig, Exponential), a rule of thumb: the best u is the one that makes ∫v du simpler.

   *— Show more —*
   Source: [Herbert E. Kasube, "A Technique for Integration by Parts", The American Mathematical Monthly 90(3), 1983](https://doi.org/10.1080/00029890.1983.11971195)
4. u should get simpler when it is differentiated, and dv must be something you can integrate; du and v then follow.
5. When the original integral comes back (∫e^x·sin(x) dx after two rounds), move it to the left side and solve for it like an unknown.
6. ∫ln(x) dx is by parts with u = ln(x) and dv = dx: ∫ln(x) dx = x·ln(x) − x + C.
7. Always add the constant of integration (+C) for an indefinite integral: any two antiderivatives of the same function differ by a constant.
8. Check any antiderivative by differentiating it: the derivative must give back the integrand exactly.

**Common Mistakes** (5)

1. Stopping after one round: the integral left over still has a power of x in it, and needs parts again until that power is gone.
2. Forgetting the constant of integration (+C).
3. Sign slips in uv − ∫v du, above all on a second round: the signs alternate.

   *— Show more —*
4. Choosing u and dv the wrong way round — LIATE picks the u that gets simpler when differentiated.
5. Swapping u and dv on the second round: that undoes the first round and leads back to the start.

### Partial fractions

Example: `1/(x^2 - 1)`

**Key Insights** (6)

1. Partial fractions: factor the denominator, write the fraction as a sum of simpler ones (one per factor), find each constant (cover-up or comparing coefficients), then integrate each piece — a linear factor gives a logarithm, an irreducible quadratic a logarithm, an arctan or both (depending on its numerator), and a repeated factor one term per power: its first power a logarithm, the higher powers a power.
2. Here: 1/(x^2 - 1) = -1/2·1/(x + 1) + 1/2·1/(x - 1), so ∫(1/(x^2 - 1)) dx = 1/2*(ln|x - 1| - ln|x + 1|) + C.
3. Each factor sets the shape of its piece: (x − a) takes A/(x − a); a repeated (x − a)² takes A/(x − a) + B/(x − a)²; an irreducible x² + px + q takes (Bx + C)/(x² + px + q).

   *— Show more —*
4. The cover-up method finds the constant of a non-repeated linear factor at once: cover (x − a) in the fraction and evaluate what is left at x = a.
5. Always add the constant of integration (+C) for an indefinite integral: any two antiderivatives of the same function differ by a constant.
6. Check any antiderivative by differentiating it: the derivative must give back the integrand exactly.

**Common Mistakes** (4)

1. Splitting 1/(a·b) into 1/a + 1/b — the decomposition needs constants found from the factors, not a guess.
2. Forgetting the constant of integration (+C).
3. Giving an irreducible quadratic a constant numerator A instead of Bx + C.

   *— Show more —*
4. Missing a power of a repeated factor: (x − 1)² needs both A/(x − 1) and B/(x − 1)².

### Partial fractions: divide first

Example: `(x^3+1)/(x-1)`

**Key Insights** (7)

1. When the numerator's degree is not lower than the denominator's, divide first: the quotient integrates term by term, and only the remainder over the denominator needs partial fractions.
2. Here: ∫((x^3 + 1)/(x - 1)) dx = 1/3*x^3 + 1/2*x^2 + x + 2ln|x - 1| + C.
3. Partial fractions: factor the denominator, write the fraction as a sum of simpler ones (one per factor), find each constant (cover-up or comparing coefficients), then integrate each piece — a linear factor gives a logarithm, an irreducible quadratic a logarithm, an arctan or both (depending on its numerator), and a repeated factor one term per power: its first power a logarithm, the higher powers a power.

   *— Show more —*
4. Each factor sets the shape of its piece: (x − a) takes A/(x − a); a repeated (x − a)² takes A/(x − a) + B/(x − a)²; an irreducible x² + px + q takes (Bx + C)/(x² + px + q).
5. The cover-up method finds the constant of a non-repeated linear factor at once: cover (x − a) in the fraction and evaluate what is left at x = a.
6. Always add the constant of integration (+C) for an indefinite integral: any two antiderivatives of the same function differ by a constant.
7. Check any antiderivative by differentiating it: the derivative must give back the integrand exactly.

**Common Mistakes** (4)

1. Decomposing an improper fraction without dividing first: partial fractions need the numerator's degree below the denominator's.
2. Forgetting the constant of integration (+C).
3. Giving an irreducible quadratic a constant numerator A instead of Bx + C.

   *— Show more —*
4. Missing a power of a repeated factor: (x − 1)² needs both A/(x − 1) and B/(x − 1)².

### Irreducible quadratic

Example: `(2x+3)/(x^2+1)`

**Key Insights** (8)

1. A numerator over an irreducible quadratic splits in two: the part that is the denominator's derivative integrates to a logarithm, the constant part to an arctan (∫1/(x² + a²) dx = (1/a)·arctan(x/a)).
2. Here: ∫((2x + 3)/(x^2 + 1)) dx = ln(x^2 + 1) + 3arctan(x) + C.
3. Complete the square when the quadratic has an x term: x² + 2x + 5 = (x + 1)² + 4, so the arctan part has x + 1 inside.

   *— Show more —*
4. Partial fractions: factor the denominator, write the fraction as a sum of simpler ones (one per factor), find each constant (cover-up or comparing coefficients), then integrate each piece — a linear factor gives a logarithm, an irreducible quadratic a logarithm, an arctan or both (depending on its numerator), and a repeated factor one term per power: its first power a logarithm, the higher powers a power.
5. Each factor sets the shape of its piece: (x − a) takes A/(x − a); a repeated (x − a)² takes A/(x − a) + B/(x − a)²; an irreducible x² + px + q takes (Bx + C)/(x² + px + q).
6. The cover-up method finds the constant of a non-repeated linear factor at once: cover (x − a) in the fraction and evaluate what is left at x = a.
7. Always add the constant of integration (+C) for an indefinite integral: any two antiderivatives of the same function differ by a constant.
8. Check any antiderivative by differentiating it: the derivative must give back the integrand exactly.

**Common Mistakes** (4)

1. Integrating 1/(x² + 1) as a logarithm: ln(x² + 1) differentiates to 2x/(x² + 1), which has an x on top. The constant part is an arctan.
2. Forgetting the constant of integration (+C).
3. Giving an irreducible quadratic a constant numerator A instead of Bx + C.

   *— Show more —*
4. Missing a power of a repeated factor: (x − 1)² needs both A/(x − 1) and B/(x − 1)².

### Trig substitution

Example: `sqrt(1 - x^2)`

**Key Insights** (7)

1. Trigonometric substitution: √(a² − x²) calls for x = a·sin θ (√(a² + x²) for x = a·tan θ, √(x² − a²) for x = a·sec θ); the root becomes a·cos θ and the integral is one in θ. Convert back with a right triangle.
2. Here: x = sin θ, dx = cos θ dθ, so ∫(sqrt(1 - x^2)) dx = 1/2*arcsin(x) + 1/2*x*√(1 - x^2) + C.
3. Each choice rests on an identity that turns the radical into one term: 1 − sin²θ = cos²θ, 1 + tan²θ = sec²θ, sec²θ − 1 = tan²θ.

   *— Show more —*
4. To convert back, draw the triangle the substitution describes (sin θ = x/a: opposite side x, hypotenuse a) and read the other ratios off it.
5. A quadratic with an x term under the root is completed to a square first: x² + 2x + 5 = (x + 1)² + 4.
6. Always add the constant of integration (+C) for an indefinite integral: any two antiderivatives of the same function differ by a constant.
7. Check any antiderivative by differentiating it: the derivative must give back the integrand exactly.

**Common Mistakes** (4)

1. Forgetting to change dx as well as the integrand (dx = a·cos θ dθ), or leaving the answer in θ instead of converting back to x.
2. Forgetting the constant of integration (+C).
3. Choosing the substitution for the wrong sign: √(x² − a²) needs sec, not sin.

   *— Show more —*
4. Ignoring the range of θ: it is what makes √(cos²θ) = cos θ rather than |cos θ|.

### Trig powers (odd power)

Example: `sin(x)^3`

**Key Insights** (6)

1. Products of powers of sin and cos: with an odd power, keep one factor for du and convert the rest with sin²θ + cos²θ = 1 (odd cos → u = sin θ; odd sin → u = cos θ). Both even: the half-angle identities. For tan^m θ·sec^n θ: keep a factor sec²θ for u = tan θ (an even sec power), or a factor sec θ·tan θ for u = sec θ (an odd tan power with at least one sec).
2. Here: ∫(sin(x)^3) dx = -cos(x) + 1/3*cos(x)^3 + C.
3. After the substitution the integral is a polynomial in u, done by the power rule; substitute back at the end.

   *— Show more —*
4. Both powers even: lower them with sin²θ = (1 − cos 2θ)/2 and cos²θ = (1 + cos 2θ)/2, repeating until only first powers of cosines remain.
5. Always add the constant of integration (+C) for an indefinite integral: any two antiderivatives of the same function differ by a constant.
6. Check any antiderivative by differentiating it: the derivative must give back the integrand exactly.

**Common Mistakes** (3)

1. Splitting off the factor from the EVEN power: the leftover must be convertible with sin²θ + cos²θ = 1, which needs an even power left behind.
2. Forgetting the constant of integration (+C).
3. Dropping the minus sign from du = −sin θ dθ when u = cos θ.

### Reduction formula (sec^n)

Example: `sec(x)^3`

**Key Insights** (6)

1. A reduction formula lowers a power by two: ∫sec^n(θ) dθ = sec^(n−2)(θ)·tan(θ)/(n − 1) + ((n − 2)/(n − 1))·∫sec^(n−2)(θ) dθ. It comes from integration by parts in which the original integral reappears and is solved for, as with ∫e^x·sin(x) dx.
2. Here: ∫(sec(x)^3) dx = 1/2*sec(x)*tan(x) + 1/2*ln|sec(x) + tan(x)| + C.
3. Apply it until the power is 1 or 0: the base cases are ∫sec(θ) dθ = ln|sec θ + tan θ| and ∫1 dθ = θ.

   *— Show more —*
4. ∫sec³(θ) dθ = (sec θ·tan θ + ln|sec θ + tan θ|)/2 + C comes up often (arc length of a parabola, trigonometric substitutions) and is worth knowing.
5. Always add the constant of integration (+C) for an indefinite integral: any two antiderivatives of the same function differ by a constant.
6. Check any antiderivative by differentiating it: the derivative must give back the integrand exactly.

**Common Mistakes** (3)

1. Trying u = sec θ on sec³θ: du = sec θ tan θ dθ is not a factor of the integrand, so the substitution does not close — the reduction formula is the way.
2. Forgetting the constant of integration (+C).
3. Dropping the factor (n − 2)/(n − 1) in front of the remaining integral.

### Reduction (tan^m)

Example: `tan(x)^2`

**Key Insights** (6)

1. Here: ∫(tan(x)^2) dx = tan(x) - x + C.
2. Powers of tan come down two at a time with tan²θ = sec²θ − 1: ∫tan^m(θ) dθ = tan^(m−1)(θ)/(m − 1) − ∫tan^(m−2)(θ) dθ, down to ∫tan θ dθ = −ln|cos θ| or ∫1 dθ = θ.
3. The first part is a substitution: u = tan θ, du = sec²θ dθ, so ∫tan^(m−2)θ·sec²θ dθ = tan^(m−1)θ/(m − 1).

   *— Show more —*
4. cot works the same way with cot²θ = csc²θ − 1, with a minus sign from du = −csc²θ dθ.
5. Always add the constant of integration (+C) for an indefinite integral: any two antiderivatives of the same function differ by a constant.
6. Check any antiderivative by differentiating it: the derivative must give back the integrand exactly.

**Common Mistakes** (3)

1. Integrating tan²(x) as tan³(x)/3: differentiating that puts a sec²(x) in the result.
2. Forgetting the constant of integration (+C).
3. Losing the minus sign: each round subtracts the next integral.

### Form substitution u = e^x

Example: `1/(1+e^x)`

**Key Insights** (6)

1. When the awkward piece is a function of x — e^x, √x — substitute for that piece and change dx with it: u = e^x gives dx = du/u; x = u² gives dx = 2u du. The new integral is rational, and partial fractions or a direct rule finish it.
2. Here: u = e^x, so ∫(1/(1 + e^x)) dx = x - ln(1 + e^x) + C.
3. After u = e^x, every e^(kx) becomes u^k, so an integrand built from exponentials becomes a rational function of u.

   *— Show more —*
4. Substitute back at the end: the answer is a function of x, so u is replaced by e^x (or √x).
5. Always add the constant of integration (+C) for an indefinite integral: any two antiderivatives of the same function differ by a constant.
6. Check any antiderivative by differentiating it: the derivative must give back the integrand exactly.

**Common Mistakes** (3)

1. Substituting u = e^x but leaving dx alone — dx = du/u, and that extra 1/u is what makes the new integrand rational.
2. Forgetting the constant of integration (+C).
3. Leaving the answer in u instead of substituting back.

### Absolute value

Example: `abs(x)`

**Key Insights** (6)

1. ∫|ax + b| dx = (ax + b)·|ax + b| / (2a) + C — split at the corner, integrate each piece, and the two pieces match up into one formula.
2. Here: ∫(abs(x)) dx = 1/2*x*abs(x) + C.
3. |x| is x for x ≥ 0 and −x for x < 0: integrate each piece and choose the constants so the pieces join without a jump.

   *— Show more —*
4. x·|x|/2 has derivative |x| everywhere, including at the corner x = 0.
5. Always add the constant of integration (+C) for an indefinite integral: any two antiderivatives of the same function differ by a constant.
6. Check any antiderivative by differentiating it: the derivative must give back the integrand exactly.

**Common Mistakes** (3)

1. Integrating |x| as if it were x, giving x²/2 — that is only right for x ≥ 0.
2. Forgetting the constant of integration (+C).
3. Joining the two pieces with unrelated constants: an antiderivative of a continuous function is continuous too.

### Error function (erf)

Example: `e^(-x^2)`

**Key Insights** (6)

1. ∫e^(−x²) dx = (√π/2)·erf(x) + C: the antiderivative is written with erf, the error function, erf(x) = (2/√π)·∫_0^x e^(−t²) dt.
2. erf is a "special function": a named antiderivative, the way ln is the name for ∫1/x dx. It is not a trick or a shortcut — it is the honest answer, and tables and calculators have it.
3. Whole-line and half-line definite versions do have closed forms: ∫_{−∞}^∞ e^(−x²) dx = √π, and ∫₀^∞ e^(−x²) dx = √π/2.

   *— Show more —*
4. The bell curve of statistics is this function in disguise: probabilities under the normal distribution are values of erf.
5. Always add the constant of integration (+C) for an indefinite integral: any two antiderivatives of the same function differ by a constant.
6. Check any antiderivative by differentiating it: the derivative must give back the integrand exactly.

**Common Mistakes** (3)

1. Trying u = −x²: then du = −2x dx, and there is no x factor in the integrand to absorb it — the substitution does not close.
2. Reading e^(−x²) as (e^(−x))² — the square is on x, not on e^(−x). (e^(−x))² = e^(−2x), which IS elementary.
3. Forgetting the constant of integration (+C).

### Definite integral

Example: `∫_0^1 x^2 dx`

**Key Insights** (7)

1. The Fundamental Theorem of Calculus: ∫_a^b f dx = F(b) − F(a), where F is any antiderivative.
2. Here F(x) = 1/3*x^3, so ∫_0^1 (x^2) dx = 1/3 (≈ 0.3333).
3. No “+C” for a definite integral — the constant cancels in the subtraction.

   *— Show more —*
4. A definite integral is the signed area between the curve and the x-axis over [a, b].
5. Area below the axis counts as negative: ∫_0^{2π} sin(x) dx = 0, although the curve encloses area on both sides. For the total area, integrate |f(x)|.
6. With a substitution, change the bounds to values of u and finish in u; there is no need to substitute back.
7. A rough sketch checks the answer: its sign and size should match the area you can see.

**Common Mistakes** (4)

1. Keeping the +C — it cancels when you subtract F(a) from F(b).
2. Swapping the bounds: ∫_a^b = −∫_b^a.
3. Integrating across a discontinuity (e.g. 1/x on [−1, 1]) as if the integral were proper.

   *— Show more —*
4. Changing to u but keeping the x-bounds.

### Improper, converges

Example: `∫_1^∞ 1/x^2 dx`

**Key Insights** (5)

1. An improper integral is a limit: replace the infinite bound by t, integrate, then let t → ∞.
2. Here the limit is finite, ∫_1^∞ (1/x^2) dx = 1: an infinite interval can still have a finite area.
3. It converges when that limit is finite; ∫₁^∞ 1/x^p dx converges exactly when p > 1.

   *— Show more —*
4. Comparison decides many tails without integrating: if 0 ≤ f(x) ≤ 1/x² for large x, then ∫^∞ f dx converges too.
5. An exponential decays faster than any power, so ∫_0^∞ e^(−x) dx = 1 and ∫_0^∞ x^n·e^(−x) dx = n! (for whole numbers n ≥ 0) all converge.

**Common Mistakes** (2)

1. Plugging ∞ into F as if it were a number.
2. Forgetting that a limit can fail to exist even when the integrand tends to 0.

### Improper, diverges

Example: `∫_1^∞ 1/x dx`

**Key Insights** (3)

1. An improper integral converges only if the limit defining it is a finite number.
2. Here F(x) = ln|x|, and F(t) → ∞ as t → ∞: the limit is not a finite number, so the integral diverges.
3. Compare with ∫₁^∞ 1/x^p dx: it converges for p > 1 and diverges for p ≤ 1.

**Common Mistakes** (2)

1. Treating ∞ as a number and "plugging it in" — the integral is a limit, and it can fail to exist.
2. Assuming a function that tends to 0 has a convergent integral (1/x → 0 but ∫₁^∞ 1/x dx = ∞).

### Singular endpoint

Example: `∫_0^1 1/sqrt(x) dx`

**Key Insights** (4)

1. An integral whose integrand blows up at an endpoint is improper: replace that endpoint with a variable, integrate, then take the one-sided limit.
2. Here the limit is finite, ∫_0^1 (1/sqrt(x)) dx = 2: the curve is unbounded, but the integral is not.
3. It converges only if that limit is a finite number — the area can be finite even though the curve is unbounded (1/√x on (0, 1]).

   *— Show more —*
4. Compare with a p-integral: ∫₀¹ 1/xᵖ dx converges for p < 1 and diverges for p ≥ 1.

**Common Mistakes** (2)

1. Substituting the singular endpoint straight into F as if the Fundamental Theorem applied there.
2. Assuming an unbounded integrand always gives an infinite area.

### Asymptote inside

Example: `∫_-1^1 1/x^2 dx`

**Key Insights** (2)

1. An integral across a vertical asymptote is a sum of two one-sided limits; if either fails to exist, the integral diverges.
2. Do not apply F(b) − F(a) across the asymptote: for 1/x² on [−1, 1] that gives −2 for a positive integrand.

**Common Mistakes** (1)

1. Applying F(b) − F(a) straight across the asymptote and reporting the (meaningless) number.

### Numerical estimate

Example: `∫_0^1 sqrt(1+x^4) dx`

**Key Insights** (4)

1. A numerical integral gives the value, not a formula: it samples the curve and adds up slices (Simpson's rule fits parabolas through triples of points), and the digits shown are those two step sizes agree on, a check on the accuracy rather than a proof of it.
2. A function continuous on an interval has an antiderivative there, but it may have no formula in elementary functions (√(1 + x⁴) is one such); this solver found none here, and a numerical value is the practical answer.
3. Try a method by hand: the solver's list stops at the techniques named in the steps; a trigonometric identity, a different substitution or a reduction formula may give the exact form.

   *— Show more —*
4. A definite integral is the signed area between the curve and the x-axis over [0, 1]; a numerical estimate is a fine way to check an exact answer found by hand.

**Common Mistakes** (3)

1. Writing the estimate as an exact value: ≈ 1.0894 is correct to the digits shown, = 1.0894 is a different claim.
2. Trusting a numerical value across a vertical asymptote — the slices there are meaningless (this solver checks for one first).
3. Assuming no antiderivative exists because a solver did not find one: the methods tried are listed in the steps.

