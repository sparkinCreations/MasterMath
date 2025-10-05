import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, BookOpen, Lightbulb, Download, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
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
        <CardHeader className="border-b border-green-100 bg-gradient-to-r from-green-50 to-emerald-50">
          <CardTitle className="flex items-center gap-2 text-xl">
            <BookOpen className="w-6 h-6 text-green-600" />
            Solution & Feedback
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-green-500" />
            </div>
            <p className="text-gray-500 text-lg">
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
        <CardHeader className="border-b border-green-100 bg-gradient-to-r from-green-50 to-emerald-50">
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2 text-xl">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
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
          {solution.steps && solution.steps.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2 text-gray-800 dark:text-gray-200">
                <BookOpen className="w-5 h-5 text-purple-600" />
                Step-by-Step Solution:
              </h3>
              <div className="space-y-3">
                {solution.steps.map((step, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 border-l-4 border-purple-400"
                  >
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm">
                        {idx + 1}
                      </div>
                      <p className="text-gray-800 flex-1 leading-relaxed">{step}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {solution.answer && (
            <div className="p-5 rounded-xl bg-gradient-to-r from-green-100 to-emerald-100 border-2 border-green-300">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-lg text-gray-800 mb-2">Final Answer:</h3>
                  <p className="text-gray-800 text-xl font-semibold">{solution.answer}</p>
                </div>
              </div>
            </div>
          )}

          {solution.tips && solution.tips.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2 text-gray-800 dark:text-gray-200">
                <Lightbulb className="w-5 h-5 text-amber-500" />
                Key Insights:
              </h3>
              <div className="space-y-2">
                {solution.tips.map((tip, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200"
                  >
                    <p className="text-gray-700">{tip}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {solution.common_mistakes && solution.common_mistakes.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2 text-gray-800 dark:text-gray-200">
                <AlertCircle className="w-5 h-5 text-red-500" />
                Common Mistakes to Avoid:
              </h3>
              <div className="space-y-2">
                {solution.common_mistakes.map((mistake, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-gradient-to-r from-red-50 to-pink-50 border border-red-200"
                  >
                    <p className="text-gray-700">{mistake}</p>
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