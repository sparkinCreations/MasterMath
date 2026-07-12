import React, { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot, ReferenceArea } from "recharts";
import { TrendingUp, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDarkMode } from "@/contexts/DarkModeContext";

const DEFAULT_RANGE = { xMin: -10, xMax: 10 };
const HEIGHTS = [240, 320, 400, 480, 560];
const DEFAULT_HEIGHT_IDX = 1; // 320px

export default function GraphViewer({ functionData }) {
  const { isDarkMode } = useDarkMode();

  // Limits graphs open centered on the approach point instead of the origin.
  const initialRange = functionData?.initialWindow || DEFAULT_RANGE;
  const [range, setRange] = useState(initialRange);
  const [yDomain, setYDomain] = useState(null); // null = auto-fit
  const [heightIdx, setHeightIdx] = useState(DEFAULT_HEIGHT_IDX);

  // New problem → reset the viewport.
  useEffect(() => {
    setRange(functionData?.initialWindow || DEFAULT_RANGE);
    setYDomain(null);
  }, [functionData]);

  // Panning is allowed only "to a reasonable extent": the extent of the
  // sampled data (solvers sample well beyond the initial view for this).
  const xExtent = useMemo(() => {
    const pts = functionData?.points || [];
    if (pts.length === 0) return { min: -10, max: 10 };
    return { min: pts[0].x, max: pts[pts.length - 1].x };
  }, [functionData?.points]);

  const yExtent = useMemo(() => {
    const all = [
      ...(functionData?.points || []).map((p) => p.y),
      ...(functionData?.secondaryPoints || []).map((p) => p.y),
    ].filter(Number.isFinite);
    if (all.length === 0) return { min: -10, max: 10 };
    return { min: Math.min(...all), max: Math.max(...all) };
  }, [functionData?.points, functionData?.secondaryPoints]);

  const visiblePoints = useMemo(() => {
    if (!functionData?.points) return [];
    return functionData.points.filter(p => p.x >= range.xMin && p.x <= range.xMax);
  }, [functionData?.points, range]);

  const visibleSecondary = useMemo(() => {
    if (!functionData?.secondaryPoints) return [];
    return functionData.secondaryPoints.filter(p => p.x >= range.xMin && p.x <= range.xMax);
  }, [functionData?.secondaryPoints, range]);

  const mergedPoints = useMemo(() => {
    if (visibleSecondary.length === 0) return visiblePoints;
    const map = new Map();
    visiblePoints.forEach(p => map.set(p.x, { x: p.x, y: p.y }));
    visibleSecondary.forEach(p => {
      if (map.has(p.x)) map.get(p.x).y2 = p.y;
      else map.set(p.x, { x: p.x, y2: p.y });
    });
    return Array.from(map.values()).sort((a, b) => a.x - b.x);
  }, [visiblePoints, visibleSecondary]);

  // Current y-window when auto: fit the visible data (used as the pan seed).
  const autoYWindow = () => {
    const ys = mergedPoints.flatMap((p) => [p.y, p.y2]).filter(Number.isFinite);
    if (ys.length === 0) return { yMin: -10, yMax: 10 };
    const lo = Math.min(...ys);
    const hi = Math.max(...ys);
    const pad = (hi - lo || 1) * 0.05;
    return { yMin: lo - pad, yMax: hi + pad };
  };

  const zoomIn = () => {
    setRange(prev => {
      const center = (prev.xMin + prev.xMax) / 2;
      const halfSpan = (prev.xMax - prev.xMin) / 4;
      if (halfSpan < 0.5) return prev;
      return { xMin: center - halfSpan, xMax: center + halfSpan };
    });
  };

  const zoomOut = () => {
    setRange(prev => {
      const span = prev.xMax - prev.xMin;
      const newSpan = Math.min(span * 2, xExtent.max - xExtent.min);
      const center = (prev.xMin + prev.xMax) / 2;
      let xMin = center - newSpan / 2;
      let xMax = center + newSpan / 2;
      if (xMin < xExtent.min) { xMin = xExtent.min; xMax = xMin + newSpan; }
      if (xMax > xExtent.max) { xMax = xExtent.max; xMin = xMax - newSpan; }
      return { xMin, xMax };
    });
  };

  const panX = (dir) => {
    setRange(prev => {
      const span = prev.xMax - prev.xMin;
      const shift = span * 0.25 * dir;
      let xMin = prev.xMin + shift;
      let xMax = prev.xMax + shift;
      // Clamp to the sampled extent — the "reasonable" edge of the world.
      if (xMin < xExtent.min) { xMin = xExtent.min; xMax = xMin + span; }
      if (xMax > xExtent.max) { xMax = xExtent.max; xMin = xMax - span; }
      return { xMin, xMax };
    });
  };

  const panY = (dir) => {
    setYDomain(prev => {
      const win = prev || autoYWindow();
      const span = win.yMax - win.yMin;
      const shift = span * 0.25 * dir;
      let yMin = win.yMin + shift;
      let yMax = win.yMax + shift;
      // Clamp: never wander more than one window-span past the data.
      const lo = yExtent.min - span;
      const hi = yExtent.max + span;
      if (yMin < lo) { yMin = lo; yMax = lo + span; }
      if (yMax > hi) { yMax = hi; yMin = hi - span; }
      return { yMin, yMax };
    });
  };

  const taller = () => setHeightIdx((i) => Math.min(i + 1, HEIGHTS.length - 1));
  const shorter = () => setHeightIdx((i) => Math.max(i - 1, 0));

  const resetZoom = () => {
    setRange(functionData?.initialWindow || DEFAULT_RANGE);
    setYDomain(null);
    setHeightIdx(DEFAULT_HEIGHT_IDX);
  };

  // Theme-aware colors
  const gridColor = isDarkMode ? '#374151' : '#c7d2fe';
  const axisColor = isDarkMode ? '#9ca3af' : '#4f46e5';
  const axisLineColor = isDarkMode ? '#4b5563' : '#cbd5e1';
  const tooltipBg = isDarkMode ? '#1f2937' : 'white';
  const tooltipBorder = isDarkMode ? '#4b5563' : '#c7d2fe';
  const tooltipText = isDarkMode ? '#e5e7eb' : '#1f2937';
  const descBg = isDarkMode ? '' : 'from-blue-50 to-indigo-50';
  const descBorder = isDarkMode ? 'border-gray-600' : 'border-indigo-200';
  const extremumColor = isDarkMode ? '#818cf8' : '#4f46e5';
  const interceptColor = '#10b981';
  const asymptoteColor = isDarkMode ? '#f87171' : '#ef4444';
  const markerStroke = isDarkMode ? '#1f2937' : '#ffffff';

  if (!functionData || !functionData.points) {
    return (
      <Card className="bg-white dark:bg-gray-800 border-2 border-indigo-200 dark:border-gray-700 shadow-lg rounded-xl">
        <CardHeader className="border-b border-indigo-100 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2 text-xl">
            <TrendingUp className="w-6 h-6 text-indigo-600" />
            Graph View
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mb-4">
              <TrendingUp className="w-8 h-8 text-indigo-500" />
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
  const ann = functionData.annotations || {};
  const inX = (x) => x >= range.xMin && x <= range.xMax;
  const inY = (y) => !yDomain || (y >= yDomain.yMin && y <= yDomain.yMax);

  const ctrl = (onClick, title, Icon) => (
    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClick} title={title}>
      <Icon className="w-4 h-4" />
    </Button>
  );

  return (
    <Card className="bg-white dark:bg-gray-800 border-2 border-indigo-200 dark:border-gray-700 shadow-lg rounded-xl">
      <CardHeader className="border-b border-indigo-100 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-700">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-xl">
            <TrendingUp className="w-6 h-6 text-indigo-600" />
            {functionData.title || "Graph View"}
          </CardTitle>
          <div className="flex items-center gap-0.5 flex-wrap">
            {ctrl(() => panX(-1), "Pan left", ChevronLeft)}
            {ctrl(() => panX(1), "Pan right", ChevronRight)}
            {ctrl(() => panY(1), "Pan up", ChevronUp)}
            {ctrl(() => panY(-1), "Pan down", ChevronDown)}
            {ctrl(zoomIn, "Zoom in", ZoomIn)}
            {ctrl(zoomOut, "Zoom out", ZoomOut)}
            {ctrl(taller, "Taller graph", Maximize2)}
            {ctrl(shorter, "Shorter graph", Minimize2)}
            {ctrl(resetZoom, "Reset view", RotateCcw)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {/* Height is passed as an explicit prop (not a resized parent):
            prop changes re-render synchronously, with no dependence on
            ResizeObserver timing. */}
        <div>
          <ResponsiveContainer width="100%" height={HEIGHTS[heightIdx]}>
            <LineChart data={mergedPoints}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis
                dataKey="x"
                stroke={axisColor}
                type="number"
                domain={[range.xMin, range.xMax]}
                tickFormatter={(v) => Number.isInteger(v) ? v : v.toFixed(1)}
                tick={{ fill: axisColor }}
                allowDataOverflow
                label={{ value: 'x', position: 'insideBottomRight', offset: -5, fill: axisColor }}
              />
              <YAxis
                stroke={axisColor}
                tick={{ fill: axisColor }}
                domain={yDomain ? [yDomain.yMin, yDomain.yMax] : ['auto', 'auto']}
                tickFormatter={(v) => Number.isInteger(v) ? v : Number(v).toFixed(1)}
                allowDataOverflow
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

              {/* Definite-integral region: shade [a, b] and mark the bounds */}
              {ann.shaded && (
                <ReferenceArea
                  x1={Math.max(ann.shaded.from, range.xMin)}
                  x2={Math.min(ann.shaded.to, range.xMax)}
                  fill={extremumColor}
                  fillOpacity={0.15}
                  stroke="none"
                />
              )}
              {ann.shaded && inX(ann.shaded.from) && (
                <ReferenceLine
                  x={ann.shaded.from}
                  stroke={extremumColor}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  label={{ value: `${ann.shaded.fromLabel}`, position: 'bottom', fill: extremumColor, fontSize: 12, fontWeight: 'bold' }}
                />
              )}
              {ann.shaded && inX(ann.shaded.to) && (
                <ReferenceLine
                  x={ann.shaded.to}
                  stroke={extremumColor}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  label={{ value: `${ann.shaded.toLabel}`, position: 'bottom', fill: extremumColor, fontSize: 12, fontWeight: 'bold' }}
                />
              )}

              {/* Vertical asymptotes (functions) */}
              {(ann.verticalAsymptotes || []).filter(inX).map((a, i) => (
                <ReferenceLine
                  key={`va-${i}`}
                  x={a}
                  stroke={asymptoteColor}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  label={{ value: `x = ${a}`, position: 'top', fill: asymptoteColor, fontSize: 12, fontWeight: 'bold' }}
                />
              ))}

              {/* Limit guideline + point of interest */}
              {ann.guideline && inX(ann.guideline.x) && (
                <ReferenceLine
                  x={ann.guideline.x}
                  stroke={extremumColor}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  label={{ value: ann.guideline.label, position: 'top', fill: extremumColor, fontSize: 12, fontWeight: 'bold' }}
                />
              )}

              {/* Equation solutions (algebra) — kept from the previous contract */}
              {functionData.solutions && functionData.solutions.filter(inX).map((sol, idx) => (
                <ReferenceLine
                  key={`sol-${idx}`}
                  x={sol}
                  stroke={interceptColor}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  label={{ value: `x = ${sol.toFixed(2)}`, position: 'top', fill: interceptColor, fontWeight: 'bold' }}
                />
              ))}

              {/* Primary curve */}
              <Line type="linear" dataKey="y" stroke="url(#colorGradient)" strokeWidth={3} dot={false} connectNulls={false} name="y" />
              {hasSecondary && (
                <Line type="linear" dataKey="y2" stroke="#10b981" strokeWidth={2} strokeDasharray="6 3" dot={false} connectNulls={false} name="y2" />
              )}

              {/* x-intercepts + y-intercept (functions) */}
              {(ann.intercepts || []).filter((p) => inX(p.x) && inY(0)).map((p, i) => (
                <ReferenceDot key={`xi-${i}`} x={p.x} y={0} r={5} fill={interceptColor} stroke={markerStroke} strokeWidth={2} />
              ))}
              {ann.yIntercept && inX(0) && inY(ann.yIntercept.y) && (
                <ReferenceDot x={0} y={ann.yIntercept.y} r={5} fill={interceptColor} stroke={markerStroke} strokeWidth={2} />
              )}

              {/* Extrema (functions) */}
              {(ann.extrema || []).filter((e) => inX(e.x) && inY(e.y)).map((e, i) => (
                <ReferenceDot
                  key={`ex-${i}`}
                  x={e.x}
                  y={e.y}
                  r={6}
                  fill={extremumColor}
                  stroke={markerStroke}
                  strokeWidth={2}
                  label={{ value: e.kind === 'max' ? 'max' : 'min', position: e.kind === 'max' ? 'top' : 'bottom', fill: extremumColor, fontSize: 12, fontWeight: 'bold' }}
                />
              ))}

              {/* System-of-equations intersection: the solution point */}
              {ann.intersection && inX(ann.intersection.x) && inY(ann.intersection.y) && (
                <ReferenceDot
                  x={ann.intersection.x}
                  y={ann.intersection.y}
                  r={6}
                  fill={extremumColor}
                  stroke={markerStroke}
                  strokeWidth={2}
                  label={{ value: ann.intersection.label, position: 'top', fill: extremumColor, fontSize: 12, fontWeight: 'bold' }}
                />
              )}

              {/* The limit value marker — hollow: the function need not reach it */}
              {ann.limitPoint && inX(ann.limitPoint.x) && inY(ann.limitPoint.y) && (
                <ReferenceDot
                  x={ann.limitPoint.x}
                  y={ann.limitPoint.y}
                  r={6}
                  fill={tooltipBg}
                  stroke={extremumColor}
                  strokeWidth={3}
                  label={{ value: `L = ${ann.limitPoint.y}`, position: 'right', fill: extremumColor, fontSize: 12, fontWeight: 'bold' }}
                />
              )}

              <defs>
                <linearGradient id="colorGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#4f46e5" />
                </linearGradient>
              </defs>
            </LineChart>
          </ResponsiveContainer>
        </div>
        {/* Legend for dual curves */}
        {hasSecondary && (
          <div className="flex items-center gap-4 mt-3 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-6 h-0.5 bg-gradient-to-r from-blue-500 to-indigo-600" />
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
