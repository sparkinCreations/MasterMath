import React, { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Trash2, Download, ChevronDown, ArrowRight, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { fetchProblemHistory, clearProblemHistory, deleteProblemHistory, problemKey } from "@/lib/problemHistory";
import { filterHistory, topicCounts, HISTORY_PAGE_SIZE } from "@/lib/historyView";
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
  usePageTitle("My Progress - Your Problem History");
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  // Search, topic filter and how many are shown (1.59.0): the list used to
  // grow without end, with no way to find last Tuesday's integral.
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("all");
  const [visible, setVisible] = useState(HISTORY_PAGE_SIZE);
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

  // One entry, after a confirmation like Clear History's: a problem solved
  // by mistake no longer means wiping everything.
  const handleDelete = async (entry) => {
    const confirmed = await confirm(`Delete "${entry.problem}" from your history? This cannot be undone.`, "Delete Problem");
    if (!confirmed) return;
    try {
      await deleteProblemHistory(entry);
      setProblems((prev) => prev.filter((p) => problemKey(p) !== problemKey(entry)));
      toast.success("Problem deleted from your history");
    } catch (error) {
      console.error("Error deleting problem:", error);
      toast.error(error.message);
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
  const topics = useMemo(() => topicCounts(problems, topicLabels), [problems]); // eslint-disable-line react-hooks/exhaustive-deps -- topicLabels is a constant
  const filtered = useMemo(() => filterHistory(problems, { query, topic }), [problems, query, topic]);
  const shown = filtered.slice(0, visible);
  const filtering = query.trim() !== "" || topic !== "all";
  // A new search or topic starts again at the first page.
  useEffect(() => { setVisible(HISTORY_PAGE_SIZE); }, [query, topic]);
  // A filter on a topic whose last entry was deleted falls back to all.
  useEffect(() => { if (topic !== "all" && !topics.some((t) => t.topic === topic)) setTopic("all"); }, [topics, topic]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        {/* Said as it is (1.59.0): a record of the problems worked through
            here, not a measure of learning ("Your Learning Journey — see how
            far you've come!" claimed what the page cannot know). */}
        <h1 className="text-4xl font-bold bg-linear-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent mb-2">
          Your Problem History
        </h1>
        <p className="text-gray-600 dark:text-gray-300 text-lg">
          Every problem you have worked through in this browser, newest first. It is stored on this device only.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:gap-6 mb-8">
        <Card className="bg-linear-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950/40 dark:to-indigo-950/40 border-2 border-indigo-200 dark:border-indigo-700/60">
          <CardHeader>
            <CardTitle className="text-indigo-700 dark:text-indigo-300 text-base md:text-lg">Problems Worked Through</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl md:text-5xl font-bold text-indigo-600 dark:text-indigo-200" aria-busy={loading}>{loading ? '—' : stats.total}</p>
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
            <CardTitle className="text-green-700 dark:text-green-300 text-base md:text-lg">This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl md:text-5xl font-bold text-green-600 dark:text-green-200" aria-busy={loading}>{loading ? '—' : stats.thisWeek}</p>
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
                No problems yet. Problems you solve in the Solver appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Find a problem: words or maths from the problem or its
                  answer, spacing ignored; and the topics, each with its count
                  (the breakdown "Topics covered: 3" never gave), as filters. */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400" aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search your history"
                  aria-label="Search your problems and answers"
                  className="w-full min-h-11 pl-9 pr-3 rounded-lg border-2 border-indigo-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-600 dark:focus-visible:ring-indigo-400"
                />
              </div>
              <div role="group" aria-label="Filter by topic" className="flex flex-wrap gap-2">
                {[{ topic: "all", label: "All topics", count: problems.length }, ...topics].map((t) => (
                  <button
                    key={t.topic}
                    type="button"
                    onClick={() => setTopic(t.topic)}
                    aria-pressed={topic === t.topic}
                    className={`min-h-11 px-3 rounded-full border text-sm font-medium transition-colors ${
                      topic === t.topic
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "bg-white dark:bg-gray-800 border-indigo-200 dark:border-gray-600 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    {t.label} ({t.count})
                  </button>
                ))}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400" aria-live="polite">
                {filtered.length === 0
                  ? "No problems match."
                  : `Showing ${shown.length} of ${filtered.length}${filtering ? ` matching (${problems.length} in all)` : ""}`}
              </p>

              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                  <p className="text-gray-600 dark:text-gray-300">Nothing in your history matches that.</p>
                  <Button variant="outline" onClick={() => { setQuery(""); setTopic("all"); }} className="dark:text-gray-100 dark:border-gray-600">
                    Clear search and filter
                  </Button>
                </div>
              ) : (
                // A list, one item per problem: a screen reader hears "list, 3
                // items", and each entry's topic and date belong to it.
                <ul className="space-y-4">
                  {shown.map((p) => (
                    <li
                      key={problemKey(p)}
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
                      <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                        {/* Back to the Solver with this problem and its saved
                            steps on screen (October 2026 review: history entries
                            could not be reopened). */}
                        <Link
                          to={createPageUrl("Solver")}
                          state={{ problem: p.problem, topic: p.topic, solution: p.solution }}
                          aria-label={`Open in Solver: ${p.problem}`}
                          className="inline-flex items-center gap-1 min-h-11 text-sm font-medium text-indigo-700 dark:text-indigo-300 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-600 dark:focus-visible:ring-indigo-400 rounded"
                        >
                          <span aria-hidden="true">Open in Solver</span>
                          <ArrowRight className="w-4 h-4" aria-hidden="true" />
                        </Link>
                        {/* One entry at a time (1.59.0). Named by aria-label, its
                            icon hidden, so it is announced once. */}
                        <button
                          type="button"
                          onClick={() => handleDelete(p)}
                          aria-label={`Delete from history: ${p.problem}`}
                          className="inline-flex items-center justify-center min-h-11 min-w-11 rounded-lg text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-red-500"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {/* The newest first, a page at a time, so the page stays quick
                  after hundreds of problems. */}
              {filtered.length > shown.length && (
                <div className="flex justify-center">
                  <Button variant="outline" onClick={() => setVisible((v) => v + HISTORY_PAGE_SIZE)} className="dark:text-gray-100 dark:border-gray-600">
                    Show {Math.min(HISTORY_PAGE_SIZE, filtered.length - shown.length)} more
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
