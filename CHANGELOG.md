# Changelog

All notable changes to MasterMath will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.16.1] - 2026-08-16

QA report items 6 and 7: the two findings that silently produced wrong
"Solved" answers for inputs students actually type.

### Fixed

- **`asin`, `acos`, `atan` behave exactly like `arcsin`, `arccos`, `arctan`.**
  Algebrite only knows the long names, so the short aliases came back as the
  unevaluated operator — `f'(x) = d(asin(x),x)`, marked Solved. The aliases
  are now normalised once, in `parseMathExpression`, upstream of every
  solver, which fixes derivatives, integrals, functions and trig alike (the
  report only tested derivatives; integrals and functions had the same gap).
  `sin^-1(x)`, `sin^(-1)(x)` and `sin⁻¹(x)` normalise too; `asinh` and `x^-1`
  are left alone.
- **An unevaluated derivative or integral is never reported as solved.**
  When Algebrite cannot differentiate or integrate something it does not
  throw — it hands the operator back: `d(f, x)`, `integral(f, x)`. Both
  solvers now detect that (`isUnevaluatedOperator` in `solverUtils.js`) and
  return an honest *unsupported* envelope. This mattered for integrals in
  particular: the existing derivative trust gate did not catch it, because
  `d(integral(f,x),x)` simplifies straight back to `f` and passes.
- **Unknown function names no longer hijack the variable.** `erf(x)`
  differentiated as `f'(f) = 0` — the variable extractor took the "f" of
  "erf" as the variable. Multi-letter names directly before "(" are now
  excluded as candidates (single letters stay: `x(x+1)` is implicit
  multiplication). `erf(x)` now gives `2e^(−x²)/√π`; a function neither
  engine knows is refused, not "solved" with respect to one of its letters.

## [1.16.0] - 2026-08-16

The first fixes from the external QA report on v1.13.0 (98 problems, seven
topics): its one critical finding, plus the capability that finding was
missing.

### Fixed

- **`sin(x) = 1/2` under Trigonometry displayed minified JavaScript as the
  final answer — under a green "Solved" badge, and saved to history as a
  solved problem.** An equation skipped the simplifier and reached
  `math.evaluate`, which reads `sin(x) = 1/2` as a *definition* of a function
  named `sin` and hands back the function object; stringifying it produced
  the source of mathjs's `typed-function` wrapper. Two fixes, both needed:
  - Equations are routed to the new trig-equation solver before anything can
    reach the evaluator (below).
  - `finalizeResult` in `api.js` — the gate every solver's output already
    passes through — now refuses any answer or step that is not presentable
    text: a function, object or array, or a string shaped like source code
    (`function name(...) {`, an arrow with a body, `[object Object]`,
    `[native code]`). Such a result is replaced with an honest *unsupported*
    envelope and never marked solved. The pattern is deliberately
    code-specific, so prose such as "return to the original variable" or "the
    arguments of the trig functions" is never mistaken for a leak. Verified
    across all seven topics: zero false refusals.

### Added

- **Trigonometric equations.** `A·f(kx) + B = C` for f ∈ {sin, cos, tan}
  — `sin(x) = 1/2`, `2cos(x) − 1 = 0`, `tan(2x) = 1`, `√3 = 2sin(x)`,
  `tan(x/2) = √3` — with the trig term isolated first, the reference angle
  given exactly for special values (π/6, 2π/3, √3/2 …), the full general
  solution (`x = π/6 + 2πn or x = 5π/6 + 2πn`, `x = πn`, `x = π/2 + πn`),
  the solutions on [0, 2π) with the kx argument divided (or multiplied)
  through, and a graph of the curve against `y = c` with those solutions
  marked. Every listed solution is substituted back into the original
  equation before it is reported. `sin(x) = 2` is "no real solution", not an
  error. Out-of-family equations — `sin²(x) = 1/4`, `sin(x) = cos(x)`,
  `sin(x²) = 0` — are refused with an explicit "not supported yet", never
  mis-solved.
- The same equations typed under **Algebra** get the same exact treatment
  (previously five decimal roots from a numeric scan); out-of-family
  equations still fall through to the numeric scan.
- `sin(x) = 1/2` joins the Trigonometry examples and placeholder.

## [1.15.0] - 2026-08-16

### Added

- **The whole app is available offline after one visit.** The service
  worker now precaches every hashed asset the build produced — all route
  chunks, the lazily loaded solver modules, mathjs / Algebrite / Recharts /
  jsPDF, both stylesheets, and the KaTeX fonts — at install time. Before,
  assets were cached only when first fetched, so a route you had not opened
  while online (the routes are code-split) had nothing to load from and hit
  the error boundary. Verified with the server stopped: the Solver, never
  opened online in that session, rendered and solved a derivative and a
  definite integral, with typeset maths and a graph, entirely from cache.
  - The manifest is generated at build time by `stampServiceWorker` in
    `vite.config.js` (the filenames carry content hashes) — 50 assets,
    ~3.7 MB raw, ~1 MB over the wire, fetched once in the background.
  - Unchanged assets are **reused from the previous worker's cache** rather
    than re-downloaded, so a release that doesn't touch mathjs doesn't cost
    every user 1 MB again. Verified by deleting the mathjs chunk from the
    server and installing a new worker: the new cache still held the real
    script, copied across.
  - Precaching is best-effort: assets are fetched individually and a miss
    never fails the install; the fetch handler still caches anything absent
    the first time it is requested online.

