import React, { useState, useEffect, useId } from "react";
import { readSolutionMode, writeSolutionMode } from "@/lib/solverPrefs";
import { SHOWN_AT_FIRST, sourceOf } from "@/lib/guidance";
import { learnMoreFor } from "@/lib/learnMore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, AlertTriangle, BookOpen, Lightbulb, Download, ChevronDown, ArrowRight, ArrowLeftRight, Eye, Footprints, ExternalLink, GraduationCap } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import MathText from "@/components/MathText";
import { STATUS, statusLabel } from "@/lib/solutionEnvelope";
import { exportSolutionAsMarkdown, exportSolutionAsJSON, exportSolutionAsPDF } from "@/lib/exportUtils";
import { useToast } from "@/components/ui/toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const TOPIC_LABELS = {
  auto: "Auto-detect",
  derivatives: "Derivatives",
  integrals: "Integrals",
  limits: "Limits",
  functions: "Functions",
  trigonometry: "Trigonometry",
  algebra: "Algebra",
  other: "Arithmetic"
};

// Visual treatment per envelope status. Green is reserved for a real solve;
// parse errors read as errors; the honest non-answers (unsupported,
// undefined, indeterminate, overflow) share an amber "heads-up" treatment.
// Results without a status (legacy history) render as solved, as before.
const AMBER_THEME = {
  Icon: AlertTriangle,
  headerIcon: "text-amber-600 dark:text-amber-400",
  badge: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700",
  card: "bg-linear-to-r from-amber-50 to-yellow-50 dark:from-amber-950/40 dark:to-yellow-950/30 border-2 border-amber-300 dark:border-amber-700",
  cardIcon: "text-amber-600 dark:text-amber-400",
  cardText: "text-gray-800 dark:text-amber-50",
  heading: "Result:",
};

const STATUS_THEMES = {
  [STATUS.SOLVED]: {
    Icon: CheckCircle2,
    headerIcon: "text-green-600 dark:text-green-400",
    badge: "bg-green-100 text-green-800 border-green-300 dark:bg-green-950/60 dark:text-green-200 dark:border-green-700",
    card: "bg-linear-to-r from-green-100 to-emerald-100 dark:from-emerald-950/40 dark:to-green-950/40 border-2 border-green-300 dark:border-emerald-700",
    cardIcon: "text-green-600 dark:text-green-400",
    cardText: "text-gray-800 dark:text-emerald-50",
    heading: "Final Answer:",
  },
  [STATUS.PARSE_ERROR]: {
    Icon: AlertCircle,
    headerIcon: "text-red-600 dark:text-red-400",
    badge: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-200 dark:border-red-700",
    card: "bg-linear-to-r from-red-50 to-rose-50 dark:from-red-950/40 dark:to-rose-950/30 border-2 border-red-300 dark:border-red-800",
    cardIcon: "text-red-600 dark:text-red-400",
    cardText: "text-gray-800 dark:text-red-50",
    heading: "What went wrong:",
  },
  [STATUS.UNSUPPORTED]: AMBER_THEME,
  [STATUS.UNDEFINED]: AMBER_THEME,
  [STATUS.INDETERMINATE]: AMBER_THEME,
  [STATUS.OVERFLOW]: AMBER_THEME,
  [STATUS.DIVERGES]: AMBER_THEME,
};

// The chart on the page (GraphViewer marks its wrapper), for the PDF: the
// window the user is looking at, and its text description as the caption.
function graphOnScreen() {
  const host = document.querySelector('[data-export-graph]');
  const svg = host?.querySelector('svg.recharts-surface');
  if (!svg) return null;
  return { svg, label: host.getAttribute('aria-label'), dark: document.documentElement.classList.contains('dark') };
}

