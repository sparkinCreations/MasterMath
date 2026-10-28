import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Calculator, Download, History, Lightbulb, TrendingUp, ListChecks, Settings as SettingsIcon, TimerOff } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useLocation } from "react-router-dom";
import { useEffect } from "react";

export default function UserManual() {
  usePageTitle("User Manual - How to Use MasterMath");
  // "/usermanual#entering-your-problem" from the solver's notation link:
  // the router does not scroll to a hash on its own.
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [hash]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
          User Manual
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-lg">
          Learn how to use MasterMath by sparkinCreations™ effectively
        </p>
      </div>

      {/* Welcome Section */}
      <Card className="mb-6 border-2 border-indigo-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-linear-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2 dark:text-gray-100">
            <BookOpen className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Welcome to MasterMath!
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            MasterMath is a step-by-step math solver that runs entirely in your browser — powered by
            open-source math libraries, not AI. Whether you're working on derivatives, integrals, limits,
            algebra (including systems and inequalities), trigonometry, function analysis, or arithmetic,
            MasterMath walks through each expression or equation with the method a textbook would use,
            helpful tips, and warnings about common mistakes. The app works fully offline after your
            first visit — a service worker caches everything so you can study anywhere.
          </p>
        </CardContent>
      </Card>

      {/* Getting Started */}
      <Card className="mb-6 border-2 border-blue-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-linear-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2 dark:text-gray-100">
            <Calculator className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Getting Started - Using the Solver
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">Step 1: Select Your Topic</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-2">
              Choose what type of problem you're working on from the dropdown menu, or leave it on Auto-detect:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-4">
              <li><strong>Auto-detect</strong> (where a new visitor starts): the topic is read from what you type — d/dx, ∫ or lim for calculus, an equation, inequality or system for Algebra, a trig function or ° for Trigonometry, "f(x) = …" for Functions, plain numbers for Arithmetic. A notice above the steps says what was detected. An expression on its own, like x² + 3x, is simplified and factored, with buttons to differentiate, integrate or analyse it instead. The solver remembers the topic you used last.</li>
              <li><strong>Derivatives:</strong> Finding rates of change and slopes</li>
              <li><strong>Integrals:</strong> Antiderivatives, definite integrals, and improper integrals</li>
              <li><strong>Limits:</strong> Understanding behavior as values approach infinity or specific points</li>
              <li><strong>Functions:</strong> Analyzing and graphing mathematical functions</li>
              <li><strong>Trigonometry:</strong> Solving problems with sine, cosine, tangent, etc.</li>
              <li><strong>Algebra:</strong> Equations (linear through cubic and higher, radical, absolute-value, exponential, logarithmic), systems of equations, inequalities, simplifying, expanding and factoring</li>
              <li><strong>Arithmetic:</strong> Basic calculations and operations</li>
            </ul>
          </div>

          <div>
            <h3 id="entering-your-problem" className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2 scroll-mt-24">Step 2: Enter Your Problem</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-2">
              Type your math problem in the text area. Here are some formatting tips:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-4">
              <li>Use <code className="bg-indigo-100 dark:bg-gray-700 dark:text-gray-200 px-1 rounded">*</code> for multiplication: <code className="bg-indigo-100 dark:bg-gray-700 dark:text-gray-200 px-1 rounded">2*x</code> instead of 2x (though MasterMath handles both)</li>
              <li>The <strong>Symbols</strong> button above the problem box opens a strip of one-tap symbols in four groups — Basic (+ − × ÷ = and powers, roots, fractions, π), Algebra (≤ ≥ |x| and a ; for systems), Calculus (∫, d/dx, lim, ∞, eˣ, ln) and Functions (sin … arctan, ln, log) — and stays open or closed as you leave it. The topic picks the starting group; every group stays available. Clear, under the box, empties it and keeps the topic. A preview under the box shows how your text was read, with powers raised and roots drawn.</li>
              <li>Use <code className="bg-indigo-100 dark:bg-gray-700 dark:text-gray-200 px-1 rounded">^</code> for exponents: <code className="bg-indigo-100 dark:bg-gray-700 dark:text-gray-200 px-1 rounded">x^2</code> for x² (unicode superscripts like x² also work)</li>
              <li>Use parentheses for clarity: <code className="bg-indigo-100 dark:bg-gray-700 dark:text-gray-200 px-1 rounded">(x + 2)*(x - 3)</code></li>
              <li>For limits, use format: <code className="bg-indigo-100 dark:bg-gray-700 dark:text-gray-200 px-1 rounded">lim x-&gt;0 (sin(x)/x)</code></li>
              <li>You can type in natural language: <code className="bg-indigo-100 dark:bg-gray-700 dark:text-gray-200 px-1 rounded">find the derivative of x^2 + 3x</code></li>
              <li>Use <strong>↑/↓ arrow keys</strong> in the input area to recall previous problems from your current session</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">Step 3: Click "Solve Problem"</h3>
            <p className="text-gray-700 dark:text-gray-300">
              MasterMath will analyze your problem and provide a complete solution with step-by-step explanations!
            </p>
          </div>
        </CardContent>
      </Card>

      {/* What you can enter, by topic */}
      <Card className="mb-6 border-2 border-indigo-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-linear-to-r from-indigo-50 to-blue-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2 dark:text-gray-100">
            <ListChecks className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            What You Can Enter
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            The topic you pick is a hint, not a rule: an equation in one unknown typed under Derivatives is solved as algebra (an equation in x and y is differentiated implicitly),
            and <code className="bg-indigo-100 dark:bg-gray-700 dark:text-gray-200 px-1 rounded">d/dx</code>,{' '}
            <code className="bg-indigo-100 dark:bg-gray-700 dark:text-gray-200 px-1 rounded">∫</code> or{' '}
            <code className="bg-indigo-100 dark:bg-gray-700 dark:text-gray-200 px-1 rounded">lim</code> in the
            problem routes it to the right solver from any topic. A notice above the steps says so when that happens, with a button to switch the topic. Under Auto-detect the notice says what was detected instead.
          </p>
          <dl className="space-y-3 text-gray-700 dark:text-gray-300">
            {[
              ['Algebra — equations', 'Linear equations are worked in exact fractions (clear the denominators, distribute, collect). Quadratics are factored when they factor, or solved by the discriminant and the formula. Cubics and higher use the Rational Root Theorem and synthetic division down to a quadratic; what has no rational root is found numerically with every root accounted for.', '2x + 5 = 11 · x^2 - 5x + 6 = 0 · x^3 - 6x^2 + 11x - 6 = 0'],
              ['Algebra — special equations', 'Square roots are isolated and squared, with the extraneous root rejected and the reason shown. Absolute values split into two cases. Exponential equations substitute u = e^x or u = a^x; logarithmic ones combine the logs and rewrite in exponential form. A bare log means base 10; write ln for the natural log.', 'sqrt(x+2) = x · |2x - 3| = 5 · 2^x = 10 · ln(x) + ln(x-1) = 0'],
              ['Systems of equations', 'Separate the equations with a semicolon. Two linear equations use Cramer\'s rule in exact fractions; three use elimination with every row operation shown; a line with a parabola or circle is solved by substitution. Dependent and inconsistent systems are shown, not just named.', '2x + 3y = 6; x - y = 4 · x + y + z = 6; x - y = 1; y + z = 5'],
              ['Inequalities', 'Linear, polynomial and rational inequalities by the sign-chart method, with correct open and closed endpoints. Compound inequalities — chains and "and"/"or" pairs — are solved part by part and combined. The graph shades where the inequality holds.', 'x^2 - 4 > 0 · -1 < 2x + 1 <= 5 · x > 1 and x < 4'],
              ['Derivatives', 'Every rule is named and worked (product, quotient, chain, logarithmic differentiation). Ask for a higher order ("second derivative of"), a value ("at x = 2"), or another variable. Absolute values are differentiated piecewise with the corner stated; the answer carries its domain where one applies. An equation in x and y is differentiated implicitly, term by term, for dy/dx — at a point too ("at (3, 4)"), with a vertical tangent or a point off the curve said so. "The tangent line to f at x = a" gives its equation, in point–slope form and then y = mx + b. An implicit curve is graphed to scale, with its tangent at the point.', 'x^2 + 3x · derivative of sin(3x^2) · second derivative of x*e^x · |x| at x = 0 · x^2 + y^2 = 25 at (3, 4) · tangent line to x^2 at x = 3'],
              ['Integrals', 'Indefinite integrals by direct rules, u-substitution, integration by parts, partial fractions (including x⁴ + 1, which factors over √2), trigonometric substitution, powers of trig functions (sin²x·cos³x by splitting a factor off; sec³x by the reduction formula; sec⁴x by u = tan x) and the substitutions u = eˣ and x = u² for integrands in eˣ or √x — each verified by differentiation. Definite integrals use the Fundamental Theorem and are cross-checked numerically; an endpoint singularity or an infinite bound is taken as a limit, and divergence is reported with its sign. When no method finds the antiderivative, a definite integral is still estimated numerically and marked "(numerical)". "The average value of f on [a, b]" integrates and divides by the width.', '2x + 1 · ∫_0^1 x^2 dx · integral of x^2 from 0 to 1 · sec(x)^3 · 1/(1 + e^x) · ∫_0^∞ e^(-x^2) dx · average value of sin(x) on [0, pi]'],
              ['Limits', 'Two-sided and one-sided limits (0+, 0-), limits at infinity, and the standard limits — each technique named (factor and cancel, conjugate, leading terms, squeeze, logarithms for the form 1^∞) and the answer verified numerically.', 'lim x->0 sin(x)/x · lim x->0+ 1/x · lim x->infinity x/e^x · lim x->infinity (1 + 1/x)^x'],
              ['Functions', 'Domain, intercepts, extrema, inflection points, asymptotes and holes, found exactly rather than read off the picture, with the range for recognised families and a graph that opens on the interesting part of the curve. "The inverse of f" undoes its operations one at a time and checks the result, or says why there is none (x², sin x: not one-to-one). "The maximum (or minimum) of f on [a, b]" uses the closed interval method: the critical points inside and both endpoints, compared.', 'x^3 - 3x · (x^2 - 1)/(x - 1) · tan(x) · inverse of (2x + 1)/(x - 3) · max and min of x^3 - 3x on [-2, 3]'],
              ['Trigonometry', 'Exact values at special angles, identities, and equations of the form A·f(kx) + B = C with the general solution and the solutions on one period. Plain numbers are read in the angle unit from Settings; sin(45) is taken as degrees. Ask for "the period of" or "the amplitude of" a wave, or convert an angle between degrees and radians, exactly in π.', 'sin(pi/4) · cos(60) · sin(x) = 1/2 · 2sin^2(x) - sin(x) - 1 = 0 · period of sin(2x) + cos(3x) · convert 135 degrees to radians'],
              ['Arithmetic', 'Order of operations worked one step at a time, fractions added by the least common denominator, percentages, factorials, roots, and plain-English phrasings such as "add 1/3 and 1/7". Whole numbers past 16 digits are exact. "Is 97 prime?", "the prime factorization of 360" and "round 3.14159 to 2 decimal places" (or significant figures, or the nearest hundred) are worked step by step.', '3 + 4 * 2^3 · 1/3 + 1/6 · 15% of 80 · 7! · is 91 prime · round 2.675 to 2 dp'],
            ].map(([topic, text, examples]) => (
              <div key={topic} className="p-3 rounded-lg bg-indigo-50/60 dark:bg-gray-700/60">
                <dt className="font-semibold text-gray-800 dark:text-gray-200">{topic}</dt>
                <dd className="mt-1">{text}</dd>
                <dd className="mt-1 text-sm text-indigo-700 dark:text-indigo-300">Try: <code className="bg-white dark:bg-gray-600 dark:text-gray-200 px-1 rounded">{examples}</code></dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {/* Example Problems */}
      <Card className="mb-6 border-2 border-green-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-linear-to-r from-green-50 to-emerald-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2 dark:text-gray-100">
            <Lightbulb className="w-6 h-6 text-green-600 dark:text-green-400" />
            Example Problems
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-3">
            <div className="p-4 bg-blue-50 dark:bg-gray-700 rounded-lg">
              <p className="font-semibold text-blue-700 dark:text-blue-300 mb-1">Derivatives Example:</p>
              <p className="text-gray-700 dark:text-gray-300">
                Topic: Derivatives<br />
                Problem: <code className="bg-white dark:bg-gray-600 dark:text-gray-200 px-2 py-1 rounded">x^2 + 3*x</code>
              </p>
            </div>

            <div className="p-4 bg-indigo-50 dark:bg-gray-700 rounded-lg">
              <p className="font-semibold text-indigo-700 dark:text-indigo-300 mb-1">Integrals Example:</p>
              <p className="text-gray-700 dark:text-gray-300">
                Topic: Integrals<br />
                Problem: <code className="bg-white dark:bg-gray-600 dark:text-gray-200 px-2 py-1 rounded">2*x + 1</code>
              </p>
            </div>

            <div className="p-4 bg-amber-50 dark:bg-gray-700 rounded-lg">
              <p className="font-semibold text-amber-700 dark:text-amber-400 mb-1">Limits Example:</p>
              <p className="text-gray-700 dark:text-gray-300">
                Topic: Limits<br />
                Problem: <code className="bg-white dark:bg-gray-600 dark:text-gray-200 px-2 py-1 rounded">lim x-&gt;0 (sin(x)/x)</code>
              </p>
            </div>

            <div className="p-4 bg-emerald-50 dark:bg-gray-700 rounded-lg">
              <p className="font-semibold text-emerald-700 dark:text-emerald-400 mb-1">Algebra Example:</p>
              <p className="text-gray-700 dark:text-gray-300">
                Topic: Algebra<br />
                Problem: <code className="bg-white dark:bg-gray-600 dark:text-gray-200 px-2 py-1 rounded">2*x + 5 = 11</code>
              </p>
            </div>

            <div className="p-4 bg-pink-50 dark:bg-gray-700 rounded-lg">
              <p className="font-semibold text-pink-700 dark:text-pink-300 mb-1">Trigonometry Example:</p>
              <p className="text-gray-700 dark:text-gray-300">
                Topic: Trigonometry<br />
                Problem: <code className="bg-white dark:bg-gray-600 dark:text-gray-200 px-2 py-1 rounded">sin(pi/4)</code>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Understanding Solutions */}
      <Card className="mb-6 border-2 border-orange-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-linear-to-r from-orange-50 to-amber-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2 dark:text-gray-100">
            <TrendingUp className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            Understanding Your Solution
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">Step-by-Step Solution</h3>
            <p className="text-gray-700 dark:text-gray-300">
              Each solution breaks down the problem into clear, numbered steps showing exactly how to solve it.
              Follow along to understand the mathematical process.
             New visitors see one step at a time (Step through), with a Next step button; Show all shows the whole working at once, and the choice is remembered.</p>
          </div>

          <div>
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">Final Answer</h3>
            <p className="text-gray-700 dark:text-gray-300">
              The final answer is highlighted in green for easy reference.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">Key Insights</h3>
            <p className="text-gray-700 dark:text-gray-300">
              Learn important concepts and tips that will help you with similar problems in the future.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">Common Mistakes to Avoid</h3>
            <p className="text-gray-700 dark:text-gray-300">
              Discover the most frequent errors students make and learn how to avoid them.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">Graph Visualization</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-2">
              When applicable, MasterMath displays an interactive graph to help you visualize the function or solution.
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-4">
              <li><strong>Zoom:</strong> Use the + and - buttons to zoom in and out; the curve is redrawn for every window, so it stays smooth</li>
              <li><strong>Pan:</strong> Drag the graph with a mouse or finger, or use the arrow buttons</li>
              <li><strong>Fit key features:</strong> The target button frames the marked roots, turning points and asymptotes</li>
              <li><strong>Reset:</strong> Click the reset button to return to the starting view</li>
              <li><strong>Dual curves:</strong> For derivatives and integrals, the graph shows the original function and the result together; when their sizes differ a lot the dashed curve gets its own right-hand axis, which you can toggle</li>
              <li><strong>Hover or tap:</strong> See the coordinates at any point</li>
              <li><strong>Key features:</strong> Open the panel under the graph for the same features in words</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">Checks, ≈ and Refusals</h3>
            <p className="text-gray-700 dark:text-gray-300">
              Every equation solution is substituted back into the original before it is shown, every antiderivative
              is differentiated back, and a root that was located numerically is written with ≈ rather than =. When
              a problem is outside what the solver can do honestly, it says so instead of guessing.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">Trigonometry Degree Detection</h3>
            <p className="text-gray-700 dark:text-gray-300">
              MasterMath auto-detects common degree values (30, 45, 60, 90, etc.) when you use
              trigonometric functions. For example, <code className="bg-indigo-100 dark:bg-gray-700 dark:text-gray-200 px-1 rounded">sin(45)</code> is
              automatically treated as sin(45°) and results are shown in both degrees and radians.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card className="mb-6 border-2 border-indigo-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-linear-to-r from-indigo-50 to-indigo-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2 dark:text-gray-100">
            <SettingsIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-3">
          <p className="text-gray-700 dark:text-gray-300">Open <strong>Settings</strong> from the sidebar. Choices are saved in your browser and apply to every solve.</p>
          <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
            <li><strong>Angle unit:</strong> Auto (special values such as 30, 45 and 60 read as degrees, everything else as radians), Degrees, or Radians. It decides how plain-number angles are read and how angle results are reported — including the general solution of a trig equation. Calculus always works in radians.</li>
            <li><strong>Decimal places:</strong> How many decimals a numeric result shows. Exact forms (fractions, radicals, π) are kept regardless, with the decimal alongside.</li>
            <li><strong>Theme:</strong> System (follows your device's light or dark setting, and switches when it does), Light, or Dark. The sun/moon button in the header is a quick way to pick a fixed theme.</li>
            <li><strong>History:</strong> Export or clear everything from the Settings or Progress page.</li>
          </ul>
        </CardContent>
      </Card>

      {/* Time limit */}
      <Card className="mb-6 border-2 border-amber-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-linear-to-r from-amber-50 to-orange-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2 dark:text-gray-100">
            <TimerOff className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            The 10-Second Limit and Cancel
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-3">
          <p className="text-gray-700 dark:text-gray-300">
            Solving runs in the background, so the page never freezes. A solve that passes ten seconds is stopped and
            reported as "Stopped after 10 seconds" — never a late or partial answer — and the <strong>Cancel</strong>{' '}
            button ends one sooner. Very high-degree polynomials with dozens of real roots are the usual cause; factoring
            out a common factor first often helps.
          </p>
        </CardContent>
      </Card>

      {/* Exporting Solutions */}
      <Card className="mb-6 border-2 border-indigo-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-linear-to-r from-indigo-50 to-indigo-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2 dark:text-gray-100">
            <Download className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Exporting Solutions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Save your solutions for later study! Click the "Export" button on any solution to download it in your preferred format:
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
            <li><strong>PDF:</strong> Perfect for printing or submitting assignments - includes all steps, tips, and mistakes</li>
            <li><strong>Markdown:</strong> Great for importing into note-taking apps like Obsidian or Notion</li>
            <li><strong>JSON:</strong> Technical format for backup or integration with other tools</li>
          </ul>
        </CardContent>
      </Card>

      {/* Progress Tracking */}
      <Card className="mb-6 border-2 border-teal-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-linear-to-r from-teal-50 to-cyan-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2 dark:text-gray-100">
            <History className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            Tracking Your Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Navigate to "My Progress" from the sidebar to:
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
            <li>View all problems you've solved: one entry per problem, with how many times you have solved it</li>
            <li>See your weekly activity and total problems completed</li>
            <li>Track how many different topics you've covered</li>
            <li>Review past solutions anytime</li>
            <li>Export your entire progress history as PDF, CSV, JSON, or Markdown</li>
            <li>Clear your history when needed (useful for starting fresh each semester)</li>
          </ul>
        </CardContent>
      </Card>

      {/* Tips for Success */}
      <Card className="mb-6 border-2 border-rose-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-linear-to-r from-rose-50 to-pink-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2 dark:text-gray-100">
            <Lightbulb className="w-6 h-6 text-rose-600 dark:text-rose-400" />
            Tips for Success
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <ul className="space-y-3 text-gray-700 dark:text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-indigo-600 dark:text-indigo-400 font-bold mt-1">✓</span>
              <span><strong>Try it yourself first:</strong> Attempt the problem before checking the solution to maximize learning</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-600 dark:text-indigo-400 font-bold mt-1">✓</span>
              <span><strong>Use the examples:</strong> Click any example problem to see how to format your input correctly</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-600 dark:text-indigo-400 font-bold mt-1">✓</span>
              <span><strong>Read the insights:</strong> The Key Insights section teaches concepts that apply to many problems</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-600 dark:text-indigo-400 font-bold mt-1">✓</span>
              <span><strong>Learn from mistakes:</strong> Review the Common Mistakes section before tests and exams</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-600 dark:text-indigo-400 font-bold mt-1">✓</span>
              <span><strong>Export for study:</strong> Create PDF study guides by exporting solutions for exam preparation</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-600 dark:text-indigo-400 font-bold mt-1">✓</span>
              <span><strong>Track progress:</strong> Use the Progress page to see how much you're improving over time</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-center py-6 text-gray-500 dark:text-gray-400">
        <p>MasterMath by sparkinCreations™</p>
        <p className="text-sm mt-1">Master math with confidence — step-by-step, solved locally</p>
      </div>
    </div>
  );
}