### Fixed

- Cache lookups ignore the `Vary` header. Some servers send `Vary: Origin`
  on static files, and Vite's module preloads carry an `Origin` header while
  the worker's precache fetches do not, so a strict match refused entries the
  precache had just stored and an offline route load returned 503 with the
  file sitting in the cache. Everything cached is content-addressed or the
  single app shell, so the same bytes are correct for every requester.
  (Netlify does not currently send `Vary` on assets; this hardens against a
  hosting change and matched what was observed under `vite preview`.)

## [1.14.1] - 2026-08-16

### Fixed

- **Blank page for returning visitors after a deploy.** Two service-worker
  defects compounded. (1) Navigations were served cache-first from an
  `index.html` frozen at the worker's install time — the "background
  revalidation" wrote its fresh copy under the request URL, never under the
  `/index.html` key that navigations read — so a worker that activated after
  a later deploy served a shell pointing at hashed chunks that no longer
  existed. (2) Netlify's SPA rewrite answers any unknown path with
  `index.html` and a **200**, so a request for a vanished chunk came back as
  HTML; the browser refuses to run HTML as a module script (blank page, no
  console error), and `fetchAndCache` — which trusted any 200 — stored that
  HTML under the `.js` URL, poisoning the entry for the life of the worker.
  Three deploys in quick succession on 2026-08-16 widened the window and
  surfaced it.

  Now: navigations are **network-first** (the shell is a few KB and is the
  one file that must agree with the server), with the cached copy used only
  when offline; a response whose body type doesn't match its filename
  (HTML for `.js`/`.css`) is never cached and, for scripts and stylesheets,
  is reported to open tabs as a stale shell, which reload **once** (guarded
  via `sessionStorage`) to pick up the current version; and the worker
  re-fetches `/index.html` on activation, so a worker installed before a
  deploy does not carry a dead shell into service. Verified end to end
  against a local SPA-fallback server: a deploy under a live worker with a
  populated cache now renders the new build on a plain reload, HTML-for-JS
  is refused by the cache and triggers exactly one recovery reload, and the
  offline shell fallback still works.

  Users already stuck on the blank page: a hard reload (⌘⇧R) loads the
  current version, and the update banner then installs this worker.

## [1.14.0] - 2026-08-16

Third accessibility pass. The graph gets a text alternative — a new
capability, hence the minor bump — and the last structural gaps from the
audit are closed: menu semantics, notification timing, and the heading
outline.

### Added

- **The graph can be read, not just seen.** `src/lib/graphDescription.js`
  turns the same annotation data the chart is drawn from into prose: the
  chart wrapper is exposed as one `role="img"` named by a summary ("Graph
  of f(x) = x² − 4x + 3. Line chart with 3 key features marked: Local
  minimum at (2, −1). Crosses the x-axis at x = 1 and x = 3. Crosses the
  y-axis at y = 3."), and a collapsible **Key features** panel beneath the
  chart lists the same points for everyone. It covers extrema, intercepts,
  asymptotes, equation solutions, the limit guideline and marker, the
  definite-integral region, the system intersection point, inequality
  intervals, and the secondary curve. It describes only what the solver
  annotated — it never infers features from the sampled points, since a
  fabricated feature is worse than none. Eleven unit tests pin the wording.
- The graph's icon-only controls carry `aria-label`s (previously `title`
  only) and are grouped as "Graph view controls".

### Fixed

- **The export menus are real menus.** The dropdown had no roles at all;
  the items were reachable only because they happened to be buttons. Now
  the WAI-ARIA menu-button pattern: `aria-haspopup="menu"` /
  `aria-expanded` / `aria-controls` on the trigger, `role="menu"` with a
  name on the popup, `role="menuitem"` on items, focus moves into the menu
  on open (ArrowDown/Enter/Space → first item, ArrowUp → last), arrow keys
  rove and wrap, Home/End jump, Escape closes and returns focus to the
  trigger, and Tab closes on the way out. Items are `tabIndex=-1`, so the
  menu is one tab stop.
- **Notifications can be read in time (WCAG 2.2.1).** Every toast used to
  vanish after 3 seconds with no way to hold it. Errors and warnings now
  persist until dismissed — they carry something the reader must act on —
  and are announced assertively (`role="alert"`). Success and info still
  auto-dismiss, but at 6 seconds, and the countdown pauses while the toast
  is hovered or focused, resuming from where it left off.
- **One h1 per page, no skipped levels.** The header and sidebar brand text
  were `h1`/`h2` on every page, on top of each page's own `h1`; they are
  now plain text (they are home links, not headings). `CardTitle` defaults
  to `h2` — a card sits directly under the page title — and takes `as="h3"`
  on Home, where the cards live under `h2` sections. The FAQ questions
  jumped `h1 → h3` and the "Why Choose MasterMath?" points jumped
  `h2 → h4`; both are corrected. Verified: exactly one `h1` and zero level
  skips on all nine routes.

## [1.13.3] - 2026-08-16

Second accessibility pass, covering perceivability: contrast, motion
sensitivity, and focus visibility. Follows the operability fixes in 1.13.2.

