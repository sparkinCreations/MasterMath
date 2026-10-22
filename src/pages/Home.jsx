import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  Calculator,
  TrendingUp,
  Lightbulb,
  Zap,
  BookOpen,
  Target,
  ArrowRight,
  CheckCircle,
  GraduationCap

} from "lucide-react";
import GithubMark from "@/components/ui/github-mark";
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

export default function Home() {
  usePageTitle("Step-by-step math, solved locally - Free Math Solver");

  return (
    <div className="p-4 md:p-6">
      {/* Hero Section */}
      <div className="max-w-6xl mx-auto mb-8 md:mb-16 text-center">
        <div className="mb-6 md:mb-8 flex flex-col items-center">
          <img
            src="/logo-192.png"
            alt="MasterMath Logo"
            className="w-20 h-20 md:w-24 md:h-24 mb-4 md:mb-6"
          />
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-3 md:mb-4 px-2">
            Welcome to MasterMath
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl text-gray-600 dark:text-gray-400 mb-2 px-2">
            Master math with confidence
          </p>
          <p className="text-base md:text-lg text-gray-500 dark:text-gray-400 px-2">
            Step-by-step calculus and algebra, solved in your browser
          </p>
          <p className="mt-3 text-sm md:text-base text-gray-600 dark:text-gray-300 px-2 max-w-2xl inline-flex items-start gap-2">
            <GraduationCap className="w-5 h-5 shrink-0 mt-0.5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
            <span>For students and teachers, from algebra to Calculus II, who want a solver that shows the method.</span>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-3 md:gap-4 mb-4 md:mb-6 px-2">
          <Button
            asChild
            size="lg"
            className="w-full sm:w-auto h-12 md:h-14 px-6 md:px-8 text-base md:text-lg font-semibold text-white bg-linear-to-r from-orange-400 to-orange-600 hover:from-orange-500 hover:to-orange-700 shadow-lg hover:shadow-xl transition-all duration-300"
          >
            <Link to={createPageUrl("Solver")}>
              <Calculator className="w-5 h-5 mr-2" />
              Start Solving
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="w-full sm:w-auto h-12 md:h-14 px-6 md:px-8 text-base md:text-lg font-semibold border-2 border-indigo-200 hover:bg-indigo-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-white"
          >
            <Link to={createPageUrl("UserManual")}>
              <BookOpen className="w-5 h-5 mr-2" />
              Learn How It Works
            </Link>
          </Button>
        </div>

        <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mb-6 md:mb-8 px-2">
          Solved locally · No account · Works offline
        </p>

        {/* GitHub Link */}
        <div className="mb-8 md:mb-12 px-2">
          <a
            href="https://github.com/sparkinCreations/MasterMath"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 text-base md:text-lg font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-all duration-200 shadow-md hover:shadow-lg"
          >
            <GithubMark className="w-5 h-5" />
            Star on GitHub
          </a>
        </div>

        {/* Hero Image/Illustration Placeholder */}
        <div className="relative max-w-4xl mx-auto px-2">
          <div className="bg-linear-to-br from-blue-100 via-indigo-100 to-green-100 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded-xl md:rounded-2xl p-6 md:p-12 border-2 border-indigo-200 dark:border-gray-600 shadow-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 text-center">
              <div className="p-2 sm:p-4 md:p-6 flex items-center justify-center gap-3 sm:flex-col sm:gap-0">
                <Calculator className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 shrink-0 sm:mx-auto sm:mb-2 md:mb-3 text-blue-600 dark:text-blue-400" />
                <p className="font-semibold text-sm md:text-base text-gray-800 dark:text-gray-200">Step-by-Step Solutions</p>
              </div>
              <div className="p-2 sm:p-4 md:p-6 flex items-center justify-center gap-3 sm:flex-col sm:gap-0">
                <TrendingUp className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 shrink-0 sm:mx-auto sm:mb-2 md:mb-3 text-indigo-600 dark:text-indigo-400" />
                <p className="font-semibold text-sm md:text-base text-gray-800 dark:text-gray-200">Visual Graphs</p>
              </div>
              <div className="p-2 sm:p-4 md:p-6 flex items-center justify-center gap-3 sm:flex-col sm:gap-0">
                <Lightbulb className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 shrink-0 sm:mx-auto sm:mb-2 md:mb-3 text-green-600 dark:text-green-400" />
                <p className="font-semibold text-sm md:text-base text-gray-800 dark:text-gray-200">Key Insights</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* A worked example — the solver's own output for x² − 5x + 6 = 0,
          so a visitor sees what "shows the steps" means before clicking. The
          text is kept in step with the solver by tests/reviewTwo.test.js. */}
      <div className="max-w-4xl mx-auto mb-8 md:mb-16 px-2">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
          What a Solution Looks Like
        </h2>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-6 md:mb-8">
          An algebra problem, exactly as the solver works it
        </p>
        <Card className="border-2 border-indigo-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg overflow-hidden">
          {/* The equation being solved, as the card's own header. Styled
              Unicode rather than KaTeX: the landing page deliberately loads
              no solver library, and a test enforces that. */}
          <CardHeader className="border-b border-indigo-100 dark:border-gray-700 bg-linear-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-700 px-6 py-5 md:px-10 md:py-6">
            <p className="text-xs md:text-sm font-semibold uppercase tracking-wide text-indigo-500 dark:text-indigo-300 mb-1">Solve · Algebra</p>
            <p className="text-2xl md:text-3xl font-bold text-indigo-700 dark:text-indigo-200 font-mono tracking-tight" aria-label="x squared minus 5 x plus 6 equals 0">
              {prettyMath(WORKED_EXAMPLE.problem)}
            </p>
          </CardHeader>
          <CardContent className="p-6 md:p-10">
            <ol className="divide-y divide-gray-200 dark:divide-gray-700 text-sm md:text-base text-gray-700 dark:text-gray-300">
              {WORKED_EXAMPLE.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-4 py-4 md:py-5 first:pt-0">
                  <span className="shrink-0 w-8 h-8 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 text-white text-sm font-bold flex items-center justify-center shadow-sm" aria-hidden="true">{i + 1}</span>
                  <span className="pt-1 leading-relaxed"><span className="sr-only">Step {i + 1}. </span>{prettyMath(step)}</span>
                </li>
              ))}
            </ol>
            <p className="mt-6 p-4 rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-green-800 dark:text-green-200 font-semibold text-base md:text-lg">
              Final answer: {prettyMath(WORKED_EXAMPLE.answer)}
            </p>
            <p className="mt-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-sm md:text-base text-amber-900 dark:text-amber-100">
              <span className="font-semibold">Key insight:</span> {prettyMath(WORKED_EXAMPLE.tip)}
            </p>
            <div className="mt-8 md:mt-10 mb-2 flex justify-center">
              <Button asChild size="lg" className="h-12 md:h-14 px-6 md:px-8 text-base md:text-lg bg-linear-to-r from-orange-400 to-orange-600 hover:from-orange-500 hover:to-orange-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300">
                <Link to={createPageUrl("Solver")} state={{ problem: WORKED_EXAMPLE.problem, topic: WORKED_EXAMPLE.topic }}>
                  <Calculator className="w-5 h-5 mr-2" />
                  Try this one in the solver
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Features Section */}
      <div className="max-w-6xl mx-auto mb-8 md:mb-16 px-2">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-6 md:mb-12">
          Everything You Need to Master Math
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Feature 1 */}
          <Card className="border-2 border-blue-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow">
            <CardHeader className="bg-linear-to-r from-blue-50 to-cyan-50 dark:from-gray-700 dark:to-gray-700">
              <CardTitle as="h3" className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                <Calculator className="w-6 h-6" />
                Multiple Topics
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-gray-700 dark:text-gray-300">
                Derivatives, integrals (definite and improper too), limits, function analysis, trigonometry, algebra — equations, systems, inequalities — and arithmetic.
              </p>
            </CardContent>
          </Card>

          {/* Feature 2 */}
          <Card className="border-2 border-indigo-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow">
            <CardHeader className="bg-linear-to-r from-indigo-50 to-pink-50 dark:from-gray-700 dark:to-gray-700">
              <CardTitle as="h3" className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
                <Zap className="w-6 h-6" />
                Worked Steps
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-gray-700 dark:text-gray-300">
                Named methods (power rule, u-sub, by-parts) with every intermediate shown — not a black-box answer.
              </p>
            </CardContent>
          </Card>

          {/* Feature 3 */}
          <Card className="border-2 border-green-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow">
            <CardHeader className="bg-linear-to-r from-green-50 to-emerald-50 dark:from-gray-700 dark:to-gray-700">
              <CardTitle as="h3" className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <TrendingUp className="w-6 h-6" />
                Track Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-gray-700 dark:text-gray-300">
                Monitor your learning journey with statistics and history of all solved problems.
              </p>
            </CardContent>
          </Card>

          {/* Feature 4 */}
          <Card className="border-2 border-amber-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow">
            <CardHeader className="bg-linear-to-r from-amber-50 to-yellow-50 dark:from-gray-700 dark:to-gray-700">
              <CardTitle as="h3" className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <Lightbulb className="w-6 h-6" />
                Learn Better
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-gray-700 dark:text-gray-300">
                Discover key insights and avoid common mistakes with helpful tips for every solution.
              </p>
            </CardContent>
          </Card>

          {/* Feature 5 */}
          <Card className="border-2 border-indigo-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow">
            <CardHeader className="bg-linear-to-r from-indigo-50 to-indigo-50 dark:from-gray-700 dark:to-gray-700">
              <CardTitle as="h3" className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
                <BookOpen className="w-6 h-6" />
                Export & Save
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-gray-700 dark:text-gray-300">
                Export any solution as PDF, Markdown, or JSON — and your whole history as CSV too — for offline study and assignment submissions.
              </p>
            </CardContent>
          </Card>

          {/* Feature 6 */}
          <Card className="border-2 border-rose-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow">
            <CardHeader className="bg-linear-to-r from-rose-50 to-pink-50 dark:from-gray-700 dark:to-gray-700">
              <CardTitle as="h3" className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
                <Target className="w-6 h-6" />
                100% Private
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-gray-700 dark:text-gray-300">
                Solving and history stay on your device. No cloud solve, no tracking. The only thing ever sent is a feedback message you choose to submit.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="max-w-5xl mx-auto mb-8 md:mb-16 px-2">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-6 md:mb-12">
          How It Works
        </h2>

        <div className="space-y-4 md:space-y-6">
          <Card className="border-2 border-indigo-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <CardContent className="p-4 md:p-8">
              <div className="flex items-start gap-4 md:gap-6">
                <div className="shrink-0">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-linear-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-lg md:text-xl shadow-lg">
                    1
                  </div>
                </div>
                <div>
                  <h3 className="text-lg md:text-2xl font-bold text-gray-800 dark:text-gray-200 mb-1 md:mb-2">Select Your Topic</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm md:text-lg">
                    Leave it on Auto-detect, or choose from derivatives, integrals, limits, functions, trigonometry, algebra, or arithmetic.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-indigo-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <CardContent className="p-4 md:p-8">
              <div className="flex items-start gap-4 md:gap-6">
                <div className="shrink-0">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-linear-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-lg md:text-xl shadow-lg">
                    2
                  </div>
                </div>
                <div>
                  <h3 className="text-lg md:text-2xl font-bold text-gray-800 dark:text-gray-200 mb-1 md:mb-2">Enter an Expression or Equation</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm md:text-lg">
                    Type mathematics itself — like d/dx x³, ∫ x² dx, or x² − 5x + 6 = 0 — or pick an example to start.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-indigo-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <CardContent className="p-4 md:p-8">
              <div className="flex items-start gap-4 md:gap-6">
                <div className="shrink-0">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-linear-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-lg md:text-xl shadow-lg">
                    3
                  </div>
                </div>
                <div>
                  <h3 className="text-lg md:text-2xl font-bold text-gray-800 dark:text-gray-200 mb-1 md:mb-2">Get Your Solution</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm md:text-lg">
                    Receive step-by-step solutions with graphs, tips, and common mistakes to avoid.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="max-w-5xl mx-auto mb-8 md:mb-16 px-2">
        <div className="bg-linear-to-br from-blue-50 via-indigo-50 to-green-50 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 rounded-xl md:rounded-2xl p-6 md:p-12 border-2 border-indigo-200 dark:border-gray-600">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-6 md:mb-8">
            Why Choose MasterMath?
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="flex items-start gap-2 md:gap-3">
              <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-green-600 dark:text-green-400 shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-base md:text-lg text-gray-800 dark:text-gray-200 mb-1">No Sign-Up Required</h3>
                <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">Start solving immediately without creating an account</p>
              </div>
            </div>

            <div className="flex items-start gap-2 md:gap-3">
              <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-green-600 dark:text-green-400 shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-base md:text-lg text-gray-800 dark:text-gray-200 mb-1">Completely Free</h3>
                <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">All current features at no cost</p>
              </div>
            </div>

            <div className="flex items-start gap-2 md:gap-3">
              <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-green-600 dark:text-green-400 shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-base md:text-lg text-gray-800 dark:text-gray-200 mb-1">Works Offline</h3>
                <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">Service worker caches the entire app — solve problems anywhere, even without Wi-Fi</p>
              </div>
            </div>

            <div className="flex items-start gap-2 md:gap-3">
              <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-green-600 dark:text-green-400 shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-base md:text-lg text-gray-800 dark:text-gray-200 mb-1">Not AI</h3>
                <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">Open-source math libraries (mathjs and Algebrite) — deterministic, the same answer every time</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-4xl mx-auto text-center px-2">
        <div className="bg-linear-to-r from-blue-600 to-indigo-600 rounded-xl md:rounded-2xl p-6 md:p-12 shadow-2xl">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 md:mb-4">
            Ready to Master Math?
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-blue-100 mb-6 md:mb-8">
            Start solving for free — no account, no tracking, all on your device
          </p>
          <Button
            asChild
            size="lg"
            className="w-full sm:w-auto h-12 md:h-14 px-6 md:px-8 text-base md:text-lg font-semibold bg-white text-indigo-600 hover:bg-gray-100 shadow-lg hover:shadow-xl transition-all duration-300"
          >
            {/* The wrapper's `inline-block` is gone on purpose: the button base
                class supplies `inline-flex`, which is what centres the icons. */}
            <Link to={createPageUrl("Solver")}>
              <Calculator className="w-5 h-5 mr-2" />
              Start Solving Now
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-8 md:py-12 text-gray-500 dark:text-gray-400 px-2">
        <p className="text-base md:text-lg">MasterMath by sparkinCreations™</p>
        <p className="text-xs md:text-sm mt-1">Master math with confidence — step-by-step, solved locally</p>
        <a
          href="https://github.com/sparkinCreations/MasterMath"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 mt-4 text-sm md:text-base text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
        >
          <GithubMark className="w-5 h-5" />
          View on GitHub
        </a>
      </div>
    </div>
  );
}
