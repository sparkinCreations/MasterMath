# MasterMath — Mathematical State Semantics Architecture

**Version referenced:** 1.12.0
**By:** sparkinCreations™
**Last Updated:** July 21, 2026
**Fixes findings from:** [`mastermath-black-box-review.md`](../evaluations/2026-07/mastermath-black-box-review.md) and [`PRODUCTION-AUDIT-v1.12.md`](../evaluations/2026-07/PRODUCTION-AUDIT-v1.12.md)

---

## Table of Contents

1. [The Problem in One Sentence](#the-problem-in-one-sentence)
2. [Design Principles](#design-principles)
3. [Component 1 — The Solution Envelope (status semantics)](#component-1--the-solution-envelope-status-semantics)
4. [Component 2 — Input Validation & Normalization Layer](#component-2--input-validation--normalization-layer)
5. [Component 3 — Numeric Semantics Guard](#component-3--numeric-semantics-guard)
6. [Component 4 — Interpretation Transparency](#component-4--interpretation-transparency)
7. [Component 5 — Domain & Continuity Analysis](#component-5--domain--continuity-analysis)
8. [Component 6 — Evidence-Scoped Claims](#component-6--evidence-scoped-claims)
9. [Component 7 — Unsupported ≠ Malformed](#component-7--unsupported--malformed)
10. [Traceability Matrix](#traceability-matrix)
11. [Implementation Phases](#implementation-phases)
12. [Test Plan](#test-plan)
13. [Explicitly Out of Scope](#explicitly-out-of-scope)

---

## The Problem in One Sentence

Every solver returns the same shape whether it succeeded or failed — `answer:
"Unable to evaluate"` is indistinguishable from `answer: "42"` — so the
pipeline (`api.js` → `Solver.jsx` → toast → history → exports) treats every
resolution as success, and every downstream symptom in the July 2026 reviews
follows from that.

The black-box review's bottom line said it directly: *"prioritize mathematical
state semantics over adding more problem types."* This document is that
design. The fixes are architectural — new shared layers with single
responsibilities — not per-symptom patches inside individual solvers.

Current failure chain, concretely:

1. `solveArithmetic('(2+3')` throws inside, catches, and returns
   `{answer: 'Unable to evaluate', tips: [syntax tips]}` — a **normal-looking
   result object**.
2. `finalizeResult()` in `api.js` checks only that `answer` is truthy —
   "Unable to evaluate" passes.
3. `Solver.jsx` `handleSolve()` reaches the happy path: saves to history with
   `feedback: "Solved successfully"` and fires
   `toast.success("Problem solved successfully!")`.
4. The catch-all in `solveProblem()` does the same thing one level up: any
   thrown error becomes a fallback object with generic syntax tips, which then
   *also* rides the happy path.

No single solver can fix this. The contract has to change.

---

## Design Principles

1. **Status is data, not prose.** Whether a solve succeeded must be a typed
   field the UI can branch on — never inferred from answer text.
2. **One chokepoint per concern.** Input validity, numeric validity, domain
   validity, and claim scope each get exactly one shared module. Solvers call
   them; they never reimplement them.
3. **Echo the interpretation.** Whenever the app normalizes, guesses, or
   reinterprets input (implicit multiplication, degree auto-detection,
   `**`→`^`), the result must carry what was understood, and the UI must show
   it. Silent reinterpretation is treated as a bug class, not a convenience.
4. **Generated text may not contradict interpreted facts.** Tips, mistakes,
   and step text are assembled *after* interpretation is fixed, and canned
   text that conflicts with the interpretation is suppressed. (This is the
   actual `sin(30)` bug — the answer was fine; the canned "radians by
   default" tip contradicted the auto-degrees interpretation.)
5. **Never claim more than the evidence supports.** A conclusion reached by
   sampling a window must say so, or be upgraded to a symbolic argument.
6. **Additive and backward compatible.** The envelope extends the existing
   solution object; stored IndexedDB history and exports keep working. Legacy
   results without a `status` render as they do today.

---

## Component 1 — The Solution Envelope (status semantics)

**New file:** `src/lib/solutionEnvelope.js`
**Touches:** `api.js`, `Solver.jsx`, `SolutionDisplay.jsx`, `exportUtils.js`, all solvers

### The contract

Every solver result gains three fields:

```javascript
{
  // NEW — required. The machine-readable outcome.
  status: 'solved'        // computed and verified — the ONLY green state
        | 'parse_error'   // input could not be read as math
        | 'unsupported'   // valid math, beyond the engine (non-elementary integral)
        | 'undefined'     // valid math, no defined value (1/0, tan(π/2) as a value)
        | 'indeterminate' // 0/0, ∞−∞, 0^0 — forms needing context, not values
        | 'overflow',     // valid math, exceeds double-precision range

  // NEW — optional. What the app understood the input to be. Rendered as an
  // "Interpreted as:" line whenever any entry differs from the raw input.
  interpretation: {
    normalized: '2*x + 1',        // post-normalization expression
    angleUnit: 'degrees (auto)',  // trig only: 'radians' | 'degrees' | 'degrees (auto)'
    variable: 'x',                // when inferred
    notes: ['** was read as ^'],  // every silent rewrite, made loud
  },

  // NEW — optional. Qualifications that don't change the answer but bound it.
  warnings: ['Valid on intervals not containing x = ±1'],

  // Existing fields, unchanged:
  steps, answer, tips, common_mistakes, graph
}
```

`solutionEnvelope.js` exports constructors so solvers can't hand-roll
malformed results:

```javascript
solved({steps, answer, ...})           // status: 'solved'
parseError({input, hint, position})    // builds steps/tips FROM the specific hint
unsupported({input, reason, seeAlso})  // "valid but beyond the engine"
undefinedValue({input, reason})
indeterminate({input, form, note})     // form: '0/0' | '∞−∞' | '0^0' | 'NaN'
overflow({input, magnitude})
```

The failure constructors generate *specific* steps and tips from their
arguments — `parseError` for `(2+3` says "unmatched opening parenthesis at
position 1," not five generic syntax tips. The generic-tip fallback dies with
this change.

### Enforcement — `finalizeResult()` becomes the contract gate

`finalizeResult()` in `api.js` currently checks that `answer` is truthy. It
becomes:

- `status` present and one of the six values → pass through.
- `status` missing (legacy solver during migration) → infer `parse_error` if
  `answer` matches the known fallback strings (`/^unable to/i`), else
  `solved`, and log a console warning so stragglers get found. This shim is
  deleted at the end of Phase 1.
- The `solveProblem()` catch-all returns `parseError(...)` /
  `unsupported(...)` instead of the current hand-built fallback object.

### UI consequences

`Solver.jsx handleSolve()`:

```javascript
if (result.status === 'solved') toast.success('Problem solved!');
else if (result.status === 'parse_error') toast.error("Couldn't read that input");
else toast.info(statusLabel(result.status));   // amber, not green, not red
```

- **History honesty:** `feedback` field is set from `status`, not hardcoded
  to `"Solved successfully"`. Parse errors are *not* saved to problem history
  at all (a typo is not a solved problem; it pollutes Progress stats).
- **`SolutionDisplay`:** answer card color derives from status — green only
  for `solved`; amber for `unsupported`/`indeterminate`/`undefined`/
  `overflow`; red-bordered for `parse_error`. The status is also rendered as
  a text badge so color is not the only channel (accessibility), and the
  toast/aria-live announcement matches it.
- **Exports** (`exportUtils.js`): non-solved results export with their status
  label so a PDF of a failed solve doesn't read as an answer.

---

## Component 2 — Input Validation & Normalization Layer

**New file:** `src/lib/inputValidator.js`
**Touches:** `api.js` (runs before routing), `mathParser.js`

A single pre-parse pass over the raw input, run in `solveProblem()` before
any solver is chosen. Two jobs:

### 2a. Structural validation (reject early, reject specifically)

| Check | Example | Result |
|---|---|---|
| Balanced parentheses | `(2+3` | `parse_error`, "unmatched opening parenthesis" |
| Illegal operator runs | `x^^2`, `2++/3` | `parse_error`, "`^^` is not an operator — use `^`" |
| Dangling operator | `2/` | `parse_error`, "expression ends with an operator" |
| Empty function call | `sin()` | `parse_error`, "sin() needs an argument" |
| Unknown symbols | `abc` | `parse_error`, "unknown symbol 'abc'" (checked against `MATH_FUNCTIONS`/constants/single-letter variables) |
| Adjacent numbers | `2 2` | `parse_error`, "two numbers with no operator between them — did you mean 2*2 or 22?" |
| Literal non-values | `NaN`, `Infinity - Infinity` typed directly | routed to Component 3's classifier, never evaluated as ordinary input |

The `2 2` rule deserves emphasis: today `parseMathExpression()` strips all
whitespace, silently turning `2 2` into `22`. Whitespace between two numeric
literals becomes a *validation error before* whitespace stripping, because no
student who typed `2 2` meant twenty-two.

### 2b. Normalization with receipts

All rewrites move behind one function that **records what it did**:

```javascript
const { expression, notes } = normalize(raw);
// notes: ['** rewritten as ^', '2x read as 2*x', '|x| read as abs(x)']
```

- `**` → `^` joins the existing rewrites (this alone fixes the `2**x=4` →
  "No real solution" bug — the parser failure that became false mathematics).
- The `notes` array flows into `interpretation.notes` on every result, so
  every rewrite the app performs is visible in the solution.

`mathParser.js` keeps its current exports (they're used by tests and
solvers); `normalize()` wraps `parseMathExpression()` and adds the receipt
layer. Existing callers migrate to `normalize()` in Phase 2.

---

## Component 3 — Numeric Semantics Guard

**New file:** `src/lib/numericSemantics.js`
**Touches:** `arithmeticSolver.js`, trig evaluation in `otherSolvers.js`, `solverUtils.formatNumber` callers

One function, `classifyNumericResult(value, expression)`, called at every
point where a raw `math.evaluate()` value is about to become an answer.
Today that value is formatted and displayed no matter what it is — `NaN`,
`Infinity`, or `1` for `0^0` — with a green toast.

| Engine value | Cause analysis | Classification |
|---|---|---|
| `Infinity` / `-Infinity` | denominator evaluates to 0 → division by zero | `undefined` — "1/0 is undefined; infinity describes the *limit* of 1/x as x→0⁺, not a quotient" |
| `Infinity` / `-Infinity` | operands near `1e308`, no zero denominator | `overflow` — "exceeds double-precision range (~1.8×10³⁰⁸)"; fixes `1e308*10` being blamed on syntax |
| `NaN` | expression contains `∞−∞`, `0*∞`, `0/0` | `indeterminate`, naming the form |
| `NaN` | otherwise | `undefined`, "not a real number" (e.g. `sqrt(-1)` in real mode — though mathjs returns `i`, other paths can produce NaN) |
| `1` for `0^0` | literal `0^0` detected in normalized expression | `solved`, answer `1`, **with a required warning**: "0⁰ = 1 by convention (combinatorics, programming); in analysis it is an indeterminate form" |

The cause analysis is deliberately shallow — a regex/AST check on the
normalized expression, not a CAS pass. When the cause can't be determined,
the classification is still honest (`undefined`, "the result is not a finite
real number") — just less specific.

`0^0` stays `solved` (mathjs's convention is defensible and the review's
"Fail" was harsh) but the warning is non-optional: the envelope constructor
for this case takes no arguments that could omit it.

---

## Component 4 — Interpretation Transparency

**Touches:** trig path in `otherSolvers.js`, `SolutionDisplay.jsx`
**No new files** — this is a policy enforced through Component 1's `interpretation` field.

The angle-unit machinery is already right: `auto` mode detects bare common
angles as degrees, Settings can pin radians/degrees, an explicit `°` or `pi`
always wins, and a cross-check note shows the other reading. What's broken is
that the **canned tips contradict it** — `otherSolvers.js` unconditionally
appends "math.js uses radians by default (π radians = 180°)" (two sites,
lines ~949 and ~977) even when the solver just announced it detected degrees.
That contradiction is the entire "Critical" T4 finding.

Architectural rule (Design Principle 4), applied here and everywhere:

1. The solver sets `interpretation.angleUnit` to exactly what it did:
   `'radians'`, `'degrees'`, `'degrees (auto-detected)'`, or
   `'degrees (° in input)'`.
2. `SolutionDisplay` renders the interpreted unit **beside the answer**, not
   buried in step 1: `sin(30) = 0.5 — interpreted as 30°`.
3. Tips are assembled by a function that receives the interpretation and
   filters the tip pool against it. The "radians by default" tip survives
   only when `angleUnit === 'radians'`. The existing "if you meant radians,
   the result would be −0.988" cross-check note is kept — it's the best line
   in the current output.

This pattern generalizes: the algebra fallback's "Use * for multiplication"
tip is equally wrong when the input parsed fine and the failure was
elsewhere. Phase 2 sweeps all canned tip blocks through the same filter.

---

## Component 5 — Domain & Continuity Analysis

**New file:** `src/lib/domainAnalysis.js`
**Touches:** `functionsSolver.js`, `derivativesSolver.js`, `integralsSolver.js`, `algebraSolver.js`, `GraphViewer.jsx`

One shared module for questions every solver currently answers alone (or
not at all): *where is this expression undefined, what kind of point is it,
and where is it not differentiable?*

### 5a. Discontinuity classifier

`classifyDiscontinuities(expression, variable)` finds candidate points
(denominator roots, log/sqrt boundary points) and classifies each:

- **Removable** — the limit exists there (compute two-sided limit numerically
  from both sides, cross-check with Algebrite where possible) → a **hole**
  with coordinates `(a, L)`.
- **Infinite** — one-sided values diverge → vertical asymptote (already
  detected today; moves here so there's one implementation).
- **Boundary** — domain edge (`sqrt(x-2)` at 2), not a discontinuity.

Consumers:

- `functionsSolver` reports holes with coordinates: `(x²−1)/(x−1)` → "hole at
  (1, 2); equal to x+1 everywhere else" — the review's F3, where "the
  analysis stops before the most important graph feature."
- **New graph annotation** `holes: [{x, y}]` in the solution schema.
  `GraphViewer` renders it as a hollow marker — the `limitPoint` hollow-dot
  rendering already exists and is reused directly.
- `algebraSolver` uses the same candidates to state domain exclusions on
  rational equations (`(x−1)/(x+2)=0` → "x ≠ −2" made explicit).

### 5b. Differentiability checker

`nonDifferentiablePoints(expression, variable)` — detects the known nonsmooth
constructs (`abs(u)` at zeros of `u`; corner-forming piecewise later if ever
supported):

- `derivativesSolver`: `abs(x)` → answer stays `sgn(x)` but gains the
  required exception: "for x ≠ 0; f′(0) does not exist (corner point)".
- `functionsSolver`: extrema reporting checks the point against this list
  before attributing anything to `f′(x)=0`. `abs(x)`'s minimum at (0,0) gets
  the honest reason — "minimum at the corner where the function changes
  from decreasing to increasing; f′(0) does not exist" — killing the false
  calculus explanation (F5), which matters more in a teaching tool than a
  wrong number would.

### 5c. Real-antiderivative postprocessing

`realDomainQualify(antiderivative)` — post-pass on integral results before
display:

- Rewrites `log(u)` → `ln|u|` when `u` is not provably positive
  (Algebrite emits bare `log`).
- Adds the interval qualification to `warnings`: for `1/(x²−1)` →
  `½ ln|(x−1)/(x+1)| + C`, warning "valid on intervals not containing
  x = ±1" (uses 5a's discontinuity points — same module, no duplication).
- The existing differentiate-back verification in `byPartsSolver` already
  validates antiderivatives; this pass runs after it and never changes the
  derivative, only the branch presentation.

---

## Component 6 — Evidence-Scoped Claims

**Touches:** `algebraSolver.js` (numeric-search paths), `functionsSolver.js` (window-based analyses)

Every global claim ("no real solution", "no other extrema") carries an
internal `evidence` tag: `'symbolic'` or `'numeric-window'`. The rule:

- `symbolic` evidence → state the claim globally, and the step text is the
  argument itself. `sqrt(x) = −1` gets the two-line proof it deserves —
  "√x ≥ 0 for every x ≥ 0, and −1 < 0, so no real solution" — replacing the
  current search over [−100, 100]. Known symbolic upgrades: range arguments
  for `sqrt`/`abs`/even powers vs. negative constants, discriminant
  arguments for quadratics.
- `numeric-window` evidence → the claim is phrased with its bounds: "no sign
  change found on [−100, 100]" — never "no real solution found."

This is a small mechanical change (thread one tag, branch the phrasing) but
it's the fix for the review's deepest criticism: *"the UI sometimes phrases
the resulting claim globally"* when the method was a bounded search.

---

## Component 7 — Unsupported ≠ Malformed

**Touches:** `integralsSolver.js`, plus every solver's catch path (via Component 1's constructors)

When parsing/normalization succeeded (Component 2 passed) but the engine
returns nothing, the failure is `unsupported`, and the message must not
mention formatting — the input was fine.

- `integralsSolver`: Algebrite returning the input unchanged (its "I give
  up" signal) after a successful parse → `unsupported({reason})`. A small
  lookup names the famous cases: `sin(x^2)`/`cos(x^2)` → "non-elementary;
  its antiderivative is the Fresnel S/C function", `e^(-x^2)` → "non-
  elementary; related to the error function erf(x)". Default reason: "this
  integral has no elementary closed form, or is beyond this engine — the
  input itself is valid."
- The distinction is structural, not per-message: because Component 2
  validated first, a catch block downstream *knows* the input parsed, so
  `parseError` is unreachable there and the constructors make the honest
  choice the only available one.

---

## Traceability Matrix

Every finding from the black-box review, mapped to the component that fixes
it. "Fixed by construction" means the fix is a consequence of the
architecture, not a targeted patch.

| Finding | Description | Component(s) | Notes |
|---|---|---|---|
| #1 / T4 | `sin(30)` contradiction (Critical) | 4 | Behavior kept (auto-degrees is right for students); contradiction eliminated; unit shown beside answer |
| #2 / R5 | `1/0` → ∞ as success (Critical) | 3 | `undefined` with limit-vs-value explanation |
| #3 / D7, I7, T10, F7, M1–M4, R10 | Failures announced as success (Critical) | 1 | The envelope; ~10 line items fixed by construction |
| #4 / A9 | `2**x=4` → "No real solution" (Critical) | 2 | `**`→`^` receipt-normalization; structural validation |
| #5 / F3 | Removable hole not identified | 5a | Hole coordinates + hollow graph marker |
| #6 / D6, F5 | `abs(x)` cusp mishandled | 5b | Exception on derivative; honest extremum reasoning |
| #7 / I6 | Missing `ln\|·\|` in antiderivative | 5c | Rewrite + interval warning |
| #8 / M3 | `2 2` → `22` silently | 2a | Validation error with "2*2 or 22?" hint |
| #9 / R4 | `0^0` → 1 unqualified | 3 | Stays 1; convention warning is non-optional |
| #10 / I5 | Non-elementary integral blamed on formatting | 7 | `unsupported` + Fresnel note |
| #11 / R9 | `1e308*10` blamed on syntax | 3 | `overflow` classification |
| #12 / A6 | "No real solution" via finite search | 6 | Symbolic range argument replaces the window |
| #13 / T7 | `arcsin(1/2)` decimal only | 4 | Exact form + principal-range note via interpretation-aware tips¹ |
| #14 / L9 | `lim 0/0` false one-sided explanation | 2a + 3 | Literal `0/0` caught as indeterminate *form* before the limit machinery invents function values |
| M5, M6 | `NaN`, `∞−∞` as successful answers | 2a + 3 | Literal non-values classified, never evaluated |
| A5 | Rational-equation domain implicit | 5a | Domain exclusions stated |
| Review "fix order" #1–7 | — | 1, 4, 3+2, 5c, 7, 5a+5b, 6 | One-to-one coverage, same priorities |

¹ #13 is the one finding that is content, not architecture: add a
known-values table for inverse trig (mirroring the existing `commonAngles`
table) and a principal-range note. It rides along in Phase 2 because it
touches the same tip-assembly code.

---

## Implementation Phases

Each phase is independently shippable, keeps all tests green, and gets its
own minor version + changelog entry per the release process.

### Phase 1 — The envelope (v1.13.0) · ~1 day

`solutionEnvelope.js`; `finalizeResult()` as contract gate with legacy shim;
`Solver.jsx` status-branched toasts and history honesty; `SolutionDisplay`
status badge + card colors; `exportUtils` status labels. Solvers' existing
catch blocks switch to envelope constructors (mechanical). **Kills the
worst-scored category (malformed-input handling, 4.5/10) in one release.**

### Phase 2 — Input layer + interpretation (v1.14.0) · ~1–2 days

`inputValidator.js` (structural checks, receipt normalization, `**`→`^`);
wire into `solveProblem()` before routing; `interpretation` rendering in
`SolutionDisplay`; tip-filter pass over all canned tip blocks (trig radians
tip first); inverse-trig exact-values table. Delete the Phase 1 legacy shim
— from here, `status` is mandatory.

### Phase 3 — Numeric semantics (v1.15.0) · ~1 day

`numericSemantics.js`; wire into `arithmeticSolver` and the trig evaluation
path; literal `0/0`, `NaN`, `∞−∞` handling shared with the validator.

### Phase 4 — Domain & continuity (v1.16.0) · ~2–3 days

`domainAnalysis.js` (classifier, differentiability, `realDomainQualify`);
`holes` graph annotation in `GraphViewer`; consumers wired
(`functionsSolver`, `derivativesSolver`, `integralsSolver`,
`algebraSolver`). Largest phase; the classifier needs corpus-driven care.

### Phase 5 — Evidence scoping (v1.17.0) · ~half day

`evidence` tag threaded through algebra/functions numeric paths; symbolic
upgrades for the known range arguments; window-bounded phrasing elsewhere.

---

## Test Plan

The repo already runs `node --test` with a corpus harness (`tests/corpus/`,
`corpus.test.js`) — extend it, don't parallel it.

1. **Contract test (new, Phase 1):** every solver, fed one valid and one
   garbage input, returns a result whose `status` is one of the six values
   and whose failure constructors carry non-generic steps. This test is what
   keeps a seventh ad-hoc status from ever appearing.
2. **Review corpus (new):** all 66 review inputs (they're already tabulated
   in the review doc) become corpus cases asserting on `status` + key answer
   fragments — D7/I7/T10/F7 assert `parse_error`, I5 asserts `unsupported`
   + "Fresnel", R5 asserts `undefined`, T4 asserts the interpreted-unit
   string and the *absence* of the radians tip. The review becomes a
   permanent regression suite instead of a document.
3. **Per-component units:** validator table-driven cases (2a's table is the
   spec); `classifyNumericResult` over the Component 3 table;
   `classifyDiscontinuities` over removable/infinite/boundary examples;
   `realDomainQualify` differentiate-back invariance (reuse the existing
   limit-substitution-invariant test pattern).
4. **UI smoke:** `handleSolve` with a `parse_error` result → no
   history write, no success toast (component-level, mocked api).

---

## Explicitly Out of Scope

- **New problem types.** The review said semantics before breadth; this plan
  honors that. No new topics until Phase 5 ships.
- **Complex-mode toggle.** `sqrt(-1) = i` stays; a real/complex mode switch
  is a Settings feature for later — Component 3 leaves a natural seam.
- **Jump discontinuities / piecewise input.** 5a classifies them if they
  ever arrive, but piecewise syntax isn't supported input today.
- **KaTeX rendering, tutor mode** — tracked in [`ROADMAP.md`](ROADMAP.md),
  orthogonal to this work.