### Fixed

- Text contrast now meets WCAG AA everywhere. The problem-input placeholder
  was 2.54:1 against white — and it is where the input-format examples live,
  so the readers who most need the hint could least read it. Now 4.83:1. The
  step-through counter ("Step 3 of 7") was 2.54:1 in light and 3.04:1 in
  dark; now 4.83:1 and 5.78:1. The graph placeholder had no dark-mode colour
  at all, leaving it at 3.04:1 on the dark card; now 5.78:1. The Feedback
  email field, which relied on the browser's default placeholder colour, now
  matches the rest of the app. Verified across seven routes in both themes:
  zero remaining AA text failures.
- The focus ring is visible again. `Button` asked for `ring-ring` and
  `ring-offset-background` — shadcn tokens this project never defined in its
  Tailwind config, so they compiled to nothing and every button silently fell
  back to Tailwind's default translucent blue, all but invisible on the blue
  and indigo gradient buttons. Replaced with explicit indigo ring colours and
  a theme-aware offset.

### Added

- `prefers-reduced-motion: reduce` is honoured (WCAG 2.3.3). Sidebar slides,
  hover fades and the update banner's bounce collapse to instant state
  changes. The busy spinner is deliberately exempt — it is the only signal
  that work is in progress — but slows to 1.5s so it does not draw the eye.
  Framer Motion sits outside CSS control, so the solution card and its step
  reveals opt out through `useReducedMotion` in `SolutionDisplay`, which is
  the only component that uses it; handling it there rather than app-wide
  keeps Framer Motion inside the lazy solver chunk.
- `forced-colors: active` support for the gradient headings. They paint
  their colour into the text's own fill and set the text transparent, which
  made them vanish outright in Windows High Contrast Mode; they now fall
  back to a plain system-coloured heading.

## [1.13.2] - 2026-08-16

Accessibility pass over the app shell and shared controls. Seven defects
that made the app unusable — or in places silent — for keyboard and screen
reader users.

### Fixed

- **Math is no longer silent to screen readers.** `MathText` rendered KaTeX
  with `output: "html"`, which emits only the visual span that KaTeX itself
  marks `aria-hidden`. Every expression in every step and final answer was
  announced as nothing. Restored to KaTeX's default `htmlAndMathml`, so the
  MathML copy carries the content.
- **The topic picker is keyboard-operable.** Options were `<div>`s with a
  click handler — not focusable, no roles — so the required topic could not
  be chosen without a mouse. Rebuilt on the ARIA combobox/listbox pattern:
  `role="combobox"` with `aria-expanded`/`aria-haspopup`/`aria-controls`,
  `role="option"` with `aria-selected`, arrow keys, Home/End, Enter/Space to
  choose, and Escape to dismiss, tracked via `aria-activedescendant`.
- **Form labels point at real elements.** The `<label for>` on the Solver
  topic select and both Feedback selects referenced ids that existed nowhere
  in the DOM. `Select` now accepts an `id` for its trigger, and the trigger
  is named via `aria-labelledby`.
- **The sidebar toggle has an accessible name** — previously a bare button
  wrapping an SVG, announced only as "button". Now labelled, with
  `aria-expanded` and `aria-controls`.
- **A collapsed sidebar leaves the tab order.** It was hidden with `w-0
  overflow-hidden`, which hides nothing from assistive tech, so keyboard
  users tabbed through seven invisible links before reaching the page. Now
  marked `inert` (plus `aria-hidden`) when closed.
- **The skip link works.** Its off-screen position was an inline style, which
  outranks any stylesheet rule, so the `:focus` rule could never bring it
  back on screen — it had never been visible. Both states now live in
  `index.css`, and `<main>` takes `tabIndex={-1}` so activating it moves
  focus rather than just scrolling.
- **The confirm dialog is a real dialog.** No role, no name, no focus
  management — Tab walked straight behind the backdrop, and this is the
  gate on "clear all history". Now `role="dialog"` + `aria-modal` with
  `aria-labelledby`/`aria-describedby`, initial focus on Cancel, a Tab trap,
  Escape to cancel, and focus restored to whatever opened it.

## [1.13.1] - 2026-08-15

### Changed

- Initial page load is ~10× smaller: 81 KB of JavaScript (gzipped) instead of
  860 KB. Every visitor — including one who only opened the landing page or a
  policy page — used to download mathjs, Algebrite, Recharts and jsPDF
  (~2.4 MB raw) before anything rendered.
  - Routes are split with `React.lazy`, so a page's code is fetched when it is
    opened. `Home` stays eager, since deferring the landing page would only
    add a round trip.
  - The graph panel loads Recharts the first time a solution actually has a
    graph to draw, rather than on every visit to the solver.
  - jsPDF is imported on demand inside the PDF export functions, so only users
    who choose "Export as PDF" pay for it. CSV, JSON and Markdown exports are
    unaffected.
  - `manualChunks` now names every module the entry chunk shares — React,
    Vite's preload helper, Rollup's CommonJS interop shims and the small
    styling/icon helpers. Previously these were folded into whichever chunk
    Rollup found convenient (React ended up inside `charts`, the preload
    helper inside `pdf`), which forced the entry chunk to statically import
    those bundles and made Vite preload them from `index.html`.
