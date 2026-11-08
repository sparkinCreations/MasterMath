// The final answer, for display, as separate lines (1.70.4): a semicolon
// outside brackets ends a part, so "domain: all real numbers; range: y ≥ -1"
// shows one fact per line. A Functions answer starts with the function
// ("f(x) = x^2 - 4x + 3: domain: …"): that becomes the heading line and the
// facts follow it. Display only: exports and history keep the answer as one
// line of text. No imports, so the page can use it.

// Split at semicolons at bracket depth 0; parts trimmed, empty ones dropped.
function splitTopLevelSemicolons(text) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    else if ((ch === ')' || ch === ']' || ch === '}') && depth > 0) depth -= 1;
    else if (ch === ';' && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

// { heading, parts }: heading is the "f(x) = …" line or null; parts has at
// least one entry. One part and no heading means the answer stays as it is.
export function answerParts(answer) {
  const text = String(answer ?? '').trim();
  const parts = splitTopLevelSemicolons(text);
  if (parts.length < 2) return { heading: null, parts: [text] };
  // The closing full stop belongs to the sentence, not to the last fact.
  parts[parts.length - 1] = parts[parts.length - 1].replace(/\.$/, '');
  let heading = null;
  const lead = parts[0].match(/^([A-Za-z]\([A-Za-z]\)\s*=\s*[^:]+):\s+(.+)$/);
  if (lead) {
    heading = lead[1].trim();
    parts[0] = lead[2].trim();
  }
  return { heading, parts };
}

// One part as { label, value }: "domain: x ≠ 2" is the label "Domain" and
// the value "x ≠ 2", so the value is typeset on its own; a part with no
// "label: " is all value. The first word is capitalised when it is a word
// ("domain", "no", "vertex"), never a variable ("x-intercepts", "y = 0").
export function labelledPart(part) {
  const cap = (t) => t.replace(/^([a-z])(?=[a-z]+\b)/, (c) => c.toUpperCase());
  const m = String(part).match(/^([^:]+?):\s+(.+)$/);
  if (m && /[a-z]{2,}/i.test(m[1]) && !/[=<>≤≥≠]/.test(m[1])) return { label: cap(m[1].trim()), value: m[2].trim() };
  return { label: null, value: cap(String(part)) };
}
