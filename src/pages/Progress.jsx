import React, { useState, useEffect, lazy, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Trash2, Download, ChevronDown, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { fetchProblemHistory, clearProblemHistory } from "@/lib/problemHistory";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { exportAsCSV, exportAsJSON, exportAsMarkdown, exportAsPDF } from "@/lib/exportUtils";
import { usePageTitle } from "@/hooks/usePageTitle";
import { readPlainEnglish } from "@/lib/plainEnglish";

// History entries typeset like the Solver's input preview (1.53.0). KaTeX
// loads after the list has drawn: until then each entry shows as typed.
const MathText = lazy(() => import("@/components/MathText"));
const Typeset = ({ text, mode }) => (
  <Suspense fallback={text}>
    <MathText mode={mode} text={mode === "input" ? readPlainEnglish(text) : text} />
  </Suspense>
);
import { historyStats } from "@/lib/historyStats";
import { statusLabel, countsAsSolved } from "@/lib/solutionEnvelope";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Progress() {
  usePageTitle("My Progress - Track Your Learning Journey");
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const confirm = useConfirm();

  // Map topic values to display labels
  const topicLabels = {
    derivatives: "Derivatives",
    integrals: "Integrals",
    limits: "Limits",
    functions: "Functions",
    trigonometry: "Trigonometry",
    algebra: "Algebra",
    other: "Arithmetic"
  };

  useEffect(() => {
    loadProblems();
  }, []);

  const loadProblems = async () => {
    try {
      const data = await fetchProblemHistory();
      setProblems(data || []);
    } catch (error) {
      console.error("Error loading problems:", error);
      setProblems([]);
      toast.error("Failed to load problem history");
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    const confirmed = await confirm(
      "Are you sure you want to clear all your problem history? This action cannot be undone.",
      "Clear All History"
    );

    if (confirmed) {
      try {
        await clearProblemHistory();
        setProblems([]);
        toast.success("Problem history cleared successfully");
      } catch (error) {
        console.error("Error clearing history:", error);
        toast.error("Failed to clear history. Please try again.");
      }
    }
  };

  const handleExport = async (format) => {
    try {
      switch (format) {
        case 'csv':
          exportAsCSV(problems, topicLabels);
          toast.success("Exported as CSV successfully");
          break;
        case 'json':
          exportAsJSON(problems);
          toast.success("Exported as JSON successfully");
          break;
        case 'markdown':
          exportAsMarkdown(problems, topicLabels);
          toast.success("Exported as Markdown successfully");
          break;
        case 'pdf':
          // Awaited: the PDF writer is fetched on demand, so a failure to load
          // it must surface as an export error rather than a silent no-op.
          await exportAsPDF(problems, topicLabels);
          toast.success("Exported as PDF successfully");
          break;
      }
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export. Please try again.");
    }
  };

  // Statistics count solved problems only; older entries that recorded a
  // refusal or an error are shown below with a status badge but not counted.
  const stats = historyStats(problems);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-linear-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent mb-2">
          Your Learning Journey
        </h1>
        <p className="text-gray-600 dark:text-gray-300 text-lg">
          Track your progress and see how far you've come!
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-linear-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950/40 dark:to-indigo-950/40 border-2 border-indigo-200 dark:border-indigo-700/60">
          <CardHeader>
            <CardTitle className="text-indigo-700 dark:text-indigo-300 text-lg">Problems Solved</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-5xl font-bold text-indigo-600 dark:text-indigo-200" aria-busy={loading}>{loading ? '—' : stats.total}</p>
            {/* The exports print the same count in the same words
                (historyTotalsText); entries that are not solves are said
                to be there, so the list below never outnumbers the card
                without a reason. */}
            {!loading && stats.notSolved > 0 && (
              <p className="mt-1 text-sm text-indigo-700 dark:text-indigo-300">of {problems.length} in history</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-linear-to-br from-green-50 to-green-100 dark:from-green-950/40 dark:to-green-950/40 border-2 border-green-200 dark:border-green-700/60">
          <CardHeader>
            <CardTitle className="text-green-700 dark:text-green-300 text-lg">This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-5xl font-bold text-green-600 dark:text-green-200" aria-busy={loading}>{loading ? '—' : stats.thisWeek}</p>
          </CardContent>
        </Card>

        <Card className="bg-linear-to-br from-orange-50 to-orange-100 dark:from-orange-950/40 dark:to-orange-950/40 border-2 border-orange-200 dark:border-orange-700/60">
          <CardHeader>
            <CardTitle className="text-orange-700 dark:text-orange-300 text-lg">Topics Covered</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-5xl font-bold text-orange-600 dark:text-orange-200" aria-busy={loading}>{loading ? '—' : stats.topics}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-2 border-indigo-200 dark:border-gray-700 dark:bg-gray-800 shadow-lg">
        <CardHeader className="bg-linear-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-700 border-b border-indigo-200 dark:border-gray-700">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <CardTitle className="text-xl dark:text-gray-100">Problem History</CardTitle>
            {problems.length > 0 && (
              <div className="flex gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-700 dark:hover:text-indigo-300 hover:border-indigo-300 dark:hover:border-indigo-600"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export
                      <ChevronDown className="w-4 h-4 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" aria-label="Export history as">
                    <DropdownMenuItem onClick={() => handleExport('pdf')}>
                      Export as PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport('csv')}>
                      Export as CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport('json')}>
                      Export as JSON
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport('markdown')}>
                      Export as Markdown
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  onClick={handleClearHistory}
                  variant="outline"
                  className="border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-700 dark:hover:text-red-300 hover:border-red-300 dark:hover:border-red-700"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear History
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
            </div>
          ) : problems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <BookOpen className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-lg">
                No problems solved yet. Start solving to track your progress!
              </p>
            </div>
          ) : (
            // A list, one item per problem: a screen reader hears "list, 3
            // items", and each entry's topic and date belong to it.
            <ul className="space-y-4">
              {problems.map((p, idx) => (
                <li
                  key={idx}
                  className="p-4 rounded-lg border-2 border-indigo-200 dark:border-gray-700 bg-linear-to-r from-blue-50 to-indigo-50 dark:from-gray-700/60 dark:to-gray-700/60 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="px-3 py-1 rounded-full bg-indigo-200 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-sm font-medium">
                        {topicLabels[p.topic] || p.topic}
                      </span>
                      {/* An entry that is not a solve — "Undefined", or a refusal saved
                          before v1.33.1 — says so, and is not counted in the stats. */}
                      {!countsAsSolved(p) && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-xs font-medium">
                          {statusLabel(p.solution.status)}
                        </span>
                      )}
                      {p.solveCount > 1 && (
                        <span className="px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-100 text-xs font-medium">
                          Solved {p.solveCount} times
                        </span>
                      )}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-gray-800 dark:text-gray-100 font-medium"><Typeset mode="input" text={p.problem} /></p>
                  {p.solution && (
                    <p className="text-gray-600 dark:text-gray-300 text-sm mt-2">
                      {countsAsSolved(p) ? 'Solution' : 'Result'}: <Typeset mode="auto" text={String(typeof p.solution === 'string' ? p.solution : p.solution.answer)} />
                    </p>
                  )}
                  {/* Back to the Solver with this problem and its saved
                      steps on screen (October 2026 review: history entries
                      could not be reopened). */}
                  <Link
                    to={createPageUrl("Solver")}
                    state={{ problem: p.problem, topic: p.topic, solution: p.solution }}
                    aria-label={`Open in Solver: ${p.problem}`}
                    className="inline-flex items-center gap-1 mt-3 min-h-11 text-sm font-medium text-indigo-700 dark:text-indigo-300 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-600 dark:focus-visible:ring-indigo-400 rounded"
                  >
                    <span aria-hidden="true">Open in Solver</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