- History exports tell the truth about outcomes, matching the solution card.
  History holds every outcome except parse errors, so it contains results the
  solver could not solve; the CSV, Markdown and PDF exports presented all of
  them as answers.
  - The CSV gains a `Status` column, and the Markdown and PDF exports label
    any entry that was not solved and head its text "Result" rather than
    "Solution".
  - "Total Problems Solved: N" becomes "Total Problems: N", with a
    "(solved: M)" breakdown whenever the two differ.

### Security

- Exported CSVs no longer let a saved problem be run as a spreadsheet formula.
  Cells beginning with `=`, `+`, `-`, `@`, tab or carriage return are prefixed
  with an apostrophe so the spreadsheet treats them as literal text. A maths
  app produces such cells routinely — "-3*x + 6 = 0" is a formula to Excel —
  and problems are free text, so they can also be crafted deliberately. Every
  field is now quoted as well, so a locale whose date format contains a comma
  cannot shift the columns.

### Fixed

- `validateMathInput` no longer rejects legitimate mathematics. Its
  "dangerous content" patterns blocked nothing reachable — React escapes what
  it renders, KaTeX runs with `trust: false` over solver output, and the
  exports are plain text — but the event-handler pattern `/on\w+\s*=/i`
  matched the "on" inside "constant", so "constant = 5" was refused as
  "Invalid input detected" with no explanation.
- The solver is now given the same string that was validated. `ProblemInput`
  sanitized the input, validated the sanitized copy, then solved the raw text,
  so the two could differ. Sanitizing no longer strips `<...>` spans either:
  that pass deleted everything between a `<` and a later `>`, quietly turning
  "x < 5 and x > 1" into "x  1".
- Exporting a solution now describes the solution on screen. The export used
  the live contents of the problem box and topic picker, so editing either
  after solving produced a file whose problem statement did not match its
  answer.
- The storage helpers in `api.js` no longer discard the reason a call failed.
  A validation failure is reported as itself ("Invalid topic selected")
  instead of being flattened into "Failed to save problem. Please try again.",
  and genuine storage failures still show that generic message but now carry
  the original error as `cause`.

- A failure to save a solved problem to history is no longer reported as a
  failed solve. Storage can fail for reasons unrelated to the mathematics
  (quota exceeded, private browsing, an evicted database); the solution stays
  on screen and the message now says the history save failed, instead of the
  misleading "Failed to solve problem. Please try again."
- Toasts raised in the same millisecond no longer collide. Ids came from
  `Date.now()`, so two simultaneous notifications shared a React key and
  dismissed each other.
## [1.13.0] - 2026-07-21

Phase 1 of the mathematical state semantics architecture
(`docs/future-work/MATH-STATE-SEMANTICS.md`): every solver result now
carries a typed status, and the UI tells the truth about outcomes.

### Added

- Solution envelope (`src/lib/solutionEnvelope.js`): every result carries a
  `status` — `solved`, `parse_error`, `unsupported`, `undefined`,
  `indeterminate`, or `overflow` — enforced by the result gate in `api.js`.
- Status badge on the solution card, with status-matched styling: green is
  reserved for real solves, amber for honest non-answers (unsupported /
  undefined / indeterminate / overflow), red for unreadable input with a
  "What went wrong" card.
- Non-elementary integrals are now told the truth: ∫sin(x²)dx reports the
  Fresnel S function instead of blaming the input's formatting; e^(−x²)
  reports erf. Failure messages never suggest a formatting fix when the
  input parsed correctly.
- Parse guards in the Functions and Limits solvers: unreadable input fails
  loudly instead of being sampled into a fabricated analysis ("f(x)=x^^2"
  echoed as a success; a false "one-sided limits disagree" claim).
- Contract test suite (`tests/envelope.test.js`) turning the July 2026
  black-box review's failure cases (D7, I5, I7, T10, F7, M1, M2) into
  permanent regressions.

### Changed

- The success toast fires only for actual solves; parse errors toast red,
  engine limitations toast amber ("Problem solved successfully!" no longer
  appears on failures — the worst-scored finding in the July 2026 review).
- Failed parses are no longer saved to problem history, and history entries
  record the real outcome instead of a hardcoded "Solved successfully".
- Solver failure messages carry the specific cause (from the math engine)
  instead of five generic syntax tips; systems/inequalities/definite-
  integral refusals state their reason as the answer.
- Exports label non-solved results with their status; a failed solve's PDF
  no longer reads like an answer.

### Added
- **Integration by parts walkthrough** — `∫x·cos(x) dx`, `∫x³·sin(x) dx`,
  `∫eˣ·sin(x) dx`, `∫ln(x) dx`, `∫arctan(x) dx` and friends now show the full
  derivation: the LIATE choice of u and dv, du and v, and the
  `∫u dv = uv − ∫v du` line for each round
- **Repeated by-parts now computes** — `x³·sin(x)` (which Algebrite fails
  outright) recurses through three rounds to a direct base case
- **Cyclic by-parts now computes** — `eˣ·sin(x)` / `eˣ·cos(x)` are solved
  algebraically: the walkthrough shows the original integral reappearing and
  moves it to the left to solve for it
