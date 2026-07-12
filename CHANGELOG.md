# Changelog

All notable changes to MasterMath will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
