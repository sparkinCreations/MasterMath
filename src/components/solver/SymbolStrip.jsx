import React from "react";
import { GROUPS, symbolsInGroup } from "@/lib/symbolInsert";

// The strip of symbol buttons under the "Symbols" toggle: a row of group
// pills (Basic / Algebra / Calculus / Functions), then that group's buttons.
// Each button is a 44 px target; the glyph is decorative and the accessible
// name says what is inserted. `onInsert(symbol)` does the insertion in the
// textarea; `group`/`onGroupChange` are owned by the parent so the topic can
// choose the starting group.
export default function SymbolStrip({ id, group, onGroupChange, onInsert }) {
  const buttonBase = "inline-flex items-center justify-center min-w-11 h-11 px-2 rounded-lg text-base font-medium focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-600 dark:focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-800 transition-colors";
  return (
    <div
      id={id}
      className="space-y-2 p-2 rounded-xl border-2 border-indigo-100 dark:border-gray-700 bg-indigo-50/60 dark:bg-gray-900/40"
    >
      {/* Four equal pills on one row, so the row never wraps on a phone. */}
      <div role="group" aria-label="Symbol group" className="grid grid-cols-4 gap-1.5">
        {GROUPS.map((g) => (
          <button
            key={g.key}
            type="button"
            aria-pressed={group === g.key}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onGroupChange(g.key)}
            className={`${buttonBase} text-sm px-1 min-w-0 ${group === g.key
              ? 'bg-indigo-600 text-white dark:bg-indigo-500'
              : 'bg-transparent text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-gray-700'}`}
          >
            {g.label}
          </button>
        ))}
      </div>
      <div role="group" aria-label="Insert a math symbol" className="flex flex-wrap gap-1.5">
        {symbolsInGroup(group).map((symbol) => (
          <button
            key={symbol.key}
            type="button"
            // The tooltip is the name: an aria-label with the same text made
            // Chrome pass the title on as a description, read a second time.
            title={symbol.label}
            // Keep the caret in the textarea: a mousedown would move focus to
            // the button and lose the selection the insertion is based on.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onInsert(symbol)}
            className={`${buttonBase} bg-white dark:bg-gray-800 border border-indigo-200 dark:border-gray-600 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-gray-700`}
          >
            <span aria-hidden="true">{symbol.glyph}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
