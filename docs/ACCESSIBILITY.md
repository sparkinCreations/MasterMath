# Accessibility

**Target:** WCAG 2.1 Level AA.
**Status (12 October 2026, v1.40.2):** every criterion a tool can check passes
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

## Not yet verified

- **Screen-reader walkthrough** with VoiceOver or NVDA of a full solve. The
  markup is right by inspection and by axe; a listening test has not been done.
- **1.4.12 Text spacing** (user stylesheet overrides) and **1.4.13 Content on
  hover** (the graph tooltips) have not been tested.
- **2.5.8 Target size** is a WCAG 2.2 criterion, outside the 2.1 target; the
  graph's icon controls are 32 px and would need checking against it.

## Reporting

Accessibility problems are bugs. Report them through the Feedback page or
`security@sparkincreations.com`.
