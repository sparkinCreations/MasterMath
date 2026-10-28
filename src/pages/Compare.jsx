import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Scale, Search, Compass, Calculator, ArrowRight, AlertTriangle } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";

// How MasterMath compares with other solvers (1.58.0). The page is for
// choosing a tool, not for selling this one: MasterMath's limits come first,
// its column is not highlighted, and a cell the vendor's own page does not
// settle says "Not stated" rather than a guess. Every competitor cell comes
// from that vendor's site or App Store listing on CHECKED_ON. When anything
// changes, update the cell, the date and the sources together.
const CHECKED_ON = "October 28, 2026";

const PRODUCTS = ["MasterMath", "Photomath", "Symbolab", "Mathway", "Wolfram|Alpha"];

const ROWS = [
  {
    feature: "Math topics",
    cells: [
      "Arithmetic, algebra (equations, systems, inequalities), trigonometry, functions, limits, derivatives, integrals",
      "Elementary math through college: algebra, functions, trigonometry, sequences, geometry, statistics, calculus",
      "Pre-algebra through calculus, trigonometry, geometry, statistics, matrices",
      "Algebra, graphing, calculus “and more”",
      "Elementary math, algebra, calculus, geometry, differential equations, statistics, and more",
    ],
  },
  {
    feature: "Word problems",
    cells: ["No", "Yes", "Yes", "Not stated", "Not stated"],
  },
  {
    feature: "Science and other subjects",
    cells: ["No", "Not stated", "Physics", "Physics", "Physics, chemistry, engineering, units, finance and many more"],
  },
  {
    feature: "How you enter a problem",
    cells: [
      "Typing only, with a symbol keypad and plain English",
      "Camera (printed or handwritten) or a calculator keypad",
      "Typing, speech or a photo",
      "Camera or typing",
      "Typing in plain English; photo input in the apps with Pro",
    ],
  },
  {
    feature: "Step-by-step solutions for free",
    cells: ["Yes", "Yes (free Basic plan)", "Advertised; free limits not stated", "No, answers only", "No — the free Basic plan “does not include step-by-step solutions”"],
  },
  {
    feature: "Paid plan (US$)",
    cells: ["None", "Plus: $9.99/month or $69.99/year", "Pro: $9.95/month, $32.95 per 6 months or $39.95/year", "Steps: $9.99/month or $39.99/year (other tiers also listed)", "Pro: $9.99/month or $60/year; Pro Premium: $12/month or $99/year"],
  },
  {
    feature: "Learning extras",
    cells: [
      "Tips and common mistakes with each solution; no practice problems, videos or tutors",
      "Multiple solution methods, video learning; animated tutorials and textbook solutions with Plus",
      "Practice problems, quizzes, worksheets",
      "Not stated",
      "Practice problems with hints (Pro)",
    ],
  },
  {
    feature: "Languages",
    cells: ["English only", "32 (App Store)", "English, Spanish, Portuguese, French, German, Italian and more", "15 (App Store)", "Not stated"],
  },
  {
    feature: "Apps",
    cells: ["Website only (can be installed from the browser); no app-store app", "iPhone and Android apps", "Website, iPhone and Android apps, Chrome extension", "Website and iPhone app (App Store)", "Website, iPhone and Android apps"],
  },
  {
    feature: "Account needed",
    cells: ["No", "Not stated", "Not stated", "Not stated", "Not for answers; the Basic plan needs a sign-in"],
  },
  {
    feature: "Works offline",
    cells: ["Yes, after the first visit", "Not stated", "No (online service)", "No (online service)", "No (online service)"],
  },
  {
    feature: "Where your problems go",
    cells: ["Nowhere — solved in your browser", "Not stated", "Online service", "Online service", "Online service"],
  },
  {
    feature: "Ads",
    cells: ["None", "Not stated", "Not stated", "Yes (App Store: “Contains Advertising”)", "Not stated"],
  },
  {
    feature: "How answers are produced",
    cells: ["Fixed maths rules (mathjs, Algebrite), not AI; answers are checked before they are shown", "Not stated", "Described as an “AI Math Solver”", "Not stated", "“Wolfram’s breakthrough algorithms and knowledgebase”"],
  },
  {
    feature: "Open source",
    cells: ["Yes (MIT licence)", "No", "No", "No", "No"],
  },
];

