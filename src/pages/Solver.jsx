import React, { useState, useCallback } from "react";
import ProblemInput from "@/components/solver/ProblemInput";
import SolutionDisplay from "@/components/solver/SolutionDisplay";
import GraphViewer from "@/components/solver/GraphViewer";
import { solveProblem, createProblemHistory } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { usePageTitle } from "@/hooks/usePageTitle";

const MAX_HISTORY = 20;

export default function Solver() {
  usePageTitle("Solver - Step-by-Step Math Solutions");
  const [problem, setProblem] = useState("");
  const [topic, setTopic] = useState("");
  const [solution, setSolution] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [inputHistory, setInputHistory] = useState([]);   // recent inputs
  const [historyIndex, setHistoryIndex] = useState(-1);   // -1 = current input
  const toast = useToast();

  const handleSolve = async () => {
    setIsLoading(true);
    try {
      const result = await solveProblem(problem, topic);
      setSolution(result);
      setGraphData(result.graph);

      // Add to input history (avoid duplicates of the last entry)
      setInputHistory(prev => {
        const entry = { problem, topic };
        if (prev.length > 0 && prev[0].problem === problem && prev[0].topic === topic) {
          return prev;
        }
        return [entry, ...prev].slice(0, MAX_HISTORY);
      });
      setHistoryIndex(-1);

      // Save to problem history
      await createProblemHistory({
        problem,
        topic,
        solution: result,
        feedback: "Solved successfully"
      });

      toast.success("Problem solved successfully!");
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
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
          Let's Master Some Math!
        </h1>
        <p className="text-gray-600 text-lg">
          Enter any precalculus or calculus problem and I'll guide you through it step-by-step
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border-2 border-purple-200 dark:border-gray-700 shadow-lg">
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

          <GraphViewer functionData={graphData} />
        </div>

        <div>
          <SolutionDisplay solution={solution} problem={problem} topic={topic} />
        </div>
      </div>
    </div>
  );
}
