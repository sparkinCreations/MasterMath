import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

// The graph panel's placeholder card, kept separate from GraphViewer so it can
// be rendered without pulling in Recharts. Solver.jsx shows this until a
// solution actually carries graph data, and again as the Suspense fallback
// while the chart chunk loads.
export default function GraphEmptyState({ message = "Enter a function to see its graph!" }) {
  return (
    <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm rounded-lg">
      <CardHeader className="border-b border-gray-100 dark:border-gray-700">
        <CardTitle className="flex items-center gap-2 text-xl">
          <TrendingUp className="w-6 h-6 text-gray-500 dark:text-gray-400" />
          Graph View
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8">
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
            <TrendingUp className="w-8 h-8 text-gray-400 dark:text-gray-400" />
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            {message}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
