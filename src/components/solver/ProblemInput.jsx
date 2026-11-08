import React, { useState, useRef, useEffect } from "react";
import NotationGuide from "@/components/solver/NotationGuide";
import { revealElement } from "@/lib/reveal";
import MathText from "@/components/MathText";
import SymbolStrip from "@/components/solver/SymbolStrip";
import MathKeypad from "@/components/solver/MathKeypad";
import { insertSymbol, groupForTopic, readSymbolStripOpen, writeSymbolStripOpen } from "@/lib/symbolInsert";
import { applyKey, readKeypadOpen, writeKeypadOpen, touchFirstDevice } from "@/lib/keypad";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Calculator, Lightbulb, AlertCircle, Keyboard, ChevronUp, ChevronDown, X, Grid3x3 } from "lucide-react";
import { validateMathInput, validateTopic, sanitizeInput } from "@/lib/validation";
import { readPlainEnglish } from "@/lib/plainEnglish";
import { getSettings, autoDegreeAngle } from "@/lib/settings";

const TOPICS = [
  { value: "auto", label: "Auto-detect" },
  { value: "derivatives", label: "Derivatives" },
  { value: "integrals", label: "Integrals" },
  { value: "limits", label: "Limits" },
  { value: "functions", label: "Functions" },
  { value: "trigonometry", label: "Trigonometry" },
  { value: "algebra", label: "Algebra" },
  { value: "other", label: "Arithmetic" }
];

const PLACEHOLDERS = {
  auto: "e.g., 2*x + 5 = 11, sin(pi/4), d/dx x^3, or ∫_0^1 x^2 dx (the topic is detected)",
  derivatives: "e.g., x^2 + 3*x or Find the derivative of x^3 - 2*x",
  integrals: "e.g., 2*x + 1, Integrate x^2, or ∫_0^1 x^2 dx (definite)",
  limits: "e.g., lim x->0 (sin(x)/x) or (x^2 - 4)/(x - 2) as x->2",
  functions: "e.g., x^2 - 4*x + 3 or f(x) = x^3 - x",
  trigonometry: "e.g., sin(pi/4), cos(60), tan(x), or sin(x) = 1/2 (equation)",
  algebra: "e.g., 2*x + 5 = 11, factor x^2 - 4, x^2 - 4 > 0, or 2x + 3y = 6; x - y = 4",
  other: "e.g., 15 + 23, 8 * 7, (5 + 3) * 4, 2^3 + 10/2"
};

// Easiest first: arithmetic and a linear equation, then the precalculus
// topics, then calculus. (A phone shows the first four.)
const EXAMPLE_PROBLEMS = [
  { topic: "other", problem: "(5 + 3) * 4 - 2^3" },
  { topic: "algebra", problem: "2*x + 5 = 11" },
  { topic: "trigonometry", problem: "sin(pi/4)" },
  { topic: "algebra", problem: "x^2 - 4 > 0" },
  { topic: "functions", problem: "x^2 - 4*x + 3" },
  { topic: "algebra", problem: "2x + 3y = 6; x - y = 4" },
  { topic: "trigonometry", problem: "sin(x) = 1/2" },
  { topic: "derivatives", problem: "x^2 + 3*x" },
  { topic: "integrals", problem: "2*x + 1" },
  { topic: "limits", problem: "lim x->0 (sin(x)/x)" },
  { topic: "integrals", problem: "∫_0^1 x^2 dx" }
];

