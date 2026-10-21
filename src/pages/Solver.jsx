import React, { useState, useCallback, useEffect, useRef, lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";
import { revealElement } from "@/lib/reveal";
import ProblemInput from "@/components/solver/ProblemInput";
import { readLastTopic, writeLastTopic, expressionNudge } from "@/lib/solverPrefs";
import { Lightbulb } from "lucide-react";
import SolutionDisplay from "@/components/solver/SolutionDisplay";
import GraphEmptyState from "@/components/solver/GraphEmptyState";
import { createProblemHistory } from "@/lib/api";
import { solveWithBudget, warmSolver } from "@/lib/budgetedSolver";
import { STATUS, statusLabel, shouldSaveToHistory } from "@/lib/solutionEnvelope";
import { useToast } from "@/components/ui/toast";
import { usePageTitle } from "@/hooks/usePageTitle";

// Recharts is ~150 kB gzipped and only a subset of solutions produce a graph,
// so the chart component is fetched the first time one actually does. Until
// then the panel shows the lightweight placeholder.
const GraphViewer = lazy(() => import("@/components/solver/GraphViewer"));

const MAX_HISTORY = 20;

export default function Solver() {
  usePageTitle("Solver - Step-by-Step Math Solutions");
  // The landing page's worked example links here with the problem to try.
  const location = useLocation();
  const prefill = location.state && typeof location.state.problem === 'string' ? location.state : null;
  const [problem, setProblem] = useState(prefill ? prefill.problem : "");
  // Never an empty form: the last topic used, else Algebra.
  const [topic, setTopic] = useState(prefill && typeof prefill.topic === 'string' ? prefill.topic : readLastTopic(globalThis.localStorage));
  useEffect(() => { writeLastTopic(globalThis.localStorage, topic); }, [topic]);
  // The bare-expression nudge for the solution on screen, if any.
  const [nudge, setNudge] = useState(null);
  const [solution, setSolution] = useState(null);
  // What the displayed solution was actually produced from. Kept separate from
  // the live `problem`/`topic` state so the exports describe the solution on
  // screen rather than whatever has since been typed into the form.
  const [solvedInput, setSolvedInput] = useState({ problem: "", topic: "" });
  const [graphData, setGraphData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [inputHistory, setInputHistory] = useState([]);   // recent inputs
  const [historyIndex, setHistoryIndex] = useState(-1);   // -1 = current input
  const toast = useToast();

  // After a solve, bring the solution into view and give it focus. On a phone
  // it sits below the input (the user is looking at the button they pressed);
  // on a desktop it is already beside the input and revealElement leaves the
  // page alone. Focus lets screen readers announce the result as well.
  const solutionRef = useRef(null);
  const graphRef = useRef(null);
  useEffect(() => {
    // Wait for the loading state to clear: the input card above the graph
    // loses its Cancel row then, and a smooth scroll that started earlier
    // would end that much too high.
    if (!solution || isLoading) return;
    // On a phone the page stacks input → graph → solution, so landing on the
    // solution skipped the graph and the reader scrolled back up to it. When
    // a graph was drawn and the layout is stacked (below Tailwind's lg
    // breakpoint), bring the graph into view and leave the reading order to
    // the reader; keyboard focus still goes to the solution so a screen
    // reader announces it. Without a graph, or beside the input on a desktop,
    // the solution is the target as before.
    // The graph now heads the results column on a desktop too (it used to
    // sit under the tall input card, below the fold), so with a graph the
    // graph is the target at every width; revealElement scrolls only when
    // it is not already in the upper part of the viewport.
    if (graphData?.points && graphRef.current) {
      revealElement(graphRef.current);
      solutionRef.current?.focus?.({ preventScroll: true });
    } else {
      revealElement(solutionRef.current, { focus: true });
    }
  }, [solution, isLoading, graphData]);

  // Start the solver worker now, so its bundle is loading while the user
  // types rather than when they press Solve.
  useEffect(() => { warmSolver(); }, []);

  // The in-flight solve, so Cancel can end it (the worker is terminated).
  const abortRef = useRef(null);
  const handleCancel = () => abortRef.current?.abort();

  // `problemText` is the sanitized string ProblemInput validated, which may
  // differ from the raw textarea contents (collapsed whitespace). Everything
  // downstream — the solve, the recall history, the saved record — uses that
  // one string, so what was validated is what gets solved and stored.
  // A problem the input refused (validation): the previous answer and graph
  // would otherwise stay on screen looking current.
  const handleInvalid = () => {
    setSolution(null);
    setGraphData(null);
    setNudge(null);
    setSolvedInput({ problem: "", topic: "" });
  };

  const handleSolve = async (problemText = problem, chosenTopic = topic) => {
    setIsLoading(true);
    // A red "Couldn't read that input" from the last attempt would otherwise
    // sit beside this solve's green "Problem solved!".
    toast.clearKinds?.(['error', 'warning']);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      // Runs in the worker with a time budget; null means the user cancelled.
      const result = await solveWithBudget(problemText, chosenTopic, { signal: controller.signal });
      if (!result) {
        toast.warning("Solve cancelled");
        return;
      }
      setSolution(result);
      setSolvedInput({ problem: problemText, topic: chosenTopic });
      setGraphData(result.graph);
      setNudge(expressionNudge(problemText, chosenTopic, result));

      // Add to input history (avoid duplicates of the last entry)
      setInputHistory(prev => {
        const entry = { problem: problemText, topic: chosenTopic };
        if (prev.length > 0 && prev[0].problem === problemText && prev[0].topic === chosenTopic) {
          return prev;
        }
        return [entry, ...prev].slice(0, MAX_HISTORY);
      });
      setHistoryIndex(-1);

      // Save to problem history — only outcomes about the maths (a solve,
      // "undefined", "indeterminate"). A typo, a refusal or an overflow is
      // not a solved problem; saving those polluted Progress and its stats.
      //
      // Persisting is a separate concern from solving, and it fails for
      // reasons that have nothing to do with the maths (storage quota,
      // private browsing, an evicted database). The solution is already on
      // screen and still correct at this point, so a save failure gets its
      // own message instead of being reported as a failed solve.
      let saved = true;
      if (shouldSaveToHistory(result.status)) {
        try {
          await createProblemHistory({
            problem: problemText,
            // File it under the topic it was solved as (the router may have
            // overridden the dropdown: "d/dx x^3" under Algebra is a derivative).
            topic: result.routedTopic || chosenTopic,
            solution: result,
            feedback: statusLabel(result.status)
          });
        } catch (saveError) {
          saved = false;
          console.error("Error saving problem to history:", saveError);
        }
      }

      // The toast tells the truth about the outcome: green only for a real
      // solve, red for unreadable input, amber for honest non-answers
      // (unsupported, undefined, indeterminate, overflow).
      if (result.status === STATUS.SOLVED) {
        toast.success("Problem solved!");
      } else if (result.status === STATUS.PARSE_ERROR) {
        toast.error("Couldn't read that input — see the notes below");
      } else {
        toast.warning(statusLabel(result.status));
      }

      if (!saved) {
        toast.warning("Couldn't save this to your history");
      }
    } catch (error) {
      console.error("Error solving problem:", error);
      toast.error("Failed to solve problem. Please try again.");
    } finally {
      abortRef.current = null;
      setIsLoading(false);
    }
  };

  // Navigate through input history (called from ProblemInput on ArrowUp/ArrowDown)
  const navigateHistory = useCallback((direction) => {
    if (inputHistory.length === 0) return;

    setHistoryIndex(prev => {
      let newIndex;
      if (direction === 'up') {
        newIndex = Math.min(prev + 1, inputHistory.length - 1);
      } else {
        newIndex = Math.max(prev - 1, -1);
      }

      if (newIndex === -1) {
        // Back to the current (empty) input; the topic stays.
        setProblem('');
      } else {
        const entry = inputHistory[newIndex];
        setProblem(entry.problem);
        setTopic(entry.topic);
      }

      return newIndex;
    });
  }, [inputHistory]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-linear-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent mb-2">
          Let's Master Some Math!
        </h1>
        <p className="text-gray-600 dark:text-gray-300 text-lg">
          Choose a topic and enter a supported math problem — from arithmetic and algebra through precalculus and calculus — and you'll get a step-by-step solution
        </p>
      </div>

      {/* Input on the left; graph then steps on the right, so the graph is
          in view beside the input on a desktop (it used to sit under the
          input card, below the fold). On a phone the columns stack in the
          same order: input, graph, solution. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border-2 border-indigo-200 dark:border-gray-700 shadow-lg">
            <ProblemInput
              problem={problem}
              setProblem={setProblem}
              topic={topic}
              setTopic={setTopic}
              onSolve={handleSolve}
              onInvalid={handleInvalid}
              isLoading={isLoading}
              onCancel={handleCancel}
              onNavigateHistory={navigateHistory}
              hasHistory={inputHistory.length > 0}
            />
          </div>
        </div>

        <div className="space-y-6">
          <div ref={graphRef} className="scroll-mt-20 lg:scroll-mt-0">
            {graphData?.points ? (
              <Suspense fallback={<GraphEmptyState message="Drawing your graph..." />}>
                <GraphViewer functionData={graphData} />
              </Suspense>
            ) : (
              <GraphEmptyState />
            )}
          </div>

          {nudge && solution && (
            <div role="note" className="flex flex-wrap items-center gap-3 p-4 rounded-xl border-2 border-amber-200 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-100">
              <Lightbulb className="w-5 h-5 text-amber-500 shrink-0" aria-hidden="true" />
              <p className="text-sm flex-1 min-w-48">{nudge.message}</p>
              <div className="flex flex-wrap gap-2">
                {nudge.options.map((opt) => (
                  <button
                    key={opt.topic}
                    type="button"
                    onClick={() => { setTopic(opt.topic); handleSolve(solvedInput.problem, opt.topic); }}
                    className="min-h-11 px-3 rounded-lg border border-amber-300 dark:border-amber-600 bg-white dark:bg-gray-800 text-sm font-medium text-amber-900 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-gray-700 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-600 dark:focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-800 transition-colors"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div ref={solutionRef} tabIndex={-1} aria-label="Solution" className="outline-hidden scroll-mt-20 lg:scroll-mt-0">
            <SolutionDisplay solution={solution} problem={solvedInput.problem} topic={solvedInput.topic} />
          </div>
        </div>
      </div>
    </div>
  );
}
