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
      answer: "Yes! All math calculations happen in your browser using JavaScript libraries. Once the page loads, you can solve problems without an internet connection. Your data is stored locally, so it's always accessible."
    },
    {
      question: "Is my data private and secure?",
      answer: "Absolutely. MasterMath is 100% client-side - nothing is sent to our servers because we don't have any! All your problems, solutions, and history are stored locally in your browser's IndexedDB. We never see, collect, or transmit your data."
    },
    {
      question: "What types of math problems can I solve?",
      answer: "MasterMath supports derivatives, integrals, limits, functions (graphing), trigonometry, algebra (equations, simplification, factoring), and basic arithmetic. We're continuously working to add more topics!"
    },
    {
      question: "How accurate are the solutions?",
      answer: "We use industry-standard math libraries (Algebrite, MathJS, mathsteps) for calculations. However, you should always verify solutions independently. MasterMath is a learning tool, not a replacement for understanding the concepts."
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
      answer: "Use standard notation: * for multiplication (2*x), ^ for exponents (x^2), / for division. You can also use function names like sin, cos, tan, sqrt, ln, log. Spaces are allowed for readability."
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
      answer: "MasterMath was created by sparkinCreations™ to make math learning accessible, free, and privacy-focused. It's built with modern web technologies and powered by open-source math libraries."
    }
  ];

  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <HelpCircle className="w-10 h-10 text-purple-600" />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
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
            className="border-2 border-purple-200 dark:border-gray-700 overflow-hidden transition-all duration-200 hover:shadow-md"
          >
            <button
              onClick={() => toggleFAQ(index)}
              className="w-full text-left p-6 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-inset"
              aria-expanded={openIndex === index}
            >
              <div className="flex justify-between items-start gap-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 pr-4">
                  {faq.question}
                </h3>
                {openIndex === index ? (
                  <ChevronUp className="w-5 h-5 text-purple-600 flex-shrink-0 mt-1" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-purple-600 flex-shrink-0 mt-1" />
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

      <div className="mt-12 p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-700 rounded-xl border-2 border-purple-200 dark:border-gray-600">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">
          Still have questions?
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Can't find the answer you're looking for? We're here to help!
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href="/usermanual"
            className="inline-flex items-center justify-center px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors"
          >
            Read User Manual
          </a>
          <a
            href="/feedback"
            className="inline-flex items-center justify-center px-6 py-3 bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 font-semibold rounded-lg border-2 border-purple-600 dark:border-purple-400 hover:bg-purple-50 dark:hover:bg-gray-600 transition-colors"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}
