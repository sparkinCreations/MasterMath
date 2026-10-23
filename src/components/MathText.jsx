import React, { useMemo } from "react";
import "katex/dist/katex.min.css";
import { renderMathSegments } from "@/lib/mathRender";

// Renders solver text with embedded math typeset by KaTeX
// (lib/mathRender.js, which the PDF export shares). A segment KaTeX cannot
// render shows as its original plain text.
//
// Accessibility: the output mode must stay "htmlAndMathml" (KaTeX's default).
// The visual `katex-html` span is marked aria-hidden by KaTeX itself, so an
// html-only render would leave every expression silent to screen readers —
// in a math app, that is the entire content.
//
// `mode`: 'auto' for steps and answers, 'marked' for tips and mistakes (only
// ⟦…⟧-marked runs are math), 'input' for a typed problem (lib/latex.js).
export default function MathText({ text, block = false, mode = "auto" }) {
  const segments = useMemo(() => renderMathSegments(text, { mode }), [text, mode]);

  const Tag = block ? "div" : "span";
  return (
    <Tag>
      {segments.map((seg, i) =>
        seg.type === "katex" ? (
          // eslint-disable-next-line react/no-danger
          <span key={i} dangerouslySetInnerHTML={{ __html: seg.html }} />
        ) : (
          <span key={i}>{seg.value}</span>
        )
      )}
    </Tag>
  );
}
