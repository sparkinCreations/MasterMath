import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { revealElement } from "@/lib/reveal";
import MathText from "@/components/MathText";
import SymbolStrip from "@/components/solver/SymbolStrip";
import { insertSymbol, groupForTopic, readSymbolStripOpen, writeSymbolStripOpen } from "@/lib/symbolInsert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Calculator, Lightbulb, AlertCircle, Keyboard, ChevronUp, ChevronDown, X } from "lucide-react";
import { validateMathInput, validateTopic, sanitizeInput } from "@/lib/validation";

const TOPICS = [
  { value: "derivatives", label: "Derivatives" },
  { value: "integrals", label: "Integrals" },
  { value: "limits", label: "Limits" },
  { value: "functions", label: "Functions" },
  { value: "trigonometry", label: "Trigonometry" },
  { value: "algebra", label: "Algebra" },
  { value: "other", label: "Arithmetic" }
];

const PLACEHOLDERS = {
  derivatives: "e.g., x^2 + 3*x or Find the derivative of x^3 - 2*x",
  integrals: "e.g., 2*x + 1, Integrate x^2, or ∫_0^1 x^2 dx (definite)",
  limits: "e.g., lim x->0 (sin(x)/x) or (x^2 - 4)/(x - 2) as x->2",
  functions: "e.g., x^2 - 4*x + 3 or f(x) = x^3 - x",
  trigonometry: "e.g., sin(pi/4), cos(60), tan(x), or sin(x) = 1/2 (equation)",
  algebra: "e.g., 2*x + 5 = 11, factor x^2 - 4, x^2 - 4 > 0, or 2x + 3y = 6; x - y = 4",
  other: "e.g., 15 + 23, 8 * 7, (5 + 3) * 4, 2^3 + 10/2"
};

const EXAMPLE_PROBLEMS = [
  { topic: "derivatives", problem: "x^2 + 3*x" },
  { topic: "integrals", problem: "2*x + 1" },
  { topic: "integrals", problem: "∫_0^1 x^2 dx" },
  { topic: "limits", problem: "lim x->0 (sin(x)/x)" },
  { topic: "functions", problem: "x^2 - 4*x + 3" },
  { topic: "algebra", problem: "2*x + 5 = 11" },
  { topic: "algebra", problem: "2x + 3y = 6; x - y = 4" },
  { topic: "algebra", problem: "x^2 - 4 > 0" },
  { topic: "trigonometry", problem: "sin(pi/4)" },
  { topic: "trigonometry", problem: "sin(x) = 1/2" },
  { topic: "other", problem: "(5 + 3) * 4 - 2^3" }
];

