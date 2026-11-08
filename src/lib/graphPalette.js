// The graph's theme colours. GraphViewer draws with graphPalette(isDarkMode);
// the PDF export (pdfTypeset.js) prints on white, so a graph copied from the
// page in dark mode is recoloured to the light palette by lightGraphSvg.

// A textbook figure (1.71.0, docs/DESIGN.md): a neutral grid and axes, the
// curve in the brand's ink indigo, one solid colour (the gradient stops are
// kept as roles and set equal).
const LIGHT = {
  grid: '#e5e5e5',
  axis: '#737373',
  axisLine: '#a3a3a3',
  tooltipBg: '#ffffff',
  tooltipBorder: '#d4d4d4',
  tooltipText: '#171717',
  extremum: '#4338ca',
  asymptote: '#dc2626',
  markerStroke: '#ffffff',
  gradientFrom: '#4338ca',
  gradientTo: '#4338ca',
};

// Lighter ink on the dark sheet: indigo-300 is about 9:1 on gray-900. No
// dark value is also a light one (the PDF recolouring maps by value).
const DARK = {
  grid: '#2e2e2e',
  axis: '#a8a8a8',
  axisLine: '#525252',
  tooltipBg: '#171717',
  tooltipBorder: '#404040',
  tooltipText: '#e5e5e5',
  extremum: '#a5b4fc',
  asymptote: '#f87171',
  markerStroke: '#171717',
  gradientFrom: '#a5b4fc',
  gradientTo: '#a5b4fc',
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
