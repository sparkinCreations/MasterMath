# Insights review: Trigonometry (1.65.0)

**Written:** November 1, 2026
**For:** MJ, to spot-check before 1.65.0 is pushed
**Revised:** after two outside reviews ("approve with revisions", then "conditional approval, two final corrections"); every claim and verdict is Rounds 29 and 30 of [`../../evaluations/2026-10/REVIEW-LOG-2026-10.md`](../../evaluations/2026-10/REVIEW-LOG-2026-10.md)
**Plan:** [`../PLAN-INSIGHTS-AND-RESOURCES.md`](../PLAN-INSIGHTS-AND-RESOURCES.md) · **Before this:** [Integrals](INTEGRALS.md), [Derivatives](DERIVATIVES.md), [Algebra](ALGEBRA.md), [Limits](LIMITS.md), [Functions](FUNCTIONS.md)

Generated from the solver, so it is exactly what a student sees for each
example (formulas as plain text here, typeset on the page). The first three
of each list show; **"Show more"** opens the rest. Where the working
changed, it is included (open "Working").

## What to check

1. **Order:** is the most useful insight first for each method?
2. **Accuracy and wording**, especially the new working: the reference-angle
   line, exact names for non-special angles (arcsin(3/10)), the proved
   identities and the domain they lose.
3. **Missing:** an insight or mistake a student needs that is not here.

## Built in from the start (the lessons of the first five topics)

- **The second insight works the student's own problem**: the reference
  angle, quadrant and sign (5π/6 = 150°, quadrant II, sin(30°)); the
  principal value of an inverse; the identity used and where it holds;
  arcsin(c) and π − arcsin(c); the rewrite of a reciprocal; u and its
  roots for a quadratic; R and φ for a·sin + b·cos.
- **The solver's own value-specific advice still leads** ("sin reaches 1
  only once in each period"), and the new lists add only what it does not
  say: a near-duplicate is dropped.
- **Exact only when exact, proved when claimed.**
- **Swept for wrong answers before writing:** about 60 inputs across values,
  identities and equations. Found and fixed:
  - **sin(1.0472) was "√3/2"** and cos(0.7854) "√2/2": the exact labels were
    matched to 0.0001, so a decimal close to π/3 was called exactly π/3.
    Now matched to double precision; a value with no exact form carries ≈
    (sin(1) ≈ 0.8415, arcsin(0.3) ≈ 0.3047, arcsin(0.3) ≈ 17.4576° in
    degrees).
  - **sin(x) = 0.3 gave "x = 0.3047 + 2πn"**, an equals sign on a decimal;
    now x = arcsin(3/10) + 2πn or x = π − arcsin(3/10) + 2πn, with the
    period's solutions ≈ 0.3047, 2.8369.
  - **Identities were "confirmed numerically at several values"**; now
    proved: both sides are written in sin and cos of one angle, and with
    t = tan(x/2) they are rational functions of t, equal when their
    difference is exactly 0 at more rational points than its numerator's
    degree (exact fractions).
  - **tan(x)·cos(x) = sin(x)** lost the points where cos(x) = 0; the answer
    now says "for cos(x) ≠ 0" (decided exactly at those points).
  - **cos(x) = 1** said "x = 0 and x = −0 both work … 2π − 0 = 2π"; a value
    reached once per period is now said once.
  - **Families left undivided:** tan(2x) = 1 was x = (π/4 + πn)/2, now
    x = π/8 + (π/2)n; cos(x/2) = 1 was x = 2(2πn), now x = 4πn; the cases of
    a quadratic are listed in order (π/6 before 7π/6).
  - **sec²(x) − 1, sin(x)·cos(x) and tan(x) + cot(x)** were left as typed;
    now tan²(x), sin(2x)/2 and 2/sin(2x).
