// The graph's theme colours. GraphViewer draws with graphPalette(isDarkMode);
// the PDF export (pdfTypeset.js) prints on white, so a graph copied from the
// page in dark mode is recoloured to the light palette by lightGraphSvg.

// The curve is one solid colour (1.70.4): its two gradient stops are kept as
// roles and set equal.
const LIGHT = {
  grid: '#c7d2fe',
  axis: '#4f46e5',
  axisLine: '#cbd5e1',
  tooltipBg: '#ffffff',
  tooltipBorder: '#c7d2fe',
  tooltipText: '#1f2937',
  extremum: '#4f46e5',
  asymptote: '#ef4444',
  markerStroke: '#ffffff',
  gradientFrom: '#4f46e5',
  gradientTo: '#4f46e5',
};

// A lighter curve on the dark card: indigo-600 measured 2.3:1 there;
// indigo-400 is about 5:1.
const DARK = {
  grid: '#374151',
  axis: '#9ca3af',
  axisLine: '#4b5563',
  tooltipBg: '#1f2937',
  tooltipBorder: '#4b5563',
  tooltipText: '#e5e7eb',
  extremum: '#818cf8',
  asymptote: '#f87171',
  markerStroke: '#1f2937',
  gradientFrom: '#818cf8',
  gradientTo: '#818cf8',
};

export const graphPalette = (isDarkMode) => (isDarkMode ? DARK : LIGHT);

// The colours that reach the chart's SVG (the tooltip is HTML, outside it).
// Each dark value maps to one light value: the dark palette never uses one
// colour for two SVG roles that differ in the light one.
const SVG_ROLES = ['grid', 'axis', 'axisLine', 'tooltipBg', 'extremum', 'asymptote', 'markerStroke', 'gradientFrom', 'gradientTo'];

// Serialized chart SVG in the dark palette → the same chart in the light one.
export function lightGraphSvg(svgText) {
  let out = svgText;
  for (const role of SVG_ROLES) {
    out = out.replace(new RegExp(`(["':\\s])${DARK[role]}(?=["';\\s)])`, 'gi'), `$1${LIGHT[role]}`);
  }
  return out;
}
