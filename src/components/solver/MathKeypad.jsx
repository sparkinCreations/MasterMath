import React from "react";
import { KEYPAD_ROWS } from "@/lib/keypad";

// The on-screen keypad under the problem box (1.69.0): digits, x and y, the
// operators, brackets, backspace and the arrow keys (lib/keypad.js). While it
// is open the problem box takes inputmode="none", so a phone's own keyboard
// stays closed and the box and its preview stay in view. `onKey(key)` edits
// the textarea at its caret.
//
// A digit or a letter is named by its text; any other key by its
// aria-label, with its glyph hidden, so "÷" is read "Divide" once and not
// "division sign".
export default function MathKeypad({ id, onKey }) {
  const base = "inline-flex items-center justify-center h-12 rounded-lg text-lg font-medium focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-600 dark:focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-800 transition-colors select-none touch-manipulation";
  const style = (k) => {
    if (k.action) return "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600";
    if (/^\d$/.test(k.glyph) || k.key === 'point') return "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-indigo-50 dark:hover:bg-gray-700 border border-indigo-200 dark:border-gray-600";
    return "bg-indigo-50 dark:bg-gray-900 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-gray-700 border border-indigo-200 dark:border-gray-600";
  };
  return (
    <div
      id={id}
      role="group"
      aria-label="Keypad"
      className="grid grid-cols-6 gap-1.5 p-2 rounded-xl border-2 border-indigo-100 dark:border-gray-700 bg-indigo-50/60 dark:bg-gray-900/40"
    >
      {KEYPAD_ROWS.flat().map((k) => {
        const named = k.label && k.label !== k.glyph;
        return (
          <button
            key={k.key}
            type="button"
            aria-label={named ? k.label : undefined}
            // Keep the caret in the problem box: a mousedown would move focus
            // to the key and lose the selection the edit is based on.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onKey(k)}
            className={`${base} ${style(k)}`}
          >
            {named ? <span aria-hidden="true">{k.glyph}</span> : k.glyph}
          </button>
        );
      })}
    </div>
  );
}
