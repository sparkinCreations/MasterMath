import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Scale, Search, Compass, Calculator, ArrowRight, AlertTriangle, Check, X, Minus, DollarSign } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";

// How MasterMath compares with other solvers (1.58.0). The page is for
// choosing a tool, not for selling this one: MasterMath's limits come first,
// its column is not highlighted, and a cell the vendor's own page does not
// settle says "Not stated" rather than a guess. Every competitor cell comes
// from that vendor's site or App Store listing. When anything changes, update
// the cell, the date and the sources together.
//
// Every row that can be is one of four answers (ANSWERS), so a column reads at
// a glance and all five products fit on a phone; a cell is the answer alone or
// [answer, detail]. Rows that cannot be (price, languages) are short text.
const CHECKED_ON = "November 8, 2026"; // the Subjects group, free steps, AI, Mathway's cells
const REST_CHECKED_ON = "October 28, 2026"; // every other cell

const PRODUCTS = ["MasterMath", "Photomath", "Symbolab", "Mathway", "Wolfram|Alpha"];

const ANSWERS = {
  Yes: { Icon: Check, color: "text-green-700 dark:text-green-400" },
  No: { Icon: X, color: "text-gray-800 dark:text-gray-200" },
  "Paid only": { Icon: DollarSign, color: "text-amber-800 dark:text-amber-400" },
  "Not stated": { Icon: Minus, color: "text-gray-600 dark:text-gray-400" },
};

const Y = "Yes";
const N = "No";
const NS = "Not stated";

const GROUPS = [
  {
    title: "Math subjects",
    countAs: "Subjects listed",
    rows: [
      { feature: "Arithmetic", cells: [Y, Y, Y, Y, Y] },
      { feature: "Algebra", cells: [[Y, "Equations, systems, inequalities"], Y, Y, Y, Y] },
      { feature: "Trigonometry", cells: [Y, Y, Y, Y, Y] },
      { feature: "Graphing", cells: [Y, Y, Y, Y, Y] },
      { feature: "Calculus", cells: [[Y, "Limits, derivatives, integrals through Calculus II"], Y, Y, Y, Y] },
      { feature: "Geometry", cells: [N, Y, Y, NS, Y] },
      { feature: "Statistics", cells: [N, Y, Y, Y, Y] },
      { feature: "Matrices and linear algebra", cells: [N, NS, Y, Y, Y] },
      { feature: "Sequences and series", cells: [N, [Y, "Sequences"], [Y, "Series"], NS, Y] },
      { feature: "Differential equations", cells: [N, NS, Y, NS, Y] },
    ],
  },
  {
    title: "Beyond plain math",
    rows: [
      { feature: "Word problems", cells: [N, Y, Y, NS, [Y, "Elementary math"]] },
      { feature: "Physics", cells: [N, NS, Y, Y, Y] },
      { feature: "Chemistry", cells: [N, NS, Y, Y, Y] },
    ],
  },
  {
    title: "Entering a problem",
    rows: [
      { feature: "Typing", cells: [[Y, "With a symbol keypad"], [Y, "Calculator keypad"], Y, Y, Y] },
      { feature: "Plain English", cells: [Y, NS, Y, NS, Y] },
      { feature: "Photo of a problem", cells: [N, [Y, "Printed or handwritten"], Y, Y, ["Paid only", "Pro, in the apps"]] },
      { feature: "Speaking it", cells: [N, NS, Y, NS, NS] },
    ],
  },
  {
    title: "Cost",
    rows: [
      {
        feature: "Step-by-step solutions for free",
        cells: [
          Y,
          [Y, "Free Basic plan"],
          [NS, "Advertised; how much is free is not given"],
          [NS, "Advertised; how much is free is not given, and a paid Steps plan is sold"],
          [N, "The free Basic plan does not include them"],
        ],
      },
      {
        feature: "Paid plan (US$)",
        cells: [
          "None",
          ["$9.99/mo or $69.99/yr", "Plus"],
          ["$9.95/mo or $39.95/yr", "Pro; also $32.95 per 6 months"],
          ["$9.99/mo or $39.99/yr", "Steps; other prices also listed"],
          ["$9.99/mo or $60/yr", "Pro; Pro Premium is $12/mo or $99/yr"],
        ],
      },
      { feature: "Free of ads", cells: [Y, NS, NS, [N, "App Store: Contains Advertising"], NS] },
    ],
  },
  {
    title: "Learning help",
    rows: [
      { feature: "Tips with each solution", cells: [[Y, "Key insights and common mistakes"], [Y, "“How” and “why” tips"], NS, NS, NS] },
      { feature: "Practice problems", cells: [[Y, "Answers checked, every topic"], NS, [Y, "Also quizzes and worksheets"], NS, ["Paid only", "With hints (Pro)"]] },
      { feature: "Videos or tutorials", cells: [N, [Y, "More with Plus"], NS, NS, NS] },
    ],
  },
  {
    title: "Where it runs",
    rows: [
      { feature: "Website", cells: [[Y, "Can be installed from the browser"], NS, Y, Y, Y] },
      { feature: "iPhone app", cells: [N, Y, Y, Y, Y] },
      { feature: "Android app", cells: [N, Y, Y, NS, Y] },
      { feature: "Languages", cells: ["English", "32", "6 or more", "15", NS] },
    ],
  },
  {
    title: "Privacy and how it works",
    rows: [
      { feature: "Works without an account", cells: [Y, NS, NS, NS, [Y, "For answers; the Basic plan needs a sign-in"]] },
      { feature: "Works offline", cells: [[Y, "After the first visit"], NS, N, N, N] },
      { feature: "Problems stay on your device", cells: [Y, NS, N, N, N] },
      {
        feature: "Answers made with AI",
        cells: [
          [N, "Fixed maths rules, checked before they are shown"],
          NS,
          [Y, "Described as an AI Math Solver"],
          [Y, "Described as AI-powered"],
          [NS, "Described as algorithms and a knowledgebase"],
        ],
      },
      { feature: "Open source", cells: [[Y, "MIT licence"], N, N, N, N] },
    ],
  },
];

