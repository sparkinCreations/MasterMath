import React, { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { segmentMathText, toLatex } from "@/lib/latex";

// Renders solver text with embedded math typeset by KaTeX.
// Fallback discipline: if conversion or KaTeX rendering fails for a segment,
// that segment renders as the original plain text — output is never worse
// than the pre-KaTeX presentation.
export default function MathText({ text, block = false }) {
  const segments = useMemo(() => {
    const segs = segmentMathText(text);
    return segs.map((seg) => {
      if (seg.type !== "math") return seg;
      try {
        const html = katex.renderToString(toLatex(seg.value), {
          throwOnError: true,
          displayMode: false,
          output: "html",
        });
        return { type: "katex", html };
      } catch {
        return { type: "text", value: seg.value };
      }
    });
  }, [text]);

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
