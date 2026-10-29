# MasterMath — Plan: More Insights, Sources, and "Learn More" Links

**Version referenced:** 1.59.0
**By:** sparkinCreations™
**Written:** October 29, 2026
**Status:** In progress: 1.60.0 is "Show more", sources, "Learn more" links and the integrals pilot ([review](insights-review/INTEGRALS.md)); 1.61.0 is derivatives ([review](insights-review/DERIVATIVES.md)); 1.62.0 is algebra ([review](insights-review/ALGEBRA.md)). Decisions: the four proposed sites plus Wolfram|Alpha (example pages only, since its step-by-step needs Pro); integrals as the pilot; a review document before each topic ships.
**Do after:** [`PLAN-FILE-SPLIT.md`](PLAN-FILE-SPLIT.md), which moves each solver's tips into its own `guidance.js`

---

## Where this came from

Every solution shows three Key Insights and two or three Common Mistakes,
chosen by the method used (about 80 methods; `tests/tipsByMethod.test.js`).
The owner asked for more of them, a source wherever one is due, and links
to outside lessons.

### Decided against: rotating tips at random

The first idea was a pool of nine per method with three picked at random on
each solve, so repeat problems would show different tips. It was dropped:

- Two students, or a teacher and a class, would see different advice for
  the same problem.
- Chance could hide the one insight that matters most for the method.
- A pool of nine for every method is about 1,400 items, inviting filler.

The plan below keeps every solution the same for everyone and puts the
extra material one tap away.

## 1. "Show more" for Key Insights and Common Mistakes

- Each method's lists are ranked, most important first. The first three of
  each show as today.
- When a list has more, a button follows it: "Show 4 more insights",
  "Show 2 more mistakes". It reveals the rest in place; "Show fewer" folds
  them back.
- No randomness: the same problem always gives the same lists in the same
  order.
- A method with three or fewer looks exactly as it does now. Nothing
  changes on screen until a method gets more content.
- No fixed number. A method gets as many as are genuinely useful.
- Exports (PDF, Markdown, JSON) and history keep the whole list. They
  already print every item; only the page shows the first three.
- Accessibility: the button names its count and has `aria-expanded`; focus
  stays on it.

**Code:** the lists are already ordered arrays and every renderer maps all
of them (`SolutionDisplay.jsx`, `exportUtils.js`, `pdfTypeset.js`). The
change is the page showing the first three with a button.

## 2. Sources

- Everything is written in MasterMath's own words. Nothing is copied.
- An insight that uses a named idea, mnemonic or result from a specific
  source carries a short "Source:" link under it, opening in a new tab.
  First case: LIATE, from Herbert E. Kasube, "A Technique for Integration
  by Parts", *American Mathematical Monthly* 90 (1983). Exports print the
  source.
- Standard textbook facts carry no citation.
- **Code:** a tip or mistake may be a string (as now) or
  `{ text, source: { title, url } }`. `finalizeResult`, the renderers and
  the typesetting tests read the text through one helper.

## 3. "Learn more" links

- A short section under each solution, chosen by topic. Links to the page
  for the exact method (integration by parts, say) can come later, once
  topic-level links prove easy to keep current.
- **Proposed sites**, chosen because they are free to read, need no
  account, and have no affiliation with MasterMath:
  - Khan Academy: lessons and practice
  - Paul's Online Math Notes (Lamar University): notes for Algebra through
    Calculus
  - OpenStax: free, peer-reviewed textbooks
  - 3Blue1Brown: visual intuition, for calculus topics only
- Links open in a new tab, are marked as external, and say they need an
  internet connection.
- **Privacy Policy and Terms:** one line each, saying these are links to
  other websites with their own policies, and that MasterMath sends nothing
  unless one is clicked.
- Every link is checked before each release and re-checked on the same
  cycle as the comparison page.

## 4. Content, one topic per release

- **Order:** integrals, derivatives, equations (algebra), limits,
  functions, trigonometry, inequalities and systems, arithmetic.
- **Review:** before each topic ships, a short document lists the new
  insights and mistakes per method for the owner to spot-check.
- **Rule:** the first insight of each method stays method-specific (the
  existing test). A general tip ("substitute back to check") may appear in
  the extra, collapsed part of several methods.

## Testing

- Every insight and mistake in every list is typeset-checked, not only the
  first three (extends `tests/typesettingTips.test.js`).
- No two methods share a first insight (`tests/tipsByMethod.test.js`).
- "Show more" appears only when a list has more than three, reveals the
  rest and folds back: browser tests on desktop and phone, and axe in
  light and dark mode.
- Every source and resource link is well formed and on an approved domain.
- A link checker, run before each release, confirms the links load. It is
  not in CI, so an outside site being down cannot block a deploy.

## Releases

1. **1.60.0:** "Show more", sources, "Learn more" links, Privacy and Terms
   wording, plus **integrals** as the pilot topic, so the button appears
   somewhere.
2. **1.61.0 onward:** one topic per release, each with its review document
   first.

## Open decisions

1. **Resource sites:** the four above? Is a YouTube channel (3Blue1Brown)
   acceptable, or websites only?
2. **Pilot topic:** integrals, or another?
3. **Review:** a review document before each topic ships? *Recommended.*
4. **Link checking:** the session needs network access to
   `khanacademy.org`, `tutorial.math.lamar.edu`, `openstax.org` and
   `3blue1brown.com` to confirm each link loads.
