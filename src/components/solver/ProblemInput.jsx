import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Sparkles, Lightbulb, AlertCircle } from "lucide-react";
import { validateMathInput, validateTopic, sanitizeInput } from "@/lib/validation";

const TOPICS = [
  { value: "derivatives", label: "Derivatives" },
  { value: "integrals", label: "Integrals" },
  { value: "limits", label: "Limits" },
  { value: "functions", label: "Functions" },
  { value: "trigonometry", label: "Trigonometry" },
  { value: "algebra", label: "Algebra" },
  { value: "other", label: "Arithmetic" }
];

const PLACEHOLDERS = {
  derivatives: "e.g., x^2 + 3*x or Find the derivative of x^3 - 2*x",
  integrals: "e.g., 2*x + 1 or Integrate x^2",
  limits: "e.g., lim x->0 (sin(x)/x) or (x^2 - 4)/(x - 2) as x->2",
  functions: "e.g., x^2 - 4*x + 3 or f(x) = x^3 - x",
  trigonometry: "e.g., sin(pi/4) or cos(60) or tan(x)",
  algebra: "e.g., 2*x + 5 = 11 or x^2 - 4 or (x + 2)*(x - 3)",
  other: "e.g., 15 + 23, 8 * 7, (5 + 3) * 4, 2^3 + 10/2"
};

const EXAMPLE_PROBLEMS = [
  { topic: "derivatives", problem: "x^2 + 3*x" },
  { topic: "integrals", problem: "2*x + 1" },
  { topic: "limits", problem: "lim x->0 (sin(x)/x)" },
  { topic: "functions", problem: "x^2 - 4*x + 3" },
  { topic: "algebra", problem: "2*x + 5 = 11" },
  { topic: "trigonometry", problem: "sin(pi/4)" },
  { topic: "other", problem: "(5 + 3) * 4 - 2^3" }
];

export default function ProblemInput({ problem, setProblem, topic, setTopic, onSolve, isLoading }) {
  const [validationError, setValidationError] = useState(null);

  const loadExample = (exampleProblem) => {
    setProblem(exampleProblem.problem);
    setTopic(exampleProblem.topic);
    setValidationError(null);
  };

  const handleProblemChange = (e) => {
    // Allow all input, only sanitize when validating
    setProblem(e.target.value);
    setValidationError(null);
  };

  const handleKeyDown = (e) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (problem.trim() && topic && !isLoading) {
        handleSolve();
      }
    }
    // Shift+Enter creates a new line (default behavior)
  };

  const handleSolve = () => {
    // Validate topic
    const topicValidation = validateTopic(topic);
    if (!topicValidation.isValid) {
      setValidationError(topicValidation.error);
      return;
    }

    // Sanitize and validate math input
    const sanitized = sanitizeInput(problem);
    const inputValidation = validateMathInput(sanitized);
    if (!inputValidation.isValid) {
      setValidationError(inputValidation.error);
      return;
    }

    setValidationError(null);
    onSolve();
  };

  // Get the display label for the selected topic
  const selectedLabel = TOPICS.find(t => t.value === topic)?.label || "Select a topic";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="topic" className="text-lg font-semibold text-gray-700 dark:text-gray-200">
          What are you working on?
        </Label>
        <Select value={topic} onValueChange={setTopic}>
          <SelectTrigger className="h-12 text-lg border-2 border-purple-200 focus:border-purple-400 rounded-xl">
            <SelectValue placeholder="Select a topic">
              {selectedLabel}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {TOPICS.map((t) => (
              <SelectItem key={t.value} value={t.value} className="text-lg">
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="problem" className="text-lg font-semibold text-gray-700 dark:text-gray-200">
          Enter your problem
        </Label>
        <Textarea
          id="problem"
          value={problem}
          onChange={handleProblemChange}
          onKeyDown={handleKeyDown}
          placeholder={topic ? PLACEHOLDERS[topic] : "Select a topic first, then enter your problem..."}
          className={`min-h-32 text-lg border-2 ${
            validationError ? 'border-red-300 focus:border-red-400' : 'border-purple-200 focus:border-purple-400'
          } rounded-xl p-4 resize-none`}
          maxLength={1000}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {problem.length}/1000 characters
        </p>
      </div>

      {validationError && (
        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600 dark:text-red-400">{validationError}</p>
        </div>
      )}

      <Button
        onClick={handleSolve}
        disabled={!problem.trim() || !topic || isLoading}
        className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl"
      >
        {isLoading ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3" />
            Solving...
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5 mr-2" />
            Solve Problem
          </>
        )}
      </Button>

      <div className="pt-4 border-t border-purple-200">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="w-5 h-5 text-amber-500" />
          <span className="font-semibold text-gray-700 dark:text-gray-200">Try an example:</span>
        </div>
        <div className="grid gap-2">
          {EXAMPLE_PROBLEMS.map((ex, idx) => (
            <button
              key={idx}
              onClick={() => loadExample(ex)}
              className="text-left p-3 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 transition-all duration-200 border border-purple-200 text-sm"
            >
              <span className="font-medium text-purple-700 capitalize">{ex.topic}:</span>{" "}
              <span className="text-gray-700 dark:text-gray-300">{ex.problem}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}