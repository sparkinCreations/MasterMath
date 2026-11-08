import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function FAQ() {
  usePageTitle("FAQ - Frequently Asked Questions");
  const [openIndex, setOpenIndex] = useState(null);

  const faqs = [
    {
      question: "Is MasterMath really free?",
      answer: "Yes. Every feature is free, with no subscription and no ads. If paid features are ever added, the existing ones stay free."
    },
    {
      question: "Do I need to create an account?",
      answer: "No. Your problem history is stored in your browser (IndexedDB), on your device."
    },
    {
      question: "Does MasterMath work offline?",
      answer: "Yes. After your first visit the app is cached, and solving and your history work without an internet connection."
    },
    {
      question: "Is my data private and secure?",
      answer: "Yes. Solving and your history stay on your device; we never see your work. The only thing ever sent is a message you choose to submit on the Feedback & Support page (via Web3Forms), as the Privacy Policy explains."
    },
    {
      question: "Is MasterMath AI?",
      answer: "No. MasterMath uses no language model or cloud AI. It solves with open-source math libraries (Algebrite and MathJS) in your browser, so answers are the same every time, it works offline, and input it can't handle is refused rather than guessed."
    },
    {
      question: "What types of math problems can I solve?",
      answer: "Derivatives (any order, at a point, implicit dy/dx for an equation in x and y, with every rule worked), integrals (indefinite, definite, and improper, by substitution, parts, partial fractions, trigonometric substitution, trig-power and reduction formulas), limits (one-sided and at infinity), function analysis with graphs, trigonometry (values, identities, and equations), algebra (linear through higher-degree equations, radical, absolute-value, exponential and logarithmic equations, systems of two or three equations, inequalities, simplifying and factoring), and arithmetic (order of operations, fractions, percentages). The User Manual lists what to type for each."
    },
    {
      question: "Can it solve word problems?",
      answer: "No. Type the maths the problem describes: a train that travels 120 miles in 2 hours has speed \"120/2\"; \"a number plus 7 is 12\" is \"x + 7 = 12\"."
    },
    {
      question: "Can I ask a question in words?",
      answer: "Short requests about the maths, yes: \"find the zeros of x^2 - 5x + 6\", \"the critical points of x^3 - 3x\", \"the period of 3sin(2x) + 1\", \"the amplitude of 3sin(x) + 4cos(x)\", \"the equation of the tangent line to x^2 at x = 3\", \"the inverse of 2x + 3\", \"convert 45 degrees to radians\", \"the average value of x^2 on [0, 3]\", \"the maximum of x^3 - 3x on [0, 2]\", \"is 97 prime\", \"the prime factorization of 360\", \"round 3.14159 to 2 decimal places\", and \"x squared plus 1\" for x^2 + 1. A story problem is a different thing: see the question above."
    },
    {
      question: "Do I have to pick a topic?",
      answer: "No. The solver starts on Auto-detect, which reads the topic from what you type: d/dx, ∫ or lim for calculus, an equation, inequality or system for algebra, a trig function or ° for trigonometry, \"f(x) = …\" for functions, and plain numbers for arithmetic. A notice above the steps says what was detected. An expression on its own, like x² + 3x, is simplified and factored, and buttons offer to differentiate, integrate or analyse it instead. Choosing a topic yourself still works, and the solver remembers the one you used last."
    },
    {
      question: "Can I solve a system of equations?",
      answer: "Yes. Type the equations separated by a semicolon, under any topic: \"2x + 3y = 6; x - y = 4\". Two linear equations are solved by Cramer's rule in exact fractions, three by elimination with every row operation shown, and a line with a parabola or circle by substitution. A system with no solution or infinitely many is shown as such, with the reason."
    },
    {
      question: "Can I solve an inequality?",
      answer: "Yes. Anything with <, >, ≤ or ≥ is solved by the sign-chart method, including compound forms like \"-1 < 2x + 1 <= 5\" and \"x > 1 and x < 4\". The answer gives the interval with the right open or closed endpoints, and the graph shades where it holds."
    },
    {
      question: "How do I enter a definite integral?",
      answer: "Either \"∫_0^1 x^2 dx\" (\"int_0^1 x^2 dx\" on a keyboard without ∫) or in words: \"integral of x^2 from 0 to 1\". The steps apply the Fundamental Theorem of Calculus and the value is cross-checked numerically. Improper integrals (an infinite bound such as \"∫_0^∞ e^(-x^2) dx\", or an integrand that blows up at an endpoint) are taken as limits, and a divergent one is reported as divergent with its sign. If no method finds the antiderivative, the definite integral is still estimated numerically (two step sizes must agree) and the answer is marked \"(numerical)\" rather than exact."
    },
    {
      question: "Does log mean base 10 or the natural log?",
      answer: "A bare log(…) is base 10, as on a calculator; write ln(…) for the natural logarithm, or log(x, b) / log_b(x) for another base. A note beside the answer says when log was read as base 10."
    },
    {
      question: "What do the Settings do?",
      answer: "Theme: System follows your device's light or dark setting and switches when it does; Light and Dark are fixed. Angle unit (Auto, Degrees or Radians) decides how plain-number angles are read and how angle results are shown, including the general solution of a trig equation; calculus always works in radians. Decimal places sets how many decimals numeric results show; exact fractions, radicals and π are kept regardless. All are saved in your browser."
    },
    {
      question: "Why did my solve stop after 10 seconds?",
      answer: "Solving has a 10-second limit, so the page never freezes and you never get a partial answer. The usual cause is a very high-degree polynomial: factor out a common factor or simplify, then try again. Cancel stops a solve sooner."
    },
    {
      question: "How accurate are the solutions?",
      answer: "Every answer is checked before it is shown: solutions are substituted back, antiderivatives are differentiated back, and definite integrals and limits are checked numerically. It is still worth checking important work yourself."
    },
    {
      question: "Can I export my solutions?",
      answer: "Yes. Export a solution as PDF, Markdown or JSON, or your whole history as PDF, CSV, JSON or Markdown."
    },
    {
      question: "Why isn't my graph showing?",
      answer: "Graphs are drawn for problems with a variable (usually x). Check that the expression is valid; a function that is undefined across the window may not draw."
    },
    {
      question: "How do I input mathematical expressions?",
      answer: "Use * for multiplication (2*x), ^ for powers (x^2), / for division, and names like sin, cos, tan, sqrt, ln and log. Spaces are fine. You can also type words, like \"find the derivative of x^2 + 3x\"."
    },
    {
      question: "Can I recall previous problems I've entered?",
      answer: "Yes. Press the up and down arrow keys in the problem box to step through what you typed this session."
    },
    {
      question: "Can I zoom and pan on graphs?",
      answer: "Yes. Drag to pan, use the zoom buttons, and press the target button to frame the marked points. The curve is redrawn for every window, and the reset button returns to the start."
    },
    {
      question: "Why do I see two curves on my graph?",
      answer: "For derivatives and integrals, the graph shows the original function (solid) and the result (green, dashed). When their sizes differ a lot, the dashed curve gets its own right-hand axis; a button toggles that."
    },
    {
      question: "Does MasterMath handle degree inputs for trigonometry?",
      answer: "Yes. With the angle unit on Auto, common degree values (30, 45, 60, 90, …) are read as degrees, so sin(45) means sin(45°), and results are shown in both units. Set Degrees or Radians in Settings to fix the reading for every input, including the general solution of a trig equation."
    },
    {
      question: "Can I use MasterMath for homework or exams?",
      answer: "Use it to check your work and learn the method, and follow your school's rules on academic integrity."
    },
    {
      question: "What browsers are supported?",
      answer: "Current versions of Chrome, Firefox, Safari and Edge, on desktop and mobile."
    },
    {
      question: "How do I clear my problem history?",
      answer: "On My Progress, press Clear History and confirm. To remove one problem, use the trash button on its entry. Export first if you want a copy."
    },
    {
      question: "Can I contribute to MasterMath?",
      answer: "Yes. MasterMath is open source on GitHub: report issues, suggest features or send code."
    },
    {
      question: "I found a bug or incorrect solution. What should I do?",
      answer: "Tell us on the Feedback & Support page, with the problem, the answer you expected and the one you got."
    },
    {
      question: "Does MasterMath support LaTeX?",
      answer: "Not yet. Use standard notation with *, ^, / and function names."
    },
    {
      question: "Can I use MasterMath on my phone?",
      answer: "Yes. It works on phones, and you can add it to your home screen as an app."
    },
    {
      question: "How often is MasterMath updated?",
      answer: "Often. Every release is listed in CHANGELOG.md on GitHub."
    },
    {
      question: "Who created MasterMath?",
      answer: "sparkinCreations™, as a free, private step-by-step solver built on open-source math libraries."
    }
  ];

  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <HelpCircle className="w-10 h-10 text-blue-800 dark:text-blue-300" />
          <h1 className="text-4xl font-bold text-blue-800 dark:text-blue-300">
            Frequently Asked Questions
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400 text-lg">
          Quick answers to common questions about MasterMath
        </p>
      </div>

      <div className="space-y-3">
        {faqs.map((faq, index) => (
          <Card
            key={index}
            className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden transition-shadow duration-200 hover:shadow-md"
          >
            <button
              onClick={() => toggleFAQ(index)}
              className="w-full text-left p-6 focus:outline-hidden focus:ring-2 focus:ring-indigo-400 focus:ring-inset"
              aria-expanded={openIndex === index}
            >
              <div className="flex justify-between items-start gap-4">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 pr-4">
                  {faq.question}
                </h2>
                {openIndex === index ? (
                  <ChevronUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-1" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-1" />
                )}
              </div>
            </button>
            {openIndex === index && (
              <CardContent className="px-6 pb-6 pt-0">
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  {faq.answer}
                </p>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      <div className="mt-12 p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">
          Still have questions?
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Can't find the answer you're looking for? We're here to help!
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href="/usermanual"
            className="inline-flex items-center justify-center px-6 py-3 bg-gray-900 text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200 font-semibold rounded-lg transition-colors"
          >
            Read User Manual
          </a>
          <a
            href="/feedback"
            className="inline-flex items-center justify-center px-6 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-semibold rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}
