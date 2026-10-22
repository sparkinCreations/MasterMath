import katex from 'katex';
import { segmentMathText, toLatex } from './latex.js';

// Solver text → segments ready to display: { type: 'katex', html } for math
// KaTeX typesets, { type: 'text', value } for prose. Shared by MathText (the
// page) and the PDF sheet (pdfTypeset.js), so the PDF shows exactly what the
// screen does.
//
// Fallback discipline: if conversion or KaTeX rendering fails for a segment,
// that segment is the original plain text — never worse than plain text.
export function renderMathSegments(text) {
  return segmentMathText(text).map((seg) => {
    if (seg.type !== 'math') return seg;
    try {
      const html = katex.renderToString(toLatex(seg.value), {
        throwOnError: true,
        displayMode: false,
        // Keep "htmlAndMathml": the MathML is what screen readers get.
        output: 'htmlAndMathml',
        // Set explicitly rather than relying on the KaTeX default. This HTML
        // is injected as markup (MathText's dangerouslySetInnerHTML, the PDF
        // sheet's innerHTML), and `trust: false` is what stops the
        // HTML-extension commands (\href, \htmlClass, \includegraphics) from
        // emitting live markup. Raw user input does reach here — a parse
        // error embeds it in the step text — so the guarantee must be stated
        // in the code, not inherited from a default a future KaTeX upgrade
        // or config change could move.
        trust: false,
      });
      return { type: 'katex', html };
    } catch {
      return { type: 'text', value: seg.value };
    }
  });
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ESCAPES[c]);

// The same segments as one HTML string (prose escaped), for markup built
// outside React.
export function mathTextToHtml(text) {
  return renderMathSegments(text)
    .map((seg) => (seg.type === 'katex' ? seg.html : `<span>${escapeHtml(seg.value)}</span>`))
    .join('');
}
