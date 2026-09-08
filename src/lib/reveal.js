// Bring an element into view when it is not already, and optionally move
// keyboard focus to it.
//
// On a phone the Solver page stacks input → graph → solution, so after
// "Solve" the user is left looking at the button, and after "Try an example"
// (a list below the textarea) the filled-in textarea is off-screen above.
// On a desktop the solution column sits beside the input with its top already
// on screen, and the textarea is on screen when an example is tapped, so
// nothing should move. The rule that captures both: scroll only when the
// target's top edge is above the viewport or below its upper part.
//
// Smooth unless the user prefers reduced motion. `env` exists so the decision
// can be unit-tested without a browser.

const UPPER_PART = 0.6;

export function revealElement(el, { focus = false, block = 'start' } = {}, env = globalThis) {
  if (!el || typeof el.getBoundingClientRect !== 'function') return { scrolled: false, focused: false };
  const viewportHeight = env.innerHeight || env.document?.documentElement?.clientHeight || 0;
  const { top } = el.getBoundingClientRect();
  const inPlace = viewportHeight > 0 && top >= 0 && top < viewportHeight * UPPER_PART;
  let scrolled = false;
  if (!inPlace && typeof el.scrollIntoView === 'function') {
    const reduce = Boolean(env.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block });
    scrolled = true;
  }
  let focused = false;
  if (focus && typeof el.focus === 'function') {
    // preventScroll: the scroll above is the one we want; the browser's own
    // focus scroll would jump to the element's exact box and fight it.
    el.focus({ preventScroll: true });
    focused = true;
  }
  return { scrolled, focused };
}