- **Per-term walkthroughs** — a by-parts term inside a sum
  (`x³·sin(x) + x²`) gets its own labelled walkthrough
- Steps render through KaTeX where possible, plain text otherwise

### Changed
- Indefinite integrals are now computed term by term, so a single hard term
  no longer sinks the whole integral. Every antiderivative is differentiated
  back and checked against the integrand before it is shown; anything that
  fails falls back to Algebrite or an honest "unable to compute"

### Fixed
- Numeric evaluation now understands `arcsin`/`arccos`/`arctan` (aliased to
  mathjs's `asin`/`acos`/`atan`), so graphs and verification of inverse-trig
  expressions no longer silently fail

## [1.11.0] - 2026-07-12

### Added
- **Inequalities** — solve linear, polynomial, and rational inequalities with
  `<`, `>`, `≤`, `≥` by the sign-chart method: `x^2 - 4 > 0` → `x < -2 or
  x > 2`, `2x + 3 < 7` → `x < 2`, `(x-1)/(x+2) >= 0` → `x < -2 or x ≥ 1`.
  Worked steps show moving to one side, finding the critical points, and the
  sign on each interval; the answer is given in both inequality and interval
  notation
- **Correct endpoints** — a root is closed for `≤`/`≥` and open for `<`/`>`,
  and a denominator zero (pole) is always excluded. All-real-numbers,
  no-solution, and single-point (`x^2 ≤ 0` → `x = 0`) cases are named
  correctly
- **Sign-chart graph** — plots the expression with its zeros marked, breaks
  drawn as dashed lines, and the solution ranges shaded (new graph annotation
  `shadedRegions`)
- Compound inequalities (`a < x < b`) are refused clearly for now

### Changed
- Algebra input containing a comparison operator is routed to the inequality
  solver from the raw text; equations, systems, factoring, and simplification
  are unaffected

## [1.10.0] - 2026-07-12

### Added
- **Systems of equations** — solve a 2×2 linear system like
  `2x + 3y = 6; x − y = 4` and get exact fractions (`x = 18/5, y = −2/5`),
  not decimals. Worked steps show the substitution; the solution is checked
  by substituting back into both equations before it is reported. Accepts
  semicolon-, comma-, newline-, or "and"-separated equations, any two
  variable names, and "solve the system …" phrasing
- **The three system outcomes** are named correctly: a unique solution, *no
  solution* (parallel lines), or *infinitely many* (the two equations are the
  same line) — the classic elimination pitfall of reading "0 = 0" as "no
  solution" is handled
- **Intersection graph** — both lines are plotted with the solution point
  marked where they cross (new graph annotation `intersection`)
- Non-linear systems, three-variable systems, and anything that isn't a clean
  2×2 linear system are refused clearly instead of mis-solved

### Changed
- Algebra input with two or more equations is routed to the new systems
  solver from the raw text (before single-expression extraction); single
  equations, factoring, and simplification are unaffected

## [1.9.1] - 2026-07-12

Presentation polish — the three cosmetic nits noted in the July 2026
production audit. Each fix keeps the correctness discipline (the exact form
is numerically re-checked before it is shown).

### Changed
- **Exact-fraction limits** — removable limits now report the exact value
  (`lim x→0 (sin x − x)/x³ = −1/6`, `(1−cos x)/x² = 1/2`) instead of a rounded
  decimal (`−0.1667`, `0.5`). Clean integers stay integers; the fraction is
  confirmed to match the verified numeric value before it is displayed, and
  renders as a proper KaTeX fraction
- **Oscillation wording** — a limit that fails because the function oscillates
  (`sin(1/x)`, `cos(1/x)`) now says so explicitly, rather than blaming
  "one-sided limits disagree." A genuine jump (`|x|/x`) still reads
  "the one-sided limits disagree" — the two DNE reasons are no longer conflated

### Fixed
- **Simplification never grows the expression** — `(x²−9)/(x+3)` now
  simplifies to `x−3` (via Algebrite) instead of mathsteps' longer split form
  `x²/(x+3) − 9/(x+3)`. The solver gathers candidate simplifications from
  mathsteps, Algebrite, and math.js, verifies each is equivalent, and picks
  the shortest — so a result is never longer than what was typed; genuinely
  simple inputs are left alone

## [1.9.0] - 2026-07-12

### Added
- **Definite integrals** — `∫_0^1 x^2 dx`, `∫_0^pi sin(x) dx`, and
  "x^2 from 0 to 3" now evaluate to an exact value (`1/3`, `2`, `9`) via the
  Fundamental Theorem of Calculus. The steps show the antiderivative F, its
  values at each bound, and the subtraction F(b) − F(a). Previously these
  refused clearly ("not supported yet"); this replaces the honest refusal
  with a real capability
- **Improper-integral guard** — an integral across a discontinuity
  (`∫_{-1}^{1} 1/x dx`) is detected and refused instead of reporting
  Algebrite's meaningless complex value. Every definite result is
  independently confirmed by Simpson's-rule quadrature before it is shown;
  the two methods must agree or the solver refuses
- **Shaded-area graphs** — a definite integral graphs the integrand with the
  interval [a, b] shaded and its bounds marked, since the integral *is* that
  signed area
- KaTeX now typesets definite integrals with their bounds (`\int_{a}^{b}`)

### Changed
- The integrals solver now receives the raw problem text (like limits do) so
  it can read bounds before notation is normalized; indefinite integrals are
  unaffected

## [1.8.1] - 2026-07-12

Fixes every defect from the July 2026 production audit of v1.8.0
(`docs/evaluations/2026-07/PRODUCTION-AUDIT-v1.8.md`). All three confident-
wrong answers lived in one place — the algebra solver's numeric fallback,
the last path without a verification gate.

### Fixed
- **Radical equations** — `sqrt(x) = 5` answers x = 25 instead of five scan
  artifacts near −100. The scanner treats non-real values (√ of a negative)
  as out-of-domain instead of feeding NaN sign comparisons, and every
  candidate root must survive back-substitution before it is reported
- **Identities** — `2(x+3) = 2x+6` answers "All real numbers" instead of
  five arbitrary grid points
- **Contradictions** — `5x−7 = 5x+2` states "No solution (the two sides are
  never equal)" confidently instead of hedging about the searched range
