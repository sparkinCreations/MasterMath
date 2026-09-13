# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**MasterMath** is a React-based educational math application that helps students solve math problems with step-by-step solutions and visual feedback. The application uses local JavaScript math libraries (not AI) to generate solutions, explanations, and graphs, with all data stored locally in the browser using IndexedDB.

## Architecture

### Component Structure

The application follows a modular architecture with clear separation of concerns:

- **Layout.jsx**: Main application layout with sidebar navigation using shadcn/ui components. Includes dark mode toggle, header with branding, footer with links, and navigation between all pages. Uses React Router for routing with `createPageUrl` utility from `@/utils`.

- **App.jsx**: Root component that wraps the application with providers (DarkModeProvider, ToastProvider, ConfirmProvider) and defines all routes including Solver, Progress, UserManual, PrivacyPolicy, TermsOfService, and Feedback.

- **Pages/**: Top-level page components
  - `Solver.jsx`: Main problem-solving interface with ProblemInput, SolutionDisplay, and GraphViewer components. Handles solving logic and saves to IndexedDB.
  - `Progress.jsx`: User progress tracking page showing statistics (total problems, this week, topics covered), problem history with filtering by topic/date, export functionality (PDF, CSV, JSON, Markdown), and clear history button with confirmation.
  - `UserManual.jsx`: User documentation and help page
  - `PrivacyPolicy.jsx`: Privacy policy information
  - `TermsOfService.jsx`: Terms of service
  - `Feedback.jsx`: User feedback and support page

- **Components/solver/**: Solver-specific UI components
  - `ProblemInput.jsx`: Input form with topic selection dropdown (derivatives, integrals, limits, functions, trigonometry, algebra, other/arithmetic), problem textarea with dynamic placeholders, solve button with loading state, and example problems for each topic.
  - `SolutionDisplay.jsx`: Displays step-by-step solutions with Framer Motion animations, final answer, key insights (tips), common mistakes to avoid, and export buttons (PDF, JSON, Markdown).
  - `GraphViewer.jsx`: Renders mathematical function graphs using Recharts. Accepts `functionData` prop with `points` array (x, y coordinates), `title`, and optional `description`.

- **Contexts/**:
  - `DarkModeContext.jsx`: Provides dark mode state and toggle function, persists to localStorage, defaults to light mode.

- **Entities/**: Data schema definitions
  - `ProblemHistory.json`: JSON schema for problem history storage in IndexedDB. Properties include `id` (auto-increment), `problem`, `topic`, `solution`, `feedback`, and `createdAt` timestamp.

### UI Library

The app uses **shadcn/ui** components with Tailwind CSS for styling. All UI components are imported from `@/components/ui/` including:
- Button, Card, Textarea, Select, Label
- Sidebar (with SidebarProvider, SidebarContent, SidebarMenu, etc.)
- Toast (for notifications)
- ConfirmDialog (for confirmations)
- DropdownMenu (for export options)

The design features:
- Gradient backgrounds (blue/purple/green)
- Modern, colorful styling with purple/blue/green color scheme
- Dark mode support throughout
- Responsive layout with mobile support

### Key Dependencies

**UI & Routing:**
- **React Router**: Client-side routing with `createPageUrl` utility
- **Recharts**: Data visualization for function graphs
- **Framer Motion**: Animations for solution display
- **Lucide React**: Icon library
- **shadcn/ui + Tailwind CSS**: UI component library and styling. Tailwind 4: configuration is CSS-first in `src/index.css` (`@import "tailwindcss"`, `@theme` for the radius scale, `@custom-variant dark` for class-based dark mode, and a v3 border-colour compatibility layer) — there is no `tailwind.config.js`; PostCSS uses `@tailwindcss/postcss`.

**Math Libraries:**
- **mathjs**: Core math operations and expression parsing. Both instances are built in `src/lib/mathInstance.js` from an explicit dependency list (not `create(all)`) so matrices, units and statistics tree-shake out; add a function there AND to the battery in `tests/mathInstance.test.js`. Floor is ~865 kB because every function in the full entry pulls BigNumber and Matrix through the typed core; the number-only entry lacks Complex/Fraction/polynomialRoot.
- **algebrite**: Symbolic algebra, calculus, and simplification
- **mathsteps**: Step-by-step algebraic simplification. Unmaintained (v0.2.0) and once confidently wrong, so it is reached only through the two guarded entry points in `mathstepsUtils.js` (`mathstepsSolveEquation`, `mathstepsSimplify`) — never throw, kill switch `setMathstepsEnabled(false)`, every caller has an exact Algebrite fallback; `tests/mathstepsSeam.test.js` enforces the single import and the fallback.

**Export & Storage:**
- **jspdf**: PDF generation for exports
- **IndexedDB**: Browser-based local storage (via custom `indexedDB.js` utility)

## Data Flow

1. User selects topic and enters problem in `ProblemInput` component
2. On solve, `solveProblem()` in `api.js`:
   - Extracts mathematical expression from natural language using `mathParser.js`
   - Routes to appropriate solver based on topic (algebra, derivatives, integrals, limits, trigonometry, functions, arithmetic)
   - Each solver uses mathjs, algebrite, or mathsteps to compute solution
3. `SolutionDisplay` renders the solution with steps, answer, tips, and common mistakes
4. `GraphViewer` visualizes function data if available (points array with x/y coordinates)
5. Problem saved to IndexedDB via `createProblemHistory()` with problem, topic, solution, feedback, and timestamp
6. Progress page loads all problems from IndexedDB and displays statistics, history, and export options

## Storage Architecture

### IndexedDB Implementation (`src/lib/indexedDB.js`)

The app uses **IndexedDB** for local, browser-based storage (no backend API):
- Database name: `MathMasterDB` (legacy pre-rebrand name, kept so existing users' saved history is not orphaned — IndexedDB databases are identified by this string)
- Object store: `problemHistory`
- Schema: Auto-incrementing `id`, with indexes on `topic` and `createdAt`
- Functions:
  - `initDB()`: Initialize database
  - `getAllProblems()`: Fetch all problems (sorted by date descending)
  - `addProblem(data)`: Add new problem with auto timestamp
  - `updateProblem(id, data)`: Update existing problem
  - `deleteProblem(id)`: Delete problem
  - `clearAllProblems()`: Clear entire history
  - `getProblemsByTopic(topic)`: Filter by topic

### API Layer (`src/lib/api.js`)

Wraps IndexedDB functions and provides:
- `fetchProblemHistory()`: Get all problems
- `createProblemHistory(data)`: Add new problem
- `updateProblemHistory(id, data)`: Update problem
- `clearProblemHistory()`: Clear all
- `solveProblem(problem, topic)`: Main solving logic that routes to appropriate solver

## Math Solvers

### Solver Architecture (`src/lib/solvers/`)

Each solver module exports a solve function that returns a consistent solution object:

```javascript
{
  steps: string[],              // Step-by-step solution
  answer: string,               // Final answer
  tips: string[],               // Key insights
  common_mistakes: string[],    // Common mistakes to avoid
  graph: {                      // Optional graph data
    points: [{x, y}, ...],
    title: string,
    description: string,
    annotations: {              // Optional markers rendered by GraphViewer
      extrema: [{x, y, kind}],  // kind: "max" | "min"
      intercepts: [{x, y: 0}],
      yIntercept: {x: 0, y},
      verticalAsymptotes: [x],
      holes: [{x, y}],          // removable discontinuities: hollow marker labelled "hole"
      guideline: {x, label},    // limits: the approach point
      limitPoint: {x, y},       // limits: hollow marker at (a, L)
      shaded: {from, to, fromLabel, toLabel},  // definite integrals: shaded area over [a,b]
      intersection: {x, y, label},  // systems: the solution point where two lines cross
      shadedRegions: [{from, to}],  // inequalities: x-ranges where it holds (±Infinity clamped to the window)
      openPoints: [{x, y, label, series}]  // hollow markers a curve approaches but does not take (one-sided derivative values at a corner); series "secondary" puts them on the dashed curve
    },
    initialWindow: {xMin, xMax}, // optional non-default starting view
    expression: string,          // optional: the viewer re-samples the curve for the window on screen (400 points per window, gaps at every break) instead of filtering `points`
    secondaryExpression: string, // the dashed curve (f′, F), re-sampled likewise
    variable: string,
    breaks: [x], secondaryBreaks: [x] // x values where a curve is undefined (a null point is inserted there); vertical asymptotes are breaks automatically
  }
}
```

**Graph sampling (`src/lib/graphSampling.js`):** `sampleCurve` (re-sampling with explicit gaps, unnamed-pole detection), `featureWindow` (the window framing a set of feature x-values), `annotationFeatureXs` (the "Fit key features" control), `interestingXs` (numeric zeros/extrema/inflections for solvers with no exact feature list). GraphViewer opens on `initialWindow`, else the feature window when the graph can be re-sampled, else ±10; it adds a right-hand y-axis for the dashed curve when the two visible ranges differ by more than 4× (toggleable).

**Available Solvers:**
- `algebraSolver.js`: Equations, simplification, factoring (using mathsteps, algebrite). Quadratics show their working (`quadraticDerivation`: x² = c and ±√, or a, b, c, discriminant, formula); one square root of the variable takes `solveViaRadicalIsolation` (isolate, domain, square, solve, check every candidate and reject the extraneous one with the reason). Every mathsteps solution is substituted back into the original equation before it is trusted (mathsteps "factored" x² − 2x − 1 as (x − 1)²); rational equations are cleared of denominators before the exact root path; polynomials in e^x — or in a^x for a numeric base a — are solved via u = e^x (`solveViaExpSubstitution`: `2^x = 10` → `ln(10)/ln(2)`); equations in logarithms via `solveViaLogSubstitution` (one argument: u = ln(g), solve, back-substitute; several: combine by the log rules into one log, rewrite in exponential form, solve the polynomial; every candidate must keep every argument positive and balance the original — `ln(x) = 1` → `e (≈ 2.7183)`, `log(x) + log(x − 3) = 1` → `5` with `−2` rejected); radicals display as √n.
- `systemsSolver.js`: Systems of two linear equations in two unknowns — Cramer's rule in exact rational arithmetic — and three in three (`solve3x3`: Gaussian elimination in mathjs fractions, every row operation shown, rank/consistency trichotomy, verified against the original equations before it is reported). Cramer's rule in exact rational arithmetic (18/5, not 3.6), worked substitution steps, and the unique / no-solution (parallel) / infinitely-many (same line) trichotomy. The solution is substituted back into both equations before it is reported. Receives the raw problem text (routed from api.js when it detects two `=` signs) so the first equation isn't mangled by single-expression extraction. Non-linear 2×2 systems (line ∩ parabola or circle, `xy = 6; x + y = 5`) are solved by substitution when one equation is linear in some variable: isolate it, substitute, take Algebrite's exact roots, back-substitute, and verify every pair against both equations; two general conics are refused.
- `inequalitiesSolver.js`: Single-variable inequalities (`<`, `>`, `≤`, `≥`) by the sign-chart method — move to one side, find zeros (numerator roots) and breaks (denominator roots), test the sign on each interval, and read off the solution with correct open/closed endpoints (roots closed for ≤/≥, poles always open). Handles linear, polynomial, and rational inequalities; reports all-reals / no-solution / single-point cases; solves compound inequalities — chains `a < f(x) ≤ b` and `and`/`or` pairs — by solving each part and intersecting or uniting the solution sets (a chain pointing both ways, `a < x > b`, is refused). Routed from api.js when the raw text contains a comparison operator.
- `derivativesSolver.js`: Differentiation (using algebrite). `k·|ax + b|` takes `solveAbsLinear` — piecewise rewrite, each branch differentiated, one-sided derivatives compared at the corner, `f'(x₀) does not exist` (never sgn(0) = 0); other abs uses keep sgn and say where f′ does not exist. `derivativeDomain` appends `x ≠ a` / `x > a` from the poles of f′ and linear root/log restrictions (`1/x → −1/x², x ≠ 0`). `classifyDerivativeRule` labels the rule per term (power / negative-exponent power / exponential / logarithmic differentiation / product / quotient / chain, incl. reciprocal and a^u); `workedRuleSteps` then shows the interior — product and quotient name u and w and their derivatives and assemble the formula; chain names the inner u, gives the outer derivative from a table (`OUTER_DERIVATIVES`) and the inner derivative, then substitutes back. Orders up to 4 (`options.order`), `options.variable` for "with respect to", `options.evalAt`. Results write ln/e^ (`lnify`).
- `integralsSolver.js`: Integration (using algebrite) — indefinite antiderivatives (direct / substitution / by-parts / partial fractions over distinct real linear factors via `integrateByPartialFractions` (cover-up, decomposition and antiderivative both verified) / abs), definite integrals, and improper integrals to ±∞ (`solveImproperInfinite`: F from the per-term machinery, `limitAtInfinity` samples F at 10²…10⁸ and classifies converge / diverge (incl. slow ln-type growth) / oscillate; exact value when the limit is a nameable constant, e.g. `∫₀^∞ e^(−x²) dx = √π/2`; cross-checked by quadrature over a long finite stretch). Definite integrals (`∫_a^b f dx` via the Fundamental Theorem of Calculus, exact value cross-checked by Simpson's-rule quadrature; an interior singularity is split at the pole and tested by one-sided limits of F — reported as divergent when either fails, summed when both converge). Integrates term by term so each term can take its own path. Receives the raw problem text (like limits) so it can read definite-integral bounds before notation is normalized.
- `byPartsSolver.js`: The integration-by-parts walkthrough engine. Drives `∫u dv = uv − ∫v du` on Algebrite's single-step derivative/integral primitives via a linear accumulator (`I = boundary + coeff·∫current`), so it can *show* the u/dv derivation and compute the two families Algebrite fails outright — repeated by-parts (`x³·sin x`) and cyclic by-parts (`eˣ·sin x`, solved algebraically when the integral reappears). u is chosen by LIATE; every antiderivative is differentiated back and checked before it's trusted. `integralsSolver` calls it per term.
- `substitutionSolver.js`: u-substitution for integrands of the shape `g′(x)·h(g(x))` — candidate inner functions are the arguments of function calls, the calls themselves (`sin(x)`, `ln(x)`), power bases and `e^(…)` exponents; for each, the integrand is divided by `g′(x)` and rewritten in `u`, and if `x` has vanished it is integrated in `u`, back-substituted, and **verified by differentiation** (symbolic, then numeric). Also `∫c·|ax+b| dx = c·(ax+b)·|ax+b|/(2a) + C` with exact fractional coefficients, since Algebrite has no `abs`. `integralsSolver` tries substitution before by-parts for products (x·e^(x²) is not a by-parts problem) and after the direct attempt otherwise.
- `arithmeticSolver.js`: Basic arithmetic operations (using mathjs). `showWorking` evaluates one operation at a time in PEMDAS order on the mathjs parse tree and prints the expression after each; `describeOrder` is the fallback.
- `otherSolvers.js`: Limits, trigonometry (using mathjs, algebrite)
- `trigEquationSolver.js`: Trigonometric equations of the form `A·f(kx) + B = C` — plus, via `solveReducibleTrig`, three shapes that reduce to it: a quadratic in one function (`2sin²x − sin x − 1 = 0` → u = 1 or −1/2, each case solved by the linear path and the results merged), `a·sin + b·cos = 0` → `tan = −a/b`, a Pythagorean rewrite (`sin²x + cos x = 1` → `1 − cos²x + cos x = 1`), `a·sin + b·cos = c` by the auxiliary angle (R·sin(θ+φ)), and `f(A) = f(B)` with two different linear arguments (`solveEqualArguments`: sin → equal/supplementary, cos → ±, tan → +πn, mixed via the cofunction identity). Base family for f ∈ {sin, cos, tan} — isolates the trig term (linear-in-u check), gives the reference angle exactly for special values (π/6, √3/2, …), the full general solution (`x = π/6 + 2πn or 5π/6 + 2πn`), the solutions on [0, 2π), and a graph of the curve against `y = c` with the solutions marked. Every listed solution is substituted back before it is reported. Out-of-family equations (sin²x, sin x = cos x, sin(x²)) are refused as *unsupported*, never mis-solved. Reached from `solveTrigonometry` whenever the input is an equation — mathjs parses `sin(x) = 1/2` as a function *definition* and returns a function object, so an equation must never reach `math.evaluate` — and from the Algebra topic for single trig equations (falling through to the numeric root scan when out of family).

**Routing by intent (`solveProblem` in `api.js`):** the topic dropdown is a hint, not a command. Before any topic-specific path runs, the input's own signals are read: derivative notation (`d/dx`, "derivative of", `dy/dx`), integral notation (`∫`, "integrate"), and limit notation (`lim`, `->`, "approaches") route to that solver under *any* topic; a single equation in one unknown routes to Algebra from any topic that doesn't own equations (trig equations stay in Trigonometry; `f(x) = …`/`y = …` stay in Functions); a variable expression under Arithmetic goes to Algebra. A routed result's first step says so ("Solved as Derivatives (you chose Algebra): the input uses derivative notation"). Before this, `d/dx x^3` under Algebra "simplified" to `x^3` and `x^2 = 4` under Integrals became `∫(x^2=4) dx = nil*x + C`.

**Evaluation points (`extractEvalPoint` in `api.js`):** a trailing "at x = a" / "when x = π/4" is stripped from the raw text *before* routing (its `=` would otherwise make `x^2 at x = 1.5` look like an equation in a, t and x). Under derivative intent it becomes `solveDerivative(expr, { evalAt })` — the derivative is evaluated at the point, exact via Algebrite `subst` with a decimal alongside (`f'(1) = cos(1) ≈ 0.5403`); under Algebra/Functions/Arithmetic/Trigonometry a plain expression is substituted and evaluated (`f(3) = 10`).

**Settings (`settings.js`):** `decimalPlaces` flows through `formatNumber` (default arg) so every solver honours it. `angleUnit` is read only by trigonometry: it decides how plain-number angles are *read* (`sin(0.5)`, decimals included) and how angle *results* are reported — `arcsin(0.3)` → `17.4576°`, and `trigEquationSolver` renders the whole solution (reference angle, general solution, `[0°, 360°)` listing, graph x-axis) in degrees when the unit is degrees. Calculus solvers always work in radians. Routed results carry `routedTopic`, and history saves under it.

**Result gate (`finalizeResult` in `api.js`):** every solver's output passes through it. Besides enforcing the envelope status, it refuses any answer or step that is not presentable text — a function/object/array, or a string shaped like source code — and returns an honest `unsupported` envelope instead. It is the last line of defence against engine internals reaching the screen; the pattern is deliberately code-specific so prose like "return to the original variable" is never mistaken for a leak.
- `functionsSolver.js`: Function analysis/graphing — exact extrema via f'(x)=0, root-based intercepts, domain & asymptote detection (never fabricates a feature)

### Math Parser (`src/lib/mathParser.js`)

Utilities for parsing and cleaning user input:
- `parseMathExpression(input)`: Converts common notation to JS-friendly format (x² → x^2, 2x → 2*x, etc.)
  - A bare `log(…)` is the **common logarithm, base 10** (`rewriteCommonLog` turns it into `log(…)/log(10)` because mathjs and Algebrite both name the *natural* log `log`); `ln` is natural; `log(x, b)`, `log_b(x)`, `log10`, `log2` name their base. `usesCommonLog` tells `finalizeResult` to add `COMMON_LOG_TIP` so the user sees the convention. A typed `log(A)/log(B)` is left in place only as a *plain* ratio — nothing binding more tightly to either log than the division between them (`isPlainLogRatio`; `log(A)/log(10)^2`, `2^log(A)/log(B)` and `x/log(A)/log(B)` are read log by log) — and a bare log nested inside it is still rewritten.
- `extractFunctionFromProblem(text)`: Extracts math expression from natural language
- `extractVariable(expr)`: Finds main variable (usually x)
- `isEquation(expr)`: Checks if expression is an equation (contains =)

## Export Functionality

### Export Utilities (`src/lib/exportUtils.js`)

**Progress History Exports:**
- `exportAsCSV(problems, topicLabels)`: CSV with date, topic, problem, solution
- `exportAsJSON(problems)`: JSON array of all problems
- `exportAsMarkdown(problems, topicLabels)`: Markdown grouped by topic
- `exportAsPDF(problems, topicLabels)`: PDF using jsPDF

**Individual Solution Exports:**
- `exportSolutionAsMarkdown(problem, topic, solution, topicLabels)`: Single solution as Markdown
- `exportSolutionAsJSON(problem, topic, solution)`: Single solution as JSON
- `exportSolutionAsPDF(problem, topic, solution, topicLabels)`: Single solution as PDF

All exports trigger browser downloads with appropriate filenames and timestamps.

## Development Commands

- **Install dependencies**: `npm install`
- **Start dev server**: `npm run dev` (opens at http://localhost:5173)
- **Build for production**: `npm run build`
- **Preview production build**: `npm run preview`
- **Run tests**: `npm test` (node --test; keep all tests green before pushing)

## Release Process (REQUIRED)

Every push to `main` deploys to production (Netlify builds from source per
`netlify.toml`). **Any push that changes what the deployed app does or looks
like MUST include, in the same push:**

1. **A version bump** in `package.json` following semver:
   - patch (x.y.Z) — bug fixes only
   - minor (x.Y.0) — new features, no breaking changes
   - Run `npm install --package-lock-only` after editing so the lockfile
     version stays in sync.
2. **A dated `CHANGELOG.md` entry** under the version heading (Keep a
   Changelog format: Added / Changed / Fixed), inserted above the previous
   release and below `## [Unreleased]`.

App-affecting means changes to `src/`, `public/`, `index.html`,
`vite.config.js`, `postcss.config.js`, or dependencies. Docs-only, test-only,
or repo-housekeeping pushes do **not** need a version bump.

The version is single-sourced from `package.json`: the footer (`Layout.jsx`),
the Settings About card, and the service-worker cache stamp
(`stampServiceWorker` in `vite.config.js`) all read it automatically — never
hardcode a version string anywhere else. The commit-stamped service worker is
also what makes the in-app update banner fire, so a forgotten version bump
still deploys safely; the bump is for humans (changelog, footer, releases).

## Important Notes

### Path Aliases
- Components use the `@/` path alias for imports (e.g., `@/components/ui/button`, `@/lib/api`)
- Configured in Vite/bundler settings

### Data Structures
- **Solution objects** must include: `steps[]`, `answer`, `tips[]`, `common_mistakes[]`, `graph` (optional)
- **Graph data** must include: `points[]` (with x, y properties), `title`, `description` (optional)
- **Topic values**: "derivatives", "integrals", "limits", "functions", "trigonometry", "algebra", "other" (arithmetic)
- **Topic labels**: Map internal values to display names (e.g., "other" → "Arithmetic")

### Storage Considerations
- All data stored in browser's IndexedDB (persistent across sessions)
- No backend API - fully client-side application
- Users can clear history via UI (with confirmation)
- Export functionality for data portability

### Styling Conventions
- Primary colors: Blue (#3B82F6) and Purple (#9333EA)
- Accent colors: Green, Orange, Amber
- Gradient backgrounds throughout
- Dark mode: Uses Tailwind's `dark:` prefix, controlled by DarkModeContext
- All components support dark mode

### Math Input Format
- Use `*` for multiplication (2*x, not 2x - though parser handles both)
- Use `^` for exponents (x^2, not x²)
- Use standard function names: sin, cos, tan, sqrt, ln, log, exp, abs
- Parser handles common notation and natural language

### Branding
- App name: **MasterMath** (not MathMaster)
- By: sparkinCreations™
- Tagline: "Master math with confidence"
- Positioning: step-by-step local solver (open-source math libraries, not AI) — never "personal math tutor" / AI chatbot framing
- Links to sparkincreations.com in footer