// "Solved as Derivatives": the input's own notation chose a different topic
// from the dropdown (api.js routes by intent). Shown as a notice at the top of
// the solution, not a toast: it stays beside the answer it explains, can be
// read again after scrolling, and is part of what a screen reader reads.
function RoutingNotice({ routing, currentTopic, onSwitchTopic }) {
  const to = TOPIC_LABELS[routing.to] || routing.to;
  const from = TOPIC_LABELS[routing.from] || routing.from;
  const reason = String(routing.reason || '').replace(/^the input\b/i, 'Your input');
  const switched = currentTopic === routing.to;
  // Under Auto-detect nothing was overridden: say what was detected and
  // that a topic can still be chosen, with no switch to offer.
  if (routing.from === 'auto') {
    return (
      <div className="flex items-start gap-3 p-4 rounded-xl border border-indigo-200 dark:border-indigo-700/60 bg-indigo-50 dark:bg-indigo-950/40">
        <ArrowLeftRight className="w-5 h-5 text-indigo-600 dark:text-indigo-300 shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-gray-800 dark:text-gray-100">
          <strong>Detected as {to}.</strong>{reason ? ` ${reason.charAt(0).toUpperCase()}${reason.slice(1)}.` : ''}{' '}
          Not what you meant? Choose a topic above.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border border-indigo-200 dark:border-indigo-700/60 bg-indigo-50 dark:bg-indigo-950/40">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <ArrowLeftRight className="w-5 h-5 text-indigo-600 dark:text-indigo-300 shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-gray-800 dark:text-gray-100">
          <strong>Solved as {to}.</strong>{reason ? ` ${reason.charAt(0).toUpperCase()}${reason.slice(1)}.` : ''}{' '}
          {switched ? `The topic is now ${to}.` : `You had ${from} selected.`}
        </p>
      </div>
      {!switched && onSwitchTopic && (
        <Button
          type="button"
          variant="outline"
          onClick={() => onSwitchTopic(routing.to)}
          className="shrink-0 min-h-11 border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-indigo-950 text-indigo-700 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
        >
          Switch topic to {to}
        </Button>
      )}
    </div>
  );
}

const LINK_CLASS = "text-indigo-700 dark:text-indigo-300 underline underline-offset-2 hover:text-indigo-900 dark:hover:text-indigo-200";

// A link to another website: a new tab, no referrer, and said so.
function ExternalAnchor({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
      {children}
      <ExternalLink className="inline w-3.5 h-3.5 ml-1 -mt-0.5" aria-hidden="true" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

// Key Insights or Common Mistakes: the first three, then the rest one tap
// away (guidance.js). The same list, in the same order, for everyone.
function GuidanceList({ solution, items, heading, Icon, iconClass, itemClass, noun }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const extra = items.length - SHOWN_AT_FIRST;
  const shown = open || extra <= 0 ? items : items.slice(0, SHOWN_AT_FIRST);
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-lg flex items-center gap-2 text-gray-800 dark:text-gray-200">
        <Icon className={`w-5 h-5 ${iconClass}`} />
        {heading}
      </h3>
      <div id={listId} className="space-y-2">
        {shown.map((item, idx) => {
          const source = sourceOf(solution, item);
          return (
            <div key={idx} className={`p-3 rounded-lg border ${itemClass}`}>
              <p className="text-gray-700 dark:text-gray-200"><MathText mode="marked" text={item} /></p>
              {source && (
                <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300">
                  Source: <ExternalAnchor href={source.url}>{source.title}</ExternalAnchor>
                </p>
              )}
            </div>
          );
        })}
      </div>
      {extra > 0 && (
        <Button
          variant="ghost"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen(!open)}
          className="gap-1.5 min-h-11 px-3"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
          {open ? `Show fewer ${noun}s` : `Show ${extra} more ${noun}${extra === 1 ? "" : "s"}`}
        </Button>
      )}
    </div>
  );
}

// Lessons elsewhere on the topic the problem was solved as (learnMore.js).
function LearnMore({ topic }) {
  const links = learnMoreFor(topic);
  if (!links.length) return null;
  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-lg flex items-center gap-2 text-gray-800 dark:text-gray-200">
        <GraduationCap className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        Learn more
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Free lessons on other websites. They open in a new tab and need an internet connection.
      </p>
      <ul className="space-y-1.5">
        {links.map((link) => (
          <li key={link.url} className="text-gray-700 dark:text-gray-200">
            <span className="font-medium">{link.site}:</span>{" "}
            <ExternalAnchor href={link.url}>{link.title}</ExternalAnchor>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SolutionDisplay({ solution, problem, topic, currentTopic, onSwitchTopic }) {
  const toast = useToast();

  // A routed solve's first step is the "Solved as …" line, which the notice
  // shows instead (it stays in the result for exports and history).
  const routing = solution?.routing || null;
  const steps = (routing ? solution.steps.slice(1) : solution?.steps) || [];
  // Step-through for a new visitor (the app teaches the method; the first
  // thing a new user sees is the working unfolding); remembered once chosen.
  const [stepThroughChosen, setStepThroughState] = useState(() => readSolutionMode(globalThis.localStorage) === 'step');
  const setStepThrough = (next) => {
    writeSolutionMode(globalThis.localStorage, next ? 'step' : 'all');
    setStepThroughState(next);
  };
  const [revealed, setRevealed] = useState(0);
  // Only a worked solution is walked through. Input that could not be read,
  // or that the solver refuses, is shown all at once: "Step 1 of 2" and a
  // "Reveal next step" button over an error made the error a puzzle.
  const walkable = !solution?.status || ![STATUS.PARSE_ERROR, STATUS.UNSUPPORTED, STATUS.OVERFLOW].includes(solution.status);
  const stepThrough = walkable && stepThroughChosen;
  const notes = solution?.status === STATUS.PARSE_ERROR || solution?.status === STATUS.UNSUPPORTED;

  // Framer Motion is not covered by the CSS reduced-motion rules, so the two
  // slide-ins here opt out explicitly. `initial: false` renders the final
  // state immediately instead of translating content into place.
  const reduceMotion = useReducedMotion();
  const cardMotion = reduceMotion
    ? { initial: false }
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.5 },
      };
  const stepMotion = (idx) =>
    reduceMotion
      ? { initial: false }
      : {
          initial: { opacity: 0, x: -20 },
          animate: { opacity: 1, x: 0 },
          transition: { delay: stepThrough ? 0 : idx * 0.1 },
        };

  // Restart the walkthrough whenever a new problem is solved.
  useEffect(() => {
    setRevealed(1);
  }, [solution]);

  const allRevealed = !stepThrough || revealed >= steps.length;

  const handleExportSolution = async (format) => {
    if (!solution || !problem || !topic) return;
    // An export names the topic the problem was solved as, never "Auto-detect".
    const exportTopic = topic === 'auto' ? solution.routedTopic || topic : topic;

    try {
      switch (format) {
        case 'pdf':
          // Awaited: the PDF writer is fetched on demand, so a failure to load
          // it must surface as an export error rather than a silent no-op.
          await exportSolutionAsPDF(problem, exportTopic, solution, TOPIC_LABELS, { graph: graphOnScreen() });
          toast.success("Solution exported as PDF");
          break;
        case 'markdown':
          exportSolutionAsMarkdown(problem, exportTopic, solution, TOPIC_LABELS);
          toast.success("Solution exported as Markdown");
          break;
        case 'json':
          exportSolutionAsJSON(problem, exportTopic, solution);
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
        <CardHeader className="border-b border-green-100 dark:border-gray-700 bg-linear-to-r from-green-50 to-emerald-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2 text-xl dark:text-gray-100">
            <BookOpen className="w-6 h-6 text-green-600 dark:text-green-400" />
            Solution & Feedback
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 bg-linear-to-br from-green-100 to-emerald-100 dark:from-gray-700 dark:to-gray-700 rounded-full flex items-center justify-center mb-4">
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

  const status = solution.status;
  const theme = STATUS_THEMES[status] || STATUS_THEMES[STATUS.SOLVED];
  const StatusIcon = theme.Icon;

  return (
    <motion.div {...cardMotion}>
      <Card className="bg-white dark:bg-gray-800 border-2 border-green-200 dark:border-gray-700 shadow-lg rounded-xl">
        <CardHeader className="border-b border-green-100 dark:border-gray-700 bg-linear-to-r from-green-50 to-emerald-50 dark:from-gray-700 dark:to-gray-700">
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2 text-xl dark:text-gray-100">
              <StatusIcon className={`w-6 h-6 ${theme.headerIcon}`} />
              Solution & Explanation
              {status && (
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${theme.badge}`}>
                  {statusLabel(status)}
                </span>
              )}
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
              <DropdownMenuContent align="end" aria-label="Export solution as">
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
          {routing && <RoutingNotice routing={routing} currentTopic={currentTopic} onSwitchTopic={onSwitchTopic} />}
          {/* What the solver understood, before any step: a misread input
              ("sec·x" for sec³x) shows here at a glance (1.58.0). */}
          {solution.readAs && (
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <span className="font-semibold">Read as:</span>{" "}
              <MathText mode="input" text={solution.readAs} />
            </p>
          )}
          {steps.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-lg flex items-center gap-2 text-gray-800 dark:text-gray-200">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                  {notes ? 'Notes:' : 'Step-by-Step Solution:'}
                </h3>
                {walkable && steps.length > 1 && (
                  <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5 bg-gray-50 dark:bg-gray-900/40">
                    <button
                      type="button"
                      onClick={() => setStepThrough(false)}
                      aria-pressed={!stepThroughChosen}
                      className={`flex items-center gap-1.5 px-3 min-h-11 rounded-md text-sm font-medium transition-colors ${
                        !stepThroughChosen
                          ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-xs"
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
                      aria-pressed={stepThroughChosen}
                      className={`flex items-center gap-1.5 px-3 min-h-11 rounded-md text-sm font-medium transition-colors ${
                        stepThroughChosen
                          ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-xs"
                          : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                      }`}
                    >
                      <Footprints className="w-4 h-4" />
                      Step through
                    </button>
                  </div>
                )}
              </div>
              {/* An ordered list, so a screen reader announces "list, 6 items"
                  and can move step by step. */}
              <ol className="divide-y divide-gray-200 dark:divide-gray-700">
                {(stepThrough ? steps.slice(0, revealed) : steps).map((step, idx) => (
                  <motion.li
                    key={idx}
                    {...stepMotion(idx)}
                    className="py-4 first:pt-1"
                  >
                    <div className="flex gap-3">
                      <div className="shrink-0 w-8 h-8 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                        <span className="sr-only">Step </span>{idx + 1}
                      </div>
                      <p className="text-gray-800 dark:text-gray-100 flex-1 leading-relaxed"><MathText text={step} /></p>
                    </div>
                  </motion.li>
                ))}
              </ol>
              {stepThrough && !allRevealed && (
                <div className="flex flex-col items-center gap-3 pt-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                    Try to predict the next step, then reveal it.
                  </p>
                  <div className="flex items-center gap-4">
                    <Button
                      onClick={() => setRevealed((r) => Math.min(r + 1, steps.length))}
                      className="px-6 py-3 rounded-lg bg-linear-to-r from-blue-500 to-indigo-600 text-white shadow-xs hover:from-blue-600 hover:to-indigo-700"
                    >
                      Reveal next step
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <button
                      type="button"
                      onClick={() => setRevealed(steps.length)}
                      className="min-h-11 px-3 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-gray-700 underline underline-offset-2 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-600 dark:focus-visible:ring-indigo-400"
                    >
                      Reveal all
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Step {revealed} of {steps.length}
                  </p>
                </div>
              )}
            </div>
          )}

          {solution.answer && allRevealed && (
            <div className={`p-5 rounded-xl ${theme.card}`}>
              <div className="flex items-start gap-3">
                <StatusIcon className={`w-6 h-6 ${theme.cardIcon} shrink-0 mt-1`} />
                <div>
                  <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-2">{theme.heading}</h3>
                  <p className={`${theme.cardText} text-xl font-semibold`}><MathText text={solution.answer} /></p>
                  {solution.warnings && solution.warnings.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {solution.warnings.map((warning, idx) => (
                        <li key={idx} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <span>{warning}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {solution.tips && solution.tips.length > 0 && allRevealed && (
            <GuidanceList
              key={`tips|${problem}|${solution.answer}`}
              solution={solution}
              items={solution.tips}
              heading="Key Insights:"
              Icon={Lightbulb}
              iconClass="text-amber-500"
              itemClass="bg-linear-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/20 border-amber-200 dark:border-amber-700/60"
              noun="insight"
            />
          )}

          {solution.common_mistakes && solution.common_mistakes.length > 0 && allRevealed && (
            <GuidanceList
              key={`mistakes|${problem}|${solution.answer}`}
              solution={solution}
              items={solution.common_mistakes}
              heading="Common Mistakes to Avoid:"
              Icon={AlertCircle}
              iconClass="text-red-500"
              itemClass="bg-linear-to-r from-red-50 to-pink-50 dark:from-red-950/30 dark:to-rose-950/20 border-red-200 dark:border-red-800/60"
              noun="mistake"
            />
          )}

          {walkable && allRevealed && <LearnMore topic={solution.routedTopic || topic} />}
        </CardContent>
      </Card>
    </motion.div>
  );
}