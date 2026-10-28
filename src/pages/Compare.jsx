import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Scale, Search, Compass, Calculator, ArrowRight } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";

// How MasterMath compares with other solvers (1.58.0). Every competitor cell
// comes from that vendor's own page on CHECKED_ON, except Mathway's, whose
// site refuses automated requests: those cells are marked and come from
// recent reviews. When a price changes, update the cell, the date and the
// sources below together — an undated or unsourced comparison is a claim we
// cannot stand behind.
const CHECKED_ON = "October 28, 2026";

const PRODUCTS = ["MasterMath", "Photomath", "Symbolab", "Mathway*", "Wolfram|Alpha"];

const ROWS = [
  {
    feature: "Step-by-step solutions for free",
    cells: ["Yes, on every problem", "Yes (free Basic plan)", "Advertised; free limits not stated", "No, answers only", "No — the free Basic plan “does not include step-by-step solutions”"],
  },
  {
    feature: "Paid plan (US$)",
    cells: ["None — everything is free", "Plus: $9.99/month or $69.99/year", "Pro: $9.95/month, $32.95 per 6 months or $39.95/year", "Premium: about $9.99/month or $39.99/year", "Pro: $9.99/month or $60/year; Pro Premium: $12/month or $99/year"],
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
    feature: "How you enter a problem",
    cells: ["Typing, with a symbol keypad and plain English", "Camera scan (app)", "Typing, speech or a photo", "Typing or camera", "Typing, in plain English; photo input in the apps with Pro"],
  },
  {
    feature: "Open source",
    cells: ["Yes (MIT licence)", "No", "No", "No", "No"],
  },
];

const SOURCES = [
  { name: "Photomath", href: "https://photomath.com/", note: "plans and prices (Basic $0, Plus) and the camera scan" },
  { name: "Symbolab", href: "https://www.symbolab.com/registration", note: "Pro prices; input methods from the home page, symbolab.com" },
  { name: "Wolfram|Alpha", href: "https://www.wolframalpha.com/pro/pricing", note: "Basic, Pro and Pro Premium plans and prices" },
  { name: "Mathway", href: "https://www.mathway.com/", note: "not checked directly: the site refuses automated requests, so this column comes from 2026 reviews — check it yourself" },
];

const ALTERNATIVES = [
  { name: "Photomath", when: "you want to point your phone's camera at a problem instead of typing it." },
  { name: "Symbolab", when: "you want to speak a problem or upload a photo of it." },
  { name: "Wolfram|Alpha", when: "you need more than school maths: science, data and general computation." },
  { name: "Another solver", when: "your problem is a matrix, a differential equation or a word problem — MasterMath says so honestly rather than guessing, but it does not solve them yet." },
];

export default function Compare() {
  usePageTitle("How MasterMath Compares - Math Solver Comparison");

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-blue-800 dark:text-blue-300 mb-2">
          How MasterMath Compares
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-lg">
          Checked on {CHECKED_ON}. Prices and features change — follow the sources below for the current ones.
        </p>
      </div>

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
              and the box is focusable so the keyboard can scroll it too. */}
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Comparison table, scrolls sideways">
            <table className="w-full min-w-[56rem] text-sm text-left border-collapse">
              <caption className="sr-only">MasterMath compared with Photomath, Symbolab, Mathway and Wolfram|Alpha, checked on {CHECKED_ON}</caption>
              <thead>
                <tr className="border-b-2 border-indigo-200 dark:border-gray-600">
                  <th scope="col" className="sticky left-0 z-10 bg-white dark:bg-gray-800 p-3 font-semibold text-gray-800 dark:text-gray-100 w-44">Feature</th>
                  {PRODUCTS.map((p, i) => (
                    <th key={p} scope="col" className={`p-3 font-semibold ${i === 0 ? "bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300" : "text-gray-800 dark:text-gray-100"}`}>
                      {p}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.feature} className="border-b border-gray-200 dark:border-gray-700 align-top">
                    <th scope="row" className="sticky left-0 z-10 bg-white dark:bg-gray-800 p-3 font-medium text-gray-800 dark:text-gray-100">{row.feature}</th>
                    {row.cells.map((cell, i) => (
                      <td key={PRODUCTS[i]} className={`p-3 ${i === 0 ? "bg-green-50 dark:bg-green-900/30 text-gray-900 dark:text-gray-100 font-medium" : "text-gray-700 dark:text-gray-300"}`}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="p-4 text-sm text-gray-600 dark:text-gray-400">
            * Mathway's site refuses automated requests, so its column comes from 2026 reviews rather than its own pages. Prices are in US dollars and can differ by country and app store. “Not stated” means the vendor's own page does not say.
          </p>
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
            The MasterMath column describes this app as it is today; its code is{" "}
            <a href="https://github.com/sparkinCreations/MasterMath" target="_blank" rel="noopener noreferrer" className="text-indigo-700 dark:text-indigo-300 underline">open on GitHub</a>{" "}
            for anyone to check. Every other cell comes from the vendor's own page on {CHECKED_ON}:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            {SOURCES.map((s) => (
              <li key={s.name}>
                <a href={s.href} target="_blank" rel="noopener noreferrer" className="text-indigo-700 dark:text-indigo-300 underline">{s.name}</a>: {s.note}
              </li>
            ))}
          </ul>
          <p>
            Spotted something out of date? Tell us on the{" "}
            <Link to={createPageUrl("Feedback")} className="text-indigo-700 dark:text-indigo-300 underline">Feedback page</Link>{" "}
            and we will correct it.
          </p>
        </CardContent>
      </Card>

      <Card className="mb-6 border-2 border-amber-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-linear-to-r from-amber-50 to-yellow-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2 dark:text-gray-100">
            <Compass className="w-6 h-6 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            When another tool is the better choice
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <ul className="space-y-2 text-gray-700 dark:text-gray-300">
            {ALTERNATIVES.map((a) => (
              <li key={a.name}><strong className="text-gray-900 dark:text-gray-100">{a.name}</strong>, if {a.when}</li>
            ))}
          </ul>
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
