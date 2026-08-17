// Text alternative for the graph panel.
//
// The Recharts SVG carries real content — extrema, intercepts, asymptotes,
// the shaded region under a definite integral, where two lines cross — with no
// text equivalent, so a non-visual reader gets a blank spot where the picture
// is. This module turns the same `functionData` the chart is drawn from into
// prose: a one-sentence summary for the chart's `aria-label`, and a list of
// the key features for a visible "Key features" panel.
//
// Discipline: only describe what the solver actually annotated. If the solver
// found no extrema, we say nothing about extrema — we do not infer features
// from the sampled points, because a fabricated feature is worse than none.

const fmt = (n) => {
  if (!Number.isFinite(n)) return String(n);
  if (Number.isInteger(n)) return String(n);
  // Four significant figures is enough to identify a point; more just adds
  // noise a screen reader has to spell out.
  const rounded = Number(n.toPrecision(4));
  return String(rounded);
};

const point = (x, y) => `(${fmt(x)}, ${fmt(y)})`;

const list = (items) => {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
};

const plural = (n, one, many) => (n === 1 ? one : many);

// Returns an array of feature strings, in a stable order that reads well:
// what is drawn, then where it's notable, then any region of interest.
export function describeGraphFeatures(functionData) {
  if (!functionData || !Array.isArray(functionData.points)) return [];

  const ann = functionData.annotations || {};
  const features = [];

  // Curves
  if (functionData.secondaryLabel) {
    features.push(`Two curves are plotted: f(x), and ${functionData.secondaryLabel} as a dashed line.`);
  }

  // Extrema
  const allExtrema = Array.isArray(ann.extrema) ? ann.extrema.filter((e) => Number.isFinite(e?.x) && Number.isFinite(e?.y)) : [];
  // Endpoint extrema are not two-sided local extrema; say what they are,
  // matching the solver's own step wording.
  const extrema = allExtrema.filter((e) => !e.endpoint);
  const endpoints = allExtrema.filter((e) => e.endpoint);
  const maxima = extrema.filter((e) => e.kind === "max");
  const minima = extrema.filter((e) => e.kind === "min");
  if (maxima.length) {
    features.push(`Local ${plural(maxima.length, "maximum", "maxima")} at ${list(maxima.map((e) => point(e.x, e.y)))}.`);
  }
  if (minima.length) {
    features.push(`Local ${plural(minima.length, "minimum", "minima")} at ${list(minima.map((e) => point(e.x, e.y)))}.`);
  }
  for (const e of endpoints) {
    const name = e.kind === "max" ? "maximum" : "minimum";
    features.push(`${e.absolute ? `Absolute ${name}` : name.charAt(0).toUpperCase() + name.slice(1)} at the domain endpoint ${point(e.x, e.y)}.`);
  }

  // Intercepts
  const xInts = Array.isArray(ann.intercepts) ? ann.intercepts.filter((p) => Number.isFinite(p?.x)) : [];
  if (xInts.length) {
    features.push(`Crosses the x-axis at ${list(xInts.map((p) => `x = ${fmt(p.x)}`))}.`);
  }
  if (ann.yIntercept && Number.isFinite(ann.yIntercept.y)) {
    features.push(`Crosses the y-axis at y = ${fmt(ann.yIntercept.y)}.`);
  }

  // Holes (removable discontinuities)
  const holes = Array.isArray(ann.holes) ? ann.holes.filter((h) => Number.isFinite(h?.x) && Number.isFinite(h?.y)) : [];
  if (holes.length) {
    features.push(`${plural(holes.length, "A hole", "Holes")} at ${list(holes.map((h) => point(h.x, h.y)))} — the function is undefined there but does not blow up.`);
  }

  // Asymptotes
  const vas = Array.isArray(ann.verticalAsymptotes) ? ann.verticalAsymptotes.filter(Number.isFinite) : [];
  if (vas.length) {
    features.push(`Vertical ${plural(vas.length, "asymptote", "asymptotes")} at ${list(vas.map((a) => `x = ${fmt(a)}`))}.`);
  }

  // Equation solutions (algebra)
  const sols = Array.isArray(functionData.solutions) ? functionData.solutions.filter(Number.isFinite) : [];
  if (sols.length) {
    features.push(`${plural(sols.length, "Solution", "Solutions")} marked at ${list(sols.map((s) => `x = ${fmt(s)}`))}.`);
  }

  // Limits
  if (ann.guideline && Number.isFinite(ann.guideline.x)) {
    const label = ann.guideline.label ? ` (${ann.guideline.label})` : "";
    features.push(`A dashed guideline marks the approach point x = ${fmt(ann.guideline.x)}${label}.`);
  }
  if (ann.limitPoint && Number.isFinite(ann.limitPoint.x) && Number.isFinite(ann.limitPoint.y)) {
    features.push(`A hollow marker at ${point(ann.limitPoint.x, ann.limitPoint.y)} shows the limit value L = ${fmt(ann.limitPoint.y)}; the function need not reach it.`);
  }

  // Definite integral
  if (ann.shaded && Number.isFinite(ann.shaded.from) && Number.isFinite(ann.shaded.to)) {
    const from = ann.shaded.fromLabel ?? fmt(ann.shaded.from);
    const to = ann.shaded.toLabel ?? fmt(ann.shaded.to);
    features.push(`The area between the curve and the x-axis is shaded from x = ${from} to x = ${to}.`);
  }

  // Systems
  if (ann.intersection && Number.isFinite(ann.intersection.x) && Number.isFinite(ann.intersection.y)) {
    features.push(`The two lines intersect at ${point(ann.intersection.x, ann.intersection.y)}.`);
  }

  // Inequalities
  const regions = Array.isArray(ann.shadedRegions) ? ann.shadedRegions.filter((r) => r && r.from !== undefined && r.to !== undefined) : [];
  if (regions.length) {
    const spans = regions.map((r) => {
      const lo = r.from === -Infinity ? "negative infinity" : fmt(r.from);
      const hi = r.to === Infinity ? "positive infinity" : fmt(r.to);
      return `from ${lo} to ${hi}`;
    });
    features.push(`The inequality holds on the shaded ${plural(regions.length, "interval", "intervals")} ${list(spans)}.`);
  }

  return features;
}

// A single sentence suitable for aria-label. Leads with the chart's own
// title (usually "Graph of f(x) = …"), then the feature count so a reader
// knows whether the visible details panel is worth expanding.
export function describeGraph(functionData) {
  if (!functionData || !Array.isArray(functionData.points)) return "";
  const title = functionData.title || "Graph";
  const features = describeGraphFeatures(functionData);
  if (features.length === 0) {
    return `${title}. Line chart. No key features are marked; see the description below the chart.`;
  }
  return `${title}. Line chart with ${features.length} key ${plural(features.length, "feature", "features")} marked: ${features.join(" ")}`;
}
