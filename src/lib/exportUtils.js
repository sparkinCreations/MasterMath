// Export utilities for MasterMath
import { statusLabel, isFailureStatus } from './solutionEnvelope.js';
import { historyTotalsText } from './historyStats.js';
import { stripMathMarkers } from './mathMarkers.js';
import { sourceOf } from './guidance.js';

// jsPDF (plus its html2canvas/dompurify dependencies) is ~600 kB — larger than
// the rest of the app combined. Importing it at module scope pulled it into
// every page load, because both export menus are rendered eagerly. Loading it
// on demand means only users who actually click "Export as PDF" pay for it.
// The promise is memoized so a second export doesn't refetch.
let jsPDFPromise = null;

function loadJsPDF() {
  if (!jsPDFPromise) {
    // Prefer the named export: in jspdf 4 the node build's `default` is the
    // whole namespace object, not the constructor (the browser build keeps
    // both). The named `jsPDF` is the constructor in every build and version.
    jsPDFPromise = import('jspdf').then((module) => module.jsPDF ?? module.default);
  }
  return jsPDFPromise;
}

// jsPDF's built-in fonts (Helvetica) cover Latin-1 only. Anything else — and
// solver output is full of ∫ π √ ≈ ≠ ≤ ≥ ′ θ ∈ ℤ → − · ² ✓ — is emitted as
// garbage glyphs, silently. Rather than embed a 300 kB Unicode font in the
// PDF chunk, PDF text is transliterated to readable ASCII/Latin-1 at the
// boundary: π → pi, √ → sqrt, ≤ → <=, − → -, and so on. Markdown, JSON and
// CSV exports are unaffected (they are UTF-8).
const PDF_TRANSLITERATIONS = [
  ['∫', 'integral '], ['π', 'pi'], ['√', 'sqrt'], ['≈', '~='], ['≠', '!='], ['≤', '<='], ['≥', '>='],
  ['′', "'"], ['″', "''"], ['θ', 'theta'], ['∈', 'in'], ['ℤ', 'Z'], ['ℝ', 'R'], ['→', '->'], ['←', '<-'],
  ['−', '-'], ['–', '-'], ['—', ' - '], ['·', '*'], ['×', 'x'], ['÷', '/'], ['∞', 'infinity'], ['✓', '(checked)'],
  ['⁻¹', '^-1'], ['²', '^2'], ['³', '^3'], ['⁴', '^4'], ['⁵', '^5'], ['⁶', '^6'], ['⁷', '^7'], ['⁸', '^8'], ['⁹', '^9'],
  ['⁰', '^0'], ['¹', '^1'], ['⁻', '^-'], ['⁺', '+'], ['½', '1/2'], ['⅓', '1/3'], ['¼', '1/4'], ['¾', '3/4'],
  ['₀', '_0'], ['₁', '_1'], ['₂', '_2'], ['α', 'alpha'], ['β', 'beta'], ['Δ', 'Delta'], ['δ', 'delta'], ['ε', 'epsilon'],
  ['λ', 'lambda'], ['μ', 'mu'], ['σ', 'sigma'], ['φ', 'phi'], ['ω', 'omega'], ['°', ' deg'], ['≡', '=='], ['±', '+/-'],
  ['…', '...'], ['‘', "'"], ['’', "'"], ['“', '"'], ['”', '"'], ['•', '-'], ['⋅', '*'], ['∀', 'for all'], ['∃', 'there exists'],
];
export function pdfSafe(text) {
  let out = stripMathMarkers(text);
  for (const [from, to] of PDF_TRANSLITERATIONS) out = out.split(from).join(to);
  // Anything still outside Latin-1 becomes '?', which is at least honest and
  // visible — never a silent wrong glyph.
  return out.replace(/[^\x00-\xFF]/g, '?');
}

// Helper to extract solution text
function getSolutionText(solution) {
  if (!solution) return '';
  if (typeof solution === 'string') return solution;
  return solution.answer || '';
}

// A failed solve must not export looking like an answer: label it with its
// status and drop the "Final Answer" framing.
function exportStatus(solution) {
  // Legacy results (stored before statuses existed) have no status field and
  // keep the old solved presentation.
  const failed = Boolean(solution?.status && isFailureStatus(solution.status));
  return {
    label: failed ? statusLabel(solution.status) : null,
    answerHeading: failed ? 'Result (not solved)' : 'Final Answer',
  };
}

// The totals line in the Markdown and PDF history exports is
// historyTotalsText (historyStats.js): the same words as the Progress page.

