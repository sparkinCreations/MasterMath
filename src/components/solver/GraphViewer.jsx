import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { TrendingUp, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDarkMode } from "@/contexts/DarkModeContext";

// Zoom levels: each step doubles/halves the visible range
const DEFAULT_RANGE = { xMin: -10, xMax: 10 };

export default function GraphViewer({ functionData }) {
  const { isDarkMode } = useDarkMode();
  const [range, setRange] = useState(DEFAULT_RANGE);

  // Filter points to visible range
  const visiblePoints = useMemo(() => {
    if (!functionData?.points) return [];
    return functionData.points.filter(p => p.x >= range.xMin && p.x <= range.xMax);
  }, [functionData?.points, range]);

  const visibleSecondary = useMemo(() => {
    if (!functionData?.secondaryPoints) return [];
    return functionData.secondaryPoints.filter(p => p.x >= range.xMin && p.x <= range.xMax);
  }, [functionData?.secondaryPoints, range]);

  // Merge primary and secondary points into one dataset for dual-line rendering
  const mergedPoints = useMemo(() => {
    if (visibleSecondary.length === 0) return visiblePoints;

    const map = new Map();
    visiblePoints.forEach(p => map.set(p.x, { x: p.x, y: p.y }));
    visibleSecondary.forEach(p => {
      if (map.has(p.x)) {
        map.get(p.x).y2 = p.y;
      } else {
        map.set(p.x, { x: p.x, y2: p.y });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.x - b.x);
  }, [visiblePoints, visibleSecondary]);

  const zoomIn = () => {
    setRange(prev => {
      const center = (prev.xMin + prev.xMax) / 2;
      const halfSpan = (prev.xMax - prev.xMin) / 4; // halve the range
      if (halfSpan < 0.5) return prev; // minimum zoom
      return { xMin: center - halfSpan, xMax: center + halfSpan };
    });
  };

  const zoomOut = () => {
    setRange(prev => {
      const center = (prev.xMin + prev.xMax) / 2;
      const halfSpan = (prev.xMax - prev.xMin); // double the range
      return { xMin: center - halfSpan, xMax: center + halfSpan };
    });
  };

  const panLeft = () => {
    setRange(prev => {
      const shift = (prev.xMax - prev.xMin) * 0.25;
      return { xMin: prev.xMin - shift, xMax: prev.xMax - shift };
    });
  };

  const panRight = () => {
    setRange(prev => {
      const shift = (prev.xMax - prev.xMin) * 0.25;
      return { xMin: prev.xMin + shift, xMax: prev.xMax + shift };
    });
  };

  const resetZoom = () => setRange(DEFAULT_RANGE);

  // Theme-aware colors
  const gridColor = isDarkMode ? '#374151' : '#e9d5ff';
  const axisColor = isDarkMode ? '#9ca3af' : '#9333ea';
  const axisLineColor = isDarkMode ? '#4b5563' : '#cbd5e1';
  const tooltipBg = isDarkMode ? '#1f2937' : 'white';
  const tooltipBorder = isDarkMode ? '#4b5563' : '#e9d5ff';
  const tooltipText = isDarkMode ? '#e5e7eb' : '#1f2937';
  const descBg = isDarkMode ? '' : 'from-blue-50 to-purple-50';
  const descBorder = isDarkMode ? 'border-gray-600' : 'border-purple-200';

  if (!functionData || !functionData.points) {
    return (
      <Card className="bg-white dark:bg-gray-800 border-2 border-purple-200 dark:border-gray-700 shadow-lg rounded-xl">
        <CardHeader className="border-b border-purple-100 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-700 dark:to-gray-700">
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

  const hasSecondary = mergedPoints.some(p => p.y2 !== undefined);

  return (
    <Card className="bg-white dark:bg-gray-800 border-2 border-purple-200 dark:border-gray-700 shadow-lg rounded-xl">
      <CardHeader className="border-b border-purple-100 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-700 dark:to-gray-700">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xl">
            <TrendingUp className="w-6 h-6 text-purple-600" />
            {functionData.title || "Graph View"}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={panLeft} title="Pan left">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomIn} title="Zoom in">
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomOut} title="Zoom out">
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={panRight} title="Pan right">
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetZoom} title="Reset view">
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mergedPoints}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis
                dataKey="x"
                stroke={axisColor}
                type="number"
                domain={[range.xMin, range.xMax]}
                tickFormatter={(v) => Number.isInteger(v) ? v : v.toFixed(1)}
                label={{ value: 'x', position: 'insideBottomRight', offset: -5, fill: axisColor }}
              />
              <YAxis
                stroke={axisColor}
                label={{ value: 'y', angle: -90, position: 'insideLeft', fill: axisColor }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  border: `2px solid ${tooltipBorder}`,
                  borderRadius: '12px',
                  padding: '8px',
                  color: tooltipText
                }}
                formatter={(value, name) => {
                  const label = name === 'y2' ? (functionData.secondaryLabel || 'Secondary') : 'f(x)';
                  return [typeof value === 'number' ? value.toFixed(4) : value, label];
                }}
                labelFormatter={(label) => `x = ${typeof label === 'number' ? label.toFixed(2) : label}`}
              />
              <ReferenceLine x={0} stroke={axisLineColor} strokeWidth={2} />
              <ReferenceLine y={0} stroke={axisLineColor} strokeWidth={2} />
              {/* Primary curve */}
              <Line
                type="linear"
                dataKey="y"
                stroke="url(#colorGradient)"
                strokeWidth={3}
                dot={false}
                connectNulls={false}
                name="y"
              />
              {/* Secondary curve (derivative or integral) */}
              {hasSecondary && (
                <Line
                  type="linear"
                  dataKey="y2"
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={false}
                  connectNulls={false}
                  name="y2"
                />
              )}
              {/* Solution reference lines */}
              {functionData.solutions && functionData.solutions.map((sol, idx) => {
                if (sol < range.xMin || sol > range.xMax) return null;
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
        {/* Legend for dual curves */}
        {hasSecondary && (
          <div className="flex items-center gap-4 mt-3 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-6 h-0.5 bg-gradient-to-r from-blue-500 to-purple-600" />
              <span className="text-gray-600 dark:text-gray-400">f(x)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-0.5 border-t-2 border-dashed border-green-500" />
              <span className="text-gray-600 dark:text-gray-400">{functionData.secondaryLabel || 'Secondary'}</span>
            </div>
          </div>
        )}
        {functionData.description && (
          <p className={`mt-3 text-sm text-gray-600 dark:text-gray-400 bg-gradient-to-r ${descBg} dark:bg-gray-700/50 p-3 rounded-lg border ${descBorder}`}>
            {functionData.description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
