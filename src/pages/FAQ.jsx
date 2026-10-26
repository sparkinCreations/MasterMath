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
      answer: "Yes! MasterMath is completely free with no hidden costs or subscriptions. All current features are available to everyone at no charge. If we ever introduce premium features in the future, existing features will remain free and any changes will be clearly communicated."
    },
    {
      question: "Do I need to create an account?",
      answer: "No account needed! You can start using MasterMath immediately. Your problem history is stored locally in your browser using IndexedDB, so your data stays private and on your device."
    },
    {
      question: "Does MasterMath work offline?",
      answer: "Yes! MasterMath includes a service worker that caches the entire app for offline use. After your first visit, you can solve problems without an internet connection. All math calculations happen locally in your browser using JavaScript libraries, and your data is stored in IndexedDB, so everything is always accessible — even without Wi-Fi."
    },
    {
      question: "Is my data private and secure?",
      answer: "Yes. Solving and your problem history stay on your device in IndexedDB — we never see your math work. The only time anything is sent is if you choose to submit Feedback & Support (via Web3Forms); that is optional and documented in the Privacy Policy."
    },
    {
      question: "Is MasterMath AI?",
      answer: "No. MasterMath does not use a language model or any cloud AI to solve problems. All calculations run in your browser with open-source math libraries (Algebrite and MathJS). That is why it works offline, why answers are deterministic, and why unsupported input is refused instead of invented."
    },
    {
      question: "What types of math problems can I solve?",
      answer: "Derivatives (any order, at a point, implicit dy/dx for an equation in x and y, with every rule worked), integrals (indefinite, definite, and improper, by substitution, parts, or partial fractions), limits (one-sided and at infinity), function analysis with graphs, trigonometry (values, identities, and equations), algebra (linear through higher-degree equations, radical, absolute-value, exponential and logarithmic equations, systems of two or three equations, inequalities, simplifying and factoring), and arithmetic (order of operations, fractions, percentages). The User Manual lists what to type for each."
    },
    {
      question: "Can it solve word problems?",
      answer: "No. Word problems are not supported: MasterMath works on the maths itself, typed as notation. Write the equation or expression the problem describes — a train that travels 120 miles in 2 hours has speed \"120/2\"; \"a number plus 7 is 12\" is \"x + 7 = 12\" — and it will solve that step by step."
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
      answer: "Either \"∫_0^1 x^2 dx\" (\"int_0^1 x^2 dx\" on a keyboard without ∫) or in words: \"integral of x^2 from 0 to 1\". The steps apply the Fundamental Theorem of Calculus and the value is cross-checked numerically. Improper integrals — an infinite bound such as \"∫_0^∞ e^(-x^2) dx\", or an integrand that blows up at an endpoint — are taken as limits, and a divergent one is reported as divergent with its sign."
    },
    {
      question: "Does log mean base 10 or the natural log?",
      answer: "A bare log(…) is the common logarithm, base 10, as on a calculator; write ln(…) for the natural logarithm, or log(x, b) / log_b(x) for another base. When a solution relied on that reading, a tip says so."
    },
    {
      question: "What do the Settings do?",
      answer: "Theme: System follows your device's light or dark setting and switches when it does; Light and Dark are fixed. Angle unit (Auto, Degrees or Radians) decides how plain-number angles are read and how angle results are shown, including the general solution of a trig equation; calculus always works in radians. Decimal places sets how many decimals numeric results show — exact fractions, radicals and π are kept regardless. All are saved in your browser."
    },
    {
      question: "Why did my solve stop after 10 seconds?",
      answer: "Solving runs in the background with a 10-second limit, so the page never freezes and you never get a late or partial answer. The usual cause is a very high-degree polynomial with many real roots. Factor out a common factor first, or simplify the equation, and try again. The Cancel button stops a solve sooner."
    },
    {
      question: "How accurate are the solutions?",
      answer: "We use industry-standard math libraries (Algebrite and MathJS) for calculations — not AI. However, you should always verify solutions independently. MasterMath is a learning tool, not a replacement for understanding the concepts."
    },
    {
      question: "Can I export my solutions?",
      answer: "Yes! You can export individual solutions or your entire problem history in multiple formats: PDF, CSV, JSON, and Markdown. Perfect for homework submissions, study notes, or keeping records."
    },
    {
      question: "Why isn't my graph showing?",
      answer: "Graphs are generated automatically for function-related problems. Make sure your expression is valid and contains a variable (usually x). Some complex functions may not graph if they contain undefined points or are outside the visible range."
    },
    {
      question: "How do I input mathematical expressions?",
      answer: "Use standard notation: * for multiplication (2*x), ^ for exponents (x^2), / for division. You can also use function names like sin, cos, tan, sqrt, ln, log. Spaces are allowed for readability. You can also type in natural language like \"find the derivative of x^2 + 3x\" and MasterMath will extract the math expression automatically."
    },
    {
      question: "Can I recall previous problems I've entered?",
      answer: "Yes! Use the up arrow (↑) and down arrow (↓) keys in the problem input area to navigate through your recent inputs from the current session. This makes it easy to re-solve or modify problems you've already tried."
    },
    {
      question: "Can I zoom and pan on graphs?",
      answer: "Yes. Drag the graph with a mouse or finger to pan, use the zoom buttons, and press the target button to frame the marked roots, turning points and asymptotes. The curve is redrawn for every window, so it stays smooth however far you zoom in; a reset button returns to the starting view."
    },
    {
      question: "Why do I see two curves on my graph?",
      answer: "For derivatives and integrals, MasterMath shows both the original function (blue/indigo curve) and the result (green dashed curve) on the same graph. When the two differ a lot in size, the dashed curve gets its own right-hand axis so neither is squashed; a button toggles that."
    },
    {
      question: "Does MasterMath handle degree inputs for trigonometry?",
      answer: "Yes. With the angle unit on Auto, common degree values (30, 45, 60, 90, …) are read as degrees, so sin(45) means sin(45°), and results are shown in both units. Set Degrees or Radians in Settings to fix the reading for every input, including the general solution of a trig equation."
    },
    {
      question: "Can I use MasterMath for homework or exams?",
      answer: "MasterMath is designed as a learning companion. While you can use it to check your work and understand concepts, we recommend using it ethically. Always follow your school's academic integrity policies. The tool is meant to help you learn, not to bypass learning."
    },
    {
      question: "What browsers are supported?",
      answer: "MasterMath works on all modern browsers (Chrome, Firefox, Safari, Edge) on desktop and mobile devices. We recommend keeping your browser updated for the best experience."
    },
    {
      question: "How do I clear my problem history?",
      answer: "Go to the 'My Progress' page and click the 'Clear History' button. You'll be asked to confirm before all data is permanently deleted. You can also export your history before clearing if you want to keep a backup."
    },
    {
      question: "Can I contribute to MasterMath?",
      answer: "Yes! MasterMath is open source on GitHub. You can report issues, suggest features, or contribute code. We welcome contributions from the community to make math learning better for everyone."
    },
    {
      question: "I found a bug or incorrect solution. What should I do?",
      answer: "Please report it! Use the Feedback & Support page to let us know about bugs or incorrect solutions. Include the problem, expected result, and what you got. This helps us improve the app for everyone."
    },
    {
      question: "Does MasterMath support LaTeX?",
      answer: "Currently, we don't support LaTeX input, but it's on our roadmap! For now, use standard notation with operators like *, ^, /, and function names."
    },
    {
      question: "Can I use MasterMath on my phone?",
      answer: "Yes! MasterMath is fully responsive and works great on mobile devices. You can even add it to your home screen as a Progressive Web App (PWA) for quick access."
    },
    {
      question: "How often is MasterMath updated?",
      answer: "We regularly update MasterMath with new features, bug fixes, and improvements. Check our GitHub repository or CHANGELOG.md for the latest updates and version history."
    },
    {
      question: "Who created MasterMath?",
      answer: "MasterMath was created by sparkinCreations™ to make math learning accessible, free, and privacy-focused. It's built with modern web technologies and powered by open-source math libraries — not AI."
    }
  ];

  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <HelpCircle className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
          <h1 className="text-4xl font-bold bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
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
            className="border-2 border-indigo-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden transition-all duration-200 hover:shadow-md"
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

      <div className="mt-12 p-6 bg-linear-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 rounded-xl border-2 border-indigo-200 dark:border-gray-600">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">
          Still have questions?
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Can't find the answer you're looking for? We're here to help!
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href="/usermanual"
            className="inline-flex items-center justify-center px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Read User Manual
          </a>
          <a
            href="/feedback"
            className="inline-flex items-center justify-center px-6 py-3 bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-200 font-semibold rounded-lg border-2 border-indigo-600 dark:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-gray-600 transition-colors"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}
