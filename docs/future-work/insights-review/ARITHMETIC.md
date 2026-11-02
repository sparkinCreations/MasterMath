# Insights review: Arithmetic (1.67.0)

**Written:** November 1, 2026
**For:** MJ, to spot-check before 1.67.0 is pushed
**Revised:** after three outside reviews (the last two: "educational content approved", "content review passed"); every claim and verdict is Rounds 36–38 of [`../../evaluations/2026-10/REVIEW-LOG-2026-10.md`](../../evaluations/2026-10/REVIEW-LOG-2026-10.md)
**Plan:** [`../PLAN-INSIGHTS-AND-RESOURCES.md`](../PLAN-INSIGHTS-AND-RESOURCES.md) · **Before this:** [Integrals](INTEGRALS.md), [Derivatives](DERIVATIVES.md), [Algebra](ALGEBRA.md), [Limits](LIMITS.md), [Functions](FUNCTIONS.md), [Trigonometry](TRIGONOMETRY.md), [Inequalities and systems](INEQUALITIES-AND-SYSTEMS.md). The last topic of the plan.

Generated from the solver, so it is exactly what a student sees for each
example (formulas as plain text here, typeset on the page). The first three
of each list show; **"Show more"** opens the rest. Where the working
changed, it is included (open "Working").

## What to check

1. **Order:** is the most useful insight first for each method?
2. **Accuracy and wording**, especially the new working: gcd and lcm from
   the primes, mod as a division with remainder, the gamma function for
   3.5!, the logarithm of a negative number, a repeating decimal read as
   its fraction, and ≈ wherever a decimal is rounded.
3. **Missing:** an insight or mistake a student needs that is not here.

## Built in from the start (the lessons of the first seven topics)

- **The second insight works the student's own problem**, from the steps
  the solve wrote: the operations in order; the common denominator; the
  carry in an addition; the place-value split of a product; the common
  factor of a division; the factors of a power or a factorial; the
  reciprocal of a negative exponent; 15/100 × 80; the power a logarithm
  asks for; the primes of a gcd or lcm; the remainder of a mod; the square
  pulled out of a root; the primes tried in a primality test; the deciding
  digit in a rounding.
- **The order of operations says its conventions where the problem relies
  on them**: 8/2(2+2) is read left to right (and how to write the other
  reading); 2^3^2 is 2^(3^2).
- **Exact only when exact**: "=" beside a decimal only when the decimal is
  the whole value (1/8 = 0.125), ≈ when it is rounded (1/7 ≈ 0.1429, also
  in the steps: 2^0.5 ≈ 1.4142). The same rule now holds in every topic:
  trigonometry and limits wrote 1/2 (≈ 0.5), and now write 1/2 (= 0.5).
