import React, { useState, useCallback, lazy, Suspense } from "react";
import ProblemInput from "@/components/solver/ProblemInput";
import SolutionDisplay from "@/components/solver/SolutionDisplay";
import GraphEmptyState from "@/components/solver/GraphEmptyState";
import { solveProblem, createProblemHistory } from "@/lib/api";
import { STATUS, statusLabel } from "@/lib/solutionEnvelope";
import { useToast } from "@/components/ui/toast";
import { usePageTitle } from "@/hooks/usePageTitle";

// Recharts is ~150 kB gzipped and only a subset of solutions produce a graph,
// so the chart component is fetched the first time one actually does. Until
// then the panel shows the lightweight placeholder.
const GraphViewer = lazy(() => import("@/components/solver/GraphViewer"));

const MAX_HISTORY = 20;

export default function Solver() {
  usePageTitle("Solver - Step-by-Step Math Solutions");
  const [problem, setProblem] = useState("");
  const [topic, setTopic] = useState("");
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

  // `problemText` is the sanitized string ProblemInput validated, which may
  // differ from the raw textarea contents (collapsed whitespace). Everything
  // downstream — the solve, the recall history, the saved record — uses that
  // one string, so what was validated is what gets solved and stored.
  const handleSolve = async (problemText = problem) => {
    setIsLoading(true);
    try {
      const result = await solveProblem(problemText, topic);
      setSolution(result);
      setSolvedInput({ problem: problemText, topic });
      setGraphData(result.graph);

      // Add to input history (avoid duplicates of the last entry)
      setInputHistory(prev => {
        const entry = { problem: problemText, topic };
        if (prev.length > 0 && prev[0].problem === problemText && prev[0].topic === topic) {
          return prev;
        }
        return [entry, ...prev].slice(0, MAX_HISTORY);
      });
      setHistoryIndex(-1);

      // Save to problem history — except parse errors: a typo is not a
      // solved problem, and saving it would pollute the Progress stats.
      //
      // Persisting is a separate concern from solving, and it fails for
      // reasons that have nothing to do with the maths (storage quota,
      // private browsing, an evicted database). The solution is already on
      // screen and still correct at this point, so a save failure gets its
      // own message instead of being reported as a failed solve.
      let saved = true;
      if (result.status !== STATUS.PARSE_ERROR) {
        try {
          await createProblemHistory({
            problem: problemText,
            // File it under the topic it was solved as (the router may have
            // overridden the dropdown: "d/dx x^3" under Algebra is a derivative).
            topic: result.routedTopic || topic,
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
        // Back to current (empty) input
        setProblem('');
        setTopic('');
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
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent mb-2">
          Let's Master Some Math!
        </h1>
        <p className="text-gray-600 dark:text-gray-300 text-lg">
          Choose a topic and enter a supported math problem — from arithmetic and algebra through precalculus and calculus — and you'll get a step-by-step solution
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border-2 border-indigo-200 dark:border-gray-700 shadow-lg">
            <ProblemInput
              problem={problem}
              setProblem={setProblem}
              topic={topic}
              setTopic={setTopic}
              onSolve={handleSolve}
              isLoading={isLoading}
              onNavigateHistory={navigateHistory}
              hasHistory={inputHistory.length > 0}
            />
          </div>

          {graphData?.points ? (
            <Suspense fallback={<GraphEmptyState message="Drawing your graph..." />}>
              <GraphViewer functionData={graphData} />
            </Suspense>
          ) : (
            <GraphEmptyState />
          )}
        </div>

        <div>
          <SolutionDisplay solution={solution} problem={solvedInput.problem} topic={solvedInput.topic} />
        </div>
      </div>
    </div>
  );
}
