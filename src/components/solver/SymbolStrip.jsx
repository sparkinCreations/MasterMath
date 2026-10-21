import React from "react";
import { SYMBOLS } from "@/lib/symbolInsert";

// The strip of symbol buttons under the "Symbols" toggle. Each button is a
// 44 px target; the glyph is decorative and the accessible name says what
// is inserted. `onInsert(symbol)` does the insertion in the textarea.
export default function SymbolStrip({ id, onInsert }) {
  return (
    <div
      id={id}
      role="group"
      aria-label="Insert a math symbol"
      className="flex flex-wrap gap-1.5 p-2 rounded-xl border-2 border-indigo-100 dark:border-gray-700 bg-indigo-50/60 dark:bg-gray-900/40"
    >
      {SYMBOLS.map((symbol) => (
        <button
          key={symbol.key}
          type="button"
          aria-label={symbol.label}
          title={symbol.label}
          // Keep the caret in the textarea: a mousedown would move focus to
          // the button and lose the selection the insertion is based on.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onInsert(symbol)}
          className="inline-flex items-center justify-center min-w-11 h-11 px-2 rounded-lg bg-white dark:bg-gray-800 border border-indigo-200 dark:border-gray-600 text-base font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-gray-700 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-600 dark:focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-800 transition-colors"
        >
          <span aria-hidden="true">{symbol.glyph}</span>
        </button>
      ))}
    </div>
  );
}