// What MasterMath cannot do, stated first so nobody has to discover it.
const LIMITS = [
  "No camera, photo, handwriting or speech input: problems are typed.",
  "No word problems: “3 apples cost $6…” is refused, not solved.",
  "No geometry, statistics, sequences and series, matrices, differential equations, polar or parametric curves, or multivariable calculus such as double integrals.",
  "No physics, chemistry or unit conversion.",
  "English only, and no app in the App Store or Google Play.",
  "No practice problems, videos or human help.",
  "A small project by one independent developer, not an established product used by millions.",
];

const SOURCES = [
  { name: "Photomath", href: "https://photomath.com/", note: "plans, prices, topics, input" },
  { name: "Photomath on the App Store", href: "https://apps.apple.com/us/app/photomath/id919087726", note: "topic list, languages, features" },
  { name: "Symbolab", href: "https://www.symbolab.com/", note: "topics, input, practice tools, languages" },
  { name: "Symbolab Pro prices", href: "https://www.symbolab.com/registration", note: "Pro prices" },
  { name: "Mathway on the App Store", href: "https://apps.apple.com/us/app/mathway-math-problem-solver/id467329677", note: "published by Chegg: prices, input, languages, ads (mathway.com refuses automated requests)" },
  { name: "Wolfram|Alpha", href: "https://www.wolframalpha.com/", note: "topics" },
  { name: "Wolfram|Alpha Pro prices", href: "https://www.wolframalpha.com/pro/pricing", note: "plans, prices, practice problems, apps" },
];

const ALTERNATIVES = [
  { name: "Photomath", when: "you want to photograph a problem, including handwriting or a word problem, in your own language." },
  { name: "Symbolab", when: "you want geometry, statistics or matrices, practice problems and worksheets, or to speak or photograph a problem." },
  { name: "Mathway", when: "you want to snap a photo and get an answer quickly, or need physics." },
  { name: "Wolfram|Alpha", when: "you need differential equations, statistics, science or data, or the widest range of topics." },
];

const SUITS = [
  "Your problem is typed algebra, trigonometry or calculus (through Calculus II integrals).",
  "You want every step free, with no account, no ads and no data leaving your device.",
  "You need it to work offline.",
];

