import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Calculator, Download, History, Lightbulb, TrendingUp } from "lucide-react";

export default function UserManual() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
          User Manual
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-lg">
          Learn how to use MathMaster by sparkinCreations™ effectively
        </p>
      </div>

      {/* Welcome Section */}
      <Card className="mb-6 border-2 border-purple-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-purple-600" />
            Welcome to MathMaster!
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            MathMaster is your personal math tutor designed to help you understand and solve precalculus
            and calculus problems step-by-step. Whether you're struggling with derivatives, integrals,
            limits, or basic algebra, MathMaster guides you through each problem with clear explanations,
            helpful tips, and warnings about common mistakes.
          </p>
        </CardContent>
      </Card>

      {/* Getting Started */}
      <Card className="mb-6 border-2 border-blue-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-6 h-6 text-blue-600" />
            Getting Started - Using the Solver
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">Step 1: Select Your Topic</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-2">
              Choose what type of problem you're working on from the dropdown menu:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-4">
              <li><strong>Derivatives:</strong> Finding rates of change and slopes</li>
              <li><strong>Integrals:</strong> Finding areas under curves and antiderivatives</li>
              <li><strong>Limits:</strong> Understanding behavior as values approach infinity or specific points</li>
              <li><strong>Functions:</strong> Analyzing and graphing mathematical functions</li>
              <li><strong>Trigonometry:</strong> Solving problems with sine, cosine, tangent, etc.</li>
              <li><strong>Algebra:</strong> Solving equations and simplifying expressions</li>
              <li><strong>Arithmetic:</strong> Basic calculations and operations</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">Step 2: Enter Your Problem</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-2">
              Type your math problem in the text area. Here are some formatting tips:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-4">
              <li>Use <code className="bg-purple-100 dark:bg-gray-700 px-1 rounded">*</code> for multiplication: <code className="bg-purple-100 dark:bg-gray-700 px-1 rounded">2*x</code> instead of 2x</li>
              <li>Use <code className="bg-purple-100 dark:bg-gray-700 px-1 rounded">^</code> for exponents: <code className="bg-purple-100 dark:bg-gray-700 px-1 rounded">x^2</code> for x²</li>
              <li>Use parentheses for clarity: <code className="bg-purple-100 dark:bg-gray-700 px-1 rounded">(x + 2)*(x - 3)</code></li>
              <li>For limits, use format: <code className="bg-purple-100 dark:bg-gray-700 px-1 rounded">lim x-&gt;0 (sin(x)/x)</code></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">Step 3: Click "Solve Problem"</h3>
            <p className="text-gray-700 dark:text-gray-300">
              MathMaster will analyze your problem and provide a complete solution with step-by-step explanations!
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Example Problems */}
      <Card className="mb-6 border-2 border-green-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-6 h-6 text-green-600" />
            Example Problems
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-3">
            <div className="p-4 bg-blue-50 dark:bg-gray-700 rounded-lg">
              <p className="font-semibold text-blue-700 dark:text-blue-400 mb-1">Derivatives Example:</p>
              <p className="text-gray-700 dark:text-gray-300">
                Topic: Derivatives<br />
                Problem: <code className="bg-white dark:bg-gray-600 px-2 py-1 rounded">x^2 + 3*x</code>
              </p>
            </div>

            <div className="p-4 bg-purple-50 dark:bg-gray-700 rounded-lg">
              <p className="font-semibold text-purple-700 dark:text-purple-400 mb-1">Integrals Example:</p>
              <p className="text-gray-700 dark:text-gray-300">
                Topic: Integrals<br />
                Problem: <code className="bg-white dark:bg-gray-600 px-2 py-1 rounded">2*x + 1</code>
              </p>
            </div>

            <div className="p-4 bg-amber-50 dark:bg-gray-700 rounded-lg">
              <p className="font-semibold text-amber-700 dark:text-amber-400 mb-1">Limits Example:</p>
              <p className="text-gray-700 dark:text-gray-300">
                Topic: Limits<br />
                Problem: <code className="bg-white dark:bg-gray-600 px-2 py-1 rounded">lim x-&gt;0 (sin(x)/x)</code>
              </p>
            </div>

            <div className="p-4 bg-emerald-50 dark:bg-gray-700 rounded-lg">
              <p className="font-semibold text-emerald-700 dark:text-emerald-400 mb-1">Algebra Example:</p>
              <p className="text-gray-700 dark:text-gray-300">
                Topic: Algebra<br />
                Problem: <code className="bg-white dark:bg-gray-600 px-2 py-1 rounded">2*x + 5 = 11</code>
              </p>
            </div>

            <div className="p-4 bg-pink-50 dark:bg-gray-700 rounded-lg">
              <p className="font-semibold text-pink-700 dark:text-pink-400 mb-1">Trigonometry Example:</p>
              <p className="text-gray-700 dark:text-gray-300">
                Topic: Trigonometry<br />
                Problem: <code className="bg-white dark:bg-gray-600 px-2 py-1 rounded">sin(pi/4)</code>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Understanding Solutions */}
      <Card className="mb-6 border-2 border-orange-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-orange-600" />
            Understanding Your Solution
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">Step-by-Step Solution</h3>
            <p className="text-gray-700 dark:text-gray-300">
              Each solution breaks down the problem into clear, numbered steps showing exactly how to solve it.
              Follow along to understand the mathematical process.
            </p>
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
            <p className="text-gray-700 dark:text-gray-300">
              When applicable, MathMaster displays an interactive graph to help you visualize the function or solution.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Exporting Solutions */}
      <Card className="mb-6 border-2 border-indigo-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2">
            <Download className="w-6 h-6 text-indigo-600" />
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
        <CardHeader className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2">
            <History className="w-6 h-6 text-teal-600" />
            Tracking Your Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Navigate to "My Progress" from the sidebar to:
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
            <li>View all problems you've solved</li>
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
        <CardHeader className="bg-gradient-to-r from-rose-50 to-pink-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-6 h-6 text-rose-600" />
            Tips for Success
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <ul className="space-y-3 text-gray-700 dark:text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-purple-600 font-bold mt-1">✓</span>
              <span><strong>Try it yourself first:</strong> Attempt the problem before checking the solution to maximize learning</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600 font-bold mt-1">✓</span>
              <span><strong>Use the examples:</strong> Click any example problem to see how to format your input correctly</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600 font-bold mt-1">✓</span>
              <span><strong>Read the insights:</strong> The Key Insights section teaches concepts that apply to many problems</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600 font-bold mt-1">✓</span>
              <span><strong>Learn from mistakes:</strong> Review the Common Mistakes section before tests and exams</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600 font-bold mt-1">✓</span>
              <span><strong>Export for study:</strong> Create PDF study guides by exporting solutions for exam preparation</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600 font-bold mt-1">✓</span>
              <span><strong>Track progress:</strong> Use the Progress page to see how much you're improving over time</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-center py-6 text-gray-500 dark:text-gray-400">
        <p>MathMaster by sparkinCreations™</p>
        <p className="text-sm mt-1">Learn with confidence - Your personal math tutor, anytime, anywhere</p>
      </div>
    </div>
  );
}
