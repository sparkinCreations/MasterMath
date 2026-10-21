import React from "react";
import { Link } from "react-router-dom";
import { Home, Calculator } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";

// An unknown URL used to redirect to the home page without a word, which
// looks like the link worked and landed somewhere odd. Say what happened.
export default function NotFound() {
  usePageTitle("Page not found");
  return (
    <div className="max-w-2xl mx-auto px-6 py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400 mb-2">404</p>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">Page not found</h1>
      <p className="text-gray-600 dark:text-gray-300 mb-8">
        There is no page at <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">{typeof window !== "undefined" ? window.location.pathname : ""}</code>. The link may be out of date, or the address mistyped.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link to="/" className="inline-flex items-center gap-2 min-h-11 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900">
          <Home className="w-4 h-4" aria-hidden="true" /> Go to the home page
        </Link>
        <Link to="/solver" className="inline-flex items-center gap-2 min-h-11 px-4 rounded-lg border-2 border-indigo-200 dark:border-gray-600 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-gray-800 font-medium focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900">
          <Calculator className="w-4 h-4" aria-hidden="true" /> Open the solver
        </Link>
      </div>
    </div>
  );
}
