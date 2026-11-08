import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { X, CheckCircle2, AlertCircle, AlertTriangle, Lightbulb, Eye, ArrowRight, Grid3x3, ChevronDown, ChevronUp, Calculator } from "lucide-react";
import MathText from "@/components/MathText";
import MathKeypad from "@/components/solver/MathKeypad";
import { applyKey, readKeypadOpen, writeKeypadOpen, touchFirstDevice } from "@/lib/keypad";
import { buildPracticeSet, checkPracticeAnswer } from "@/lib/practiceClient";

// Practice mode (1.70.0; docs/future-work/PLAN-PRACTICE-MODE.md): a pop-up
// with up to five problems like the one just solved, made and checked by the
// solver before they are shown. The student types an answer and checks it,
// reveals the working one step at a time, or the whole solution; "Another
// one" walks the set and rotates at the end. "Look at the example" shows the
// problem it started from. Full-screen on a phone.
//
// Focus, Escape, Tab trapping and the backdrop follow NotationGuide.jsx.

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

const focusRing = "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-600 dark:focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900";
const secondary = `inline-flex items-center justify-center gap-1.5 min-h-11 px-3 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 aria-disabled:opacity-50 aria-disabled:cursor-not-allowed transition-colors ${focusRing}`;

// The steps without the "Solved as …" line a routed result starts with.
const workedSteps = (result) => ((result?.routing ? result.steps.slice(1) : result?.steps) || []);

const VERDICT_STYLE = {
  correct: { Icon: CheckCircle2, box: "bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-700 text-green-900 dark:text-green-100", icon: "text-green-600 dark:text-green-400" },
  close: { Icon: AlertTriangle, box: "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100", icon: "text-amber-600 dark:text-amber-400" },
  partial: { Icon: AlertTriangle, box: "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100", icon: "text-amber-600 dark:text-amber-400" },
  wrong: { Icon: AlertCircle, box: "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-700 text-red-900 dark:text-red-100", icon: "text-red-600 dark:text-red-400" },
  unreadable: { Icon: AlertCircle, box: "bg-gray-50 dark:bg-gray-950/40 border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100", icon: "text-gray-500 dark:text-gray-400" },
  empty: { Icon: AlertCircle, box: "bg-gray-50 dark:bg-gray-950/40 border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100", icon: "text-gray-500 dark:text-gray-400" },
};

