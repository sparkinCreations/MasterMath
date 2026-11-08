import React, { useState, useMemo, useEffect, useRef, useId } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot, ReferenceArea, usePlotArea, useXAxisScale } from "recharts";
import { TrendingUp, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Maximize2, Minimize2, Focus, Rows3, Expand, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import GraphEmptyState from "@/components/solver/GraphEmptyState";
import { useDarkMode } from "@/contexts/DarkModeContext";
import { graphPalette } from "@/lib/graphPalette";
import { describeGraph, describeGraphFeatures } from "@/lib/graphDescription";
import { sampleCurve, implicitCurve, featureWindow, annotationFeatureXs, intersectionPoints, annotationFeatureYs, robustYWindow, tameWindow, growthWindow, niceTicks, estimateLabelWidth, formatLineX, placePointLabel, layoutLineLabels, zoomWindow } from "@/lib/graphSampling";

// A ReferenceDot label placed where it fits inside the plot (placePointLabel).
// Recharts renders this with the dot's box as `viewBox`; the props are named
// text/color, not value/fill, so Recharts' own label props cannot override
// them. The halo (a stroke in the card colour painted under the fill) keeps
// the text readable where it crosses a curve or grid line.
function PointLabel({ viewBox, text, color, haloColor }) {
  const plot = usePlotArea();
  if (!viewBox || !plot || text == null) return null;
  const cx = viewBox.x + (viewBox.width ?? viewBox.upperWidth ?? 0) / 2;
  const cy = viewBox.y + (viewBox.height ?? 0) / 2;
  const at = placePointLabel({ cx, cy, textWidth: estimateLabelWidth(text), plot });
  return (
    <text x={at.x} y={at.y} textAnchor={at.anchor} dominantBaseline={at.anchor === 'middle' ? 'auto' : 'central'}
      fill={color} stroke={haloColor} strokeWidth={3} paintOrder="stroke" fontSize={12} fontWeight="bold">
      {text}
    </text>
  );
}

// Labels for vertical lines — asymptotes, equation solutions, a limit's
// approach guideline — drawn INSIDE the plot. Recharts' own 'top' position
// puts them in the 5px margin above the plot, where they were cut off at every
// width. Each row is laid out together, so a label that would overlap its
// neighbour is dropped (layoutLineLabels). A limit's guideline takes the
// bottom row: its point label ("L = 1") sits beside the marker, and a top-row
// guideline label landed on top of it. Rendered as a chart child for the
// scale hooks.
function LineLabels({ items, haloColor }) {
  const plot = usePlotArea();
  const xScale = useXAxisScale();
  if (!plot || !xScale || !items.length) return null;
  // Tier 1 (a label that would overlap its neighbour) sits one line further
  // into the plot: below the top row, above the bottom row.
  const rows = { top: plot.y + 14, bottom: plot.y + plot.height - 6 };
  const tierStep = { top: 15, bottom: -15 };
  return (
    <g className="line-labels">
      {Object.entries(rows).map(([row, y]) => layoutLineLabels(
        items
          .filter((item) => (item.row || 'top') === row && item.text)
          .map((item, i) => ({ ...item, key: `line-label-${row}-${i}`, px: xScale(item.x) }))
          .filter((item) => Number.isFinite(item.px)),
        { plot }
      ).map((label) => (
        <text key={label.key} x={label.x} y={y + (label.tier || 0) * tierStep[row]} textAnchor="middle"
          fill={label.color} stroke={haloColor} strokeWidth={3} paintOrder="stroke" fontSize={12} fontWeight="bold">
          {label.text}
        </text>
      )))}
    </g>
  );
}

const DEFAULT_RANGE = { xMin: -10, xMax: 10 };

// The window a graph opens in: the solver's own choice; else, when the curve
// can be re-sampled anywhere, one framing its marked features (a cubic's
// three roots and two turning points, not ±10 with the shape squashed into
// a strip); else the default.
function startWindow(functionData) {
  const chosen = () => {
    if (functionData?.initialWindow) return functionData.initialWindow;
    if (functionData?.expression) {
      const fitted = featureWindow(annotationFeatureXs(functionData));
      if (fitted) return fitted;
      // Nothing marked (e^x): a window the curve's shape actually fills.
      const grown = growthWindow(functionData.expression, functionData.variable || 'x');
      if (grown) return grown;
    }
    return DEFAULT_RANGE;
  };
  const window = chosen();
  // A curve that explodes at the edge of its window (sin(x²)·eˣ) is shrunk
  // to a readable one; a curve with poles keeps its window.
  const hasPoles = (functionData?.annotations?.verticalAsymptotes || []).length > 0 || (functionData?.breaks || []).length > 0;
  if (functionData?.expression && !hasPoles) return tameWindow(functionData.expression, functionData.variable || 'x', window);
  return window;
}
const HEIGHTS = [240, 320, 400, 480, 560];
const DEFAULT_HEIGHT_IDX = 1; // 320px
// The narrowest x-window zoom reaches (the zoom-in button's old limit).
const MIN_SPAN = 1;
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || '');
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export default function GraphViewer({ functionData }) {
  const { isDarkMode } = useDarkMode();

  // Limits graphs open centered on the approach point instead of the origin.
  // A graph that carries its expression is re-sampled for whatever window
  // is on screen (see graphSampling.js); one without it can only be
  // filtered to the points the solver supplied.
  // An implicit curve F(x, y) = 0 (implicitCurve) is traced for the window on
  // screen, with an optional tangent as the dashed curve.
  const implicit = functionData?.implicit || null;
  const canResample = Boolean(functionData?.expression || functionData?.secondaryExpression || implicit);
  const variable = functionData?.variable || 'x';
  const [range, setRange] = useState(() => startWindow(functionData));
  const [yDomain, setYDomain] = useState(null); // null = auto-fit
  const [heightIdx, setHeightIdx] = useState(DEFAULT_HEIGHT_IDX);
  // Second y-axis for the dashed curve: null = automatic (separate when the
  // two curves' visible ranges differ by more than 4×), true/false = chosen.
  const [separateAxes, setSeparateAxes] = useState(null);
  // The graph popped out to fill the screen (1.72.0): same view, same
  // controls, as tall as the screen allows.
  const [expanded, setExpanded] = useState(false);
  const [expandedHeight, setExpandedHeight] = useState(0);

  // New problem → reset the viewport.
  useEffect(() => {
    setRange(startWindow(functionData));
    setYDomain(null);
    setSeparateAxes(null);
  }, [functionData]);

  // Panning is allowed only "to a reasonable extent": the extent of the
  // sampled data (solvers sample well beyond the initial view for this), or
  // a generous fixed extent when the curve can be re-sampled anywhere.
  const xExtent = useMemo(() => {
    if (canResample) return { min: -1000, max: 1000 };
    const pts = functionData?.points || [];
    if (pts.length === 0) return { min: -10, max: 10 };
    return { min: pts[0].x, max: pts[pts.length - 1].x };
  }, [functionData?.points, canResample]);

  const yExtent = useMemo(() => {
    if (implicit) return { min: -1000, max: 1000 };
    const all = [
      ...(functionData?.points || []).map((p) => p.y),
      ...(functionData?.secondaryPoints || []).map((p) => p.y),
    ].filter(Number.isFinite);
    if (all.length === 0) return { min: -10, max: 10 };
    return { min: Math.min(...all), max: Math.max(...all) };
  }, [functionData?.points, functionData?.secondaryPoints, implicit]);

  const primaryBreaks = useMemo(() => [
    ...(functionData?.annotations?.verticalAsymptotes || []),
    ...(functionData?.breaks || []),
  ], [functionData]);
  const secondaryBreaks = useMemo(() => functionData?.secondaryBreaks || [], [functionData]);

  const visiblePoints = useMemo(() => {
    if (!functionData?.points) return [];
    if (canResample) {
      if (!functionData.expression) return [];
      return sampleCurve(functionData.expression, variable, { ...range, breaks: primaryBreaks, extraXs: secondaryBreaks });
    }
    return functionData.points.filter(p => p.x >= range.xMin && p.x <= range.xMax);
  }, [functionData, canResample, variable, range, primaryBreaks, secondaryBreaks]);

  const visibleSecondary = useMemo(() => {
    if (functionData?.secondaryExpression && canResample) {
      return sampleCurve(functionData.secondaryExpression, variable, { ...range, breaks: secondaryBreaks, extraXs: primaryBreaks });
    }
    if (!functionData?.secondaryPoints) return [];
    return functionData.secondaryPoints.filter(p => p.x >= range.xMin && p.x <= range.xMax);
  }, [functionData, canResample, variable, range, primaryBreaks, secondaryBreaks]);

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

  // Visible ranges of the two curves, for the axis decision and the legend.
  const spanOf = (pts, key) => {
    const ys = pts.map((p) => p[key]).filter(Number.isFinite);
    return ys.length ? Math.max(...ys) - Math.min(...ys) : 0;
  };
  const primarySpan = spanOf(visiblePoints, 'y');
  const secondarySpan = spanOf(visibleSecondary, 'y');
  const axesDiffer = visibleSecondary.length > 0 && primarySpan > 0 && secondarySpan > 0 && (primarySpan / secondarySpan > 4 || secondarySpan / primarySpan > 4);
  // A curve and its tangent line, or f and its mirror image f⁻¹, only read
  // on one axis (sharedAxis); otherwise very different spans get two.
  const useRightAxis = visibleSecondary.length > 0 && (separateAxes === null ? axesDiffer && !functionData?.sharedAxis : separateAxes);

  // Automatic y-windows: a robust fit of what is visible (see robustYWindow),
  // with every marked feature kept inside. The left axis fits both curves
  // unless the dashed one has its own axis.
  // An implicit curve is drawn to scale, one unit the same length on both
  // axes, so a circle is round: the y-window is centred on the solver's
  // framing and as tall, in units, as the plot is in pixels. The plot's
  // width is measured (ResizeObserver); its height is the chosen height
  // less the x-axis.
  const chartRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(0);
  useEffect(() => {
    const el = chartRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => setChartWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [functionData, expanded]);
  const chartHeight = expanded && expandedHeight ? expandedHeight : HEIGHTS[heightIdx];
  // On first draw, widen the x-window until the curve's whole height fits
  // at that scale (a circle in a wide plot needs more x than y).
  const fittedImplicit = useRef(null);
  const [refit, setRefit] = useState(0);
  useEffect(() => {
    if (!implicit || !chartWidth || fittedImplicit.current === functionData) return;
    fittedImplicit.current = functionData;
    const x0 = functionData.initialWindow;
    const y0 = functionData.implicitYWindow;
    if (!x0 || !y0) return;
    const plotW = Math.max(50, chartWidth - 70);
    const plotH = Math.max(50, chartHeight - 45);
    const span = Math.max(x0.xMax - x0.xMin, (y0.yMax - y0.yMin) * (plotW / plotH));
    const centre = (x0.xMin + x0.xMax) / 2;
    setRange({ xMin: centre - span / 2, xMax: centre + span / 2 });
  }, [implicit, chartWidth, functionData, chartHeight, refit]);
  const implicitAutoY = useMemo(() => {
    const y0 = functionData?.implicitYWindow;
    if (!implicit || !y0) return null;
    const plotW = Math.max(50, (chartWidth || 600) - 70);
    const plotH = Math.max(50, chartHeight - 45);
    const centre = (y0.yMin + y0.yMax) / 2;
    const half = ((range.xMax - range.xMin) * (plotH / plotW)) / 2;
    return { yMin: centre - half, yMax: centre + half };
  }, [implicit, functionData, range, chartWidth, chartHeight]);
  const autoY = useMemo(
    () => implicitAutoY || robustYWindow(mergedPoints, useRightAxis ? ['y'] : ['y', 'y2'], [
      ...annotationFeatureYs(functionData, 'primary'),
      ...(useRightAxis ? [] : annotationFeatureYs(functionData, 'secondary')),
    ]),
    [implicitAutoY, mergedPoints, useRightAxis, functionData]
  );
  const autoY2 = useMemo(
    () => (useRightAxis ? robustYWindow(mergedPoints, ['y2'], annotationFeatureYs(functionData, 'secondary')) : null),
    [mergedPoints, useRightAxis, functionData]
  );

  // Current y-window when auto (used as the pan seed).
  const autoYWindow = () => autoY || { yMin: -10, yMax: 10 };

  // Round tick values. The fitted windows end on raw sample values, and a
  // chart that spreads ticks across −9.63…4.41 labels them −9.6, −5.6, −1.6,
  // 2.4, 4.4; the y-axes are widened to round numbers and the x-axis keeps
  // its window with round ticks inside it.
  const yBase = yDomain || autoY;
  // Round y-ends would stretch an implicit curve out of scale: its ticks stay inside.
  const yNice = yBase ? niceTicks(yBase.yMin, yBase.yMax, implicit ? { extend: false } : undefined) : null;
  const y2Nice = autoY2 ? niceTicks(autoY2.yMin, autoY2.yMax) : null;
  const xNice = niceTicks(range.xMin, range.xMax, { count: 7, extend: false });
  // The implicit curve, traced over exactly the window drawn.
  const traceYMin = implicit ? yBase?.yMin : yNice ? yNice.min : yBase?.yMin;
  const traceYMax = implicit ? yBase?.yMax : yNice ? yNice.max : yBase?.yMax;
  const implicitLines = useMemo(
    () => (implicit && Number.isFinite(traceYMin) && Number.isFinite(traceYMax)
      ? implicitCurve(implicit.expression, implicit.x, implicit.y, { xMin: range.xMin, xMax: range.xMax, yMin: traceYMin, yMax: traceYMax })
      : []),
    [implicit, range.xMin, range.xMax, traceYMin, traceYMax]
  );
  const tickText = (decimals) => (v) => (decimals === undefined
    ? (Number.isInteger(v) ? String(v) : Number(v).toFixed(1))
    : String(Number(Number(v).toFixed(decimals))));

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
    fittedImplicit.current = null;
    setRefit((n) => n + 1);
    setRange(startWindow(functionData));
    setYDomain(null);
    setHeightIdx(DEFAULT_HEIGHT_IDX);
    setSeparateAxes(null);
  };

  // Frame the marked features (extrema, intercepts, asymptotes, …) with
  // room around them; a no-op when nothing is marked.
  const fitFeatures = () => {
    const win = featureWindow(annotationFeatureXs(functionData));
    if (!win) return;
    setRange(win);
    setYDomain(null);
  };

  // Drag to pan. A horizontal drag slides the x-window (touch and mouse);
  // a mouse drag also slides the y-window. On touch the vertical direction
  // is left to the page (touch-action: pan-y), so the graph never traps a
  // scroll — the pan buttons still move y. Distances are converted with the
  // plot's width, which is the wrapper minus the axes.
  const drag = useRef(null);
  const [dragging, setDragging] = useState(false);
  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not supported */ }
    if (e.pointerType === 'touch') {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.current.size === 2) {
        // A second finger: the drag becomes a pinch.
        drag.current = null;
        setDragging(false);
        const { distance, mid } = pinchState();
        pinch.current = { distance: Math.max(distance, 1), mid, base: { range, yWin: yDomain } };
        return;
      }
      if (touches.current.size > 2) return;
    }
    drag.current = { x: e.clientX, y: e.clientY, range, yWin: yDomain || autoY, pointerType: e.pointerType, moved: false };
  };
  const onPointerMove = (e) => {
    if (touches.current.has(e.pointerId)) touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && touches.current.size === 2) {
      const { distance } = pinchState();
      if (distance > 0) zoomFrom(pinch.current.base, pinch.current.distance / distance, pinch.current.mid);
      return;
    }
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    if (!d.moved) { d.moved = true; setDragging(true); }
    const rect = e.currentTarget.getBoundingClientRect();
    const plotW = Math.max(50, rect.width - 60 - (useRightAxis ? 60 : 0) - 10);
    const span = d.range.xMax - d.range.xMin;
    let xMin = d.range.xMin - (dx / plotW) * span;
    let xMax = d.range.xMax - (dx / plotW) * span;
    if (xMin < xExtent.min) { xMin = xExtent.min; xMax = xMin + span; }
    if (xMax > xExtent.max) { xMax = xExtent.max; xMin = xMax - span; }
    setRange({ xMin, xMax });
    if (d.pointerType === 'mouse' && d.yWin) {
      const plotH = Math.max(50, rect.height - 40);
      const ySpan = d.yWin.yMax - d.yWin.yMin;
      const yShift = (dy / plotH) * ySpan;
      setYDomain({ yMin: d.yWin.yMin + yShift, yMax: d.yWin.yMax + yShift });
    }
  };
  const onPointerUp = (e) => {
    touches.current.delete(e?.pointerId);
    if (touches.current.size < 2) pinch.current = null;
    drag.current = null;
    setDragging(false);
  };

  // Zoom about a point (1.72.0): the x under the cursor, or between two
  // fingers, stays where it is while the window narrows or widens around it.
  // `base` is the view the gesture started from (a pinch scales from where it
  // began, not step by step); fx, fy are the point's place across and down
  // the plot, 0 to 1. A y-window set by hand is scaled about the point too;
  // an automatic one keeps fitting the curve.
  const plotBox = () => {
    const rect = chartRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const left = 60;
    const right = (useRightAxis ? 60 : 0) + 10;
    return { left: rect.left + left, top: rect.top + 5, width: Math.max(50, rect.width - left - right), height: Math.max(50, rect.height - 40) };
  };
  const pointAt = (clientX, clientY) => {
    const box = plotBox();
    if (!box) return { fx: 0.5, fy: 0.5 };
    return { fx: clamp((clientX - box.left) / box.width, 0, 1), fy: clamp((clientY - box.top) / box.height, 0, 1) };
  };
  const zoomFrom = (base, factor, at) => {
    const next = zoomWindow(base, factor, at, { extent: xExtent, minSpan: MIN_SPAN });
    setRange(next.range);
    if (next.yWin) setYDomain(next.yWin);
  };

  // Two fingers on the graph pinch-zoom it. touch-action: pan-y already kept
  // the browser from pinch-zooming the page there, so the gesture was unused;
  // one finger still scrolls the page and drags the graph sideways.
  const touches = useRef(new Map());
  const pinch = useRef(null);
  const pinchState = () => {
    const [a, b] = [...touches.current.values()];
    return { distance: Math.hypot(a.x - b.x, a.y - b.y), mid: pointAt((a.x + b.x) / 2, (a.y + b.y) / 2) };
  };

  // Ctrl (or ⌘) + wheel zooms, and so does a trackpad pinch: Chrome and Edge
  // send it as a wheel with ctrlKey, Safari as gesture events. A plain wheel
  // scrolls the page as always, and shows how to zoom: a graph that took the
  // wheel would trap anyone scrolling past it.
  const [wheelHint, setWheelHint] = useState(false);
  const hintTimer = useRef(null);
  const zoomRef = useRef(null);
  zoomRef.current = { zoomFrom, pointAt, range, yWin: yDomain };
  useEffect(() => {
    const el = chartRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      if (!(e.ctrlKey || e.metaKey)) {
        setWheelHint(true);
        clearTimeout(hintTimer.current);
        hintTimer.current = setTimeout(() => setWheelHint(false), 1500);
        return;
      }
      e.preventDefault();
      const z = zoomRef.current;
      const pixels = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      z.zoomFrom({ range: z.range, yWin: z.yWin }, Math.exp(clamp(pixels, -200, 200) * 0.002), z.pointAt(e.clientX, e.clientY));
    };
    let gesture = null;
    const onGestureStart = (e) => {
      e.preventDefault();
      const z = zoomRef.current;
      gesture = { base: { range: z.range, yWin: z.yWin }, at: z.pointAt(e.clientX, e.clientY) };
    };
    const onGestureChange = (e) => {
      e.preventDefault();
      if (gesture && e.scale > 0) zoomRef.current.zoomFrom(gesture.base, 1 / e.scale, gesture.at);
    };
    const onGestureEnd = (e) => { e.preventDefault(); gesture = null; };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onGestureStart);
    el.addEventListener('gesturechange', onGestureChange);
    el.addEventListener('gestureend', onGestureEnd);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGestureStart);
      el.removeEventListener('gesturechange', onGestureChange);
      el.removeEventListener('gestureend', onGestureEnd);
      clearTimeout(hintTimer.current);
    };
  }, [functionData, expanded]);

  // The expanded view: Escape closes it, Tab stays inside, the page behind
  // does not scroll, and focus goes back to the Expand button on close.
  const expandButtonRef = useRef(null);
  const closeRef = useRef(null);
  const dialogRef = useRef(null);
  const plotAreaRef = useRef(null);
  const titleId = useId();
  useEffect(() => {
    if (!expanded) return undefined;
    const opener = expandButtonRef.current;
    closeRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      // The button is re-created when the inline card comes back; focus it
      // once it has.
      requestAnimationFrame(() => (expandButtonRef.current || opener)?.focus());
    };
  }, [expanded]);
  // The plot fills what the dialog leaves below its header.
  useEffect(() => {
    const el = plotAreaRef.current;
    if (!expanded || !el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => setExpandedHeight(Math.max(240, Math.floor(entry.contentRect.height))));
    observer.observe(el);
    return () => observer.disconnect();
  }, [expanded]);
  const onDialogKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      setExpanded(false);
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll(FOCUSABLE) || []);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  // Theme-aware colors (lib/graphPalette.js; the PDF export recolours a
  // dark-mode copy of this SVG to the light palette)
  const palette = graphPalette(isDarkMode);
  const gridColor = palette.grid;
  const axisColor = palette.axis;
  const axisLineColor = palette.axisLine;
  const tooltipBg = palette.tooltipBg;
  const tooltipBorder = palette.tooltipBorder;
  const tooltipText = palette.tooltipText;
  const descBg = isDarkMode ? '' : 'bg-blue-50';
  const descBorder = isDarkMode ? 'border-gray-600' : 'border-indigo-200';
  const extremumColor = palette.extremum;
  const interceptColor = '#10b981';
  const asymptoteColor = palette.asymptote;
  const markerStroke = palette.markerStroke;
  const secondaryColor = '#10b981';
  const secondaryAxisName = functionData?.secondaryLabel ? functionData.secondaryLabel.split('=')[0].trim() : 'secondary';

  // Solver.jsx already gates on graph data, so this is a defensive guard for
  // any other caller rather than the path users normally see.
  if (!functionData || !functionData.points) {
    return <GraphEmptyState />;
  }

  const hasSecondary = mergedPoints.some(p => p.y2 !== undefined);
  const ann = functionData.annotations || {};
  const inX = (x) => x >= range.xMin && x <= range.xMax;
  const inY = (y) => !yDomain || (y >= yDomain.yMin && y <= yDomain.yMax);

  // Text alternative for the chart. The SVG itself is opaque to assistive
  // tech, so the wrapper is exposed as a single image named by a prose
  // summary, and the same features are listed in a visible panel below.
  const chartLabel = describeGraph(functionData);
  const features = describeGraphFeatures(functionData);

  // Controls are icon-only: the title is both the hover tooltip and the
  // name. (An aria-label with the same text made Chrome pass the title on
  // as a description, so a reader said "Zoom in, button, Zoom in".)
  const ctrl = (onClick, label, Icon) => (
    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClick} title={label}>
      <Icon className="w-4 h-4" aria-hidden="true" />
    </Button>
  );

  const chart = (
        <div
          role="img"
          aria-label={chartLabel}
          data-export-graph
          ref={chartRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="relative"
          style={{ touchAction: 'pan-y', cursor: dragging ? 'grabbing' : 'grab' }}
        >
          {/* How to zoom with a wheel, shown briefly when one scrolls over
              the graph (the page scrolls; the graph does not take the wheel). */}
          {wheelHint && (
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <span className="rounded-lg bg-gray-900/80 px-3 py-2 text-sm font-medium text-white">
                Hold {isMac() ? '⌘' : 'Ctrl'} and scroll to zoom
              </span>
            </div>
          )}
          <ResponsiveContainer width="100%" height={chartHeight}>
            <LineChart data={mergedPoints}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis
                dataKey="x"
                stroke={axisColor}
                type="number"
                domain={[range.xMin, range.xMax]}
                ticks={xNice ? xNice.ticks : undefined}
                tickFormatter={tickText(xNice?.decimals)}
                tick={{ fill: axisColor }}
                allowDataOverflow
                label={{ value: 'x', position: 'insideBottomRight', offset: -5, fill: axisColor }}
              />
              <YAxis
                stroke={axisColor}
                tick={{ fill: axisColor }}
                domain={implicit && yBase ? [yBase.yMin, yBase.yMax] : yNice ? [yNice.min, yNice.max] : yDomain ? [yDomain.yMin, yDomain.yMax] : autoY ? [autoY.yMin, autoY.yMax] : ['auto', 'auto']}
                ticks={yNice ? yNice.ticks : undefined}
                tickFormatter={tickText(yNice?.decimals)}
                allowDataOverflow
                label={{ value: 'y', angle: -90, position: 'insideLeft', fill: axisColor }}
              />
              {useRightAxis && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke={secondaryColor}
                  tick={{ fill: secondaryColor }}
                  domain={y2Nice ? [y2Nice.min, y2Nice.max] : autoY2 ? [autoY2.yMin, autoY2.yMax] : ['auto', 'auto']}
                  ticks={y2Nice ? y2Nice.ticks : undefined}
                  tickFormatter={tickText(y2Nice?.decimals)}
                  allowDataOverflow
                  label={{ value: secondaryAxisName, angle: 90, position: 'insideRight', fill: secondaryColor }}
                />
              )}
              {!implicit && <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  border: `2px solid ${tooltipBorder}`,
                  borderRadius: '12px',
                  padding: '8px',
                  color: tooltipText
                }}
                // Short series names ("f'(x)", not the whole derivative): on a
                // phone the full label pushed the tooltip past the chart's
                // edge. The legend below carries the expression.
                wrapperStyle={{ maxWidth: 'min(240px, 70vw)', whiteSpace: 'normal' }}
                formatter={(value, name) => {
                  const label = name === 'y2' ? secondaryAxisName : 'f(x)';
                  return [typeof value === 'number' ? value.toFixed(4) : value, label];
                }}
                labelFormatter={(label) => `x = ${typeof label === 'number' ? label.toFixed(2) : label}`}
              />}
              <ReferenceLine x={0} stroke={axisLineColor} strokeWidth={2} />
              <ReferenceLine y={0} stroke={axisLineColor} strokeWidth={2} />

              {/* Inequality solution regions: shade each x-range that holds */}
              {(ann.shadedRegions || []).map((rg, i) => (
                <ReferenceArea
                  key={`sr-${i}`}
                  x1={Math.max(rg.from, range.xMin)}
                  x2={Math.min(rg.to, range.xMax)}
                  fill={interceptColor}
                  fillOpacity={0.14}
                  stroke="none"
                />
              ))}

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
              {/* The bound lines; their labels are drawn by LineLabels below,
                  at the top of the plot. Recharts' 'bottom' label sat in the
                  x-axis tick strip, where "0" and "1" printed over the ticks
                  "0" and "1". */}
              {ann.shaded && inX(ann.shaded.from) && (
                <ReferenceLine x={ann.shaded.from} stroke={extremumColor} strokeWidth={2} strokeDasharray="4 4" />
              )}
              {ann.shaded && inX(ann.shaded.to) && (
                <ReferenceLine x={ann.shaded.to} stroke={extremumColor} strokeWidth={2} strokeDasharray="4 4" />
              )}

              {/* Vertical asymptotes (functions) */}
              {(ann.verticalAsymptotes || []).filter(inX).map((a, i) => (
                <ReferenceLine
                  key={`va-${i}`}
                  x={a}
                  stroke={asymptoteColor}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
              ))}

              {/* Limit guideline + point of interest */}
              {ann.guideline && inX(ann.guideline.x) && (
                <ReferenceLine
                  x={ann.guideline.x}
                  stroke={extremumColor}
                  strokeWidth={2}
                  strokeDasharray="4 4"
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
                />
              ))}

              {/* Labels for every vertical line above, laid out together inside
                  the plot so none is cut off or overlaps another (LineLabels). */}
              <LineLabels
                haloColor={tooltipBg}
                items={[
                  ...(ann.verticalAsymptotes || []).filter(inX).map((a) => ({ x: a, text: formatLineX(a, variable), color: asymptoteColor })),
                  ...(functionData.solutions || []).filter(inX).map((sol) => ({ x: sol, text: formatLineX(sol, variable), color: interceptColor })),
                  ...(ann.guideline && inX(ann.guideline.x) ? [{ x: ann.guideline.x, text: ann.guideline.label, color: extremumColor, row: 'bottom' }] : []),
                  // A definite integral's bounds head their shaded column at
                  // the top of the plot ("a = 0", "b = 1"), clear of the
                  // x-axis ticks and of the curve, which runs near the axis
                  // there.
                  ...(ann.shaded && inX(ann.shaded.from) ? [{ x: ann.shaded.from, text: `a = ${ann.shaded.fromLabel ?? ann.shaded.from}`, color: extremumColor }] : []),
                  ...(ann.shaded && inX(ann.shaded.to) ? [{ x: ann.shaded.to, text: `b = ${ann.shaded.toLabel ?? ann.shaded.to}`, color: extremumColor }] : []),
                ]}
              />

              {/* Primary curve */}
              <Line type="linear" dataKey="y" stroke="url(#colorGradient)" strokeWidth={3} dot={false} connectNulls={false} name="y" isAnimationActive={false} />
              {/* An implicit curve: each traced piece drawn in its own order
                  (a circle doubles back in x, so it is not one series). */}
              {implicitLines.map((piece, i) => (
                <Line key={`imp-${i}`} data={piece} type="linear" dataKey="y" stroke={palette.gradientTo} strokeWidth={3} dot={false} connectNulls={false} name="curve" legendType="none" isAnimationActive={false} />
              ))}
              {hasSecondary && (
                <Line type="linear" dataKey="y2" yAxisId={useRightAxis ? 'right' : 0} stroke={secondaryColor} strokeWidth={2} strokeDasharray="6 3" dot={false} connectNulls={false} name="y2" isAnimationActive={false} />
              )}

              {/* Open points: a value a curve approaches but does not take —
                  the one-sided values of a derivative at a corner. Hollow,
                  on the curve they belong to. */}
              {(ann.openPoints || []).filter((o) => inX(o.x) && Number.isFinite(o.y)).map((o, i) => (
                <ReferenceDot
                  key={`open-${i}`}
                  x={o.x}
                  y={o.y}
                  yAxisId={o.series === 'secondary' && useRightAxis ? 'right' : 0}
                  r={6}
                  fill={tooltipBg}
                  stroke={o.series === 'secondary' ? secondaryColor : asymptoteColor}
                  strokeWidth={3}
                  label={o.label && (i === 0 || (ann.openPoints[i - 1].label !== o.label)) ? <PointLabel text={o.label} color={o.series === 'secondary' ? secondaryColor : asymptoteColor} haloColor={tooltipBg} /> : undefined}
                />
              ))}

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

              {/* A tangent line's point of contact with the curve */}
              {ann.tangentPoint && inX(ann.tangentPoint.x) && inY(ann.tangentPoint.y) && (
                <ReferenceDot
                  x={ann.tangentPoint.x}
                  y={ann.tangentPoint.y}
                  r={6}
                  fill={extremumColor}
                  stroke={markerStroke}
                  strokeWidth={2}
                  label={<PointLabel text={ann.tangentPoint.label} color={extremumColor} haloColor={tooltipBg} />}
                />
              )}

              {/* A system's solution points, every one, labelled inside the
                  plot (Recharts' position "top" is clipped). */}
              {intersectionPoints(ann).filter((p) => inX(p.x) && inY(p.y)).map((p, i) => (
                <ReferenceDot
                  key={`intersection-${i}`}
                  x={p.x}
                  y={p.y}
                  r={6}
                  fill={extremumColor}
                  stroke={markerStroke}
                  strokeWidth={2}
                  label={<PointLabel text={p.label} color={extremumColor} haloColor={tooltipBg} />}
                />
              ))}

              {/* Holes (removable discontinuities) — hollow: the point is
                  exactly where the function is NOT defined. Drawn after the
                  curve so the gap sits on top of the line. */}
              {(ann.holes || []).filter((h) => inX(h.x) && inY(h.y)).map((h, i) => (
                <ReferenceDot
                  key={`hole-${i}`}
                  x={h.x}
                  y={h.y}
                  r={6}
                  fill={tooltipBg}
                  stroke={asymptoteColor}
                  strokeWidth={3}
                  label={{ value: 'hole', position: 'top', fill: asymptoteColor, fontSize: 12, fontWeight: 'bold' }}
                />
              ))}

              {/* The limit value marker — hollow: the function need not reach it */}
              {ann.limitPoint && inX(ann.limitPoint.x) && inY(ann.limitPoint.y) && (
                <ReferenceDot
                  x={ann.limitPoint.x}
                  y={ann.limitPoint.y}
                  r={6}
                  fill={tooltipBg}
                  stroke={extremumColor}
                  strokeWidth={3}
                  label={<PointLabel text={`L = ${ann.limitPoint.y}`} color={extremumColor} haloColor={tooltipBg} />}
                />
              )}

              <defs>
                <linearGradient id="colorGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={palette.gradientFrom} />
                  <stop offset="100%" stopColor={palette.gradientTo} />
                </linearGradient>
              </defs>
            </LineChart>
          </ResponsiveContainer>
        </div>
  );

  const controls = (
    <div className="flex items-center gap-0.5 flex-wrap" role="group" aria-label="Graph view controls">
      {ctrl(() => panX(-1), "Pan left", ChevronLeft)}
      {ctrl(() => panX(1), "Pan right", ChevronRight)}
      {ctrl(() => panY(1), "Pan up", ChevronUp)}
      {ctrl(() => panY(-1), "Pan down", ChevronDown)}
      {ctrl(zoomIn, "Zoom in", ZoomIn)}
      {ctrl(zoomOut, "Zoom out", ZoomOut)}
      {!expanded && ctrl(taller, "Taller graph", Maximize2)}
      {!expanded && ctrl(shorter, "Shorter graph", Minimize2)}
      {annotationFeatureXs(functionData).length > 0 && ctrl(fitFeatures, "Fit key features", Focus)}
      {hasSecondary && (
        <Button
          variant="ghost"
          size="icon"
          className={`h-8 w-8 ${useRightAxis ? 'bg-indigo-100 dark:bg-gray-600' : ''}`}
          onClick={() => setSeparateAxes(!useRightAxis)}
          title={useRightAxis ? 'Use one y-axis for both curves' : `Separate y-axis for ${functionData.secondaryLabel ? functionData.secondaryLabel.split('=')[0].trim() : 'the dashed curve'}`}
          aria-pressed={useRightAxis}
        >
          <Rows3 className="w-4 h-4" aria-hidden="true" />
        </Button>
      )}
      {ctrl(resetZoom, "Reset view", RotateCcw)}
    </div>
  );
  const title = (
    <>
      <TrendingUp className="w-6 h-6 text-indigo-600" aria-hidden="true" />
      {functionData.title || "Graph View"}
    </>
  );

  return (
    <>
    <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm rounded-lg">
      <CardHeader className="border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-xl text-gray-900 dark:text-gray-100">
            {title}
          </CardTitle>
          <div className="flex items-center gap-0.5 flex-wrap">
            {!expanded && controls}
            {/* Pop the graph out to fill the screen, with the same view. */}
            <Button ref={expandButtonRef} variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpanded(true)} title="Expand graph" aria-haspopup="dialog" aria-expanded={expanded}>
              <Expand className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {expanded ? (
          // While the graph is popped out, its place keeps its height so the
          // page does not jump.
          <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300" style={{ height: HEIGHTS[heightIdx] }}>
            The graph is open in the expanded view.
          </div>
        ) : (
          <>
            {/* Height is passed as an explicit prop (not a resized parent):
                prop changes re-render synchronously, with no dependence on
                ResizeObserver timing.

                role="img" + aria-label present the whole chart as one described
                picture. Recharts' internal SVG nodes are then hidden from the
                accessibility tree, which is what we want: they carry no usable
                semantics, and the "Key features" panel below is the readable
                version of the same information. */}
            {chart}
        {/* Legend for dual curves */}
        {(hasSecondary || implicit) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-sm" aria-hidden="true">
            <div className="flex items-center gap-2">
              <div className="w-6 h-0.5 bg-indigo-600" />
              <span className="text-gray-600 dark:text-gray-400">{implicit ? implicit.label : 'f(x)'}</span>
            </div>
            {hasSecondary && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 border-t-2 border-dashed border-green-500" />
                <span className="text-gray-600 dark:text-gray-400">{functionData.secondaryLabel || 'Secondary'}{useRightAxis ? ' (right axis)' : ''}</span>
              </div>
            )}
          </div>
        )}
        {/* The chart's key features in text — the readable equivalent of the
            markers drawn above, for anyone who can't see them (and a handy
            recap for anyone who can). Collapsed by default so it doesn't
            crowd the panel; a native <details> keeps it keyboard-operable
            with no extra wiring. */}
        {features.length > 0 && (
          <details className="mt-3 text-sm rounded-lg border border-indigo-200 dark:border-gray-600 bg-white/60 dark:bg-gray-700/40">
            <summary className="cursor-pointer select-none px-3 py-2 font-medium text-indigo-700 dark:text-indigo-300 rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-600 dark:focus-visible:ring-indigo-400">
              Key features ({features.length})
            </summary>
            <ul className="px-3 pb-3 pt-1 space-y-1 list-disc list-inside text-gray-700 dark:text-gray-200">
              {features.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </details>
        )}
        {functionData.description && (
          <p className={`mt-3 text-sm text-gray-600 dark:text-gray-400 ${descBg} dark:bg-gray-700/50 p-3 rounded-lg border ${descBorder}`}>
            {functionData.description}
          </p>
        )}
          </>
        )}
      </CardContent>
    </Card>
    {expanded && (
      <div className="fixed inset-0 z-50 flex items-stretch justify-center sm:p-4" onKeyDown={onDialogKeyDown}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-xs animate-in fade-in" onClick={() => setExpanded(false)} aria-hidden="true" />
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="relative flex flex-col w-full max-w-7xl bg-white dark:bg-gray-800 sm:rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 animate-in zoom-in-95"
        >
          <div className="flex items-center justify-between flex-wrap gap-2 px-4 sm:px-6 py-3 border-b border-gray-100 dark:border-gray-700">
            <h2 id={titleId} className="flex items-center gap-2 text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
            <div className="flex items-center gap-0.5 flex-wrap">
              {controls}
              <Button ref={closeRef} variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpanded(false)} title="Close expanded graph">
                <X className="w-5 h-5" aria-hidden="true" />
              </Button>
            </div>
          </div>
          <div className="flex-1 min-h-0 flex flex-col px-3 sm:px-6 pt-3 pb-3">
            <div ref={plotAreaRef} className="flex-1 min-h-0">{chart}</div>
        {/* Legend for dual curves */}
        {(hasSecondary || implicit) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm" aria-hidden="true">
            <div className="flex items-center gap-2">
              <div className="w-6 h-0.5 bg-indigo-600" />
              <span className="text-gray-600 dark:text-gray-400">{implicit ? implicit.label : 'f(x)'}</span>
            </div>
            {hasSecondary && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 border-t-2 border-dashed border-green-500" />
                <span className="text-gray-600 dark:text-gray-400">{functionData.secondaryLabel || 'Secondary'}{useRightAxis ? ' (right axis)' : ''}</span>
              </div>
            )}
          </div>
        )}
          </div>
        </div>
      </div>
    )}
    </>
  );
}