- **Absolute-value bars** — `|x−3| = 5` now parses (`|…|` → `abs(…)`) and
  solves: x = −2 or x = 8 (was "No real solution found")
- **Quartic roots** — `x⁴ − 16 = 0` displays x = ±2, ±2i instead of raw
  `(−1)^(1/4)` principal-root notation (each root verified by
  back-substitution)
- Periodic fallback equations (`sin(x) = 0`) show the five roots nearest
  zero, not the five nearest −100

### Added
- `tests/corpus/additions.csv` — post-evaluation acceptance rows (the audit
  failures plus a never-invent-roots guard), loaded by the corpus harness
  alongside the original 91-row evaluation (97 rows, 100%, zero
  confident-wrong)

## [1.8.0] - 2026-07-12

### Added
- **Tutor mode (step-through)** — a "Show all / Step through" toggle on the
  step-by-step solution. In step-through mode steps are revealed one at a
  time via a "Reveal next step" button (with a "Reveal all" shortcut and a
  "Step X of N" counter), and a prompt invites the student to predict the
  next move before revealing it. The final answer, key insights, and common
  mistakes stay hidden until every step has been revealed, so it teaches
  rather than lets you copy the answer. Defaults to "Show all"; the toggle
  only appears for multi-step solutions.

## [1.7.0] - 2026-07-12

The Wave 1 "quality tail" from the July 2026 evaluation (items B2–B5 in
`docs/evaluations/2026-07/ANALYSIS.md`) — the last four known partial
behaviours. The evaluation corpus now scores 88 correct + 3 clear refusals
of 91, with zero confident-wrong answers.

### Added
- **One-sided limits** — `lim x→0+ 1/x`, `x->0^-`, and "as x approaches 0
  from the right" all evaluate the requested side (∞ here) instead of
  silently answering the two-sided limit. Handles domain boundaries
  (`lim x→0⁻ √x` does not exist), slow divergence (`lim x→0⁺ ln(x) = −∞`),
  and marks the side on the graph guideline (`x → 0⁺`)
- **Factoring** — "factor x² − 9" now factors: `(x − 3)(x + 3)`, with
  difference-of-squares narration and a check-by-expanding step. Results are
  verified numerically before being shown; irreducible inputs say so honestly
- **Exact radicals** — `sqrt(50)` answers `5√2 (≈ 7.0711)` with the
  perfect-square walkthrough instead of a bare decimal; radical sums combine
  exactly (`√8 + √2 = 3√2`)