// Spreadsheet applications treat a cell beginning with '=', '+', '-', '@' or
// a control character as a formula. A maths app is unusually likely to produce
// such cells honestly ("-3 < x < 5") and, since problems are free text, it can
// be made to produce them deliberately — so opening an exported file could run
// whatever the cell contained. Prefixing with an apostrophe marks the cell as
// literal text, which is the standard mitigation for CSV injection.
//
// \p{Cc} covers every C0/C1 control character, not just the tab and carriage
// return this once listed: a spreadsheet may strip or reinterpret a leading
// control character before deciding whether the cell is a formula, so a value
// starting with a line feed would have slipped through guarded as text.
// sanitizeInput() strips these from newly entered problems, but history that
// was imported or saved before that existed is not covered by it.
const FORMULA_TRIGGER = /^(?:[=+\-@]|\p{Cc})/u;

function csvCell(value) {
  const text = String(value ?? '');
  const guarded = FORMULA_TRIGGER.test(text) ? `'${text}` : text;
  // Every field is quoted, not just the free-text ones: a locale whose date
  // format contains a comma would otherwise shift the columns.
  return `"${guarded.replace(/"/g, '""')}"`;
}

/**
 * Build the progress-history CSV. Separate from the download so the escaping
 * can be tested directly.
 */
export function buildProgressCSV(problems, topicLabels = {}) {
  // Status is a column of its own: without it a saved "unsupported" or
  // "indeterminate" result reads in a spreadsheet exactly like a real answer.
  const headers = ['Date', 'Topic', 'Problem', 'Status', 'Solution'];
  const rows = problems.map(p => [
    new Date(p.createdAt).toLocaleDateString(),
    topicLabels[p.topic] || p.topic,
    p.problem,
    exportStatus(p.solution).label || 'Solved',
    getSolutionText(p.solution),
  ].map(csvCell));

  return [
    headers.map(csvCell).join(','),
    ...rows.map(row => row.join(',')),
  ].join('\n');
}

// Export progress history as CSV
export function exportAsCSV(problems, topicLabels) {
  downloadFile(buildProgressCSV(problems, topicLabels), 'mastermath-progress.csv', 'text/csv');
}

// Export progress history as JSON
export function exportAsJSON(problems) {
  const jsonContent = JSON.stringify(problems, null, 2);
  downloadFile(jsonContent, 'mastermath-progress.json', 'application/json');
}

// Export progress history as Markdown
export function exportAsMarkdown(problems, topicLabels) {
  let markdown = '# MasterMath Progress\n\n';
  markdown += `**${historyTotalsText(problems)}**\n\n`;

  // Group by topic
  const byTopic = {};
  problems.forEach(p => {
    const topic = topicLabels[p.topic] || p.topic;
    if (!byTopic[topic]) byTopic[topic] = [];
    byTopic[topic].push(p);
  });

  Object.entries(byTopic).forEach(([topic, probs]) => {
    markdown += `## ${topic}\n\n`;
    probs.forEach(p => {
      markdown += `### ${new Date(p.createdAt).toLocaleDateString()}\n`;
      markdown += `**Problem:** ${p.problem}\n\n`;
      const entryStatus = exportStatus(p.solution);
      if (entryStatus.label) {
        markdown += `**Status:** ${entryStatus.label}\n\n`;
      }
      const solutionText = getSolutionText(p.solution);
      if (solutionText) {
        markdown += `**${entryStatus.label ? 'Result' : 'Solution'}:** ${solutionText}\n\n`;
      }
      markdown += '---\n\n';
    });
  });

  downloadFile(markdown, 'mastermath-progress.md', 'text/markdown');
}

// The topic the solve was routed to: an integral typed under Algebra is an
// Integrals problem (its first step says so), and an equation under Functions
// an Algebra one. Every export is titled by it: the PDF was, while Markdown
// and JSON used the dropdown's topic (October 25 review).
const solvedTopic = (topic, solution) => solution?.routedTopic || topic;

// Export individual solution as Markdown
export function exportSolutionAsMarkdown(problem, chosenTopic, solution, topicLabels) {
  const status = exportStatus(solution);
  const topic = solvedTopic(chosenTopic, solution);
  let markdown = `# ${topicLabels[topic] || topic} Problem\n\n`;
  markdown += `**Problem:** ${problem}\n\n`;
  if (solution.readAs) markdown += `**Read as:** ${solution.readAs}\n\n`;
  if (status.label) {
    markdown += `**Status:** ${status.label}\n\n`;
  }

  if (solution.steps && solution.steps.length > 0) {
    markdown += `## Step-by-Step Solution\n\n`;
    solution.steps.forEach((step, idx) => {
      markdown += `${idx + 1}. ${step}\n`;
    });
    markdown += '\n';
  }

  if (solution.answer) {
    markdown += `## ${status.answerHeading}\n\n${solution.answer}\n\n`;
  }

  if (solution.tips && solution.tips.length > 0) {
    markdown += `## Key Insights\n\n`;
    solution.tips.forEach(tip => {
      markdown += `- ${tip}\n`;
      const source = sourceOf(solution, tip);
      if (source) markdown += `  Source: [${source.title}](${source.url})\n`;
    });
    markdown += '\n';
  }

  if (solution.common_mistakes && solution.common_mistakes.length > 0) {
    markdown += `## Common Mistakes to Avoid\n\n`;
    solution.common_mistakes.forEach(mistake => {
      markdown += `- ${mistake}\n`;
      const source = sourceOf(solution, mistake);
      if (source) markdown += `  Source: [${source.title}](${source.url})\n`;
    });
    markdown += '\n';
  }

  markdown += `\n---\n*Generated by MasterMath*\n`;

  const filename = `solution-${topic}-${Date.now()}.md`;
  downloadFile(markdown, filename, 'text/markdown');
}

