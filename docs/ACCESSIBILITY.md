# Accessibility

**Target:** WCAG 2.1 Level AA.
**Status (13 October 2026, v1.40.5):** every criterion a tool can check passes
on every page in light and dark mode; the criteria that need a human have been
checked by hand on the Solver, Home and Progress pages as recorded below. This
is a statement of what was tested, not a certification.

## What runs on every push

`e2e/a11y.spec.js` runs [axe-core](https://github.com/dequelabs/axe-core)
(WCAG 2.0/2.1 A and AA rules) against the production build on all nine pages,
in light and dark mode, and on the Solver page showing a validation error and
showing a solution with a graph. Any violation fails the build. This covers,
among others: colour contrast (1.4.3), non-text content (1.1.1), info and
relationships (1.3.1), name/role/value (4.1.2), language of page (3.1.1),
bypass blocks (2.4.1), labels (3.3.2), and parsing/ARIA validity.

## Checked by hand

| Criterion | How | Result |
|---|---|---|
| 2.1.1 Keyboard | Tab through the Solver page; open and close the topic list with Enter/Escape; solve with Enter | Pass. Order: skip link → menu → logo → dark mode → topic → problem → examples → Solve. A disabled Solve is skipped, as it should be. |
| 2.4.3 Focus order | Same walk | Pass — follows the visual order. |
| 2.4.7 Focus visible | Computed style of the focused control after keyboard focus | Pass — 3 px outline on every control. |
| 1.4.10 Reflow | Viewport at 320 px: Home, Solver (with a solution and graph), Progress | Pass — no horizontal scrolling; the graph and tables fit. |
| 1.4.4 Resize text | 320 px viewport is the 200 % case for a 640 px layout; text is rem-based | Pass. |
| 4.1.3 Status messages | Solving ("Calculating the solution…"), outcomes (toasts), validation error | Pass — polite `role="status"` while solving; toasts are `status`/`alert` live regions; the error is `role="alert"` and tied to the field with `aria-describedby`/`aria-invalid`. |
| 1.4.1 Use of colour | Solution status, graph markers | Pass — status has a text label; graph markers are also named in the text description. |
| 2.3.3 Animation (AAA, but honoured) | `prefers-reduced-motion` | Honoured: step animations are disabled. |

## Maths for screen readers

KaTeX renders with `htmlAndMathml`; the visual layer is `aria-hidden` and the
MathML is what a screen reader reads. `MathText.jsx` documents why this must
not change. Every graph has a text description of its features
(`graphDescription.js`) rendered beside it.

## Screen-reader walk (accessibility tree)

On 13 October 2026 a full solve was walked through Chromium's accessibility
tree — the data VoiceOver and NVDA consume — in reading order:

- **Form:** combobox "What are you working on? Select a topic"; textbox
  "Enter your problem"; every example button named by its problem.
- **Invalid input:** alert "Please enter a valid math problem"; the textbox
  is `aria-invalid` and described by that text.
- **Solving:** the polite status region announces "Calculating the
  solution…" and clears; afterwards focus moves to the region named
  "Solution", and the toast "Problem solved!" is a status live region.
- **Solution:** h2 "Solution & Explanation", h3 per section; each step reads
  "Step 1 Subtract 5 from both sides: 2x = 6" with the maths as MathML
  (`math: 2 x = 6`, `math: x = 3`); the visual KaTeX layer is hidden from the
  tree; the TeX annotation is not exposed (no double reading).
- **Graph:** `role="img"` named "Graph of 2x + 5. Line chart with 1 key
  feature marked: Solution marked at x = 3."; the ten controls are named
  (Pan left … Reset view).
- **Progress:** stats as heading + value; Clear History opens a dialog named
  "Clear All History", focus lands on Cancel, Escape closes it and focus
  returns to the Clear History button.

On 22 October 2026 (v1.53.0, when tips, mistakes, the example buttons and
the history list were typeset) the tree was read again:

- **Example buttons** are named by the typed problem ("Algebra: 2*x + 5 =
  11", what clicking puts in the box); the typeset maths inside is MathML.
  The input preview stays `aria-hidden` (the textbox is the content).
- **Typed pi was read "p i"**: "sin(pi/4)" was set as the letters p and i,
  on the buttons, in history and in an integral's answer. It is π now.
- **Steps were not a list**: "Step 1" then a paragraph, so a reader could
  not hear the count or move step to step. They are an ordered list.
- **History was not a list**: each entry's topic and date floated free of
  its problem. It is a list, one item per problem.
- **Tips and mistakes** carry MathML for their formulas, like the steps.

- **Double announcements**: every page and state (the topic list, the
  Symbols strip, the notation guide, a solution with its graph, the export
  menus, the clear-history dialog, step-through, the phone navigation) was
  checked for a control announced twice. Three were: the graph controls
  and Symbols buttons (an aria-label and an identical title, which Chrome
  passes on as a description), the typeset example buttons (their MathML
  after their name), and the selected angle unit in Settings (its tooltip
  repeated the text below it). All fixed; "nothing on the Solver or
  Settings is announced twice" in the a11y spec keeps it so.

`e2e/a11y.spec.js` ("typeset maths for screen readers") checks that every
KaTeX run on the page has MathML and a hidden visual layer, the button
names, both lists, and audits Progress with history in both themes.

Two things this found were fixed in v1.40.5: the logo image inside the home
links had a non-empty `alt`, so readers heard "MasterMath Logo MasterMath by
sparkinCreations…" (now decorative), and step numbers were a bare "1" (now
"Step 1" to a reader).

## Not yet verified

- **A listening test** with VoiceOver or NVDA. The tree is right; what is not
  known is how each reader *speaks* the MathML — in particular whether a
  fraction such as 6/2 is read "6 over 2" (VoiceOver with Safari reads MathML
  natively; Chrome exposes it differently) and whether the ≈ in approximate
  roots is spoken. A five-minute script:
  1. Safari, VoiceOver on (⌘F5). Open mastermath.app/solver.
  2. Tab to the topic combobox — expect "What are you working on? Select a
     topic". Choose Algebra. Tab to the problem box — expect "Enter your
     problem". Type `hello world`, Tab to Solve, press it — expect the alert
     "Please enter a valid math problem" to be spoken.
  3. Replace the text with `2*x + 5 = 11` and press Solve — expect
     "Calculating the solution…", then "Problem solved!", and focus on
     "Solution".
  4. Read down with VO-→ — expect "Step 1 Subtract 5 from both sides,
     2 x equals 6", "Step 2 Divide both sides by 2, x equals 6 over 2 equals
     3", then "Final Answer, x equals 3". Note how "6 over 2" is actually
     read.
  5. Solve `x^41 - x = 1` — expect "x approximately equals 1.0173" (or how
     the reader renders ≈), then "plus 40 complex solutions".
  6. Navigate to Progress; activate Clear History — expect "Clear All
     History, dialog", focus on Cancel; press Escape — expect focus back on
     Clear History.
- **1.4.12 Text spacing** (user stylesheet overrides) and **1.4.13 Content on
  hover** (the graph tooltips) have not been tested.
- **2.5.8 Target size** is a WCAG 2.2 criterion, outside the 2.1 target; the
  graph's icon controls are 32 px and would need checking against it.

## Reporting

Accessibility problems are bugs. Report them through the Feedback page or
`security@sparkincreations.com`.
