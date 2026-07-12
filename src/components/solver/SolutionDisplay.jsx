import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, BookOpen, Lightbulb, Download, ChevronDown, ArrowRight, Eye, Footprints } from "lucide-react";
import { motion } from "framer-motion";
import MathText from "@/components/MathText";
import { exportSolutionAsMarkdown, exportSolutionAsJSON, exportSolutionAsPDF } from "@/lib/exportUtils";
import { useToast } from "@/components/ui/toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const TOPIC_LABELS = {
  derivatives: "Derivatives",
  integrals: "Integrals",
  limits: "Limits",
  functions: "Functions",
  trigonometry: "Trigonometry",
  algebra: "Algebra",
  other: "Arithmetic"
};

export default function SolutionDisplay({ solution, problem, topic }) {
  const toast = useToast();

  const steps = solution?.steps || [];
  const [stepThrough, setStepThrough] = useState(false);
  const [revealed, setRevealed] = useState(0);

  // Restart the walkthrough whenever a new problem is solved.
  useEffect(() => {
    setRevealed(1);
  }, [solution]);

  const allRevealed = !stepThrough || revealed >= steps.length;

  const handleExportSolution = (format) => {
    if (!solution || !problem || !topic) return;

    try {
      switch (format) {
        case 'pdf':
          exportSolutionAsPDF(problem, topic, solution, TOPIC_LABELS);
          toast.success("Solution exported as PDF");
          break;
        case 'markdown':
          exportSolutionAsMarkdown(problem, topic, solution, TOPIC_LABELS);
          toast.success("Solution exported as Markdown");
          break;
        case 'json':
          exportSolutionAsJSON(problem, topic, solution);
          toast.success("Solution exported as JSON");
          break;
      }
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export solution");
    }
  };
  if (!solution) {
    return (
      <Card className="bg-white dark:bg-gray-800 border-2 border-green-200 dark:border-gray-700 shadow-lg rounded-xl">
        <CardHeader className="border-b border-green-100 dark:border-gray-700 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2 text-xl dark:text-gray-100">
            <BookOpen className="w-6 h-6 text-green-600 dark:text-green-400" />
            Solution & Feedback
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-emerald-100 dark:from-gray-700 dark:to-gray-700 rounded-full flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-green-500 dark:text-green-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              Your solution will appear here!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="bg-white dark:bg-gray-800 border-2 border-green-200 dark:border-gray-700 shadow-lg rounded-xl">
        <CardHeader className="border-b border-green-100 dark:border-gray-700 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-gray-700 dark:to-gray-700">
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2 text-xl dark:text-gray-100">
              <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
              Solution & Explanation
            </CardTitle>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700 hover:border-green-300"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                  <ChevronDown className="w-4 h-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExportSolution('pdf')}>
                  Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportSolution('markdown')}>
                  Export as Markdown
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportSolution('json')}>
                  Export as JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {steps.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-lg flex items-center gap-2 text-gray-800 dark:text-gray-200">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                  Step-by-Step Solution:
                </h3>
                {steps.length > 1 && (
                  <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5 bg-gray-50 dark:bg-gray-900/40">
                    <button
                      type="button"
                      onClick={() => setStepThrough(false)}
                      aria-pressed={!stepThrough}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        !stepThrough
                          ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-sm"
                          : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                      }`}
                    >
                      <Eye className="w-4 h-4" />
                      Show all
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStepThrough(true);
                        setRevealed(1);
                      }}
                      aria-pressed={stepThrough}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        stepThrough
                          ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-sm"
                          : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                      }`}
                    >
                      <Footprints className="w-4 h-4" />
                      Step through
                    </button>
                  </div>
                )}
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {(stepThrough ? steps.slice(0, revealed) : steps).map((step, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: stepThrough ? 0 : idx * 0.1 }}
                    className="py-4 first:pt-1"
                  >
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                        {idx + 1}
                      </div>
                      <p className="text-gray-800 dark:text-gray-100 flex-1 leading-relaxed"><MathText text={step} /></p>
                    </div>
                  </motion.div>
                ))}
              </div>
              {stepThrough && !allRevealed && (
                <div className="flex flex-col items-center gap-3 pt-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                    Try to predict the next step, then reveal it.
                  </p>
                  <div className="flex items-center gap-4">
                    <Button
                      onClick={() => setRevealed((r) => Math.min(r + 1, steps.length))}
                      className="px-6 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-sm hover:from-blue-600 hover:to-indigo-700"
                    >
                      Reveal next step
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <button
                      type="button"
                      onClick={() => setRevealed(steps.length)}
                      className="text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-300 underline underline-offset-2"
                    >
                      Reveal all
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Step {revealed} of {steps.length}
                  </p>
                </div>
              )}
            </div>
          )}

          {solution.answer && allRevealed && (
            <div className="p-5 rounded-xl bg-gradient-to-r from-green-100 to-emerald-100 dark:from-emerald-950/40 dark:to-green-950/40 border-2 border-green-300 dark:border-emerald-700">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Final Answer:</h3>
                  <p className="text-gray-800 dark:text-emerald-50 text-xl font-semibold"><MathText text={solution.answer} /></p>
                </div>
              </div>
            </div>
          )}

          {solution.tips && solution.tips.length > 0 && allRevealed && (
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2 text-gray-800 dark:text-gray-200">
                <Lightbulb className="w-5 h-5 text-amber-500" />
                Key Insights:
              </h3>
              <div className="space-y-2">
                {solution.tips.map((tip, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/20 border border-amber-200 dark:border-amber-700/60"
                  >
                    <p className="text-gray-700 dark:text-gray-200">{tip}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {solution.common_mistakes && solution.common_mistakes.length > 0 && allRevealed && (
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2 text-gray-800 dark:text-gray-200">
                <AlertCircle className="w-5 h-5 text-red-500" />
                Common Mistakes to Avoid:
              </h3>
              <div className="space-y-2">
                {solution.common_mistakes.map((mistake, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-950/30 dark:to-rose-950/20 border border-red-200 dark:border-red-800/60"
                  >
                    <p className="text-gray-700 dark:text-gray-200">{mistake}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}