export default function PracticeDialog({ problem, topic, solution, onClose }) {
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const inputRef = useRef(null);
  const id = useId();
  const titleId = `${id}-title`;

  // The set: found while the student works on the first problem.
  const [items, setItems] = useState([]);
  const [building, setBuilding] = useState(true);
  const [none, setNone] = useState(false);
  const [current, setCurrent] = useState(0);
  const [notice, setNotice] = useState("");
  // Per problem: what was typed, the verdict, steps shown, solved or not.
  const [work, setWork] = useState({});
  const [checking, setChecking] = useState(false);
  const [showExample, setShowExample] = useState(false);
  const [keypadOpen, setKeypadOpen] = useState(() => readKeypadOpen(globalThis.localStorage, touchFirstDevice()));

  useEffect(() => {
    const controller = new AbortController();
    buildPracticeSet(problem, topic, {
      signal: controller.signal,
      onItem: (item) => setItems((list) => [...list, item]),
    }).then((set) => {
      if (controller.signal.aborted) return;
      setBuilding(false);
      if (!set || set.length === 0) setNone(true);
    });
    return () => controller.abort();
  }, [problem, topic]);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    closeRef.current?.focus();
    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, []);
  // Escape closes from anywhere, focus inside the dialog or not.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const item = items[current];
  const state = work[current] || { typed: "", verdict: null, hints: 0, solution: false };
  const updateAt = useCallback((at, patch) => setWork((w) => ({ ...w, [at]: { ...(w[at] || { typed: "", verdict: null, hints: 0, solution: false }), ...patch } })), []);
  const update = (patch) => updateAt(current, patch);
  const steps = workedSteps(item?.result);
  const solvedCount = Object.values(work).filter((w) => w.verdict?.verdict === "correct").length;

  // The answer box takes focus when a problem appears.
  const shownProblem = item?.problem;
  useEffect(() => {
    if (shownProblem) inputRef.current?.focus({ preventScroll: true });
  }, [shownProblem]);

  const check = async () => {
    if (!item || checking) return;
    // The verdict belongs to the problem that was checked, even if the
    // student has moved on by the time it comes back.
    const at = current;
    setChecking(true);
    const verdict = await checkPracticeAnswer(item, state.typed);
    setChecking(false);
    updateAt(at, { verdict });
  };

  const next = () => {
    if (items.length === 0) return;
    if (current + 1 < items.length) {
      setCurrent(current + 1);
      setNotice("");
    } else if (!building) {
      setCurrent(0);
      setNotice(items.length === 1 ? "That is the only one for this problem, so here it is again." : `That's all ${items.length}, back to the first.`);
    }
  };

  // The keypad edits the answer box at its caret, as on the problem box.
  const pendingSelection = useRef(null);
  useEffect(() => {
    const sel = pendingSelection.current;
    const el = inputRef.current;
    if (!sel || !el) return;
    pendingSelection.current = null;
    el.focus({ preventScroll: true });
    el.setSelectionRange(sel.start, sel.end);
  }, [state.typed]);
  const handleKey = (key) => {
    const el = inputRef.current;
    const value = state.typed;
    const start = el ? el.selectionStart : value.length;
    const end = el ? el.selectionEnd : value.length;
    const after = applyKey(value, start, end, key);
    if (after.value === value) {
      el?.focus({ preventScroll: true });
      el?.setSelectionRange(after.selectionStart, after.selectionEnd);
      return;
    }
    pendingSelection.current = { start: after.selectionStart, end: after.selectionEnd };
    update({ typed: after.value, verdict: null });
  };
  const toggleKeypad = () => {
    const open = !keypadOpen;
    writeKeypadOpen(globalThis.localStorage, open);
    setKeypadOpen(open);
  };

  const handleKeyDown = (event) => {
    if (event.key !== "Tab") return;
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

  const verdictStyle = state.verdict ? VERDICT_STYLE[state.verdict.verdict] || VERDICT_STYLE.wrong : null;
  const nextReady = current + 1 < items.length || !building;

  return (
    <div className="fixed inset-x-0 top-0 h-dvh z-[60] flex items-stretch sm:items-center justify-center" onKeyDown={handleKeyDown}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs animate-in fade-in" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative bg-white dark:bg-gray-900 sm:rounded-lg shadow-xl sm:border border-gray-200 dark:border-gray-800 p-4 sm:p-6 w-full sm:max-w-2xl sm:mx-4 h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto animate-in zoom-in-95"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-gray-100">Practice</h2>
            {items.length > 0 && (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Problem {current + 1} of {building ? `${items.length}+` : items.length}
                {solvedCount > 0 && <> · {solvedCount} correct</>}
              </p>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close practice"
            className={`inline-flex items-center justify-center w-11 h-11 -mr-2 -mt-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 ${focusRing}`}
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {!item && building && (
          <p className="flex items-center gap-2 py-8 justify-center text-gray-600 dark:text-gray-300" role="status">
            <Calculator className="w-5 h-5 animate-pulse" aria-hidden="true" />
            Making practice problems…
          </p>
        )}

        {!item && none && (
          <div className="py-6 text-center" role="status">
            <p className="text-gray-700 dark:text-gray-200">There are no similar problems MasterMath can check for this one.</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Try practice on another problem, or change the numbers yourself and solve it.</p>
          </div>
        )}

        {item && (
          <div className="space-y-4">
            {notice && <p className="text-sm text-indigo-700 dark:text-indigo-300" role="status">{notice}</p>}
            <div className="p-4 rounded-md bg-gray-50 dark:bg-gray-950/40 border border-gray-200 dark:border-gray-800">
              <p className="text-xs font-medium uppercase tracking-wide text-indigo-700 dark:text-indigo-300 mb-1">
                Your problem{state.verdict?.verdict === "correct" && <span className="ml-2 normal-case text-green-700 dark:text-green-400">✓ done</span>}
              </p>
              <p className="text-lg text-gray-900 dark:text-gray-100 overflow-x-auto">
                {item.correct?.zeros && <span className="text-base text-gray-700 dark:text-gray-300">f(x) = </span>}
                <MathText text={item.problem} mode="input" />
              </p>
              {item.correct?.prompt && <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{item.correct.prompt}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label htmlFor={`${id}-answer`} className="text-sm font-medium text-gray-800 dark:text-gray-100">Your answer</label>
                <button
                  type="button"
                  onClick={toggleKeypad}
                  aria-expanded={keypadOpen}
                  aria-controls={`${id}-keypad`}
                  className={`inline-flex items-center gap-1 min-h-11 px-2 rounded-lg text-xs font-medium text-indigo-700 dark:text-indigo-300 hover:bg-gray-100 dark:hover:bg-gray-800 ${focusRing}`}
                >
                  <Grid3x3 className="w-4 h-4" aria-hidden="true" />
                  Keypad
                  {keypadOpen ? <ChevronUp className="w-4 h-4" aria-hidden="true" /> : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  id={`${id}-answer`}
                  type="text"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  inputMode={keypadOpen ? "none" : undefined}
                  value={state.typed}
                  onChange={(e) => update({ typed: e.target.value, verdict: null })}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); check(); } }}
                  placeholder={item.correct?.placeholder || (item.correct?.kind === "solutions" ? "e.g. 2, 3" : item.correct?.kind === "antiderivative" ? "e.g. x^3/3 + C" : item.correct?.kind === "derivative" ? "e.g. 3x^2" : "e.g. 3/4")}
                  className={`flex-1 min-w-0 min-h-11 px-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 ${focusRing}`}
                />
                <button
                  type="button"
                  onClick={check}
                  disabled={checking}
                  className={`inline-flex items-center justify-center min-h-11 px-5 rounded-lg font-semibold text-white bg-indigo-700 hover:bg-indigo-800 dark:bg-indigo-300 dark:text-gray-950 dark:hover:bg-indigo-200 disabled:opacity-60 ${focusRing}`}
                >
                  Check
                </button>
              </div>
              {keypadOpen && <div className="mt-2"><MathKeypad id={`${id}-keypad`} label="Answer keypad" onKey={handleKey} /></div>}
            </div>

            <div aria-live="polite">
              {state.verdict && verdictStyle && (
                <div className={`flex items-start gap-2 p-3 rounded-lg border ${verdictStyle.box}`}>
                  <verdictStyle.Icon className={`w-5 h-5 shrink-0 mt-0.5 ${verdictStyle.icon}`} aria-hidden="true" />
                  <p>{state.verdict.message}</p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {/* aria-disabled, not disabled: a disabled button drops focus out of the dialog. */}
              <button type="button" className={secondary} onClick={() => { if (!(state.solution || state.hints >= steps.length)) update({ hints: state.hints + 1 }); }} aria-disabled={state.solution || state.hints >= steps.length}>
                <Lightbulb className="w-4 h-4" aria-hidden="true" />
                {state.hints === 0 ? "Hint" : "Next step"}
              </button>
              <button type="button" className={secondary} onClick={() => { if (!state.solution) update({ solution: true, hints: steps.length }); }} aria-disabled={state.solution}>
                <Eye className="w-4 h-4" aria-hidden="true" />
                Show solution
              </button>
              <button type="button" className={secondary} onClick={next} aria-disabled={!nextReady}>
                {nextReady ? "Another one" : "Making the next one…"}
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {(state.hints > 0 || state.solution) && (
              <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">{state.solution ? "Solution" : `Step ${state.hints} of ${steps.length}`}</h3>
                <ol className="space-y-2 list-decimal pl-5 text-gray-800 dark:text-gray-100">
                  {steps.slice(0, state.solution ? steps.length : state.hints).map((step, i) => (
                    <li key={i} className="leading-relaxed"><MathText text={step} /></li>
                  ))}
                </ol>
                {state.solution && (
                  <p className="mt-3 font-semibold text-green-800 dark:text-green-300"><MathText text={item.result.answer} /></p>
                )}
              </div>
            )}

            <div className="border-t border-gray-200 dark:border-gray-800 pt-3">
              <button
                type="button"
                onClick={() => setShowExample((v) => !v)}
                aria-expanded={showExample}
                aria-controls={`${id}-example`}
                className={`inline-flex items-center gap-1 min-h-11 px-2 -ml-2 rounded-lg text-sm font-medium text-indigo-700 dark:text-indigo-300 hover:bg-gray-100 dark:hover:bg-gray-800 ${focusRing}`}
              >
                Look at the example
                {showExample ? <ChevronUp className="w-4 h-4" aria-hidden="true" /> : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
              </button>
              {showExample && (
                <div id={`${id}-example`} className="mt-2 text-sm text-gray-800 dark:text-gray-100">
                  <p className="mb-2"><MathText text={problem} mode="input" /></p>
                  <ol className="space-y-2 list-decimal pl-5">
                    {workedSteps(solution).map((step, i) => <li key={i} className="leading-relaxed"><MathText text={step} /></li>)}
                  </ol>
                  <p className="mt-2 font-semibold text-green-800 dark:text-green-300"><MathText text={solution.answer} /></p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
