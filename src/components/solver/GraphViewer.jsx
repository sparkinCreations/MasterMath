import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Scatter, ScatterChart } from "recharts";
import { TrendingUp } from "lucide-react";

// Custom dot component for solution points
const SolutionDot = (props) => {
  const { cx, cy } = props;
  return (
    <g>
      <circle cx={cx} cy={cy} r={8} fill="#10b981" stroke="#fff" strokeWidth={3} />
      <circle cx={cx} cy={cy} r={4} fill="#fff" />
    </g>
  );
};

export default function GraphViewer({ functionData }) {
  if (!functionData || !functionData.points) {
    return (
      <Card className="bg-white dark:bg-gray-800 border-2 border-purple-200 dark:border-gray-700 shadow-lg rounded-xl">
        <CardHeader className="border-b border-purple-100 bg-gradient-to-r from-blue-50 to-purple-50">
          <CardTitle className="flex items-center gap-2 text-xl">
            <TrendingUp className="w-6 h-6 text-purple-600" />
            Graph View
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mb-4">
              <TrendingUp className="w-8 h-8 text-purple-500" />
            </div>
            <p className="text-gray-500 text-lg">
              Enter a function to see its graph!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white dark:bg-gray-800 border-2 border-purple-200 dark:border-gray-700 shadow-lg rounded-xl">
      <CardHeader className="border-b border-purple-100 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-700 dark:to-gray-700">
        <CardTitle className="flex items-center gap-2 text-xl">
          <TrendingUp className="w-6 h-6 text-purple-600" />
          {functionData.title || "Graph View"}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={functionData.points}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e9d5ff" />
              <XAxis
                dataKey="x"
                stroke="#9333ea"
                label={{ value: 'x', position: 'insideBottomRight', offset: -5 }}
              />
              <YAxis
                stroke="#9333ea"
                label={{ value: 'y', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '2px solid #e9d5ff',
                  borderRadius: '12px',
                  padding: '8px'
                }}
              />
              <ReferenceLine x={0} stroke="#cbd5e1" strokeWidth={2} />
              <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={2} />
              <Line
                type="monotone"
                dataKey="y"
                stroke="url(#colorGradient)"
                strokeWidth={3}
                dot={false}
              />
              {/* Render solution points as green dots */}
              {functionData.solutions && functionData.solutions.map((sol, idx) => {
                // Find the y-value for this x
                const point = functionData.points.find(p => Math.abs(p.x - sol) < 0.1);
                if (point) {
                  return (
                    <ReferenceLine
                      key={`sol-${idx}`}
                      x={sol}
                      stroke="#10b981"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      label={{
                        value: `x = ${sol.toFixed(2)}`,
                        position: 'top',
                        fill: '#10b981',
                        fontWeight: 'bold'
                      }}
                    />
                  );
                }
                return null;
              })}
              <defs>
                <linearGradient id="colorGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#9333ea" />
                </linearGradient>
              </defs>
            </LineChart>
          </ResponsiveContainer>
        </div>
        {functionData.description && (
          <p className="mt-4 text-sm text-gray-600 bg-gradient-to-r from-blue-50 to-purple-50 p-3 rounded-lg border border-purple-200">
            {functionData.description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}