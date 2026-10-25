import React, { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { HelpCircle, X } from "lucide-react";

// "Notation guide": a button under the problem box that opens a short
// reference of how to type things, with a link to the full section in the
// manual. A spelled-out line under the box was a strip of jargon that had
// to be scanned past on every visit; this is one tap away instead.
//
// Focus, Escape, Tab trapping and the backdrop follow confirm-dialog.jsx.

const ROWS = [
  ['Powers', 'x^2, x^(1/2) — or x², x**2, "x squared", "x to the power of 3"'],
  ['Roots', 'sqrt(x) — or √(x+1), "square root of x"'],
  ['Fractions', '(x+1)/(x-1), 1/2'],
  ['Multiplication', '2*x or 2x, (x+1)(x-1)'],
  ['Functions', 'sin(x), cos(2x), ln(x), log(x) is base 10, e^x — or "sine of x", "e to the x"'],
  ['Absolute value', '|x - 2|'],
  ['Equations', '2x + 5 = 11 — a system: 2x + 3y = 6; x - y = 4'],
  ['Inequalities', 'x^2 - 4 > 0, |x| ≤ 3 — or "2x + 1 is greater than 5"'],
  ['Derivatives', 'd/dx(x^3), or "derivative of x^3"; at a point: x^3 at x = 2; implicitly: find dy/dx if x^2 + y^2 = 25'],
  ['Integrals', '∫ x^2 dx, ∫_0^1 x^2 dx (or int x^2 dx, int_0^1 x^2 dx), or "integral of x^2 from 0 to 1"'],
  ['Limits', 'lim x->0 (sin(x)/x), or "limit of 1/x as x approaches infinity"'],
  ['Constants', 'pi or π, e, ∞ or infinity'],
];

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export default function NotationGuide({ className = "" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={`inline-flex items-center gap-1 min-h-11 px-2 rounded-lg text-xs font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-gray-700 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-600 dark:focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-800 transition-colors ${className}`}
      >
        <HelpCircle className="w-4 h-4" aria-hidden="true" />
        Notation guide
      </button>
      {open && <NotationDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function NotationDialog({ onClose }) {
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const id = useId();
  const titleId = `${id}-title`;

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    closeRef.current?.focus();
    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, []);

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(panelRef.current?.querySelectorAll(FOCUSABLE) || []);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onKeyDown={handleKeyDown}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs animate-in fade-in" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border-2 border-indigo-200 dark:border-gray-700 p-5 sm:p-6 max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto animate-in zoom-in-95"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-gray-100">Notation guide</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close the notation guide"
            className="inline-flex items-center justify-center w-11 h-11 -mr-2 -mt-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-gray-700 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-600 dark:focus-visible:ring-indigo-400"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">Type it as you would say it. Plain English works too, numbers included: "x squared", "two x plus five equals eleven", "derivative of x^3", "integral of x^2 from 0 to 1". The preview under the box shows how your words were read; "of" takes one term, so write "square root of (x + 1)" for more.</p>
        <table className="w-full text-sm">
          <tbody>
            {ROWS.map(([what, how]) => (
              <tr key={what} className="border-t border-gray-100 dark:border-gray-700 align-top">
                <th scope="row" className="py-2 pr-3 text-left font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">{what}</th>
                <td className="py-2 font-mono text-gray-800 dark:text-gray-100 break-words">{how}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
          The <Link to="/usermanual#entering-your-problem" onClick={onClose} className="font-medium text-indigo-700 dark:text-indigo-300 underline decoration-indigo-300 dark:decoration-indigo-600">full guide in the User Manual</Link> has more examples for each topic.
        </p>
      </div>
    </div>
  );
}
