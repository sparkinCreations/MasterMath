// Export utilities for MasterMath
import { statusLabel, isFailureStatus } from './solutionEnvelope.js';

// jsPDF (plus its html2canvas/dompurify dependencies) is ~600 kB — larger than
// the rest of the app combined. Importing it at module scope pulled it into
// every page load, because both export menus are rendered eagerly. Loading it
// on demand means only users who actually click "Export as PDF" pay for it.
// The promise is memoized so a second export doesn't refetch.
let jsPDFPromise = null;

function loadJsPDF() {
  if (!jsPDFPromise) {
    jsPDFPromise = import('jspdf').then((module) => module.default);
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
  let out = String(text ?? '');
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

// History holds every outcome except parse errors, so it contains entries the
// solver could not actually solve (unsupported, undefined, indeterminate,
// overflow). Counting them all as "solved" overstated what the user had done.
function solvedCount(problems) {
  return problems.filter(p => !p.solution?.status || !isFailureStatus(p.solution.status)).length;
}

// Summary line shared by the Markdown and PDF history exports. The breakdown
// only appears when there is something to break down.
function totalsLine(problems) {
  const solved = solvedCount(problems);
  return solved === problems.length
    ? `Total Problems: ${problems.length}`
    : `Total Problems: ${problems.length} (solved: ${solved})`;
}

// Spreadsheet applications treat a cell beginning with '=', '+', '-', '@' or
// a control character as a formula. A maths app is unusually likely to produce
// such cells honestly ("-3 < x < 5") and, since problems are free text, it can
// be made to produce them deliberately — so opening an exported file could run
// whatever the cell contained. Prefixing with an apostrophe marks the cell as
// literal text, which is the standard mitigation for CSV injection.
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

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
  markdown += `**${totalsLine(problems)}**\n\n`;

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

// Export individual solution as Markdown
export function exportSolutionAsMarkdown(problem, topic, solution, topicLabels) {
  const status = exportStatus(solution);
  let markdown = `# ${topicLabels[topic] || topic} Problem\n\n`;
  markdown += `**Problem:** ${problem}\n\n`;
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
    });
    markdown += '\n';
  }

  if (solution.common_mistakes && solution.common_mistakes.length > 0) {
    markdown += `## Common Mistakes to Avoid\n\n`;
    solution.common_mistakes.forEach(mistake => {
      markdown += `- ${mistake}\n`;
    });
    markdown += '\n';
  }

  markdown += `\n---\n*Generated by MasterMath*\n`;

  const filename = `solution-${topic}-${Date.now()}.md`;
  downloadFile(markdown, filename, 'text/markdown');
}

// Export individual solution as JSON
export function exportSolutionAsJSON(problem, topic, solution) {
  const data = {
    problem,
    topic,
    solution,
    exportedAt: new Date().toISOString()
  };

  const filename = `solution-${topic}-${Date.now()}.json`;
  downloadFile(JSON.stringify(data, null, 2), filename, 'application/json');
}

// Export progress history as PDF
export async function exportAsPDF(problems, topicLabels) {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF();

  // Title
  doc.setFontSize(20);
  doc.text('MasterMath Progress', 20, 20);

  doc.setFontSize(12);
  doc.text(pdfSafe(totalsLine(problems)), 20, 35);
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
}

// Export individual solution as PDF
export async function exportSolutionAsPDF(problem, topic, solution, topicLabels) {
  const jsPDF = await loadJsPDF();
  const status = exportStatus(solution);
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
      const tipLines = doc.splitTextToSize(pdfSafe(`• ${tip}`), 165);

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
      const mistakeLines = doc.splitTextToSize(pdfSafe(`• ${mistake}`), 165);

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

  const filename = `solution-${topic}-${Date.now()}.pdf`;
  doc.save(filename);
}

// Helper function to trigger file download
function downloadFile(content, filename, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