- **Symbolic trig identities** — `sin(x)² + cos(x)² = 1` (was "Unable to
  evaluate"); simplifications are verified numerically before being claimed,
  and expressions with no simpler form say so instead of guessing

### Changed
- One-sided limit markers typeset as proper superscripts in KaTeX (`0⁺`)

## [1.6.0] - 2026-07-08

### Added
- **KaTeX math rendering** — solution steps and final answers now display
  typeset math (real fractions, exponents, integral and root signs) instead
  of ASCII like `x^2`. Fully offline (KaTeX is bundled); any fragment KaTeX
  can't render falls back to plain text
- **Graph annotations** — graphs now mark what the solution talks about:
  extrema dots labeled max/min, x- and y-intercept dots, dashed vertical
  asymptote lines, and for limits a guideline at the approach point with a
  hollow marker at (a, L)
- **Graph height controls** — make the chart taller or shorter (5 sizes)
- **Four-way panning** — pan up/down as well as left/right; panning is
  clamped to a reasonable extent (the solvers now sample x ∈ ±40, and the
  vertical window can't wander more than one screen past the data)
- Limit graphs open centered on the approach point

### Changed
- Sample cap raised so polynomial growth isn't dropped from the pannable
  range (only true blow-ups are excluded); Reset restores view and height

### Fixed
- Graph height changes apply instantly (removed a transition that could
  leave the chart stuck at its old size)

## [1.5.0] - 2026-07-08

### Added
- **Quadratic insights** — parabolas now report the axis of symmetry
  (x = −b/2a), opening direction from the leading coefficient, and the exact
  vertex
- Function analysis now reports domain restrictions, y-intercept, inflection
  points, and horizontal asymptotes

### Changed
- **Functions/Graphing rebuilt from scratch** (scored 2/10 in the July 2026
  evaluation). Features are now computed, never guessed:
  - extrema from solving f′(x) = 0 (exact via Algebrite, verified numeric
    fallback) — no more fabricated "vertices" for monotonic functions like eˣ
  - x-intercepts from real root-finding with |f(root)| ≈ 0 verification — no
    more invented intercepts near the window edge for 1/(x−2)
  - vertical asymptotes detected and reported (denominator roots + divergence
    check), including slow log-type divergence
  - domain boundaries found by bisection (sqrt(x−3) reports "undefined for
    x < 3" and its (3, 0) starting point)
  - honest fallbacks: "no local extrema" / "none found" instead of made-up
    features; no global monotonicity claims across a broken domain
- All 10 Functions rows of the evaluation corpus now pass — the full 91-row
  corpus grades 100% with zero confidently-wrong answers and zero skips

### Fixed
- ln(x) graphing/analysis works (previously every numeric evaluation failed)

## [1.4.0] - 2026-07-08

### Added
- **Regression harness over the 91-problem evaluation corpus**
  (`tests/corpus/`) — re-runs every eval input through the real pipeline and
  grades by math-equivalence (not string match), so no fixed bug returns
  silently. Wired into `npm test`; it fails if any answer is confidently wrong.
- Combinatorics: `C(n,k)`/`nCr` and `P(n,k)`/`nPr` notation now evaluate
  (e.g. `C(5,2)` = 10).
- Clear refusals for not-yet-supported input instead of confident wrong
  answers: definite integrals (`∫_a^b`) and systems of equations now explain
  they aren't supported rather than returning a garbage number.

### Fixed
- **Wave 1 of the July 2026 evaluation** — zero confidently-wrong answers
  remain on the graded corpus:
  - `d/dx arctan(x)` now returns `1/(x^2+1)` (was `0`; inverse-trig names were
    missing from the variable detector, so it differentiated w.r.t. "a").
  - `7!` evaluates to `5040` (the trailing `!` was being stripped as sentence
    punctuation).
  - `lim x→0 |x|/x` correctly reports "does not exist" (was `0`; the symbolic
    limit ladder now discards any rung whose numeric cross-check fails).
  - `∫1/x dx` displays `ln|x| + C` (was `log(x) + C`).
  - `ln(x)` is now evaluable everywhere (graphs, sampling) via a mathjs `ln`
    alias — mathjs only knew `log`.

## [1.3.1] - 2026-07-08

### Fixed
- **Limits no longer return confidently wrong answers on 0/0 forms** —
  numeric-only sampling suffered floating-point cancellation (e.g.
  (1−cos x)/x² returned 0 instead of 0.5, (sin x − x)/x³ returned 0 instead
  of −1/6). Finite limits now climb a symbolic ladder — direct substitution,
  simplify-and-resubstitute, Taylor-series ratio, L'Hôpital — with numeric
  sampling as the last resort, and answers are independently cross-checked
  (verified flag with the method named)
- sec/csc/cot now differentiate and integrate — Algebrite has no reciprocal
  trig functions, so d/dx sec(x) previously returned the unevaluated literal
  "d(sec(x),x)" and ∫sec²x failed; they are rewritten to sin/cos forms first
- Cubic equations like x³ = 8 now return clean roots (x = 2 plus the complex
  pair) instead of principal-complex-root notation like −2·(−1)^(1/3)

### Added
- Regression test suite (tests/regressions.test.js) pinning every bug above
  with its original wrong output, plus a numeric-invariant test for the
  limit substitution guard (55 tests total)

## [1.3.0] - 2026-07-07

### Added
- **Settings page** (`/settings`) — Appearance (theme), Solver Preferences,
  Data & Privacy (export all / clear history), and About sections
- **Solver preferences that change solving behavior**
  - Angle unit: auto-detect / degrees / radians for trig inputs like sin(30),
    with explanatory steps and a cross-check note for the other unit
  - Decimal places (2–6) for all numeric results
- **Worked, term-by-term solution steps** — derivatives and integrals now show
  the real intermediate result for each term with the rule that produced it,
  instead of generic rule reminders
- Exact algebra fallback via Algebrite roots — quadratics like x^2 = 2 return
  exact radicals (and complex roots like x = ±i) instead of stopping early
- Limits at infinity and honest indeterminate-form (0/0) handling
- Build-time service worker stamping so the in-app update banner fires on
  every release

### Changed
- **Rebrand to match the logo** — indigo replaces purple throughout; primary
  action buttons (Solve, Start Solving) are now orange with a Calculator icon
- Solution steps restyled as a clean divided list (no boxed backgrounds)
- Sidebar menu slimmed (legal pages moved to footer/Settings) and now
  auto-collapses after selecting a page
- Home hero tiles are unboxed, and lay out icon-beside-text on mobile
- Dark mode overhauled across every page and base component (inputs, selects,
  toasts, dialogs), with WCAG-contrast fixes in both themes

### Fixed
- tan(π/2) and other vertical-asymptote trig values now return "Undefined"
  with an explanation instead of a floating-point artifact
- Service worker no longer force-reloads the page mid-session when an update
  is detected — updates apply when the user clicks the banner

## [1.1.0] - 2025-01-05

### Added
- **New Homepage/Landing Page**
  - Hero section with welcome message and prominent CTAs
  - Feature showcase grid highlighting 6 core features
  - "How It Works" section with 3-step process
  - "Why Choose MasterMath?" benefits section with checkmarks
  - Final CTA section encouraging users to start solving
  - Fully responsive design with dark mode support
  - Home navigation link added to sidebar (first position)

- **SEO Optimization**
  - Comprehensive meta tags in index.html (title, description, keywords, author)
  - Open Graph tags for Facebook/LinkedIn social sharing
  - Twitter Card meta tags for Twitter previews
  - Canonical URL and theme color configuration
  - Schema.org JSON-LD structured data for Google rich snippets
  - Dynamic page-specific titles using custom `usePageTitle` hook
  - Sitemap.xml for search engine crawling
  - Robots.txt for crawler instructions

- **Developer Experience**
  - Custom `usePageTitle` hook for SEO-friendly page titles
  - Completely rewrote CLAUDE.md with accurate, comprehensive documentation
  - Documented all 7 pages, IndexedDB implementation, math solvers, and architecture

### Changed
- **Sidebar UX Improvement**
  - Sidebar now starts collapsed by default for better first impression
  - Updated `SidebarProvider` to accept `defaultOpen` prop
  - Improved mobile and desktop user experience

- **Branding Consistency**
  - Updated all references from "MasterMath" to "MasterMath"
  - Updated UserManual.jsx, PrivacyPolicy.jsx with consistent branding
  - Updated Layout.jsx header and footer

- **Page Titles** (SEO-optimized)
  - Home: "Master Math with Confidence - Free Math Solver"
  - Solver: "Solver - Step-by-Step Math Solutions"
  - Progress: "My Progress - Track Your Learning Journey"
  - User Manual: "User Manual - How to Use MasterMath"
  - Privacy Policy: "Privacy Policy - Your Privacy Matters"
  - Terms of Service: "Terms of Service - Usage Guidelines"
  - Feedback: "Feedback & Support - We'd Love to Hear From You"

### Fixed
- Feedback form for user reports and suggestions
- Enhanced documentation for open source release
- Improved Terms of Service with comprehensive accuracy disclaimers

## [1.0.0] - 2025-10-05

### Added
- **Core Math Solver Engine**
  - Derivatives and differentiation with step-by-step explanations
  - Integrals and integration with detailed processes
  - Limits calculations with mathematical reasoning
  - Algebra solver for equations and simplification
  - Trigonometry function solutions
  - Functions and graphing capabilities
  - Arithmetic operations support

- **Educational Features**
  - Step-by-step solution breakdowns
  - Educational tips and learning guidance
  - Common mistakes warnings
  - Mathematical concept explanations

- **User Interface**
  - Clean, modern React-based interface
  - Dark/light mode toggle
  - Responsive design for all devices
  - Intuitive problem input system
  - Topic selection for targeted solving

- **Privacy & Security**
  - 100% client-side processing
  - No data transmission to servers
  - Local storage for problem history
  - No user accounts required
  - Privacy-focused architecture

- **Visualization**
  - Interactive graph generation
  - Function plotting and analysis
  - Mathematical visualization tools
  - Recharts integration for data display

- **Progress Tracking**
  - Local problem history storage
  - Progress monitoring and analytics
  - Export functionality for solutions
  - Learning journey tracking

- **Accessibility**
  - ARIA labels and semantic HTML
  - Keyboard navigation support
  - Screen reader compatibility
  - High contrast mode support

### Technical Implementation
- **Frontend**: React 18.3.1 with Vite build system
- **Math Libraries**: Algebrite, MathJS, mathsteps integration
- **Styling**: Tailwind CSS with custom components
- **Icons**: Lucide React icon library
- **Charts**: Recharts for data visualization
- **Animation**: Framer Motion for smooth interactions

### Documentation
- Comprehensive user manual
- Privacy policy and terms of service
- Mathematical accuracy disclaimers
- Educational usage guidelines

---

## Version History Notes

### Development Approach
This project was developed using AI-assisted programming techniques, demonstrating modern collaborative development between human vision and AI implementation. The core educational philosophy and user experience design remained human-driven, while AI assistance accelerated implementation and feature development.

### Educational Mission
MasterMath was created to serve as a learning companion that promotes understanding over quick answers. The tool emphasizes the importance of verifying solutions independently and using the application as a supplement to traditional learning methods.

### Open Source Release
Version 1.0.0 marks the initial open source release of MasterMath, making this educational tool freely available to students, educators, and developers worldwide.

---

## Future Roadmap

### Planned Features
- Additional mathematical topics (differential equations, linear algebra)
- Enhanced graph customization options
- Collaborative features for educators
- Multiple language support
- Improved mobile experience
- Advanced export formats (PDF, LaTeX)

### Educational Enhancements
- Interactive tutorials and guided learning paths
- Adaptive difficulty based on user progress
- Integration with common curricula standards
- Enhanced explanations for different learning styles

### Technical Improvements
- Performance optimizations
- Extended browser compatibility
- Offline progressive web app capabilities
- Enhanced accessibility features

---

*For the complete history of changes, see the [GitHub releases page](https://github.com/sparkinCreations/MasterMath/releases).*