export default function ProblemInput({ problem, setProblem, topic, setTopic, onSolve, onInvalid, onCancel, isLoading, onNavigateHistory, hasHistory }) {
  const [validationError, setValidationError] = useState(null);
  const textareaRef = useRef(null);
  // The symbol strip is hidden until asked for, and stays the way it was
  // left (the choice is saved on this device).
  const [symbolsOpen, setSymbolsOpen] = useState(() => readSymbolStripOpen(globalThis.localStorage));
  // Eleven example cards each took a full row on a phone, pushing the
  // solution far down; four show, the rest open on demand. Desktops (md
  // and up) show them all.
  const [allExamples, setAllExamples] = useState(false);
  const EXAMPLES_ON_PHONE = 4;
  const toggleSymbols = () => {
    setSymbolsOpen((open) => {
      writeSymbolStripOpen(globalThis.localStorage, !open);
      return !open;
    });
  };
  // The keypad (1.69.0): open on a phone or tablet until closed, closed
  // with a mouse until opened; either way it stays as it was left. While it
  // is open the phone's own keyboard stays closed (inputmode="none").
  const [keypadOpen, setKeypadOpen] = useState(() => readKeypadOpen(globalThis.localStorage, touchFirstDevice()));
  const toggleKeypad = () => {
    const el = textareaRef.current;
    const focused = el && globalThis.document?.activeElement === el;
    setKeypadOpen((open) => {
      writeKeypadOpen(globalThis.localStorage, !open);
      return !open;
    });
    // A phone applies a new inputmode only when the box is focused again:
    // closing the keypad brings its own keyboard back, opening it puts it away.
    if (focused) {
      el.blur();
      setTimeout(() => el.focus({ preventScroll: true }), 0);
    }
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
  const handleKey = (key) => {
    const el = textareaRef.current;
    const start = el ? el.selectionStart : problem.length;
    const end = el ? el.selectionEnd : problem.length;
    const next = applyKey(problem, start, end, key);
    pendingSelection.current = { start: next.selectionStart, end: next.selectionEnd };
    // An arrow changes only the caret: set it now, as no render follows.
    if (next.value === problem) {
      pendingSelection.current = null;
      el?.focus({ preventScroll: true });
      el?.setSelectionRange(next.selectionStart, next.selectionEnd);
      return;
    }
    setProblem(next.value);
    setValidationError(null);
  };
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

  // ↑/↓ recall only from an empty box or with the caret at an edge, so the
  // keys still move the caret in a multi-line problem. A recalled problem
  // puts the caret at its end, which blocked the next ↑ (every other press
  // did nothing); a box showing exactly what was recalled stays navigable.
  const recalledRef = useRef(null);
  const navigatingRef = useRef(false);
  useEffect(() => {
    if (navigatingRef.current) {
      recalledRef.current = problem;
      navigatingRef.current = false;
    }
  }, [problem]);
  const recall = (direction) => {
    navigatingRef.current = true;
    onNavigateHistory(direction);
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
    const recalled = problem !== '' && problem === recalledRef.current;
    if (e.key === 'ArrowUp' && onNavigateHistory && (problem === '' || e.target.selectionStart === 0 || recalled)) {
      e.preventDefault();
      recall('up');
    }
    if (e.key === 'ArrowDown' && onNavigateHistory && (problem === '' || e.target.selectionStart === e.target.value.length || recalled)) {
      e.preventDefault();
      recall('down');
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
            className="h-12 text-lg border border-gray-300 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 rounded-lg"
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
        {/* The two buttons drop below the label where they do not fit beside
            it: on a phone the label wrapped to three lines and the Symbols
            chevron ran off the edge. */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <Label htmlFor="problem" className="text-lg font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap">
            Enter your problem
          </Label>
          {/* The keypad and the symbols, each opened and closed on its own. */}
          <div className="flex items-center gap-1 ml-auto">
            <button
              type="button"
              onClick={toggleKeypad}
              aria-expanded={keypadOpen}
              aria-controls="math-keypad"
              className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-lg text-sm font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-gray-700 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-600 dark:focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-800 transition-colors"
            >
              <Grid3x3 className="w-4 h-4" aria-hidden="true" />
              Keypad
              {keypadOpen ? <ChevronUp className="w-4 h-4" aria-hidden="true" /> : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
            </button>
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
        </div>
        {symbolsOpen && <SymbolStrip id="symbol-strip" group={symbolGroup} onGroupChange={setSymbolGroup} onInsert={handleInsert} />}
        <Textarea
          ref={textareaRef}
          id="problem"
          value={problem}
          onChange={handleProblemChange}
          onKeyDown={handleKeyDown}
          placeholder={topic ? PLACEHOLDERS[topic] : "Select a topic first, then enter your problem..."}
          className={`min-h-32 text-lg border scroll-mt-24 md:scroll-mt-0 ${
            validationError ? 'border-red-400 focus:border-red-500' : 'border-gray-300 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400'
          } rounded-lg p-4 resize-none`}
          maxLength={1000}
          // The keypad types instead: the phone's own keyboard stays closed.
          inputMode={keypadOpen ? 'none' : undefined}
          aria-invalid={validationError ? true : undefined}
          aria-describedby={validationError ? 'problem-error' : undefined}
        />
        {/* What the typed text means, typeset: a ^2 shows raised, √( shows
            a radical, and plain English is shown as the solver will read it
            ("x squared" as x², "sine of x" as sin(x); plainEnglish.js).
            Decorative for assistive tech — the textarea's own text is the
            accessible content, and announcing every keystroke's re-render
            would be noise. */}
        {problem.trim() && (
          <div aria-hidden="true" className="flex items-baseline gap-2 px-1 text-gray-800 dark:text-gray-100 min-h-7">
            <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 shrink-0">Preview</span>
            <span className="text-lg leading-snug break-words min-w-0"><MathText mode="input" text={readPlainEnglish(problem)} /></span>
          </div>
        )}
        {/* Auto reads a bare common angle as degrees (sin(30) is sin(30°));
            said here, before the solve, as well as in the steps. */}
        {(() => {
          const angle = getSettings().angleUnit === 'auto' ? autoDegreeAngle(problem) : null;
          return angle === null ? null : (
            <p className="text-sm text-gray-600 dark:text-gray-300 px-1">
              Angle unit is Auto: {angle} is read as {angle}°. Write {angle}° or use pi to be explicit, or set the angle unit in Settings.
            </p>
          );
        })()}
        {keypadOpen && <MathKeypad id="math-keypad" onKey={handleKey} />}
        <div className="flex justify-between items-center gap-3 min-h-11">
          <div className="flex items-center gap-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {problem.length}/1000 characters
            </p>
            {/* How to type things, one tap away; the placeholder's examples
                vanish at the first keystroke. */}
            <NotationGuide />
          </div>
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
        className="w-full h-14 text-xl font-bold text-white bg-orange-600 hover:bg-orange-700 shadow-sm transition-colors rounded-lg"
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
          className="w-full h-11 text-base font-semibold border border-gray-300 dark:border-gray-600 rounded-lg"
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
              type="button"
              onClick={() => loadExample(ex)}
              // The card shows the example typeset; clicking puts the typed
              // form in the box. Its accessible name is that typed form, and
              // the card's content is hidden from assistive tech, so the
              // problem is announced once, not again as MathML.
              aria-label={`${TOPICS.find((t) => t.value === ex.topic)?.label || ex.topic}: ${ex.problem}`}
              className={`text-left p-3 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-gray-700/60 dark:hover:bg-gray-700 transition-all duration-200 border border-gray-200 dark:border-gray-600 text-sm ${idx >= EXAMPLES_ON_PHONE && !allExamples ? 'hidden md:block' : ''}`}
            >
              <span aria-hidden="true">
                <span className="font-medium text-indigo-700 dark:text-indigo-300">{TOPICS.find((t) => t.value === ex.topic)?.label || ex.topic}:</span>{" "}
                <span className="text-gray-700 dark:text-gray-300"><MathText mode="input" text={readPlainEnglish(ex.problem)} /></span>
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setAllExamples((v) => !v)}
          aria-expanded={allExamples}
          className="md:hidden mt-2 w-full min-h-11 rounded-lg text-sm font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-gray-700 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-600 dark:focus-visible:ring-indigo-400 transition-colors"
        >
          {allExamples ? 'Fewer examples' : `Show all ${EXAMPLE_PROBLEMS.length} examples`}
        </button>
      </div>
    </div>
  );
}