- **Swept for wrong answers before writing:** about 70 inputs. Found and
  fixed:
  - **−7 mod 5 was −2**, against the solver's own mistake ("−7 mod 5 is 3,
    not −2"): the minus was applied after the mod, with a step saying "the
    exponent binds tighter". It is 3, worked: −7 = (−2) × 5 + 3.
  - **0.333... was 333/1000**: the dots were dropped. A repeating decimal is
    now read as its fraction, and the step says how: 0.1666… = (16 − 1)/90
    = 15/90 = 1/6.
  - **3.5! was "11.6317"**, as if it were a factorial (a mistake on the same
    list said not to apply ! to a fraction): it is the gamma function's
    Γ(4.5) ≈ 11.6317, and the step says so. **(−5)!** showed the engine's
    "Value must be non-negative"; it is undefined, in words.
  - **log(8) was "0.9031"**, an irrational number with no ≈; it is
    log(8) ≈ 0.9031 (ln, log_2 alike). **1/7 was "(= 0.1429)"**; it is
    ≈ 0.1429.
  - **log(−1) was "1.3644i"**, beside a tip that logarithms need positive
    numbers; the step now says it has no real value, and what the complex
    value shown is (πi/ln(10) ≈ 1.3644i).
  - **gcd, lcm and mod were looked up** ("Evaluate the function: gcd(12, 18)
    = 6"); now worked from the primes and as a division with remainder.
    (−8)^(1/3) said "Resolve the exponents" and worked nothing; now 8^(1/3)
    = 2 since 2³ = 8.
- **Revised after the review:** log(−1)'s answer says there is no real
  value first, then the complex value shown; the factorial, logarithm,
  power, gcd × lcm, mod and cube-root rules each say where they hold; a
  repeating decimal has its own mistakes, and after the second review its
  own insights (a repeating decimal is exact: 0.333… = 1/3, 0.333 =
  333/1000).
- **No sources:** every insight here is a standard textbook fact.

## The lists, method by method


### Order of operations

Example: `(5 + 3) * 4 - 2^3` → 24

<details><summary>Working</summary>

- Evaluate: (5+3)*4-2^3
- Work inside the parentheses: (5+3) = 8  →  8*4-2^3
- Exponents first: 2 ^ 3 = 8  →  8 * 4 - 8
- Multiplication and division next, left to right: 8 * 4 = 32  →  32 - 8
- Addition and subtraction last, left to right: 32 - 8 = 24
- Final answer: 24

</details>

**Key Insights** (4)

1. PEMDAS/BODMAS order: Parentheses, Exponents, Multiplication & Division (left to right), Addition & Subtraction (left to right).
2. Here: (5+3) = 8, then 2 ^ 3 = 8, then 8 × 4 = 32, then 32 - 8 = 24.
3. Multiplication and division share a tier — resolve them left to right, not multiplication first.

   *— Show more —*
4. Use parentheses to force a different order of operations.

**Common Mistakes** (3)

1. Adding or subtracting before multiplying or dividing.
2. Evaluating left to right while ignoring precedence.
3. Sign errors when subtracting a negative number.

### Implicit product after a division (convention, new)

Example: `8/2(2+2)` → 16

**Key Insights** (5)

1. PEMDAS/BODMAS order: Parentheses, Exponents, Multiplication & Division (left to right), Addition & Subtraction (left to right).
2. Here: (2+2) = 4, then 8 ÷ 2 = 4, then 4 × 4 = 16.
3. A number in front of a bracket is a multiplication, on the same tier as division: 8/2(2+2) is read left to right, (8/2)·4 = 16. Some books bind the implicit product first and get 1, so write (8/2)(2+2) or 8/(2(2+2)) to say which.

   *— Show more —*
4. Multiplication and division share a tier — resolve them left to right, not multiplication first.
5. Use parentheses to force a different order of operations.

**Common Mistakes** (4)

1. Adding or subtracting before multiplying or dividing.
2. Multiplying before dividing because the product is written without a sign: 8/2(2+2) is not 8/8 in the usual reading.
3. Evaluating left to right while ignoring precedence.

   *— Show more —*
4. Sign errors when subtracting a negative number.

### Stacked powers (new)

Example: `2^3^2` → 512

**Key Insights** (5)

1. PEMDAS/BODMAS order: Parentheses, Exponents, Multiplication & Division (left to right), Addition & Subtraction (left to right).
2. Here: 3 ^ 2 = 9, then 2 ^ 9 = 512.
3. Stacked powers are worked from the top down: 2^3^2 = 2^(3^2) = 2^9 = 512, not (2^3)^2 = 64.

   *— Show more —*
4. Multiplication and division share a tier — resolve them left to right, not multiplication first.
5. Use parentheses to force a different order of operations.

**Common Mistakes** (4)

1. Adding or subtracting before multiplying or dividing.
2. Working 2^3^2 left to right as (2^3)^2.
3. Evaluating left to right while ignoring precedence.

   *— Show more —*
4. Sign errors when subtracting a negative number.

### Adding fractions (LCD)

Example: `3/4 + 5/6` → 19/12 (≈ 1.5833)

<details><summary>Working</summary>

- Evaluate: 3/4+5/6
- The denominators differ (4, 6), so first rewrite every term over a common denominator.
- The least common denominator is 12 (the least common multiple of 4 and 6).
- Rewrite each term over 12: 3/4 = 9/12,  5/6 = 10/12.
- Combine the numerators over 12: 9/12 + 10/12 = (9 + 10)/12 = 19/12.
- Final answer: 19/12 (≈ 1.5833)

</details>

**Key Insights** (4)

1. To add or subtract fractions, rewrite them over a common denominator first, then combine only the numerators.
2. Here: over the common denominator, 9/12 + 10/12 = (9 + 10)/12 = 19/12.
3. Work with the fractions exactly — 1/3 is not 0.3333, and rounding part-way through changes the answer.

   *— Show more —*
4. Reduce the result by dividing numerator and denominator by their greatest common factor.

**Common Mistakes** (3)

1. Adding the numerators and the denominators separately: 1/3 + 1/7 is not 2/10.
2. Converting only some of the terms — a whole number must be rewritten over the common denominator too.
3. Rounding a fraction to a decimal in the middle of exact work.

### Multiplying fractions

Example: `2/3 * 9/4` → 3/2 (= 1.5)

**Key Insights** (4)

1. Multiplying fractions needs no common denominator: multiply straight across, numerators together and denominators together.
2. Here: 2/3 × 9/4 = (2 × 9)/(3 × 4) = 18/12, which reduces: 18/12 = 3/2.
3. Cross-cancel a common factor between a numerator and a denominator before multiplying, and the product is already reduced.

   *— Show more —*
4. Reduce the result by dividing numerator and denominator by their greatest common factor.

**Common Mistakes** (3)

1. Finding a common denominator before multiplying — that is only needed for adding and subtracting.
2. Multiplying the numerators but keeping one of the denominators.
3. Rounding a fraction to a decimal in the middle of exact work.

### Dividing fractions

Example: `(1/2) / (3/4)` → 2/3 (≈ 0.6667)

**Key Insights** (4)

1. To divide by a fraction, flip it (take its reciprocal) and multiply — "keep, change, flip".
2. Here: 1/2 ÷ 3/4 = 1/2 × 4/3 = (1 × 4)/(2 × 3) = 4/6, which reduces: 4/6 = 2/3.
3. Only the divisor (the second fraction) is inverted; the first fraction stays as it is.

   *— Show more —*
4. Reduce the result by dividing numerator and denominator by their greatest common factor.

**Common Mistakes** (3)

1. Flipping the wrong fraction when dividing: only the divisor (the second fraction) is inverted.
2. Dividing straight across (numerator by numerator) — that only works when it happens to divide evenly.
3. Rounding a fraction to a decimal in the middle of exact work.

### Addition with a carry

Example: `25 + 17` → 42

**Key Insights** (3)

1. Add column by column from the right, ones with ones and tens with tens, carrying 1 to the next column when a column reaches 10.
2. Here: the ones make 5 + 7 = 12: write 2 and carry 1, so 25 + 17 = 42.
3. Check with an estimate: round each number and add the rounded values; the exact answer should be close.

**Common Mistakes** (2)

1. Misaligning the places when one number has more digits than the other.
2. Forgetting a carry when a column adds to 10 or more.

### Subtraction below zero

Example: `5 - 8` → -3

**Key Insights** (3)

1. When the number subtracted is the larger one, the result is negative: 5 − 8 = −(8 − 5) = −3 — the distance is the same, the sign flips.
2. Here: 8 − 5 = 3, and the larger number is the one taken away, so 5 − 8 = -3.
3. On a number line, subtracting moves left: start at the first number and step back by the second; past 0 the answer is negative.

**Common Mistakes** (2)

1. Subtracting the smaller number from the larger and keeping the sign positive: 5 − 8 is −3, not 3.
2. Dropping the minus sign when the second number is larger.

### Decimals

Example: `0.1 + 0.2` → 3/10 (= 0.3)

**Key Insights** (3)

1. Line up the decimal points and add column by column: 0.1 + 0.2 = 0.3 exactly. (A calculator working in binary shows 0.30000000000000004; the fraction 3/10 is the true value.)
2. Here: in tenths, 1/10 + 2/10 = 3/10.
3. Check with an estimate: round each number and add the rounded values; the exact answer should be close.

**Common Mistakes** (2)

1. Adding the digits without lining up the places: 0.1 + 0.02 is 0.12, not 0.3.
2. Forgetting a carry when a column adds to 10 or more.

### Multiplication by place value

Example: `23 * 47` → 1081

**Key Insights** (3)

1. Multiply, then check with an estimate: round each factor and multiply the rounded values.
2. Here: split 47 by place value: 23 × 47 = 23 × 40 + 23 × 7 = 920 + 161 = 1081.
3. The sign rule: two negatives make a positive, one negative makes a negative.

**Common Mistakes** (2)

1. Losing a zero (or gaining one) when a factor ends in zeros.
2. A sign slip when one factor is negative.

### Division as a fraction

Example: `100/8` → 25/2 (= 12.5)

**Key Insights** (3)

1. A division is a fraction: 100/8 = 25/2 after cancelling the common factor 4; as a decimal, 12.5.
2. Here: 100 and 8 share the factor 4: 100/8 = 25/2 = 12.5.
3. A division that does not come out even is a fraction or a repeating decimal, both exact; a rounded decimal is an approximation.

**Common Mistakes** (2)

1. Dividing in the wrong order: 100/8 is 100 ÷ 8, not 8 ÷ 100.
2. Rounding 12.5 to 12 or 13 when the exact value is asked for.

### Powers

Example: `2^5` → 32

**Key Insights** (4)

1. a^n is a multiplied by itself n times: 2^10 = 2 × 2 × … × 2 (ten factors) = 1024.
2. Here: 2^5 = 2 × 2 × 2 × 2 × 2 = 32.
3. The rules: a^m · a^n = a^(m+n) and (a^m)^n = a^(mn) for whole-number exponents (for other exponents, take a > 0), and a^0 = 1, a^(−n) = 1/a^n for a ≠ 0.

   *— Show more —*
4. Powers grow fast: doubling ten times is 1024, twenty times is over a million.

**Common Mistakes** (2)

1. Multiplying the base by the exponent: 2^10 is 1024, not 20.
2. Swapping base and exponent: 2^10 = 1024 but 10^2 = 100.

### A negative base

Example: `-3^2` → -9

**Key Insights** (4)

1. The exponent binds before the minus sign: −3^2 is −(3^2) = −9. The square of −3 is written (−3)^2 = 9.
2. Here: −3^2 = −(3^2) = -9; the minus waits until the power is done.
3. An even power of a negative number is positive, an odd power negative: (−3)^2 = 9, (−3)^3 = −27.

   *— Show more —*
4. Use parentheses whenever the base is negative, so the reader (and the calculator) sees what is being raised.

**Common Mistakes** (2)

1. Reading −3^2 as (−3)^2 = 9.
2. Reading (−3)^2 as −9: inside parentheses, the whole −3 is squared.

### A negative exponent

Example: `2^-3` → 1/8 (= 0.125)

<details><summary>Working</summary>

- Evaluate: 2^(-3)
- Exponents first: 2 ^ (-3) — a negative exponent means a reciprocal, a^(-n) = 1/a^n (the base cannot be 0): 2^(-3) = 1/2^3 = 1/8 (= 0.125)
- Final answer: 1/8 (= 0.125)

</details>

**Key Insights** (4)

1. a^(−n) = 1/a^n: a negative exponent moves the power to the denominator — it does not make the result negative.
2. Here: 2^(-3) = 1/2^3 = 1/8: the power moves to the denominator, and the value stays positive.
3. The base cannot be 0 (0^(−n) would be 1/0), and the sign of the result comes from the base: (−2)^(−3) = 1/(−8) = −1/8.

   *— Show more —*
4. A negative exponent on a fraction flips it: (1/2)^(−2) = 2² = 4.

**Common Mistakes** (3)

1. Writing 2^(−3) as −8 or as −2³.
2. Making the result negative — the minus sign is in the exponent, not in the value.
3. Forgetting that −2^(−2) applies the minus after the power: −(1/4).

### Factorial

Example: `7!` → 5040

**Key Insights** (4)

1. n! = n × (n − 1) × … × 2 × 1 — the product of every whole number from n down to 1.
2. Here: 7! = 7 × 6 × 5 × 4 × 3 × 2 × 1 = 5040.
3. 0! = 1 by definition, so that formulas for combinations and permutations work at the edges.

   *— Show more —*
4. Factorials grow very fast: 10! is already 3,628,800.

**Common Mistakes** (3)

1. Reading 7! as 7 × 1, or as 7 + 6 + … + 1.
2. Treating (n − 1)! as n! − 1.
3. Applying the ordinary factorial outside the whole numbers: n! as a product is for n = 0, 1, 2, …. The gamma function extends it to most other numbers (3.5! = Γ(4.5)), but it is undefined at the negative whole numbers.

### Not a whole number: the gamma function (fixed)

Example: `3.5!` → ≈ 11.6317

<details><summary>Working</summary>

- Evaluate: 3.5!
- 3.5! is not a factorial in the usual sense: n! multiplies the whole numbers from n down to 1, and 3.5 is not a whole number. The value shown is the gamma function's, which extends the factorial: 3.5! = Γ(4.5).
- Final answer: ≈ 11.6317

</details>

**Key Insights** (4)

1. n! = n × (n − 1) × … × 2 × 1 — the product of every whole number from n down to 1.
2. Here: 3.5 is not a whole number, so 3.5! is not a product of whole numbers; the value shown is Γ(4.5), which the gamma function extends the factorial to.
3. 0! = 1 by definition, so that formulas for combinations and permutations work at the edges.

   *— Show more —*
4. Factorials grow very fast: 10! is already 3,628,800.

**Common Mistakes** (3)

1. Reading 7! as 7 × 1, or as 7 + 6 + … + 1.
2. Treating (n − 1)! as n! − 1.
3. Applying the ordinary factorial outside the whole numbers: n! as a product is for n = 0, 1, 2, …. The gamma function extends it to most other numbers (3.5! = Γ(4.5)), but it is undefined at the negative whole numbers.

### Percent

Example: `15% of 80` → 12

<details><summary>Working</summary>

- Evaluate: 15%of80
- Percent means "per hundred": rewrite 15%of80 as (15/100)*80.
- Work inside the parentheses: (15/100) = 3/20  →  (3/20)*80
- To multiply fractions, multiply the numerators together and the denominators together: 3/20 × 80 = (3 × 80)/(20 × 1) = 240/20.
- Reduce by the common factor 20: 240/20 = 12, a whole number.
- Final answer: 12

</details>

**Key Insights** (4)

1. "Per cent" means per hundred: 50% = 50/100 = 1/2, and "of" means multiply.
2. Here: 15% of 80 = 15/100 × 80 = 12.
3. To find p% of a number, multiply by p/100 (or move the decimal point two places).

   *— Show more —*
4. A percent of a percent multiplies: 50% of 50% is 25%, not 100%.

**Common Mistakes** (3)

1. Multiplying by 50 instead of by 0.5.
2. Adding the percentage instead of multiplying by it.
3. Mixing up "50% of 80" with "50 is what percent of 80".

### Logarithm (≈ now said)

Example: `log(8)` → log(8) ≈ 0.9031

<details><summary>Working</summary>

- Evaluate: log(8)
- log(8) asks for the power of 10 that gives 8: 10^0.9031 ≈ 8, so log(8) ≈ 0.9031.
- Final answer: log(8) ≈ 0.9031

</details>

**Key Insights** (5)

1. log_b(a) asks for the power of b that gives a: log_b(a) = k means b^k = a, so log_2(8) = 3 because 2^3 = 8.
2. Here: log(8) asks for the power of 10 that gives 8: 10^0.9031 ≈ 8, so log(8) ≈ 0.9031.
3. "log(…)" is read as the common logarithm, base 10, as on a calculator. Write "ln(…)" for the natural logarithm, or "log(x, b)" / "log_b(x)" for another base.

   *— Show more —*
4. ln is the natural logarithm, base e. For a base other than 10 or e, change base: log_b(a) = ln(a)/ln(b).
5. The rules, for x > 0 and y > 0 (real logarithms): log(xy) = log(x) + log(y), log(x/y) = log(x) − log(y), log(x^n) = n·log(x). With complex logarithms they can fail, because of which value is taken.

**Common Mistakes** (3)

1. Mixing up log and ln: log(8) ≈ 0.9031 but ln(8) ≈ 2.0794.
2. Splitting log(a + b) into log(a) + log(b): the product rule is for log(ab).
3. Taking the logarithm of 0 or a negative number as a real number: in the real numbers it is defined only for positive numbers (log(−1) has only a complex value).

### Logarithm of a negative number (fixed)

Example: `log(-1)` → No real value; principal complex value πi/ln(10) ≈ 1.3644i

<details><summary>Working</summary>

- Evaluate: log(-1)
- log(−1) has no real value: no power of 10 is negative. In the complex numbers its principal value is πi/ln(10), shown below; in real arithmetic it is undefined.
- Final answer: No real value; principal complex value πi/ln(10) ≈ 1.3644i

</details>

**Key Insights** (5)

1. log_b(a) asks for the power of b that gives a: log_b(a) = k means b^k = a, so log_2(8) = 3 because 2^3 = 8.
2. Here: log(−1) would be the power of 10 that gives a negative number, and every power of 10 is positive: in real arithmetic it is undefined.
3. "log(…)" is read as the common logarithm, base 10, as on a calculator. Write "ln(…)" for the natural logarithm, or "log(x, b)" / "log_b(x)" for another base.

   *— Show more —*
4. ln is the natural logarithm, base e. For a base other than 10 or e, change base: log_b(a) = ln(a)/ln(b).
5. The rules, for x > 0 and y > 0 (real logarithms): log(xy) = log(x) + log(y), log(x/y) = log(x) − log(y), log(x^n) = n·log(x). With complex logarithms they can fail, because of which value is taken.

**Common Mistakes** (3)

1. Mixing up log and ln: log(8) ≈ 0.9031 but ln(8) ≈ 2.0794.
2. Splitting log(a + b) into log(a) + log(b): the product rule is for log(ab).
3. Taking the logarithm of 0 or a negative number as a real number: in the real numbers it is defined only for positive numbers (log(−1) has only a complex value).

### gcd, worked from the primes (new)

Example: `gcd(12, 18)` → 6

<details><summary>Working</summary>

- Evaluate: gcd(12,18)
- Factor each number into primes: 12 = 2^2 × 3, and 18 = 2 × 3^2.
- The gcd takes each prime the two share, at its lower power: 2 × 3 = 6.
- Final answer: 6

</details>

**Key Insights** (4)

1. The gcd is the largest number dividing both: take the primes they share, each to its lower power — for 12 and 18, 2 × 3 = 6.
2. Here: 12 = 2^2 × 3 and 18 = 2 × 3^2; the shared primes at their lower powers give 2 × 3 = 6.
3. Euclid's algorithm is quicker: replace the larger number by its remainder on division by the smaller, until a remainder is 0 — 18 and 12, then 12 and 6, then 6 and 0: the gcd is 6.

   *— Show more —*
4. For two positive whole numbers, the gcd times the lcm is their product (6 × 36 = 12 × 18), so one gives the other: the lcm of 12 and 18 is 12 × 18 / 6 = 36.

**Common Mistakes** (3)

1. Taking the smaller number: the gcd of 12 and 18 is 6, not 12.
2. Stopping Euclid's algorithm one step early, at a non-zero remainder.
3. Mixing the two up: the gcd is never larger than either number, the lcm never smaller.

### lcm

Example: `lcm(4, 6)` → 12

**Key Insights** (4)

1. The lcm is the smallest number both divide into: take every prime from either factorization, each to its higher power — for 4 and 6, 2² × 3 = 12.
2. Here: 4 = 2^2 and 6 = 2 × 3; every prime at its higher power gives 2^2 × 3 = 12.
3. For two positive whole numbers, the gcd times the lcm is their product (6 × 36 = 12 × 18), so one gives the other: the lcm of 12 and 18 is 12 × 18 / 6 = 36.

   *— Show more —*
4. For the gcd, Euclid's algorithm is quicker than factoring: replace the larger number by its remainder on division by the smaller, until a remainder is 0.

**Common Mistakes** (3)

1. Multiplying the numbers: the lcm of 12 and 18 is 36, not 216.
2. Stopping Euclid's algorithm one step early, at a non-zero remainder.
3. Mixing the two up: the gcd is never larger than either number, the lcm never smaller.

### mod, with a negative dividend (fixed)

Example: `-7 mod 5` → 3

<details><summary>Working</summary>

- Evaluate: mod(-7,5)
- -7 mod 5 is the remainder when -7 is divided by 5: -7 = (-2) × 5 + 3, with 0 ≤ 3 < 5, so the remainder is 3.
- Final answer: 3

</details>

**Key Insights** (4)

1. a mod b is the remainder when a is divided by b: 17 = 3 × 5 + 2, so 17 mod 5 = 2.
2. Here: -7 = (-2) × 5 + 3, so the remainder is 3.
3. For a positive b, the result is always between 0 and b − 1; a result of 0 means b divides a exactly.

   *— Show more —*
4. Clock arithmetic: 17 o'clock on a 5-hour clock reads 2 — the multiples of 5 wrap around.

**Common Mistakes** (3)

1. Giving the quotient (3) instead of the remainder (2).
2. Reporting a remainder as large as the divisor: it is always smaller.
3. A negative dividend: −7 mod 5 is 3 (the remainder is kept non-negative), not −2.

### A perfect square

Example: `sqrt(16)` → 4

**Key Insights** (3)

1. A perfect square has a whole-number root: √n = r exactly when r² = n for a whole number r ≥ 0 (√16 = 4, √81 = 9).
2. Here: √16 = 4 because 4² = 16.
3. The radical symbol means the non-negative root: √16 is 4, and −4 is the other solution of x² = 16, not part of √16.

**Common Mistakes** (2)

1. √(a + b) is not √a + √b: √(16 + 9) = 5, but √16 + √9 = 7.
2. Reporting ±4 for √16 — the symbol means the non-negative root.

### Simplifying a root

Example: `sqrt(50)` → 5√2 (≈ 7.0711)

<details><summary>Working</summary>

- Evaluate: sqrt(50)
- Evaluate the function: sqrt(50) ≈ 7.0711
- Simplify the root: pull out the largest perfect square factor, 50 = 25 × 2, so √50 = √25·√2 = 5√2.
- Final answer: 5√2 (≈ 7.0711)

</details>

**Key Insights** (4)

1. √a is the non-negative number whose square is a; √2 is irrational, so its decimal never ends or repeats.
2. Here: 50 = 25 × 2, so √50 = √25·√2 = 5√2.
3. Rewrite roots as powers when combining them: √a = a^(1/2) for a ≥ 0, and ∛a = a^(1/3), read as the real cube root when a < 0 (∛(−8) = −2).

   *— Show more —*
4. Simplify by pulling out perfect squares: √8 = √4·√2 = 2√2.

**Common Mistakes** (3)

1. √(a + b) is not √a + √b.
2. Reporting ±√a for a plain root — the radical symbol means the positive root.
3. Rounding too early in a longer calculation.

### An odd root of a negative number

Example: `(-8)^(1/3)` → -2

<details><summary>Working</summary>

- Evaluate: (-8)^(1/3)
- (-8)^(1/3): the base is negative and the root is odd (3), so it has a real value — rewrite it as -(8^(1/3)). Then 8^(1/3) = 2, since 2^3 = 8: the value is -2. (A calculator that answers 1 + 1.7321i is showing the principal complex root instead.)
- Final answer: -2

</details>

**Key Insights** (4)

1. An odd root of a negative number is real: ∛(−8) = −2 because (−2)³ = −8.
2. Here: 8^(1/3) = 2, since 2^3 = 8; the root of the negative number is -2.
3. An even root of a negative number is not real: √(−4) has no real value (it is 2i).

   *— Show more —*
4. a^(1/3) means ∛a, the number whose cube is a; the sign of the root matches the sign of a.

**Common Mistakes** (2)

1. Giving 2 for ∛(−8): 2³ = 8, not −8.
2. Saying "no real solution" as if it were a square root.

### A square root of a negative number

Example: `sqrt(-4)` → 2i

**Key Insights** (4)

1. The imaginary unit is i = √(−1), so i² = −1. A square root of a negative number is a multiple of i.
2. Here: the square root of a negative number is i times the root of the positive one: 2i.
3. Take out the −1 first: √(−4) = √4·√(−1) = 2i, and √(−8) = √8·i = 2√2·i.

   *— Show more —*
4. Check it by squaring: (2i)² = 4i² = −4.

**Common Mistakes** (2)

1. Answering √(−4) = −2: (−2)² = 4, not −4. No real number squares to a negative.
2. Using √a·√b = √(ab) with two negatives: √(−4)·√(−9) = 2i·3i = −6, not √36 = 6.

### A repeating decimal (fixed)

Example: `0.333...` → 1/3 (≈ 0.3333)

<details><summary>Working</summary>

- Evaluate: 0.333…
- 0.333… is a repeating decimal: the block 3 repeats forever, so 0.333… = 3/9 = 1/3.
- Multiplication and division next, left to right: 1 / 3 = 1/3 (≈ 0.3333)
- Final answer: 1/3 (≈ 0.3333)

</details>

**Key Insights** (5)

1. A repeating decimal is a fraction: a block of k digits repeating forever is that block over k nines (0.333… = 3/9, 0.142857… = 142857/999999), reduced.
2. Here: 0.333… = 3/9 = 1/3: the repeating block over as many 9s as it has digits.
3. A repeating decimal is exact, not approximate: the dots mean the digits go on forever, so 0.333… = 1/3, while 0.333 = 333/1000.

   *— Show more —*
4. When some digits come before the repeat starts, take them off first: 0.1666… = (16 − 1)/90 = 15/90 = 1/6.
5. Check by dividing: 1 ÷ 3 = 0.333…. Every fraction is a decimal that ends or repeats, and every such decimal is a fraction.

**Common Mistakes** (4)

1. Taking the rounded 0.333 for the exact 0.333…: 0.333 = 333/1000, which is 1/3000 short of 1/3.
2. Putting the repeating block over a power of ten: 0.333… is 3/9, not 3/10.
3. Forgetting the digits that do not repeat: 0.1666… is (16 − 1)/90 = 1/6, not 16/99.

   *— Show more —*
4. Thinking 0.999… is just below 1: it is 9/9 = 1 exactly.

### A repeating decimal in a sum

Example: `0.1666… + 1/3` → 1/2 (= 0.5)

<details><summary>Working</summary>

- Evaluate: 0.1666…+1/3
- 0.1666… is a repeating decimal: the block 6 repeats forever, so 0.1666… = (16 − 1)/90 = 15/90 = 1/6.
- The denominators differ (6, 3), so first rewrite every term over a common denominator.
- The least common denominator is 6 (the least common multiple of 6 and 3).
- Rewrite each term over 6: 1/3 = 2/6.
- Combine the numerators over 6: 1/6 + 2/6 = (1 + 2)/6 = 3/6.
- Reduce by the common factor 3: 3/6 = 1/2.
- Final answer: 1/2 (= 0.5)

</details>

**Key Insights** (4)

1. To add or subtract fractions, rewrite them over a common denominator first, then combine only the numerators.
2. Here: over the common denominator, 1/6 + 2/6 = (1 + 2)/6 = 3/6, which reduces: 3/6 = 1/2.
3. Work with the fractions exactly — 1/3 is not 0.3333, and rounding part-way through changes the answer.

   *— Show more —*
4. Reduce the result by dividing numerator and denominator by their greatest common factor.

**Common Mistakes** (3)

1. Adding the numerators and the denominators separately: 1/3 + 1/7 is not 2/10.
2. Converting only some of the terms — a whole number must be rewritten over the common denominator too.
3. Rounding a fraction to a decimal in the middle of exact work.

### Complex multiplication

Example: `(2+3i)*(1-i)` → 5 + i

**Key Insights** (4)

1. i is defined by i^2 = −1: multiply complex numbers like binomials (FOIL), then replace i^2 with −1.
2. Here: (2 + 3i)(1 - i) = 2 − 2i + 3i − 3i^2 = 2 + 3 + i = 5 + i.
3. (a + bi)(c + di) = (ac − bd) + (ad + bc)i: the −bd is the i^2 term with its sign flipped.

   *— Show more —*
4. A real factor scales both parts: 2(3 + 4i) = 6 + 8i.

**Common Mistakes** (2)

1. Leaving i^2 in the answer instead of replacing it with −1.
2. Multiplying real parts together and imaginary parts together: (2 + 3i)(1 − i) is not 2 − 3i.

### Is it prime?

Example: `is 91 prime` → 91 is not prime: 91 = 7 × 13

<details><summary>Working</summary>

- Detected as Arithmetic: your input asks whether a number is prime.
- A prime number is a whole number greater than 1 whose only divisors are 1 and itself.
- Try the primes in order: 91 ÷ 7 = 13 exactly, so 7 divides 91.
- 91 = 7 × 13: it has a divisor other than 1 and itself, so it is not prime (it is composite).
- Its prime factorization: 91 = 7 × 13.

</details>

**Key Insights** (4)

1. To test n for primality, divide by the primes up to √n: if n = a × b with both factors greater than 1, one of them is at most √n.
2. Here: 2, 3, 5 leave a remainder, and 7 divides it: 91 = 7 × 13, so 91 is composite.
3. 2 is the only even prime; 1 is not prime (it has one divisor, not two).

   *— Show more —*
4. Quick checks: an even number is divisible by 2; a digit sum divisible by 3 means divisible by 3; a last digit 0 or 5 means divisible by 5.

**Common Mistakes** (3)

1. Calling 1 prime: a prime has exactly two divisors.
2. Stopping too early: 91 = 7 × 13 looks prime until 7 is tried.
3. Testing every number up to n instead of only the primes up to √n.

### Prime factorization

Example: `prime factorization of 360` → 360 = 2^3 × 3^2 × 5

**Key Insights** (4)

1. Every whole number greater than 1 is a product of primes in exactly one way (the Fundamental Theorem of Arithmetic).
2. Here: 2 goes in three times, 3 goes in twice, 5 goes in once, so 360 = 2^3 × 3^2 × 5.
3. Group repeated factors with exponents: 2 × 2 × 2 = 2^3.

   *— Show more —*
4. The factorization gives the divisors, the GCD and the LCM: the GCD takes the lower power of each prime, the LCM the higher.

**Common Mistakes** (2)

1. Stopping at a composite factor: 360 = 4 × 90 is not yet prime factors.
2. Listing 1 as a prime factor.

### Rounding

Example: `round 3.14159 to 2 decimal places` → 3.14

**Key Insights** (3)

1. Look only at the digit just after the last one you keep: 5 or more rounds up, less than 5 rounds down.
2. Here: the deciding digit, just after the 4 in the hundredths place, is 1, so round down: 3.14.
3. Keep trailing zeros the rounding asks for: 2.996 to 2 decimal places is 3.00, not 3.

**Common Mistakes** (2)

1. Rounding in stages: 2.346 to 1 decimal place is 2.3; rounding to 2.35 first and then to 2.4 is wrong.
2. Dropping digits instead of rounding: 3.789 to 1 decimal place is 3.8, not 3.7.

