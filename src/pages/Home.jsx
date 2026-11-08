import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  Calculator,
  TrendingUp,
  Lightbulb,
  ListChecks,
  BookOpen,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import GithubMark from "@/components/ui/github-mark";
import HeroVideo from "@/components/HeroVideo";
import { WORKED_EXAMPLE } from "@/lib/workedExample";

// Solver text for display without KaTeX: superscripts, a real minus sign and
// a middle dot. Display only — the data stays the solver's own output.
function prettyMath(text) {
  return String(text)
    .replace(/\^2\b/g, '²')
    .replace(/\^3\b/g, '³')
    .replace(/\s-\s/g, ' − ')
    .replace(/(^|[\s(=])-(?=[\dx])/g, '$1−')
    .replace(/\*/g, '·');
}

// The features section: six short entries, one sentence each. Plain
// entries on the page, no coloured cards (1.71.0, docs/DESIGN.md).
const FEATURES = [
  {
    icon: Calculator, title: 'Every topic',
    text: 'Arithmetic, algebra, systems and inequalities, trigonometry, functions, limits, derivatives and integrals, definite and improper too.',
  },
  {
    icon: ListChecks, title: 'Worked steps, checked',
    text: 'Named methods (the power rule, u-substitution, by parts), every line shown and the answer verified. Open-source maths libraries, not an AI chatbot: the same answer every time.',
  },
  {
    icon: TrendingUp, title: 'Graphs',
    text: 'Functions, derivatives and integrals are drawn, with extrema, intercepts and asymptotes marked. Drag and zoom to explore.',
  },
  {
    icon: Lightbulb, title: 'Insights and mistakes',
    text: 'Key insights and the common mistakes for the method just used, not one generic list.',
  },
  {
    icon: BookOpen, title: 'Export and progress',
    text: 'Any solution as PDF, Markdown or JSON, your whole history as CSV, and a progress page of everything solved.',
  },
  {
    icon: ShieldCheck, title: 'Private, offline, free',
    text: 'No account, no tracking, no cost, and it works without Wi-Fi. Solving and history stay on your device; the only thing ever sent is a feedback message you choose to submit.',
  },
];

const GITHUB = "https://github.com/sparkinCreations/MasterMath";

export default function Home() {
  usePageTitle("Step-by-step math, solved locally - Free Math Solver");

  // The page as a worked solution on paper (1.71.0, docs/DESIGN.md): the
  // claim and the recording, a worked example set like a textbook's, what
  // it does, and one closing line. Headings in the serif, one solid action
  // per section, no gradients.
  return (
    <div className="px-4 py-8 md:px-6 md:py-14">
      {/* Hero: the claim beside the recording on large screens; stacked,
          recording last, below lg. */}
      <section className="max-w-6xl mx-auto mb-16 md:mb-24">
        <div className="grid gap-10 lg:gap-14 lg:grid-cols-2 items-center">
          <div>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.25rem] xl:text-[3.6rem] font-semibold leading-[1.08] tracking-tight text-balance text-gray-900 dark:text-gray-50">
              See{" "}
              <span className="underline decoration-orange-500 dark:decoration-orange-400 decoration-[0.12em] underline-offset-[0.14em]">the method</span>
              , not just the answer.
            </h1>
            <p className="mt-5 text-lg md:text-xl leading-relaxed text-gray-600 dark:text-gray-300 max-w-xl">
              Step-by-step algebra through Calculus II, solved in your browser.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button asChild variant="primary" className="h-12 px-6 text-base">
                <Link to={createPageUrl("Solver")}>
                  Start solving
                  <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="secondary" className="h-12 px-6 text-base">
                <Link to={createPageUrl("UserManual")}>How it works</Link>
              </Button>
            </div>

            <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-600 dark:text-gray-400" aria-label="At a glance">
              <li>Solved locally</li>
              <li>No account</li>
              <li>Works offline</li>
              <li>Free on every problem</li>
            </ul>
            {/* The comparison lives on its own dated, sourced page (1.58.0);
                the home page only claims what MasterMath itself does. */}
            <p className="mt-2 flex flex-wrap items-center gap-x-5 text-sm">
              <Link to={createPageUrl("Compare")} className="inline-flex items-center gap-1 min-h-11 font-medium text-indigo-700 dark:text-indigo-300 underline underline-offset-4 decoration-indigo-300 dark:decoration-indigo-700 hover:decoration-current">
                See how MasterMath compares
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
              <a href={GITHUB} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 min-h-11 font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-50">
                <GithubMark className="w-4 h-4" />
                Star on GitHub
              </a>
            </p>
          </div>

          {/* The solver at work: a real recording (1.70.2; HeroVideo, made
              by scripts/record-hero.mjs). Its poster is the page's largest
              paint and is preloaded at high priority. */}
          <figure>
            <HeroVideo description="A recording of MasterMath: x² − 4x + 3 is typed under Functions and solved. The graph shows the parabola crossing the x-axis at 1 and 3, with its minimum at 2, beside the first steps of the solution." />
            <figcaption className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              A real recording of the solver.
            </figcaption>
          </figure>
        </div>
      </section>

      {/* A worked example: the solver's own output for x² − 5x + 6 = 0, set
          like a textbook's worked example, so a visitor sees what "shows the
          steps" means before clicking. The text is kept in step with the
          solver by tests/reviewTwo.test.js. */}
      <section className="max-w-3xl mx-auto mb-16 md:mb-24" aria-labelledby="worked-example">
        <h2 id="worked-example" className="font-display text-3xl md:text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
          What a solution looks like
        </h2>
        <p className="mt-2 mb-6 text-gray-600 dark:text-gray-400">
          An algebra problem, exactly as the solver works it.
        </p>
        <Card className="overflow-hidden">
          {/* The equation being solved, as the sheet's own header. Styled
              Unicode rather than KaTeX: the landing page deliberately loads
              no solver library, and a test enforces that. */}
          <div className="px-6 py-5 md:px-10 md:py-7 border-b border-gray-200 dark:border-gray-800">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 mb-2">Worked example · Algebra</p>
            <p className="font-display text-3xl md:text-4xl font-semibold text-gray-900 dark:text-gray-50" aria-label="x squared minus 5 x plus 6 equals 0">
              {prettyMath(WORKED_EXAMPLE.problem)}
            </p>
          </div>
          <CardContent className="p-6 md:p-10">
            <ol className="text-[15px] md:text-base text-gray-800 dark:text-gray-200">
              {WORKED_EXAMPLE.steps.map((step, i) => (
                <li key={i} className="grid grid-cols-[2rem_1fr] gap-3 py-3.5 border-t border-gray-100 dark:border-gray-800 first:border-t-0 first:pt-0">
                  <span className="font-display text-lg font-semibold leading-7 text-indigo-700 dark:text-indigo-300 tabular-nums" aria-hidden="true">{i + 1}</span>
                  <span className="leading-7"><span className="sr-only">Step {i + 1}. </span>{prettyMath(step)}</span>
                </li>
              ))}
            </ol>
            <div className="mt-6 rounded-md border-l-4 border-green-600 bg-green-50 dark:border-green-500 dark:bg-green-950/40 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-green-800 dark:text-green-300">Answer</p>
              <p className="mt-1 font-display text-xl font-semibold text-green-900 dark:text-green-100">{prettyMath(WORKED_EXAMPLE.answer)}</p>
            </div>
            <div className="mt-3 rounded-md border-l-4 border-amber-500 bg-amber-50/70 dark:bg-amber-950/30 px-4 py-3 text-sm md:text-[15px] text-gray-800 dark:text-gray-200">
              <span className="font-semibold text-amber-900 dark:text-amber-200">Key insight.</span> {prettyMath(WORKED_EXAMPLE.tip)}
            </div>
            <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between pt-6 border-t border-gray-200 dark:border-gray-800">
              <Button asChild variant="primary" className="h-11 px-5">
                <Link to={createPageUrl("Solver")} state={{ problem: WORKED_EXAMPLE.problem, topic: WORKED_EXAMPLE.topic }}>
                  Try this one in the solver
                  <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
                </Link>
              </Button>
              {/* The star ask with its reason, where it lands hardest: the
                  reader has just seen what the solver does. */}
              <p className="text-sm text-gray-600 dark:text-gray-400 sm:text-right sm:max-w-xs">
                Free, with no account and no ads. If it helped,{" "}
                <a href={GITHUB} target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-700 dark:text-indigo-300 underline underline-offset-4 decoration-indigo-300 dark:decoration-indigo-700 hover:decoration-current">a star on GitHub</a>{" "}
                is all I ask.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* What it does: six short entries (1.56.4: one section, the privacy
          entry naming the one outbound request). */}
      <section className="max-w-6xl mx-auto mb-16 md:mb-24" aria-labelledby="what-it-does">
        <h2 id="what-it-does" className="font-display text-3xl md:text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-50 mb-8 md:mb-10">
          What it does
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-8">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="pt-5 border-t border-gray-200 dark:border-gray-800">
              <h3 className="flex items-center gap-2.5 text-base font-semibold text-gray-900 dark:text-gray-50">
                <Icon className="w-5 h-5 text-indigo-700 dark:text-indigo-300" aria-hidden="true" />
                {title}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-gray-600 dark:text-gray-400">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Closing: one line and the one action. */}
      <section className="max-w-6xl mx-auto">
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-10 md:px-12 md:py-12 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h2 className="font-display text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
              Bring your own problem.
            </h2>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Free, no account, and nothing leaves your device.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <Button asChild variant="primary" className="h-12 px-6 text-base">
              <Link to={createPageUrl("Solver")}>
                <Calculator className="w-4 h-4 mr-2" aria-hidden="true" />
                Open the solver
              </Link>
            </Button>
            <Button asChild variant="secondary" className="h-12 px-6 text-base">
              <a href={GITHUB} target="_blank" rel="noopener noreferrer">
                <GithubMark className="w-4 h-4 mr-2" />
                Star on GitHub
              </a>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