export default function ProblemInput({ problem, setProblem, topic, setTopic, onSolve, onInvalid, onCancel, isLoading, onNavigateHistory, hasHistory }) {
  const [validationError, setValidationError] = useState(null);
  const textareaRef = useRef(null);
  // The symbol strip is hidden until asked for, and stays the way it was
  // left (the choice is saved on this device).
  const [symbolsOpen, setSymbolsOpen] = useState(() => readSymbolStripOpen(globalThis.localStorage));
  const toggleSymbols = () => {
    setSymbolsOpen((open) => {
      writeSymbolStripOpen(globalThis.localStorage, !open);
      return !open;
    });
  };
  // The topic picks the strip's group; a group chosen by hand holds until
  // the topic changes.
  const [symbolGroup, setSymbolGroup] = useState(() => groupForTopic(topic));
  useEffect(() => { setSymbolGroup(groupForTopic(topic)); }, [topic]);
  const clearProblem = () => {
    setProblem('');
    setValidationError(null);
    textareaRef.current?.focus?.({ preventScroll: true });
  };
  // Selection to apply once React has rendered the inserted text: setting
  // it on the DOM before the controlled value updates would be overwritten.
  const pendingSelection = useRef(null);
  useEffect(() => {
    const sel = pendingSelection.current;
    const el = textareaRef.current;
    if (!sel || !el) return;
    pendingSelection.current = null;
    el.focus({ preventScroll: true });
    el.setSelectionRange(sel.start, sel.end);
  }, [problem]);
  const handleInsert = (symbol) => {
    const el = textareaRef.current;
    const start = el ? el.selectionStart : problem.length;
    const end = el ? el.selectionEnd : problem.length;
    const next = insertSymbol(problem, start, end, symbol);
    pendingSelection.current = { start: next.selectionStart, end: next.selectionEnd };
    setProblem(next.value);
    setValidationError(null);
  };

  const loadExample = (exampleProblem) => {
    setProblem(exampleProblem.problem);
    setTopic(exampleProblem.topic);
    setValidationError(null);
    // The examples sit below the textarea; on a phone the filled-in textarea
    // is now off-screen above. Bring it back and put the caret in it.
    revealElement(textareaRef.current, { focus: true });
  };

  const handleProblemChange = (e) => {
    // Allow all input, only sanitize when validating
    setProblem(e.target.value);
    setValidationError(null);
  };

  const handleKeyDown = (e) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (problem.trim() && topic && !isLoading) {
        handleSolve();
      }
    }
    // Navigate input history with ArrowUp/ArrowDown when input is empty or at start
    if (e.key === 'ArrowUp' && onNavigateHistory && (problem === '' || e.target.selectionStart === 0)) {
      e.preventDefault();
      onNavigateHistory('up');
    }
    if (e.key === 'ArrowDown' && onNavigateHistory && (problem === '' || e.target.selectionStart === e.target.value.length)) {
      e.preventDefault();
      onNavigateHistory('down');
    }
    // Shift+Enter creates a new line (default behavior)
  };

  const handleSolve = () => {
    // Validate topic
    const topicValidation = validateTopic(topic);
    if (!topicValidation.isValid) {
      setValidationError(topicValidation.error);
      onInvalid?.();
      return;
    }

    // Sanitize and validate math input
    const sanitized = sanitizeInput(problem);
    const inputValidation = validateMathInput(sanitized);
    if (!inputValidation.isValid) {
      setValidationError(inputValidation.error);
      onInvalid?.();
      return;
    }

    setValidationError(null);
    // Hand the solver the same string that was just validated. Validating the
    // sanitized text and then solving the raw text meant the two could differ.
    onSolve(sanitized);
  };

  // Get the display label for the selected topic
  const selectedLabel = TOPICS.find(t => t.value === topic)?.label || "Select a topic";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label id="topic-label" htmlFor="topic" className="text-lg font-semibold text-gray-700 dark:text-gray-200">
          What are you working on?
        </Label>
        <Select id="topic" value={topic} onValueChange={setTopic}>
          <SelectTrigger
            aria-labelledby="topic-label topic"
            className="h-12 text-lg border-2 border-indigo-200 dark:border-gray-600 focus:border-indigo-400 dark:focus:border-indigo-500 rounded-xl"
          >
            <SelectValue placeholder="Select a topic">
              {selectedLabel}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {TOPICS.map((t) => (
              <SelectItem key={t.value} value={t.value} className="text-lg">
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="problem" className="text-lg font-semibold text-gray-700 dark:text-gray-200">
            Enter your problem
          </Label>
          <button
            type="button"
            onClick={toggleSymbols}
            aria-expanded={symbolsOpen}
            aria-controls="symbol-strip"
            className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-lg text-sm font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-gray-700 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-600 dark:focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-800 transition-colors"
          >
            <Keyboard className="w-4 h-4" aria-hidden="true" />
            Symbols
            {symbolsOpen ? <ChevronUp className="w-4 h-4" aria-hidden="true" /> : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
          </button>
        </div>
        {symbolsOpen && <SymbolStrip id="symbol-strip" group={symbolGroup} onGroupChange={setSymbolGroup} onInsert={handleInsert} />}
        <Textarea
          ref={textareaRef}
          id="problem"
          value={problem}
          onChange={handleProblemChange}
          onKeyDown={handleKeyDown}
          placeholder={topic ? PLACEHOLDERS[topic] : "Select a topic first, then enter your problem..."}
          className={`min-h-32 text-lg border-2 scroll-mt-24 md:scroll-mt-0 ${
            validationError ? 'border-red-300 focus:border-red-400' : 'border-indigo-200 dark:border-gray-600 focus:border-indigo-400 dark:focus:border-indigo-500'
          } rounded-xl p-4 resize-none`}
          maxLength={1000}
          aria-invalid={validationError ? true : undefined}
          aria-describedby={validationError ? 'problem-error' : undefined}
        />
        {/* What the typed text means, typeset: a ^2 shows raised, √( shows
            a radical. Decorative for assistive tech — the textarea's own
            text is the accessible content, and announcing every keystroke's
            re-render would be noise. */}
        {problem.trim() && (
          <div aria-hidden="true" className="flex items-baseline gap-2 px-1 text-gray-800 dark:text-gray-100 min-h-7">
            <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 shrink-0">Preview</span>
            <span className="text-lg leading-snug break-words min-w-0"><MathText text={problem} /></span>
          </div>
        )}
        {/* A hint that stays while typing: the placeholder's examples vanish
            at the first keystroke, and a casual user does not guess
            "lim x->0". */}
        <p className="text-xs text-gray-500 dark:text-gray-400 px-1">
          Type it as you would say it: <code className="font-mono">x^2</code>, <code className="font-mono">sqrt(x)</code> or √, <code className="font-mono">∫_0^1 x^2 dx</code>, <code className="font-mono">d/dx(x^3)</code>, <code className="font-mono">{"lim x->0 (sin(x)/x)"}</code>, or "integral of x^2 from 0 to 1".{' '}
          <Link to="/usermanual#entering-your-problem" className="underline decoration-gray-300 dark:decoration-gray-600 hover:text-indigo-700 dark:hover:text-indigo-300">Notation guide</Link>
        </p>
        <div className="flex justify-between items-center gap-3 min-h-11">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {problem.length}/1000 characters
          </p>
          {problem && (
            // Emptying a textarea on a phone is long-press, Select All,
            // Delete; one button instead. The topic stays, the caret returns.
            <button
              type="button"
              onClick={clearProblem}
              className="inline-flex items-center gap-1 min-h-11 px-3 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-gray-700 hover:text-indigo-700 dark:hover:text-indigo-300 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-600 dark:focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-800 transition-colors"
            >
              <X className="w-4 h-4" aria-hidden="true" />
              Clear
            </button>
          )}
          {hasHistory && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              ↑↓ to recall previous problems
            </p>
          )}
        </div>
      </div>

      {validationError && (
        <div id="problem-error" role="alert" className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle aria-hidden="true" className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          {/* red-700, not red-600: 600 on the red-50 panel is 4.36:1 at this size, under the AA 4.5:1 (axe). */}
          <p className="text-sm text-red-700 dark:text-red-400">{validationError}</p>
        </div>
      )}

      <Button
        onClick={handleSolve}
        disabled={!problem.trim() || !topic || isLoading}
        className="w-full h-14 text-lg font-semibold text-white bg-linear-to-r from-orange-400 to-orange-600 hover:from-orange-500 hover:to-orange-700 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl"
      >
        {isLoading ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3" />
            Calculating...
          </>
        ) : (
          <>
            <Calculator className="w-5 h-5 mr-2" />
            Solve Problem
          </>
        )}
      </Button>
      {!problem.trim() && !isLoading && (
        // Why Solve is disabled, instead of a silent grey button.
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center -mt-3">Type a problem above, or pick an example below, to enable Solve.</p>
      )}
      {/* The button's label changes to "Calculating…" but a label change is
          not announced; this polite live region is, and it empties when the
          solve ends (the outcome is announced by the toast). */}
      <div role="status" aria-live="polite" className="sr-only">
        {isLoading ? 'Calculating the solution…' : ''}
      </div>
      {isLoading && onCancel && (
        // A solve runs in a worker with a time budget; this ends it early
        // (the worker is terminated, so even a stuck symbolic step stops).
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="w-full h-11 text-base font-semibold border-2 border-indigo-200 dark:border-gray-600 rounded-xl"
        >
          Cancel
        </Button>
      )}

      <div className="pt-4 border-t border-indigo-200">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="w-5 h-5 text-amber-500" />
          <span className="font-semibold text-gray-700 dark:text-gray-200">Try an example:</span>
        </div>
        <div className="grid gap-2">
          {EXAMPLE_PROBLEMS.map((ex, idx) => (
            <button
              key={idx}
              onClick={() => loadExample(ex)}
              className="text-left p-3 rounded-lg bg-linear-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 dark:from-gray-700/60 dark:to-gray-700/60 dark:hover:from-gray-700 dark:hover:to-gray-700 transition-all duration-200 border border-indigo-200 dark:border-gray-600 text-sm"
            >
              <span className="font-medium text-indigo-700 dark:text-indigo-300">{TOPICS.find((t) => t.value === ex.topic)?.label || ex.topic}:</span>{" "}
              <span className="text-gray-700 dark:text-gray-300">{ex.problem}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}