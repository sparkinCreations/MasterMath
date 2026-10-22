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
export default function MathText({ text, block = false }) {
  const segments = useMemo(() => renderMathSegments(text), [text]);

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