// A cell is "Yes" or ["Yes", "the detail"].
const answerOf = (cell) => (Array.isArray(cell) ? cell[0] : cell);
const detailOf = (cell) => (Array.isArray(cell) ? cell[1] : null);

// What MasterMath cannot do, stated first so nobody has to discover it.
const LIMITS = [
  "No camera, photo, handwriting or speech input: problems are typed.",
  "No word problems: “3 apples cost $6…” is refused, not solved.",
  "No geometry, statistics, sequences and series, matrices, differential equations, polar or parametric curves, multivariable calculus (such as double integrals), physics, chemistry or unit conversion.",
  "English only, and no app in the App Store or Google Play.",
  "Practice is similar problems with checked answers, not quizzes; no videos or human help.",
];

const SOURCES = [
  { name: "Photomath", href: "https://photomath.com/", note: "plans, prices, subjects, input" },
  { name: "Photomath on the App Store", href: "https://apps.apple.com/us/app/photomath/id919087726", note: "subject list, languages, features" },
  { name: "Symbolab", href: "https://www.symbolab.com/", note: "input, practice tools, languages" },
  { name: "Symbolab's calculators", href: "https://www.symbolab.com/solver", note: "subjects" },
  { name: "Symbolab Pro prices", href: "https://www.symbolab.com/registration", note: "Pro prices" },
  { name: "Mathway", href: "https://www.mathway.com/", note: "subjects, input, how answers are made" },
  { name: "Mathway on the App Store", href: "https://apps.apple.com/us/app/mathway-math-problem-solver/id467329677", note: "published by Chegg: prices, languages, ads" },
  { name: "Wolfram|Alpha's mathematics examples", href: "https://www.wolframalpha.com/examples/mathematics", note: "subjects" },
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

function Answer({ text }) {
  const style = ANSWERS[text];
  if (!style) return <span className="text-gray-800 dark:text-gray-200">{text}</span>;
  const { Icon, color } = style;
  return (
    <span className={`inline-flex items-start gap-1 font-medium ${color}`}>
      <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
      <span>{text}</span>
    </span>
  );
}

// "MasterMath" and "Wolfram|Alpha" may break at their natural joint on the
// narrowest phones, where a fifth of the screen is not wide enough for them.
function ProductName({ name }) {
  const parts = name.split(/(?<=Master|\|)/);
  return parts.map((part, i) => (
    <React.Fragment key={part}>{i > 0 && <wbr />}{part}</React.Fragment>
  ));
}

export default function Compare() {
  usePageTitle("How MasterMath Compares - Math Solver Comparison");

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-blue-800 dark:text-blue-300 mb-2">
          How MasterMath Compares
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-lg mb-3">
          Subjects, free steps and AI checked on {CHECKED_ON}; the rest on {REST_CHECKED_ON}. Prices and features change, so follow the sources below for the current ones.
        </p>
        <p className="text-gray-700 dark:text-gray-300 max-w-3xl">
          MasterMath covers fewer topics than the others.
        </p>
      </div>

      <Card className="mb-6 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
        <CardHeader className="border-b border-gray-100 dark:border-gray-700">
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

      <Card className="mb-6 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
        <CardHeader className="border-b border-gray-100 dark:border-gray-700">
          <CardTitle className="flex items-center gap-2 dark:text-gray-100">
            <Scale className="w-6 h-6 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
            Side by side
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 px-3 lg:px-4 pt-3 text-xs lg:text-sm" aria-label="What the answers mean">
            {Object.keys(ANSWERS).map((a) => <li key={a}><Answer text={a} /></li>)}
          </ul>
          {/* Below lg a row is a grid: its name across the top, then a fifth of
              the width for each product, so all five are on the screen at once
              and nothing scrolls sideways. A display other than table can cost
              a table its semantics, hence the explicit roles. A cell's detail
              moves to a line under the row there. The header row stays in view
              (the phone's sticky app header is 74px tall). Every column is
              styled alike: no column is the "winner". */}
          <table role="table" className="block lg:table lg:table-fixed w-full mt-2 text-xs lg:text-sm text-left border-collapse">
            <caption className="sr-only">MasterMath compared with Photomath, Symbolab, Mathway and Wolfram|Alpha</caption>
            <thead role="rowgroup" className="block lg:table-header-group sticky top-[74px] md:top-0 z-10 bg-white dark:bg-gray-800">
              <tr role="row" className="grid grid-cols-5 lg:table-row border-b-2 border-gray-300 dark:border-gray-600">
                <th role="columnheader" scope="col" className="hidden lg:table-cell p-3 lg:w-44 font-semibold text-gray-800 dark:text-gray-100">Feature</th>
                {PRODUCTS.map((p) => (
                  <th key={p} role="columnheader" scope="col" className="px-0.5 py-2 lg:p-3 text-[11px] lg:text-sm text-center lg:text-left [overflow-wrap:anywhere] font-semibold text-gray-800 dark:text-gray-100"><ProductName name={p} /></th>
                ))}
              </tr>
            </thead>
            {GROUPS.map((group) => (
              <tbody key={group.title} role="rowgroup" className="block lg:table-row-group">
                <tr role="row" className="block lg:table-row bg-gray-100 dark:bg-gray-700">
                  <th role="rowheader" colSpan={6} scope="rowgroup" className="block lg:table-cell px-2 lg:px-3 py-1.5 font-semibold text-gray-900 dark:text-gray-100">{group.title}</th>
                </tr>
                {group.countAs && (
                  <tr role="row" className="grid grid-cols-5 lg:table-row border-b border-gray-200 dark:border-gray-700">
                    <th role="rowheader" scope="row" className="col-span-5 lg:table-cell px-2 pt-2 pb-1 lg:p-3 font-semibold text-gray-800 dark:text-gray-100">{group.countAs}</th>
                    {PRODUCTS.map((p, i) => (
                      <td key={p} role="cell" className="px-1 pb-2 lg:p-3 text-center lg:text-left font-semibold text-gray-800 dark:text-gray-200">
                        {group.rows.filter((row) => answerOf(row.cells[i]) === Y).length} of {group.rows.length}
                      </td>
                    ))}
                  </tr>
                )}
                {group.rows.map((row) => {
                  const details = row.cells.flatMap((cell, i) => (detailOf(cell) ? [`${PRODUCTS[i]}: ${detailOf(cell)}.`] : []));
                  return (
                    <tr key={row.feature} role="row" className="grid grid-cols-5 lg:table-row border-b border-gray-200 dark:border-gray-700 lg:align-top">
                      <th role="rowheader" scope="row" className="col-span-5 lg:table-cell px-2 pt-2 pb-1 lg:p-3 lg:w-44 font-medium text-gray-800 dark:text-gray-100">{row.feature}</th>
                      {row.cells.map((cell, i) => (
                        <td key={PRODUCTS[i]} role="cell" className="px-1 pb-2 lg:p-3 text-center lg:text-left">
                          <Answer text={answerOf(cell)} />
                          {detailOf(cell) && <span className="hidden lg:block mt-0.5 text-xs text-gray-600 dark:text-gray-400">{detailOf(cell)}</span>}
                        </td>
                      ))}
                      {details.length > 0 && (
                        <td role="cell" className="col-span-5 lg:hidden px-2 pb-2 text-xs text-gray-600 dark:text-gray-400">{details.join(" ")}</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
          <p className="p-4 text-sm text-gray-600 dark:text-gray-400">
            “Not stated” means the vendor's own pages do not say, not that the answer is no, and it is not counted
            in “Subjects listed”. A Yes means the vendor lists the subject, not that every product covers it equally
            deeply. Prices are in US dollars and can differ by country and app store.
          </p>
        </CardContent>
      </Card>

      <Card className="mb-6 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
        <CardHeader className="border-b border-gray-100 dark:border-gray-700">
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

      <Card className="mb-6 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
        <CardHeader className="border-b border-gray-100 dark:border-gray-700">
          <CardTitle className="flex items-center gap-2 dark:text-gray-100">
            <Search className="w-6 h-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            How we checked
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-3 text-gray-700 dark:text-gray-300">
          <p>
            The MasterMath column describes this app today; its code is{" "}
            <a href="https://github.com/sparkinCreations/MasterMath" target="_blank" rel="noopener noreferrer" className="text-indigo-700 dark:text-indigo-300 underline">open on GitHub</a>.{" "}
            Every other cell comes from the vendor's own website or App Store listing, on the dates at the top of this page:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            {SOURCES.map((s) => (
              <li key={s.href}>
                <a href={s.href} target="_blank" rel="noopener noreferrer" className="text-indigo-700 dark:text-indigo-300 underline">{s.name}</a>: {s.note}
              </li>
            ))}
          </ul>
          <p>
            Something wrong or out of date? Tell us on the{" "}
            <Link to={createPageUrl("Feedback")} className="text-indigo-700 dark:text-indigo-300 underline">Feedback page</Link>{" "}
            and we will correct it.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-center mb-4">
        <Button asChild size="lg" className="h-12 px-6 text-xl font-bold text-white bg-orange-600 hover:bg-orange-700 shadow-lg">
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
