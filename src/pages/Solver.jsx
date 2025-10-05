import React, { useState } from "react";
import ProblemInput from "@/components/solver/ProblemInput";
import SolutionDisplay from "@/components/solver/SolutionDisplay";
import GraphViewer from "@/components/solver/GraphViewer";
import { solveProblem, createProblemHistory } from "@/lib/api";
import { useToast } from "@/components/ui/toast";

export default function Solver() {
  const [problem, setProblem] = useState("");
  const [topic, setTopic] = useState("");
  const [solution, setSolution] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  const handleSolve = async () => {
    setIsLoading(true);
    try {
      const result = await solveProblem(problem, topic);
      setSolution(result);
      setGraphData(result.graph);

      // Save to problem history
      await createProblemHistory({
        problem,
        topic,
        solution: result.answer,
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
          Let's Solve Some Math!
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
