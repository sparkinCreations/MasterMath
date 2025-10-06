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
  CheckCircle
} from "lucide-react";

export default function Home() {
  usePageTitle("Master Math with Confidence - Free Math Solver");

  return (
    <div className="p-4 md:p-6">
      {/* Hero Section */}
      <div className="max-w-6xl mx-auto mb-8 md:mb-16 text-center">
        <div className="mb-6 md:mb-8">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3 md:mb-4 px-2">
            Welcome to MasterMath
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl text-gray-600 dark:text-gray-400 mb-2 px-2">
            Master math with confidence
          </p>
          <p className="text-base md:text-lg text-gray-500 dark:text-gray-500 px-2">
            Your personal math tutor for precalculus and calculus
          </p>
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-3 md:gap-4 mb-8 md:mb-12 px-2">
          <Link to={createPageUrl("Solver")} className="w-full sm:w-auto">
            <Button
              size="lg"
              className="w-full sm:w-auto h-12 md:h-14 px-6 md:px-8 text-base md:text-lg font-semibold bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <Calculator className="w-5 h-5 mr-2" />
              Start Solving
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
          <Link to={createPageUrl("UserManual")} className="w-full sm:w-auto">
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto h-12 md:h-14 px-6 md:px-8 text-base md:text-lg font-semibold border-2 border-purple-200 hover:bg-purple-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-white"
            >
              <BookOpen className="w-5 h-5 mr-2" />
              Learn How It Works
            </Button>
          </Link>
        </div>

        {/* Hero Image/Illustration Placeholder */}
        <div className="relative max-w-4xl mx-auto px-2">
          <div className="bg-gradient-to-br from-blue-100 via-purple-100 to-green-100 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded-xl md:rounded-2xl p-6 md:p-12 border-2 border-purple-200 dark:border-gray-600 shadow-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 text-center">
              <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-xl shadow-md">
                <Calculator className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-2 md:mb-3 text-blue-600" />
                <p className="font-semibold text-sm md:text-base text-gray-800 dark:text-gray-200">Step-by-Step Solutions</p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-xl shadow-md">
                <TrendingUp className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-2 md:mb-3 text-purple-600" />
                <p className="font-semibold text-sm md:text-base text-gray-800 dark:text-gray-200">Visual Graphs</p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-xl shadow-md">
                <Lightbulb className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-2 md:mb-3 text-green-600" />
                <p className="font-semibold text-sm md:text-base text-gray-800 dark:text-gray-200">Key Insights</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-6xl mx-auto mb-8 md:mb-16 px-2">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-6 md:mb-12">
          Everything You Need to Master Math
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Feature 1 */}
          <Card className="border-2 border-blue-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-gray-700 dark:to-gray-700">
              <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                <Calculator className="w-6 h-6" />
                Multiple Topics
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-gray-700 dark:text-gray-300">
                Solve problems in derivatives, integrals, limits, functions, trigonometry, algebra, and arithmetic.
              </p>
            </CardContent>
          </Card>

          {/* Feature 2 */}
          <Card className="border-2 border-purple-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-gray-700 dark:to-gray-700">
              <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
                <Zap className="w-6 h-6" />
                Instant Solutions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-gray-700 dark:text-gray-300">
                Get immediate step-by-step solutions with detailed explanations for every problem.
              </p>
            </CardContent>
          </Card>

          {/* Feature 3 */}
          <Card className="border-2 border-green-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow">
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-gray-700 dark:to-gray-700">
              <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
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
            <CardHeader className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-gray-700 dark:to-gray-700">
              <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
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
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-gray-700 dark:to-gray-700">
              <CardTitle className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
                <BookOpen className="w-6 h-6" />
                Export & Save
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-gray-700 dark:text-gray-300">
                Export solutions as PDF, Markdown, or JSON for offline study and assignment submissions.
              </p>
            </CardContent>
          </Card>

          {/* Feature 6 */}
          <Card className="border-2 border-rose-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow">
            <CardHeader className="bg-gradient-to-r from-rose-50 to-pink-50 dark:from-gray-700 dark:to-gray-700">
              <CardTitle className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
                <Target className="w-6 h-6" />
                100% Private
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-gray-700 dark:text-gray-300">
                All data stored locally on your device. No servers, no tracking, complete privacy.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="max-w-5xl mx-auto mb-8 md:mb-16 px-2">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-6 md:mb-12">
          How It Works
        </h2>

        <div className="space-y-4 md:space-y-6">
          <Card className="border-2 border-purple-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <CardContent className="p-4 md:p-8">
              <div className="flex items-start gap-4 md:gap-6">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg md:text-xl shadow-lg">
                    1
                  </div>
                </div>
                <div>
                  <h3 className="text-lg md:text-2xl font-bold text-gray-800 dark:text-gray-200 mb-1 md:mb-2">Select Your Topic</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm md:text-lg">
                    Choose from derivatives, integrals, limits, functions, trigonometry, algebra, or arithmetic.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <CardContent className="p-4 md:p-8">
              <div className="flex items-start gap-4 md:gap-6">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg md:text-xl shadow-lg">
                    2
                  </div>
                </div>
                <div>
                  <h3 className="text-lg md:text-2xl font-bold text-gray-800 dark:text-gray-200 mb-1 md:mb-2">Enter Your Problem</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm md:text-lg">
                    Type your math problem or choose from example problems to get started quickly.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <CardContent className="p-4 md:p-8">
              <div className="flex items-start gap-4 md:gap-6">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg md:text-xl shadow-lg">
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
        <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-green-50 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 rounded-xl md:rounded-2xl p-6 md:p-12 border-2 border-purple-200 dark:border-gray-600">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-6 md:mb-8">
            Why Choose MasterMath?
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="flex items-start gap-2 md:gap-3">
              <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-green-600 flex-shrink-0 mt-1" />
              <div>
                <h4 className="font-bold text-base md:text-lg text-gray-800 dark:text-gray-200 mb-1">No Sign-Up Required</h4>
                <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">Start solving immediately without creating an account</p>
              </div>
            </div>

            <div className="flex items-start gap-2 md:gap-3">
              <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-green-600 flex-shrink-0 mt-1" />
              <div>
                <h4 className="font-bold text-base md:text-lg text-gray-800 dark:text-gray-200 mb-1">Always Free</h4>
                <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">All features available at no cost, forever</p>
              </div>
            </div>

            <div className="flex items-start gap-2 md:gap-3">
              <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-green-600 flex-shrink-0 mt-1" />
              <div>
                <h4 className="font-bold text-base md:text-lg text-gray-800 dark:text-gray-200 mb-1">Works Offline</h4>
                <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">All calculations happen in your browser, no internet needed</p>
              </div>
            </div>

            <div className="flex items-start gap-2 md:gap-3">
              <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-green-600 flex-shrink-0 mt-1" />
              <div>
                <h4 className="font-bold text-base md:text-lg text-gray-800 dark:text-gray-200 mb-1">Student-Friendly</h4>
                <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">Designed for students by understanding their needs</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-4xl mx-auto text-center px-2">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl md:rounded-2xl p-6 md:p-12 shadow-2xl">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 md:mb-4">
            Ready to Master Math?
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-blue-100 mb-6 md:mb-8">
            Join thousands of students who are learning math with confidence
          </p>
          <Link to={createPageUrl("Solver")} className="inline-block w-full sm:w-auto">
            <Button
              size="lg"
              className="w-full sm:w-auto h-12 md:h-14 px-6 md:px-8 text-base md:text-lg font-semibold bg-white text-purple-600 hover:bg-gray-100 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <Calculator className="w-5 h-5 mr-2" />
              Start Solving Now
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-8 md:py-12 text-gray-500 dark:text-gray-400 px-2">
        <p className="text-base md:text-lg">MasterMath by sparkinCreations™</p>
        <p className="text-xs md:text-sm mt-1">Master math with confidence - Your personal math tutor, anytime, anywhere</p>
      </div>
    </div>
  );
}