// Export individual solution as JSON
export function exportSolutionAsJSON(problem, chosenTopic, solution) {
  const topic = solvedTopic(chosenTopic, solution);
  const data = {
    problem,
    topic,
    ...(topic !== chosenTopic ? { chosenTopic } : {}),
    solution,
    exportedAt: new Date().toISOString()
  };

  const filename = `solution-${topic}-${Date.now()}.json`;
  downloadFile(JSON.stringify(data, null, 2), filename, 'application/json');
}

// Export progress history as PDF
// The history PDF: typeset (pdfTypeset.js) wherever a DOM and a canvas are
// available, the plain-text one below otherwise. Resolves to 'typeset' or
// 'text', the kind saved.
export async function exportAsPDF(problems, topicLabels) {
  const jsPDF = await loadJsPDF();
  if (typeof document !== 'undefined') {
    try {
      const { buildProgressPDF } = await import('./pdfTypeset.js');
      const doc = await buildProgressPDF(jsPDF, {
        totals: historyTotalsText(problems),
        generated: new Date().toLocaleDateString(),
        entries: problems.map((p) => ({
          topic: topicLabels[p.topic] || p.topic,
          date: new Date(p.createdAt).toLocaleDateString(),
          problem: p.problem,
          answer: getSolutionText(p.solution),
          statusLabel: exportStatus(p.solution).label,
          solveCount: p.solveCount || 1,
        })),
      });
      doc.save('mastermath-progress.pdf');
      return 'typeset';
    } catch (error) {
      console.warn('Typeset PDF failed; exporting the plain-text PDF instead.', error);
    }
  }
  const doc = new jsPDF();

  // Title
  doc.setFontSize(20);
  doc.text('MasterMath Progress', 20, 20);

  doc.setFontSize(12);
  doc.text(pdfSafe(historyTotalsText(problems)), 20, 35);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 45);

  let yPos = 60;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;

  problems.forEach((p, idx) => {
    // Check if we need a new page
    if (yPos > pageHeight - 40) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text(`${idx + 1}. ${topicLabels[p.topic] || p.topic}`, margin, yPos);
    yPos += 7;

    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.text(`Date: ${new Date(p.createdAt).toLocaleDateString()}`, margin + 5, yPos);
    yPos += 7;

    // Problem text with word wrap
    const problemLines = doc.splitTextToSize(pdfSafe(`Problem: ${p.problem}`), 170);
    doc.text(problemLines, margin + 5, yPos);
    yPos += problemLines.length * 5;

    const entryStatus = exportStatus(p.solution);
    if (entryStatus.label) {
      doc.text(`Status: ${entryStatus.label}`, margin + 5, yPos);
      yPos += 7;
    }

    const solutionText = getSolutionText(p.solution);
    if (solutionText) {
      const heading = entryStatus.label ? 'Result' : 'Solution';
      const solutionLines = doc.splitTextToSize(pdfSafe(`${heading}: ${solutionText}`), 170);
      doc.text(solutionLines, margin + 5, yPos);
      yPos += solutionLines.length * 5;
    }

    yPos += 10; // Space between problems
  });

  doc.save('mastermath-progress.pdf');
  return 'text';
}

// Export individual solution as PDF: typeset (pdfTypeset.js — KaTeX steps
// and the graph, as on screen) wherever a DOM and a canvas are available,
// and the plain-text PDF below when they are not or the capture fails.
// `graph` is { svg, label, dark } for the chart on screen, or null.
// Resolves to 'typeset' or 'text', the kind of PDF that was saved.
export async function exportSolutionAsPDF(problem, chosenTopic, solution, topicLabels, { graph = null } = {}) {
  const jsPDF = await loadJsPDF();
  const topic = solvedTopic(chosenTopic, solution);
  const status = exportStatus(solution);
  const filename = `solution-${topic}-${Date.now()}.pdf`;
  if (typeof document !== 'undefined') {
    try {
      const { buildTypesetPDF } = await import('./pdfTypeset.js');
      const title = `${topicLabels[topic] || topic} Problem`;
      const doc = await buildTypesetPDF(jsPDF, { title, problem, status, solution, graph });
      doc.save(filename);
      return 'typeset';
    } catch (error) {
      console.warn('Typeset PDF failed; exporting the plain-text PDF instead.', error);
    }
  }
  buildTextPDF(jsPDF, problem, topic, solution, topicLabels, status).save(filename);
  return 'text';
}

