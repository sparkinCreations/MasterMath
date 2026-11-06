# Plan: Practice Mode ("Try a similar one")

**Written:** November 6, 2026
**For:** MJ (agreed in conversation: a pop-up, a set of five that rotates)
**Roadmap item:** P4, carried over from [`ROADMAP.md`](ROADMAP.md#p4--practice-mode-try-a-similar-problem) and [`ROADMAP-2026-10.md`](ROADMAP-2026-10.md)
**First release:** 1.70.0

## What the student gets

Under a solved problem's final answer, a **Try a similar one** button opens a
pop-up (full-screen on a phone) with a practice problem of the same kind:
same topic, same method, new numbers. The student works it on paper, types
the answer (the keypad works here too) and taps **Check**.

| Control | Does |
|---|---|
| **Check** | "Correct ✓", or "Not quite" with what their answer does wrong (see *Checking*) |
| **Hint** | Reveals the solution one step at a time, as step-through does |
| **Show solution** | Every step and the answer |
| **Another one** | The next problem of the set; after the last, back to the first, saying so |
| **Look at the example** | The worked problem the student started from, folded open inside the pop-up |

The set is **up to five problems**, made and checked before they are shown.
"Another one" walks through them and rotates: "That's all 5, back to the
first." A problem answered correctly is marked ✓ in the set, so the student
can see how far they have come. A problem with fewer good variations has a
smaller set; one with none says so on the button's place ("No similar
problems for this one") rather than offering one the app cannot check.

**The same set for every student.** The variations are drawn from a
generator seeded by the problem itself, so everyone who solves
`x^2 - 5x + 6 = 0` gets the same five, in the same order (like the tips:
every student gets the same advice), and a teacher can set them.

## Not AI, and never unchecked

Every practice problem is made by changing the numbers of the solved one and
solving the result with the same engine; it is shown only if it passes:

1. **It solved** (status `solved`), within the 10-second budget.
2. **The same method.** The first Key Insight is specific to the method, and
   `tests/tipsByMethod.test.js` already guarantees no two methods share it,
   so it is the method's fingerprint. A factorable quadratic must not become
   one that needs the formula; by parts must not become a substitution.
3. **An answer as clean as the original's.** Every feature of the new
   answer (a fraction, a root, π, a logarithm, e, a decimal ≈) must appear
   in the original's: whole-number answers stay whole numbers. The same
   number of solutions; numbers no larger than about ten times the
   original's; about the same number of steps.
4. **A checkable answer.** The correct answer is read into a form the
   checker can use (a number, a list of numbers, an expression), and that
   reading is itself verified (solutions substituted back, a derivative
   compared with the engine's) before the problem is kept.
5. **New:** not the original, not already in the set.

### How the numbers change

- **Literal remap.** Each whole number in the typed problem maps to a new
  one, the same number to the same new one everywhere (so `x->1` and
  `(x - 1)` stay together). Exponents never change (x² stays x²: a new
  exponent is a new method); 0 never changes (it is usually structural:
  `x -> 0`, `= 0`, a lower bound of 0).
- **Root rebuild**, where literal remap rarely keeps the method:
  - a polynomial equation `P(x) = 0` whose roots are all rational: new roots
    (each root's size remapped, its sign kept), the same leading
    coefficient, written out in standard form, so a factorable quadratic
    stays factorable;
  - a limit of a ratio of polynomials at a common root (the removable hole):
    the point and every root remapped together, numerator and denominator
    rebuilt, so the hole stays a hole.

Candidates are tried one at a time in the solver worker, each under the
usual 10-second budget, until five pass or 40 have been tried. The first
one opens the pop-up; the rest are made while the student works on it.

## Checking an answer

The student's text goes through the app's own reader (`parseMathExpression`:
2x, x², √, ln|x|, π all work) and is compared by mathematics, never by text.

| Kind | Problems | Correct when | "Not quite" says |
|---|---|---|---|
| Number | arithmetic; a limit; a definite integral; a derivative at a point | the same value; a decimal is accepted when it is the answer rounded to the places typed (at least two) | "Close: right to 1 decimal place" when it is, else to check the working |
| Solutions | one equation in one unknown | the same set, any order, as `2, 3`, `x = 3 or x = 2`, `3/2`, `(1 + √5)/2` | which of theirs does not satisfy the equation (left and right sides at that value), or how many are missing |
| Derivative | f′(x), any order | equal to the engine's at sample points | the two values at one point |
| Antiderivative | an indefinite integral | differs from the engine's by a constant (any +C, or none) | the derivative of theirs against the integrand at one point |

Not in the first release, because a "correct" answer cannot be told from
the problem itself: **factor, simplify and expand** (the input itself is
equal to the answer), and the topics whose answers are not one value or one
expression: **functions, trig equations, inequalities, systems** (interval
notation, general solutions in n, ordered pairs). These come later.

## Where the code goes

| Piece | Where | Note |
|---|---|---|
| Kinds, reading the correct answer, checking | `src/lib/practice/check.js` | worker side (mathjs); pure, unit-tested |
| Variations, fingerprint, the pool | `src/lib/practice/generate.js` | worker side; seeded, deterministic |
| Worker messages | `solver.worker.js`, `budgetedSolver.js` | a `task` field: `practice-candidate`, `practice-check`; no task is a solve, as before |
| The pop-up | `src/components/solver/PracticeDialog.jsx` | focus, Escape and Tab trap as `NotationGuide`; full-screen under `sm`; the keypad (`MathKeypad`) |
| The button | `SolutionDisplay.jsx`, under the final answer | only for a solved result of a supported kind |

The page imports nothing from the solver: every candidate and every check is
a worker request (`tests/buildPreload.test.js` keeps mathjs off the page).

## Tests

- `tests/practice.test.js`: for each first-release family (the example
  buttons and the October test list's cases of those kinds), the set is
  the same on every run, each problem solves with the original's method and
  answer shape, and its own correct answer is accepted by the checker;
  wrong answers of each kind are refused with the right message; decimals,
  +C, order and notation variants are accepted.
- `e2e/smoke.spec.js`: solve, open practice, answer correctly, see
  "Correct ✓"; a wrong answer; Hint; Another one; rotation; Escape closes and
  focus returns to the button.
- `e2e/a11y.spec.js`: the pop-up open, light and dark, and the
  double-announcement check.

## Later

- Functions, trigonometry, inequalities and systems, with answer readers for
  their forms.
- "Practised" on My Progress (attempts stored with the history).