- **Revised after the review:** cot(x) = 0 solved (it was "no real
  solution"); φ stated with its quadrant; which angles have exact values,
  the reciprocal rule at c = 0, the tan count with kx, "principal value"
  worded exactly; the identity proof checks x = π + 2πn; sin(30) under the
  Auto angle unit says it was read as 30°.
- **No sources:** every insight here is a standard textbook fact ("All
  Students Take Calculus" is a common classroom mnemonic, not a citation).

## The lists, method by method

### Special angle, first quadrant

Example: `sin(pi/3)` → √3/2 (≈ 0.866)

**Key Insights** (5)

1. Remember: sin(0°) = 0, sin(30°) = 1/2, sin(45°) = √2/2, sin(60°) = √3/2, sin(90°) = 1.
2. Here: π/3 = 60°, a special angle, so sin(60°) = √3/2.
3. The signs by quadrant ("All Students Take Calculus"): all positive in I, sine in II, tangent in III, cosine in IV.

   *— Show more —*
4. Beyond 90°, reduce to the reference angle in [0°, 90°] and give the value the sign of the quadrant: sin(150°) = sin(30°) = 1/2, cos(150°) = −cos(30°).
5. Key identity: sin²(x) + cos²(x) = 1; and sin and cos are cofunctions, sin(θ) = cos(90° − θ).

**Common Mistakes** (3)

1. Confusing sin and cos values for complementary angles (sin 30° = cos 60°).
2. Giving the reference angle's value without the quadrant's sign: sin(210°) is −1/2, not 1/2.
3. Giving a decimal where the exact value is expected: special angles have exact values.

### Special angle beyond 90° (reference angle, new)

Example: `sin(5pi/6)` → 1/2 (≈ 0.5)

<details><summary>Working</summary>

- Evaluate the trigonometric expression: sin(5pi/6)
- Using the sine function (opposite / hypotenuse in a right triangle).
- Input is in radians (π = 180°).
- Calculate the value: 1/2 (≈ 0.5)

</details>

**Key Insights** (4)

1. A special angle has an exact value: reduce it to its reference angle in [0°, 90°], read the value from 0°, 30°, 45°, 60°, 90°, and give it the sign of the quadrant.
2. Here: 5π/6 = 150° is in quadrant II with reference angle 30°; sin is positive there, so sin(150°) = sin(30°) = 1/2.
3. The signs by quadrant ("All Students Take Calculus"): all positive in I, sine in II, tangent in III, cosine in IV.

   *— Show more —*
4. Key identity: sin²(x) + cos²(x) = 1; and sin and cos are cofunctions, sin(θ) = cos(90° − θ).

**Common Mistakes** (3)

1. Confusing sin and cos values for complementary angles (sin 30° = cos 60°).
2. Giving the reference angle's value without the quadrant's sign: sin(210°) is −1/2, not 1/2.
3. Giving a decimal where the exact value is expected: special angles have exact values.

### Special angle in degrees, quadrant III

Example: `cos(210°)` → -√3/2 (≈ -0.866)

**Key Insights** (5)

1. A special angle has an exact value: reduce it to its reference angle in [0°, 90°], read the value from 0°, 30°, 45°, 60°, 90°, and give it the sign of the quadrant.
2. Here: 210° is in quadrant III with reference angle 30°; cos is negative there, so cos(210°) = −cos(30°) = -√3/2.
3. The signs by quadrant ("All Students Take Calculus"): all positive in I, sine in II, tangent in III, cosine in IV.

   *— Show more —*
4. Key identity: sin²(x) + cos²(x) = 1; and sin and cos are cofunctions, sin(θ) = cos(90° − θ).
5. π radians = 180°: multiply degrees by π/180 to get radians. Write "pi" for π ("sin(pi/6)") or set the angle unit in Settings.

**Common Mistakes** (4)

1. Mixing up radians and degrees — sin(30) in radians is −0.988, not 1/2.
2. Confusing sin and cos values for complementary angles (sin 30° = cos 60°).
3. Giving the reference angle's value without the quadrant's sign: sin(210°) is −1/2, not 1/2.

   *— Show more —*
4. Giving a decimal where the exact value is expected: special angles have exact values.

### Tangent

Example: `tan(pi/4)` → 1

**Key Insights** (4)

1. tan = sin/cos, so tan is undefined wherever cos = 0 (90°, 270°, …) and its period is 180°, not 360°.
2. Here: π/4 = 45°, a special angle, so tan(45°) = 1.
3. The signs by quadrant ("All Students Take Calculus"): all positive in I, sine in II, tangent in III, cosine in IV.

   *— Show more —*
4. Key identities: 1 + tan²(x) = sec²(x) and 1 + cot²(x) = csc²(x).

**Common Mistakes** (4)

1. Forgetting that tan(90°) is undefined (cos(90°) = 0) — a calculator shows a huge number, not the truth.
2. Using 360° as the period of tan (it repeats every 180°).
3. Giving the reference angle's value without the quadrant's sign: sin(210°) is −1/2, not 1/2.

   *— Show more —*
4. Giving a decimal where the exact value is expected: special angles have exact values.

### A reciprocal

Example: `sec(pi/3)` → 2

**Key Insights** (4)

1. sec is a reciprocal: sec = 1/cos, csc = 1/sin, cot = cos/sin, undefined wherever the function below it is 0. Find the sine or cosine first, then take the reciprocal.
2. Here: π/3 = 60°, a special angle, so sec(60°) = 2.
3. The signs by quadrant ("All Students Take Calculus"): all positive in I, sine in II, tangent in III, cosine in IV.

   *— Show more —*
4. Key identities: 1 + tan²(x) = sec²(x) and 1 + cot²(x) = csc²(x).

**Common Mistakes** (5)

1. Forgetting that sec(90°) is undefined (cos(90°) = 0) — a calculator shows a huge number, not the truth.
2. Confusing sec with 1/sin (sec = 1/cos).
3. Taking sec as an inverse: sec(x) = 1/cos(x), not arccos(x).

   *— Show more —*
4. Giving the reference angle's value without the quadrant's sign: sin(210°) is −1/2, not 1/2.
5. Giving a decimal where the exact value is expected: special angles have exact values.

### Undefined (an asymptote)

Example: `tan(pi/2)` → Undefined — cos(π/2) = 0

**Key Insights** (3)

1. tan(x) has a vertical asymptote wherever cos(x) = 0 — the value grows without bound instead of settling on a number.
2. A calculator that shows a huge number here is hitting floating-point rounding, not a real value.
3. Angles are read in radians unless the angle unit is set to degrees in Settings (π radians = 180°).

**Common Mistakes** (3)

1. Assuming tan is defined everywhere — it blows up wherever cos(x) = 0.
2. Reading the huge floating-point number near an asymptote as the actual answer.
3. Mixing up radians and degrees (use pi for radians).

### Not a special angle (≈, new)

Example: `sin(1)` → ≈ 0.8415

<details><summary>Working</summary>

- Evaluate the trigonometric expression: sin(1)
- Interpreting 1 as radians, which is 1 × 180/π ≈ 57.2958°. For degrees, write 1° or set the angle unit to degrees in Settings.
- Using the sine function (opposite / hypotenuse in a right triangle).
- Calculate the value: ≈ 0.8415

</details>

**Key Insights** (6)

1. Remember: sin(0°) = 0, sin(30°) = 1/2, sin(45°) = √2/2, sin(60°) = √3/2, sin(90°) = 1.
2. Here: sin(1) is not a special angle (1 radian is about 57.3°), so its value is a decimal: ≈ 0.8415.
3. The familiar special angles (multiples of 30° and 45°) have exact values from the table, and others have exact forms too (sin(15°) = (√6 − √2)/4, sin(22.5°) = √(2 − √2)/2). When no simpler form is found, the value is shown as a decimal with ≈; sin(1) itself is still an exact number.

   *— Show more —*
4. The signs by quadrant ("All Students Take Calculus"): all positive in I, sine in II, tangent in III, cosine in IV.
5. Key identity: sin²(x) + cos²(x) = 1; and sin and cos are cofunctions, sin(θ) = cos(90° − θ).
6. π radians = 180°: multiply degrees by π/180 to get radians. Write "pi" for π ("sin(pi/6)") or set the angle unit in Settings.

**Common Mistakes** (3)

1. Mixing up radians and degrees — sin(30) in radians is −0.988, not 1/2.
2. Confusing sin and cos values for complementary angles (sin 30° = cos 60°).
3. Giving the reference angle's value without the quadrant's sign: sin(210°) is −1/2, not 1/2.

### A decimal near a special angle (fixed)

Example: `sin(1.0472)` → ≈ 0.866

<details><summary>Working</summary>

- Evaluate the trigonometric expression: sin(1.0472)
- Interpreting 1.0472 as radians, which is 1.0472 × 180/π ≈ 60.0001°. For degrees, write 1.0472° or set the angle unit to degrees in Settings.
- Using the sine function (opposite / hypotenuse in a right triangle).
- Calculate the value: ≈ 0.866

</details>

**Key Insights** (6)

1. Remember: sin(0°) = 0, sin(30°) = 1/2, sin(45°) = √2/2, sin(60°) = √3/2, sin(90°) = 1.
2. Here: sin(1.0472) is not a special angle (1.0472 radians is about 60°), so its value is a decimal: ≈ 0.866.
3. The familiar special angles (multiples of 30° and 45°) have exact values from the table, and others have exact forms too (sin(15°) = (√6 − √2)/4, sin(22.5°) = √(2 − √2)/2). When no simpler form is found, the value is shown as a decimal with ≈; sin(1) itself is still an exact number.

   *— Show more —*
4. The signs by quadrant ("All Students Take Calculus"): all positive in I, sine in II, tangent in III, cosine in IV.
5. Key identity: sin²(x) + cos²(x) = 1; and sin and cos are cofunctions, sin(θ) = cos(90° − θ).
6. π radians = 180°: multiply degrees by π/180 to get radians. Write "pi" for π ("sin(pi/6)") or set the angle unit in Settings.

**Common Mistakes** (3)

1. Mixing up radians and degrees — sin(30) in radians is −0.988, not 1/2.
2. Confusing sin and cos values for complementary angles (sin 30° = cos 60°).
3. Giving the reference angle's value without the quadrant's sign: sin(210°) is −1/2, not 1/2.

### A bare common angle under the Auto unit (read as degrees)

Example: `sin(30)` → 1/2 (≈ 0.5)

<details><summary>Working</summary>

- Evaluate the trigonometric expression: sin(30)
- Detected input as degrees: 30° = 30 × π/180 radians
- Converting: 30° = 0.5236 radians
- Using the sine function (opposite / hypotenuse in a right triangle).
- This is a special angle: 30°. Common value: sin(30°) = 1/2
- Result (treating input as degrees): 1/2 (≈ 0.5)
- Note: if you meant radians, the result would be -0.988.

</details>

**Key Insights** (7)

1. The angle unit is on Auto, so a bare common angle such as 30 is read as degrees (30°); in radians, sin(30) is a different number. Write sin(30°) or sin(30π/180) to be explicit, or set the angle unit in Settings.
2. Here: 30°, a special angle, so sin(30°) = 1/2.
3. Remember: sin(0°) = 0, sin(30°) = 1/2, sin(45°) = √2/2, sin(60°) = √3/2, sin(90°) = 1.

   *— Show more —*
4. The signs by quadrant ("All Students Take Calculus"): all positive in I, sine in II, tangent in III, cosine in IV.
5. Beyond 90°, reduce to the reference angle in [0°, 90°] and give the value the sign of the quadrant: sin(150°) = sin(30°) = 1/2, cos(150°) = −cos(30°).
6. Key identity: sin²(x) + cos²(x) = 1; and sin and cos are cofunctions, sin(θ) = cos(90° − θ).
7. π radians = 180°: multiply degrees by π/180 to get radians. Write "pi" for π ("sin(pi/6)") or set the angle unit in Settings.

**Common Mistakes** (4)

1. Mixing up radians and degrees — sin(30) in radians is −0.988, not 1/2.
2. Confusing sin and cos values for complementary angles (sin 30° = cos 60°).
3. Giving the reference angle's value without the quadrant's sign: sin(210°) is −1/2, not 1/2.

   *— Show more —*
4. Giving a decimal where the exact value is expected: special angles have exact values.

### Inverse, special value

Example: `arcsin(1/2)` → π/6 (≈ 0.5236)

**Key Insights** (5)

1. An inverse trig function returns an ANGLE: arcsin(c) is the one angle in [−π/2, π/2] whose sine is c, the principal value.
2. Here: arcsin(1/2) asks for the angle in [−π/2, π/2] whose sine is 1/2: π/6.
3. arcsin and arccos only accept inputs in [−1, 1]; arctan accepts any real number.

   *— Show more —*
4. The principal ranges are chosen so each inverse is a function: arcsin and arctan return angles in quadrants I and IV, arccos in I and II.
5. sin(arcsin(c)) = c for every allowed c, but arcsin(sin(θ)) = θ only for θ in [−π/2, π/2]: arcsin(sin(3π/4)) = π/4.

**Common Mistakes** (3)

1. Reading arcsin(x) as 1/sin(x): that is csc(x), a different function.
2. Reporting an angle outside the principal range, or in the wrong unit.
3. Taking arcsin(sin(θ)) = θ for every θ: it holds only on the principal range.

### Inverse, not special

Example: `arcsin(0.3)` → ≈ 0.3047

**Key Insights** (5)

1. An inverse trig function returns an ANGLE: arcsin(c) is the one angle in [−π/2, π/2] whose sine is c, the principal value.
2. Here: arcsin(0.3) is not one of the special values, so the angle is ≈ 0.3047.
3. arcsin and arccos only accept inputs in [−1, 1]; arctan accepts any real number.

   *— Show more —*
4. The principal ranges are chosen so each inverse is a function: arcsin and arctan return angles in quadrants I and IV, arccos in I and II.
5. sin(arcsin(c)) = c for every allowed c, but arcsin(sin(θ)) = θ only for θ in [−π/2, π/2]: arcsin(sin(3π/4)) = π/4.

**Common Mistakes** (3)

1. Reading arcsin(x) as 1/sin(x): that is csc(x), a different function.
2. Reporting an angle outside the principal range, or in the wrong unit.
3. Taking arcsin(sin(θ)) = θ for every θ: it holds only on the principal range.

### Inverse out of range

Example: `arcsin(2)` → Undefined for real numbers — arcsin is only defined on [−1, 1]

**Key Insights** (2)

1. The inverse trig functions arcsin and arccos accept inputs from −1 to 1 only; arctan accepts any real number.
2. A calculator that reports a complex value here has left the real numbers — that is not the angle you were looking for.

**Common Mistakes** (1)

1. Asking for arcsin or arccos of a value outside [−1, 1] and reading the complex result as an angle.

### Degrees to radians

Example: `90°` → 90° = π/2 rad (≈ 1.5708)

**Key Insights** (2)

1. Degrees to radians: multiply by π/180. Radians to degrees: multiply by 180/π.
2. Common angles: 30° = π/6, 45° = π/4, 60° = π/3, 90° = π/2, 180° = π.

**Common Mistakes** (1)

1. Multiplying by 180/π when converting degrees to radians: that goes the other way.

### Identity: Pythagorean (proved, new)

Example: `sin(x)^2 + cos(x)^2` → 1

<details><summary>Working</summary>

- Simplify the trigonometric expression: sin(x)^2 + cos(x)^2
- Apply the Pythagorean identity: sin²(θ) + cos²(θ) = 1 for every angle θ.
- Check: writing both sides in sin(x) and cos(x) and substituting t = tan(x/2) turns them into the same rational function of t; at x = π + 2πn, where t is undefined, the two sides are compared directly. So the identity holds wherever both sides are defined.
- Result: 1.

</details>

**Key Insights** (6)

1. Pythagorean identity: sin²(x) + cos²(x) = 1, and its ÷cos² and ÷sin² forms, 1 + tan²(x) = sec²(x) and 1 + cot²(x) = csc²(x).
2. Here: sin(x)^2 + cos(x)^2 = 1 by the Pythagorean identity sin²(θ) + cos²(θ) = 1.
3. Rewriting tan, sec, csc and cot in terms of sin and cos often unlocks a simplification.

   *— Show more —*
4. An identity must hold for every angle where both sides are defined; checking a few values can only find a counterexample, never prove it. By hand, the usual proof is algebra: rewrite one side with the identities until it is the other.
5. Simplifying can change the domain: tan(x)·cos(x) = sin(x) only where cos(x) ≠ 0, so say where the result holds.
6. To prove one by hand, work on one side only, and keep going until it matches the other; never move terms across as in an equation.

**Common Mistakes** (4)

1. Cancelling across a sum: sin(x)/x is not sin — only common factors cancel.
2. Dropping the argument: sin² + cos² means nothing without the same angle inside both.
3. Writing sin(2x) = 2sin(x): the double-angle identity is 2·sin(x)·cos(x).

   *— Show more —*
4. Forgetting where the original is undefined after it simplifies.

### Identity: double angle (proved)

Example: `2sin(x)cos(x)` → sin(2x)

<details><summary>Working</summary>

- Simplify the trigonometric expression: 2sin(x)cos(x)
- Apply the double-angle identity sin(2θ) = 2·sin(θ)·cos(θ).
- Check: writing both sides in sin(x) and cos(x) and substituting t = tan(x/2) turns them into the same rational function of t; at x = π + 2πn, where t is undefined, the two sides are compared directly. So the identity holds wherever both sides are defined.
- Result: sin(2x).

</details>

**Key Insights** (6)

1. Double angle: sin(2x) = 2·sin(x)·cos(x) and cos(2x) = cos²(x) − sin²(x) = 1 − 2sin²(x) = 2cos²(x) − 1: read them both ways.
2. Here: 2sin(x)cos(x) = sin(2x) by the double-angle identity sin(2θ) = 2·sin(θ)·cos(θ).
3. Rewriting tan, sec, csc and cot in terms of sin and cos often unlocks a simplification.

   *— Show more —*
4. An identity must hold for every angle where both sides are defined; checking a few values can only find a counterexample, never prove it. By hand, the usual proof is algebra: rewrite one side with the identities until it is the other.
5. Simplifying can change the domain: tan(x)·cos(x) = sin(x) only where cos(x) ≠ 0, so say where the result holds.
6. To prove one by hand, work on one side only, and keep going until it matches the other; never move terms across as in an equation.

**Common Mistakes** (4)

1. Cancelling across a sum: sin(x)/x is not sin — only common factors cancel.
2. Dropping the argument: sin² + cos² means nothing without the same angle inside both.
3. Writing sin(2x) = 2sin(x): the double-angle identity is 2·sin(x)·cos(x).

   *— Show more —*
4. Forgetting where the original is undefined after it simplifies.

### Identity that loses a domain (new)

Example: `tan(x)*cos(x)` → sin(x) (for cos(x) ≠ 0)

<details><summary>Working</summary>

- Simplify the trigonometric expression: tan(x)*cos(x)
- Apply the trigonometric identities.
- Check: writing both sides in sin(x) and cos(x) and substituting t = tan(x/2) turns them into the same rational function of t; at x = π + 2πn, where t is undefined, the two sides are compared directly. So the identity holds wherever both sides are defined.
- The original is undefined where cos(x) = 0 and the result is not, so the equality holds for cos(x) ≠ 0: tan(x)*cos(x) = sin(x) there.
- Result: sin(x), for cos(x) ≠ 0.

</details>

**Key Insights** (6)

1. Rewriting tan, sec, csc and cot in terms of sin and cos often unlocks a simplification.
2. Here: written in sin and cos, tan(x)*cos(x) = sin(x), for cos(x) ≠ 0.
3. Pythagorean identity: sin²(x) + cos²(x) = 1, and its ÷cos² and ÷sin² forms, 1 + tan²(x) = sec²(x) and 1 + cot²(x) = csc²(x).

   *— Show more —*
4. An identity must hold for every angle where both sides are defined; checking a few values can only find a counterexample, never prove it. By hand, the usual proof is algebra: rewrite one side with the identities until it is the other.
5. Simplifying can change the domain: tan(x)·cos(x) = sin(x) only where cos(x) ≠ 0, so say where the result holds.
6. To prove one by hand, work on one side only, and keep going until it matches the other; never move terms across as in an equation.

**Common Mistakes** (4)

1. Cancelling across a sum: sin(x)/x is not sin — only common factors cancel.
2. Dropping the argument: sin² + cos² means nothing without the same angle inside both.
3. Writing sin(2x) = 2sin(x): the double-angle identity is 2·sin(x)·cos(x).

   *— Show more —*
4. Forgetting where the original is undefined after it simplifies.

### Identity: sec² − 1 (new)

Example: `sec(x)^2 - 1` → tan(x)^2

**Key Insights** (6)

1. Pythagorean identity: sin²(x) + cos²(x) = 1, and its ÷cos² and ÷sin² forms, 1 + tan²(x) = sec²(x) and 1 + cot²(x) = csc²(x).
2. Here: sec(x)^2 - 1 = tan(x)^2 by the Pythagorean identity sec²(θ) − 1 = tan²(θ).
3. Rewriting tan, sec, csc and cot in terms of sin and cos often unlocks a simplification.

   *— Show more —*
4. An identity must hold for every angle where both sides are defined; checking a few values can only find a counterexample, never prove it. By hand, the usual proof is algebra: rewrite one side with the identities until it is the other.
5. Simplifying can change the domain: tan(x)·cos(x) = sin(x) only where cos(x) ≠ 0, so say where the result holds.
6. To prove one by hand, work on one side only, and keep going until it matches the other; never move terms across as in an equation.

**Common Mistakes** (4)

1. Cancelling across a sum: sin(x)/x is not sin — only common factors cancel.
2. Dropping the argument: sin² + cos² means nothing without the same angle inside both.
3. Writing sin(2x) = 2sin(x): the double-angle identity is 2·sin(x)·cos(x).

   *— Show more —*
4. Forgetting where the original is undefined after it simplifies.

### Equation, two solutions per period

Example: `sin(x) = 1/2` → x = π/6 + 2πn  or  x = 5π/6 + 2πn (n ∈ ℤ);  on [0, 2π): π/6, 5π/6

<details><summary>Working</summary>

- Solve the equation: sin(x) = 1/2
- Take the inverse sine: the principal value is arcsin(1/2) = π/6.
- Sine takes each value twice per period (quadrants I and II for positive values, III and IV for negative), so within one period: x = π/6 and x = π − (π/6) = 5π/6.
- General solution (n any integer): x = π/6 + 2πn  or  x = 5π/6 + 2πn
- On [0, 2π): x = π/6,  x = 5π/6
- Check: substituting each value back into sin(x) = 1/2 balances both sides.

</details>

**Key Insights** (4)

1. Remember both quadrants where sin takes the value 1/2 — a calculator's inverse function only returns one of them.
2. Here: arcsin(1/2) = π/6, and the second solution in the period is π − π/6 = 5π/6: x = π/6 + 2πn  or  x = 5π/6 + 2πn.
3. A trig equation has infinitely many solutions because the functions repeat — the general solution captures all of them; the [0, 2π) list is one period's worth.

   *— Show more —*
4. Check each solution in the original equation: a slip in the quadrant shows up at once.

**Common Mistakes** (2)

1. Reporting only the calculator's principal value (arcsin(1/2) = π/6) and missing the second solution in the period.
2. Giving the solutions in one period only, without the "+ 2πn" that lists every period.

### Equation, not a special value (exact names, new)

Example: `sin(x) = 0.3` → x = arcsin(3/10) + 2πn  or  x = π − arcsin(3/10) + 2πn (n ∈ ℤ);  on [0, 2π): x ≈ 0.3047, 2.8369

<details><summary>Working</summary>

- Solve the equation: sin(x) = 0.3
- Take the inverse sine: the principal value is arcsin(3/10) ≈ 0.3047 rad.
- Sine takes each value twice per period (quadrants I and II for positive values, III and IV for negative), so within one period: x ≈ 0.3047 and x = π − arcsin(3/10) ≈ 2.8369.
- General solution (n any integer): x = arcsin(3/10) + 2πn  or  x = π − arcsin(3/10) + 2πn
- On [0, 2π): x ≈ 0.3047,  x ≈ 2.8369
- Check: substituting each value back into sin(x) = 0.3 balances both sides.

</details>

**Key Insights** (4)

1. Remember both quadrants where sin takes the value 0.3 — a calculator's inverse function only returns one of them.
2. Here: arcsin(3/10) ≈ 0.3047, and the second solution in the period is π − 0.3047 ≈ 2.8369: x = arcsin(3/10) + 2πn  or  x = π − arcsin(3/10) + 2πn.
3. A trig equation has infinitely many solutions because the functions repeat — the general solution captures all of them; the [0, 2π) list is one period's worth.

   *— Show more —*
4. Check each solution in the original equation: a slip in the quadrant shows up at once.

**Common Mistakes** (2)

1. Reporting only the calculator's principal value (arcsin(3/10) ≈ 0.3047) and missing the second solution in the period.
2. Giving the solutions in one period only, without the "+ 2πn" that lists every period.

### Equation, once per period (fixed step)

Example: `cos(x) = 1` → x = 2πn (n ∈ ℤ);  on [0, 2π): 0

<details><summary>Working</summary>

- Solve the equation: cos(x) = 1
- Take the inverse cosine: the principal value is arccos(1) = 0.
- Cosine reaches 1 only once per period, at the top of the wave: x = 0.
- General solution (n any integer): x = 2πn
- On [0, 2π): x = 0
- Check: substituting each value back into cos(x) = 1 balances both sides.

</details>

**Key Insights** (4)

1. cos reaches 1 only once in each period, at the top of the wave (x = 0), so there is one family of solutions, not two.
2. Here: the value is reached only at the top of each wave, at 0, so x = 2πn.
3. A trig equation has infinitely many solutions because the functions repeat — the general solution captures all of them; the [0, 2π) list is one period's worth.

   *— Show more —*
4. sin = 0 and cos = 0 happen twice per period, half a period apart, so they too are one family, stepping by π.

**Common Mistakes** (2)

1. Adding a second solution: −0 is the same angle, and cos takes the value 1 nowhere else in the period.
2. Giving the solutions in one period only, without the "+ 2πn" that lists every period.

### Equation, tan with kx (simplified family, new)

Example: `tan(2x) = 1` → x = π/8 + (π/2)n (n ∈ ℤ);  on [0, 2π): π/8, 5π/8, 9π/8, 13π/8

<details><summary>Working</summary>

- Solve the equation: tan(2x) = 1
- Take the inverse tangent: the principal value is arctan(1) = π/4.
- Tangent repeats every π (not 2π), so one solution per period suffices.
- Let θ = 2x. General solution for θ (n any integer): θ = π/4 + πn
- Divide by 2 to get x: x = π/8 + (π/2)n
- On [0, 2π): x = π/8,  x = 5π/8,  x = 9π/8,  x = 13π/8
- Check: substituting each value back into tan(2x) = 1 balances both sides.

</details>

**Key Insights** (5)

1. tan has period π, so its general solution steps by πn rather than 2πn.
2. Here: arctan(1) = π/4, and tan repeats every π: x = π/8 + (π/2)n.
3. A trig equation has infinitely many solutions because the functions repeat — the general solution captures all of them; the [0, 2π) list is one period's worth.

   *— Show more —*
4. tan takes every real value, so tan(θ) = c always has solutions; it is undefined where cos(θ) = 0.
5. For tan(x) = c there are two solutions in [0, 2π), arctan(c) and arctan(c) + π; for a nonzero integer k, tan(kx) = c has 2|k|. For other k, count the members of the general family that fall in the interval.

**Common Mistakes** (3)

1. Reporting only the calculator's value arctan(1) = π/4 and missing π/4 + π, which is also in [0, 2π).
2. Forgetting to divide by 2: the families found are for 2x, and x is each of them divided by 2 — 2 times as many solutions in [0, 2π).
3. Stepping by 2π: half of the solutions are lost.

### Equation, a reciprocal

Example: `sec(x) = 2` → x = π/3 + 2πn  or  x = 5π/3 + 2πn (n ∈ ℤ);  on [0, 2π): π/3, 5π/3

**Key Insights** (7)

1. A reciprocal turns into a basic equation when c ≠ 0: sec(θ) = c is cos(θ) = 1/c, csc(θ) = c is sin(θ) = 1/c, cot(θ) = c is tan(θ) = 1/c.
2. Here: the equation is cos(x) = 1/2, solved as usual: x = π/3 + 2πn  or  x = 5π/3 + 2πn.
3. Remember both quadrants where cos takes the value 1/2 — a calculator's inverse function only returns one of them.

   *— Show more —*
4. A trig equation has infinitely many solutions because the functions repeat — the general solution captures all of them; the [0, 2π) list is one period's worth.
5. For c = 0: cot(θ) = cos(θ)/sin(θ) = 0 exactly where cos(θ) = 0, so θ = π/2 + πn; sec(θ) = 0 and csc(θ) = 0 have no solution.
6. sec and csc are never strictly between −1 and 1: sec(θ) = 1/2 has no solution.
7. Then solve the basic equation as usual: both solutions per period, and the general solution.

**Common Mistakes** (4)

1. Reporting only the calculator's principal value (arccos(1/2) = π/3) and missing the second solution in the period.
2. Giving the solutions in one period only, without the "+ 2πn" that lists every period.
3. Inverting the wrong function: sec is 1/cos, csc is 1/sin.

   *— Show more —*
4. Writing sec(θ) = 2 as cos(θ) = 2: the value is inverted too.

### Equation, quadratic in sin

Example: `2sin(x)^2 - sin(x) - 1 = 0` → x = π/2 + 2πn  or  x = 7π/6 + 2πn  or  x = 11π/6 + 2πn (n ∈ ℤ);  on [0, 2π): π/2, 7π/6, 11π/6

<details><summary>Working</summary>

- Solve the equation: 2sin(x)^2 - sin(x) - 1 = 0
- The equation is quadratic in sin(x). Let u = sin(x): 2u² − u − 1 = 0.
- Solve the quadratic (factor or use the quadratic formula): u = -1/2  or  u = 1.
- Case sin(x) = -1/2:
-   Take the inverse sine: the principal value is arcsin(-1/2) = -π/6.
-   The principal value -π/6 lies outside [0, 2π). Sine takes each value twice per period, so the two solutions on [0, 2π) are x = π − (-π/6) = 7π/6 and x = 2π + (-π/6) = 11π/6.
-   General solution (n any integer): x = 7π/6 + 2πn  or  x = 11π/6 + 2πn
-   On [0, 2π): x = 7π/6,  x = 11π/6
-   Check: substituting each value back into sin(x) = -1/2 balances both sides.
- Case sin(x) = 1:
-   Take the inverse sine: the principal value is arcsin(1) = π/2.
-   Sine reaches 1 only once per period, at the top of the wave: x = π/2.
-   General solution (n any integer): x = π/2 + 2πn
-   On [0, 2π): x = π/2
-   Check: substituting each value back into sin(x) = 1 balances both sides.
- Combine the cases. On [0, 2π): x = π/2,  x = 7π/6,  x = 11π/6

</details>

**Key Insights** (5)

1. A quadratic in sin is solved like any quadratic — substitute u = sin(x), solve for u, then solve each sin(x) = value separately.
2. Here: with u = sin(x), 2u² − u − 1 = 0 gives u = -1/2  or  u = 1; each value is solved for the angle.
3. Discard any u outside [−1, 1] for sine and cosine before looking for angles.

   *— Show more —*
4. sin²(x) = 1 − cos²(x) turns a mix of sin² and cos into a quadratic in cos alone.
5. Factor when you can: 2u² − u − 1 = (2u + 1)(u − 1).

**Common Mistakes** (3)

1. Dividing both sides by sin(x) and losing the sin(x) = 0 solutions.
2. Solving for u and reporting u as the answer — the angle still has to be found.
3. Keeping a value such as u = 2: sin(x) = 2 has no solution.

### Equation, a·sin + b·cos

Example: `sin(x) + cos(x) = 1` → x = 2πn  or  x = π/2 + 2πn (n ∈ ℤ);  on [0, 2π): 0, π/2

<details><summary>Working</summary>

- Solve the equation: sin(x) + cos(x) = 1
- Sine and cosine both appear to the first power with a nonzero constant: sin(x) + cos(x) = 1.
- Combine them into one sine: a·sin θ + b·cos θ = R·sin(θ + φ) with R = √(a² + b²) = √2 and φ the angle with cos φ = a/R and sin φ = b/R: φ = arctan(b/a) = π/4.
- So sin(x + π/4) = 1/√2 = √2/2. Let θ = x + π/4.
- Solve for θ: θ = π/4 + 2πn  or  θ = 3π/4 + 2πn (n ∈ ℤ);  on [0, 2π): π/4, 3π/4
- Then x = θ − π/4: x = 2πn  or  x = π/2 + 2πn
- On [0, 2π): x = 0,  x = π/2
- Check: substituting each value back into sin(x) + cos(x) = 1 balances both sides.

</details>

**Key Insights** (3)

1. a·sin θ + b·cos θ is a single sine wave of amplitude R = √(a² + b²), shifted by φ — combining them turns the equation into the basic form.
2. Here: R = √2 and φ = π/4, so sin(x + π/4) = 1/√2 = √2/2.
3. If |c| > R the equation has no solution: the combined wave never reaches c.

**Common Mistakes** (3)

1. Squaring both sides to remove the mixed terms — that introduces extraneous solutions.
2. Forgetting to subtract φ after solving for θ.
3. Taking φ = arctan(b/a) when a < 0: for −sin θ + cos θ it gives −π/4, but φ = 3π/4.

### Equation, a·sin + b·cos with a < 0 (φ in quadrant II)

Example: `-sin(x) + cos(x) = 1` → x = 2πn  or  x = 3π/2 + 2πn (n ∈ ℤ);  on [0, 2π): 0, 3π/2

<details><summary>Working</summary>

- Solve the equation: -sin(x) + cos(x) = 1
- Sine and cosine both appear to the first power with a nonzero constant: −sin(x) + cos(x) = 1.
- Combine them into one sine: a·sin θ + b·cos θ = R·sin(θ + φ) with R = √(a² + b²) = √2 and φ the angle with cos φ = a/R and sin φ = b/R: φ = 3π/4 (in quadrant II, since a < 0).
- So sin(x + 3π/4) = 1/√2 = √2/2. Let θ = x + 3π/4.
- Solve for θ: θ = π/4 + 2πn  or  θ = 3π/4 + 2πn (n ∈ ℤ);  on [0, 2π): π/4, 3π/4
- Then x = θ − 3π/4: x = 2πn  or  x = 3π/2 + 2πn
- On [0, 2π): x = 0,  x = 3π/2
- Check: substituting each value back into -sin(x) + cos(x) = 1 balances both sides.

</details>

**Key Insights** (3)

1. a·sin θ + b·cos θ is a single sine wave of amplitude R = √(a² + b²), shifted by φ — combining them turns the equation into the basic form.
2. Here: R = √2 and φ = 3π/4, so sin(x + 3π/4) = 1/√2 = √2/2.
3. If |c| > R the equation has no solution: the combined wave never reaches c.

**Common Mistakes** (3)

1. Squaring both sides to remove the mixed terms — that introduces extraneous solutions.
2. Forgetting to subtract φ after solving for θ.
3. Taking φ = arctan(b/a) when a < 0: for −sin θ + cos θ it gives −π/4, but φ = 3π/4.

### Equation, cot = 0 (fixed)

Example: `cot(x) = 0` → x = π/2 + πn (n ∈ ℤ);  on [0, 2π): π/2, 3π/2

<details><summary>Working</summary>

- Solve the equation: cot(x) = 0
- Isolate: cot(x) = 0. Since cot(θ) = cos(θ)/sin(θ), it is 0 exactly where cos(θ) = 0 (and sin(θ) = ±1 ≠ 0 there): cos(x) = 0.
- Take the inverse cosine: the principal value is arccos(0) = π/2.
- Cosine is even (cos(−θ) = cos θ), so x = π/2 and x = −π/2 both work. Within one period [0, 2π), −π/2 is the same angle as 2π − π/2 = 3π/2.
- General solution (n any integer): x = π/2 + πn
- On [0, 2π): x = π/2,  x = 3π/2
- Check: substituting each value back into cos(x) = 0 balances both sides.

</details>

**Key Insights** (6)

1. A reciprocal turns into a basic equation when c ≠ 0: sec(θ) = c is cos(θ) = 1/c, csc(θ) = c is sin(θ) = 1/c, cot(θ) = c is tan(θ) = 1/c.
2. cos is 0 where its graph crosses the axis — twice in each period, half a period apart — so the solutions are one family stepping by π.
3. A trig equation has infinitely many solutions because the functions repeat — the general solution captures all of them; the [0, 2π) list is one period's worth.

   *— Show more —*
4. For c = 0: cot(θ) = cos(θ)/sin(θ) = 0 exactly where cos(θ) = 0, so θ = π/2 + πn; sec(θ) = 0 and csc(θ) = 0 have no solution.
5. sec and csc are never strictly between −1 and 1: sec(θ) = 1/2 has no solution.
6. Then solve the basic equation as usual: both solutions per period, and the general solution.

**Common Mistakes** (4)

1. Listing x = π/2 alone and missing the second crossing, x = 3π/2.
2. Giving the solutions in one period only, without the "+ 2πn" that lists every period.
3. Inverting the wrong function: sec is 1/cos, csc is 1/sin.

   *— Show more —*
4. Writing sec(θ) = 2 as cos(θ) = 2: the value is inverted too.

### Equation, a product

Example: `sin(x)cos(x) = 1/4` → x = π/12 + πn  or  x = 5π/12 + πn (n ∈ ℤ);  on [0, 2π): π/12, 5π/12, 13π/12, 17π/12

**Key Insights** (5)

1. A trig equation has infinitely many solutions because the functions repeat — the general solution captures all of them; the [0, 2π) list is one period's worth.
2. Here: the product is ½·sin(2x), so sin(2x) = 1/2.
3. Remember both quadrants where sin takes the value 1/2 — a calculator's inverse function only returns one of them.

   *— Show more —*
4. Solve sin(2x) = 2c for 2x, then divide by 2: there are four solutions in [0, 2π) when |2c| < 1.
5. sin(x)·cos(x) = c has no solution when |c| > 1/2.

**Common Mistakes** (4)

1. Reporting only the calculator's principal value (arcsin(1/2) = π/6) and missing the second solution in the period.
2. Forgetting to divide by 2: the families found are for 2x, and x is each of them divided by 2 — 2 times as many solutions in [0, 2π).
3. Dividing by cos(x) to get tan: the solutions where cos(x) = 0 are lost, and the equation is not in tan alone.

   *— Show more —*
4. Forgetting the ½: sin(x)·cos(x) is ½·sin(2x), not sin(2x).

### Equation, equal functions

Example: `sin(x) = sin(2x)` → x = 2πn  or  x = π/3 + (2π/3)n (n ∈ ℤ);  on [0, 2π): 0, π/3, π, 5π/3

<details><summary>Working</summary>

- Solve the equation: sin(x) = sin(2x)
- Two sines are equal when their angles are equal, or supplementary, up to full turns: x = 2x + 2πn  or  x = π − (2x) + 2πn.
- Solve each branch for x: x = 2πn  or  x = π/3 + (2π/3)n
- On [0, 2π): x = 0,  x = π/3,  x = π,  x = 5π/3
- Check: substituting each value back into sin(x) = sin(2x) balances both sides.

</details>

**Key Insights** (4)

1. sin A = sin B has TWO branches (equal or supplementary angles); cos A = cos B has A = ±B; tan A = tan B has one branch with period π.
2. Here: the two branches are x = 2x + 2πn  or  x = π − (2x) + 2πn.
3. Cofunctions convert: cos B = sin(π/2 − B).

   *— Show more —*
4. Solve each branch for x separately, then list every solution in [0, 2π).

**Common Mistakes** (2)

1. Cancelling the function on both sides as if it were a factor — sin A = sin B does not mean A = B only.
2. Forgetting the second branch.

### Equation, no solution

Example: `sin(x) = 2` → No real solution (sin(θ) is never outside [−1, 1])

**Key Insights** (3)

1. sin and cos stay between −1 and 1: an equation that needs a value outside that range has no real solution.
2. Check the equation for a sign or coefficient slip; values beyond ±1 usually mean the trig term wasn't isolated correctly.
3. tan and cot take every real value; sec and csc never lie strictly between −1 and 1.

**Common Mistakes** (1)

1. Applying arcsin/arccos to a number outside [−1, 1] and reading the calculator error as a value.

### Equation, solved numerically

Example: `sin(x) = x/2` → x ≈ -1.8955  or  x = 0  or  x ≈ 1.8955

**Key Insights** (4)

1. Equations that mix trig terms with different arguments or with x itself usually have no closed form: numeric solutions are the honest answer, shown with ≈.
2. ≈ means the root is known to the decimals shown, not exactly; substitute it back and the two sides agree to those decimals.
3. Sketch both sides: each crossing is a solution, and the picture says how many to expect.

   *— Show more —*
4. Each root was located by scanning and then checked by substitution; there can be more outside the range searched.

**Common Mistakes** (3)

1. Treating a located root as exact — its next digits are not zeros.
2. Stopping at one root when the graphs cross more than once.
3. Expecting an exact answer for every trig equation: most mixed ones have none.