export default function Compare() {
  usePageTitle("How MasterMath Compares - Math Solver Comparison");

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-blue-800 dark:text-blue-300 mb-2">
          How MasterMath Compares
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-lg mb-3">
          Checked on {CHECKED_ON}. Prices and features change — follow the sources below for the current ones.
        </p>
        <p className="text-gray-700 dark:text-gray-300 max-w-3xl">
          This page is here to help you pick the right tool, not to sell this one. MasterMath covers fewer
          topics than any of the others, so its limits come first.
        </p>
      </div>

      <Card className="mb-6 border-2 border-amber-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-linear-to-r from-amber-50 to-yellow-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2 dark:text-gray-100">
            <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            What MasterMath does not do
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
            {LIMITS.map((l) => <li key={l}>{l}</li>)}
          </ul>
        </CardContent>
      </Card>

      <Card className="mb-6 border-2 border-indigo-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-linear-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2 dark:text-gray-100">
            <Scale className="w-6 h-6 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
            Side by side
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <p className="lg:hidden px-4 pt-3 text-sm text-gray-600 dark:text-gray-400">Swipe the table sideways to see every solver.</p>
          {/* A real table, so a screen reader can move by row and column; it
              scrolls sideways inside its own box on a phone, never the page,
              and the box is focusable so the keyboard can scroll it too.
              Every column is styled alike: no column is the "winner". */}
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Comparison table, scrolls sideways">
            <table className="w-full min-w-[64rem] text-sm text-left border-collapse">
              <caption className="sr-only">MasterMath compared with Photomath, Symbolab, Mathway and Wolfram|Alpha, checked on {CHECKED_ON}</caption>
              <thead>
                <tr className="border-b-2 border-indigo-200 dark:border-gray-600">
                  <th scope="col" className="sticky left-0 z-10 bg-white dark:bg-gray-800 p-3 font-semibold text-gray-800 dark:text-gray-100 w-40">Feature</th>
                  {PRODUCTS.map((p) => (
                    <th key={p} scope="col" className="p-3 font-semibold text-gray-800 dark:text-gray-100">{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.feature} className="border-b border-gray-200 dark:border-gray-700 align-top">
                    <th scope="row" className="sticky left-0 z-10 bg-white dark:bg-gray-800 p-3 font-medium text-gray-800 dark:text-gray-100">{row.feature}</th>
                    {row.cells.map((cell, i) => (
                      <td key={PRODUCTS[i]} className="p-3 text-gray-700 dark:text-gray-300">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="p-4 text-sm text-gray-600 dark:text-gray-400">
            “Not stated” means the vendor's own pages do not say, not that the answer is no. Topic lists are each
            vendor's own description, so they are not equally detailed. Prices are in US dollars and can differ
            by country and app store.
          </p>
        </CardContent>
      </Card>

      <Card className="mb-6 border-2 border-green-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-linear-to-r from-green-50 to-emerald-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2 dark:text-gray-100">
            <Compass className="w-6 h-6 text-green-600 dark:text-green-400" aria-hidden="true" />
            Which one to use
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4 text-gray-700 dark:text-gray-300">
          <div>
            <h2 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">Another tool is the better choice if…</h2>
            <ul className="space-y-2">
              {ALTERNATIVES.map((a) => (
                <li key={a.name}><strong className="text-gray-900 dark:text-gray-100">{a.name}</strong>: {a.when}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">MasterMath may suit you if…</h2>
            <ul className="list-disc list-inside space-y-2">
              {SUITS.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6 border-2 border-blue-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-linear-to-r from-blue-50 to-cyan-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2 dark:text-gray-100">
            <Search className="w-6 h-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            How we checked
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-3 text-gray-700 dark:text-gray-300">
          <p>
            The MasterMath column describes this app as it is today, including what it refuses; its code is{" "}
            <a href="https://github.com/sparkinCreations/MasterMath" target="_blank" rel="noopener noreferrer" className="text-indigo-700 dark:text-indigo-300 underline">open on GitHub</a>{" "}
            for anyone to check. Every other cell comes from the vendor's own website or App Store listing on {CHECKED_ON}:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            {SOURCES.map((s) => (
              <li key={s.href}>
                <a href={s.href} target="_blank" rel="noopener noreferrer" className="text-indigo-700 dark:text-indigo-300 underline">{s.name}</a>: {s.note}
              </li>
            ))}
          </ul>
          <p>
            Spotted something wrong or out of date — including something unfair to another app? Tell us on the{" "}
            <Link to={createPageUrl("Feedback")} className="text-indigo-700 dark:text-indigo-300 underline">Feedback page</Link>{" "}
            and we will correct it.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-center mb-4">
        <Button asChild size="lg" className="h-12 px-6 text-base font-semibold text-white bg-linear-to-r from-orange-400 to-orange-600 hover:from-orange-500 hover:to-orange-700 shadow-lg">
          <Link to={createPageUrl("Solver")}>
            <Calculator className="w-5 h-5 mr-2" aria-hidden="true" />
            Try the Solver
            <ArrowRight className="w-5 h-5 ml-2" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