// The plain-text PDF: jsPDF's Latin-1 fonts, symbols transliterated by
// pdfSafe. The fallback, and what a solution exports as outside a browser.
function buildTextPDF(jsPDF, problem, topic, solution, topicLabels, status) {
  const doc = new jsPDF();
  const margin = 20;
  let yPos = 20;

  // Title
  doc.setFontSize(18);
  doc.text(pdfSafe(`${topicLabels[topic] || topic} Problem`), margin, yPos);
  yPos += 15;

  // Problem
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text('Problem:', margin, yPos);
  yPos += 8;

  doc.setFont(undefined, 'normal');
  doc.setFontSize(11);
  const problemLines = doc.splitTextToSize(pdfSafe(problem), 170);
  doc.text(problemLines, margin, yPos);
  yPos += problemLines.length * 7 + 10;

  // Status (only shown when the solve did not succeed)
  if (status.label) {
    doc.setFont(undefined, 'bold');
    doc.text(pdfSafe(`Status: ${status.label}`), margin, yPos);
    doc.setFont(undefined, 'normal');
    yPos += 10;
  }

  // Steps
  if (solution.steps && solution.steps.length > 0) {
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Step-by-Step Solution:', margin, yPos);
    yPos += 10;

    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    solution.steps.forEach((step, idx) => {
      const stepLines = doc.splitTextToSize(pdfSafe(`${idx + 1}. ${step}`), 165);

      // Check page break
      if (yPos + stepLines.length * 6 > doc.internal.pageSize.height - 20) {
        doc.addPage();
        yPos = 20;
      }

      doc.text(stepLines, margin + 5, yPos);
      yPos += stepLines.length * 6 + 5;
    });
    yPos += 5;
  }

  // Answer
  if (solution.answer) {
    if (yPos > doc.internal.pageSize.height - 30) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(`${status.answerHeading}:`, margin, yPos);
    yPos += 8;

    doc.setFont(undefined, 'normal');
    doc.setFontSize(11);
    const answerLines = doc.splitTextToSize(pdfSafe(solution.answer), 170);
    doc.text(answerLines, margin, yPos);
    yPos += answerLines.length * 7 + 10;
  }

  // Tips
  if (solution.tips && solution.tips.length > 0) {
    if (yPos > doc.internal.pageSize.height - 40) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Key Insights:', margin, yPos);
    yPos += 8;

    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    solution.tips.forEach(tip => {
      const source = sourceOf(solution, tip);
      const tipLines = doc.splitTextToSize(pdfSafe(`• ${tip}${source ? `\nSource: ${source.title}, ${source.url}` : ''}`), 165);

      if (yPos + tipLines.length * 6 > doc.internal.pageSize.height - 20) {
        doc.addPage();
        yPos = 20;
      }

      doc.text(tipLines, margin + 5, yPos);
      yPos += tipLines.length * 6 + 3;
    });
    yPos += 5;
  }

  // Common Mistakes
  if (solution.common_mistakes && solution.common_mistakes.length > 0) {
    if (yPos > doc.internal.pageSize.height - 40) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Common Mistakes to Avoid:', margin, yPos);
    yPos += 8;

    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    solution.common_mistakes.forEach(mistake => {
      const source = sourceOf(solution, mistake);
      const mistakeLines = doc.splitTextToSize(pdfSafe(`• ${mistake}${source ? `\nSource: ${source.title}, ${source.url}` : ''}`), 165);

      if (yPos + mistakeLines.length * 6 > doc.internal.pageSize.height - 20) {
        doc.addPage();
        yPos = 20;
      }

      doc.text(mistakeLines, margin + 5, yPos);
      yPos += mistakeLines.length * 6 + 3;
    });
  }

  // Footer
  const pageCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text('Generated by MasterMath', margin, doc.internal.pageSize.height - 10);
  }

  return doc;
}

// Helper function to trigger file download
// Every file export passes through here, so this is where the ⟦…⟧ math
// markers of step text (mathMarkers.js) are removed: they are a hint for the
// on-screen renderer, never part of the exported text.
function downloadFile(content, filename, contentType) {
  const blob = new Blob([stripMathMarkers(content)], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
