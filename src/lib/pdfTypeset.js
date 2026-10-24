// The typeset PDF of one solution (October 2026 roadmap P2).
//
// jsPDF's built-in fonts are Latin-1, so text drawn with doc.text() cannot
// show ±, √ or x² (exportUtils.js transliterates them to +/-, sqrt, x^2).
// Instead the solution is laid out as an HTML sheet — the same KaTeX the
// page shows (mathRender.js), and the graph copied from the page — then each
// page of the sheet is captured with html2canvas and placed as an image.
//
// - Light on white whatever the app's theme: the sheet uses its own inline
//   colours, the capture removes the `dark` class from its copy of the page,
//   and a dark-mode graph is recoloured to the light palette.
// - Pages break between blocks (a step, the answer, a tip), never through
//   one; a section heading travels with its first item.
// - Every block's words are also written as invisible text at its position,
//   so the PDF can still be searched and copied from.
// - Loaded only on export (with html2canvas), and it needs nothing from the
//   network, so it works offline. exportUtils.js falls back to the
//   plain-text PDF if anything here throws (a blocked canvas, private mode).

// html2canvas-pro, the maintained fork: it reads each font's baseline from
// the canvas (html2canvas 1.4 measured it in a box that inherits the page's
// line-height, so KaTeX sat low against the prose), and it parses oklch(),
// Tailwind 4's colour space.
import html2canvas from 'html2canvas-pro';
import { mathTextToHtml, escapeHtml } from './mathRender.js';
import { lightGraphSvg } from './graphPalette.js';
import { pdfSafe } from './exportUtils.js';
import { stripMathMarkers } from './mathMarkers.js';

// A4 in mm, and the sheet's CSS width: 720 px across 180 mm, 4 px per mm.
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 15;
const FOOTER = 12;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const CONTENT_H = PAGE_H - MARGIN - FOOTER;
const SHEET_PX = 720;
const PX_PER_MM = SHEET_PX / CONTENT_W;
// Canvas pixels per CSS pixel: sharp in print, and a page stays well under
// the canvas-area limit of mobile Safari.
const SCALE = 2;

const INK = '#1f2937';
const MUTED = '#4b5563';
const INDIGO = '#4f46e5';

const THEMES = {
  solved: { bg: '#ecfdf5', border: '#a7f3d0', ink: '#065f46' },
  failed: { bg: '#fffbeb', border: '#fde68a', ink: '#92400e' },
};

function el(tag, style, html = '') {
  const node = document.createElement(tag);
  node.setAttribute('style', style);
  node.innerHTML = html;
  return node;
}

const heading = (text, color = INK) =>
  `<div style="font-weight:700;font-size:17px;color:${color};margin:0 0 8px">${escapeHtml(text)}</div>`;

// A box for a tip or a mistake.
const note = (html, bg, border) =>
  `<div style="background:${bg};border:1px solid ${border};border-radius:8px;padding:8px 12px;color:#374151">${html}</div>`;

// The chart as it is on screen, as a standalone SVG image.
function graphImage(graph) {
  const svg = graph?.svg;
  if (!svg) return null;
  const rect = svg.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const copy = svg.cloneNode(true);
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  copy.setAttribute('width', String(Math.round(rect.width)));
  copy.setAttribute('height', String(Math.round(rect.height)));
  copy.setAttribute('viewBox', `0 0 ${Math.round(rect.width)} ${Math.round(rect.height)}`);
  // As an image the SVG sees none of the page's CSS: give its text the
  // page's font explicitly.
  copy.setAttribute('font-family', getComputedStyle(svg).fontFamily || 'sans-serif');
  let text = new XMLSerializer().serializeToString(copy);
  if (graph.dark) text = lightGraphSvg(text);
  return {
    src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`,
    width: rect.width,
    height: rect.height,
  };
}

// The sheet's blocks, in order: { html, text }. A section heading is part of
// its first item's block, so a page never ends on a heading.
function sheetBlocks({ title, problem, status, solution, graph }) {
  const blocks = [];
  const statusLine = status.label
    ? `<div style="display:inline-block;margin-top:8px;padding:2px 10px;border-radius:999px;border:1px solid ${THEMES.failed.border};background:${THEMES.failed.bg};color:${THEMES.failed.ink};font-size:12px;font-weight:600">Status: ${escapeHtml(status.label)}</div>`
    : '';
  blocks.push({
    html: `<div style="font-weight:800;font-size:22px;color:${INDIGO};margin-bottom:12px">${escapeHtml(title)}</div>
      <div style="font-weight:700;color:${INK};margin-bottom:2px">Problem:</div>
      <div style="font-size:15px;color:${INK};white-space:pre-wrap;word-break:break-word">${escapeHtml(problem)}</div>${statusLine}`,
    text: [title, `Problem: ${problem}`, status.label ? `Status: ${status.label}` : ''].filter(Boolean).join('\n'),
  });

  const steps = solution.steps || [];
  steps.forEach((step, i) => {
    const plain = stripMathMarkers(step);
    blocks.push({
      html: `${i === 0 ? heading('Step-by-Step Solution') : ''}
        <div style="display:flex;gap:12px;padding:8px 0;${i > 0 ? 'border-top:1px solid #e5e7eb;' : ''}">
          <div style="flex:0 0 26px;height:26px;border-radius:50%;background:${INDIGO};color:#fff;font-weight:700;font-size:12px;line-height:26px;text-align:center">${i + 1}</div>
          <div style="flex:1;line-height:1.65;color:${INK}">${mathTextToHtml(step)}</div>
        </div>`,
      text: `${i === 0 ? 'Step-by-Step Solution\n' : ''}${i + 1}. ${plain}`,
    });
  });

  if (solution.answer) {
    const theme = status.label ? THEMES.failed : THEMES.solved;
    const warnings = (solution.warnings || [])
      .map((w) => `<div style="margin-top:6px;font-size:13px;color:${MUTED}">⚠ ${escapeHtml(w)}</div>`)
      .join('');
    blocks.push({
      html: `<div style="margin-top:8px;background:${theme.bg};border:1px solid ${theme.border};border-radius:12px;padding:14px 18px">
          ${heading(status.answerHeading)}
          <div style="font-size:18px;font-weight:600;color:${theme.ink}">${mathTextToHtml(solution.answer)}</div>${warnings}
        </div>`,
      text: [`${status.answerHeading}: ${solution.answer}`, ...(solution.warnings || [])].join('\n'),
    });
  }

  const image = graphImage(graph);
  if (image) {
    // The chart scaled to the sheet's width, never taller than half a page.
    const maxH = (CONTENT_H * PX_PER_MM) / 2;
    const w = Math.min(SHEET_PX, (image.width * maxH) / image.height);
    blocks.push({
      html: `<div style="margin-top:12px">${heading('Graph')}
          <img src="${image.src}" alt="" style="display:block;width:${w}px;height:${(w * image.height) / image.width}px;border:1px solid #c7d2fe;border-radius:8px">
          ${graph.label ? `<div style="margin-top:6px;font-size:12px;color:${MUTED}">${escapeHtml(graph.label)}</div>` : ''}
        </div>`,
      text: `Graph${graph.label ? `: ${graph.label}` : ''}`,
    });
  }

  const list = (items, title, bg, border, color) => {
    items.forEach((item, i) => {
      blocks.push({
        html: `${i === 0 ? `<div style="margin-top:12px">${heading(title, color)}</div>` : ''}<div style="padding:3px 0">${note(mathTextToHtml(item, { mode: 'marked' }), bg, border)}</div>`,
        text: `${i === 0 ? `${title}\n` : ''}- ${stripMathMarkers(item)}`,
      });
    });
  };
  list(solution.tips || [], 'Key Insights', '#fffbeb', '#fde68a', '#92400e');
  list(solution.common_mistakes || [], 'Common Mistakes to Avoid', '#fef2f2', '#fecaca', '#991b1b');
  return blocks;
}

// Group measured block heights (CSS px) into pages.
export function paginate(heights, pageHeight) {
  const pages = [];
  let current = [];
  let used = 0;
  heights.forEach((h, i) => {
    if (current.length > 0 && used + h > pageHeight) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(i);
    used += h;
  });
  if (current.length) pages.push(current);
  return pages;
}

const waitForImages = (root) =>
  Promise.all([...root.querySelectorAll('img')].map((img) => (img.decode ? img.decode().catch(() => {}) : null)));

export async function buildTypesetPDF(jsPDF, { title, problem, status, solution, graph }) {
  return renderBlocks(jsPDF, sheetBlocks({ title, problem, status, solution, graph }));
}

// The My Progress history as a typeset PDF: each entry's problem and answer
// set by the same renderer as the page, so ±, √, ∞ and x² print as
// themselves (the plain-text PDF spelled ∞ "infinity"; October 2026 review).
// Graphs are in each solution's own PDF: history keeps the answer, not the
// chart. `entries` are { topic, date, problem, answer, statusLabel, solveCount }.
export async function buildProgressPDF(jsPDF, { totals, generated, entries }) {
  const blocks = [{
    html: `<div style="font-weight:800;font-size:22px;color:${INDIGO};margin-bottom:6px">MasterMath Progress</div>
      <div style="color:${INK}">${escapeHtml(totals)}</div>
      <div style="color:${MUTED};font-size:12px;margin-bottom:8px">Generated: ${escapeHtml(generated)}</div>`,
    text: ['MasterMath Progress', totals, `Generated: ${generated}`].join('\n'),
  }];
  entries.forEach((e, i) => {
    const badge = (label, bg, ink) => `<span style="display:inline-block;margin-left:6px;padding:1px 8px;border-radius:999px;background:${bg};color:${ink};font-size:11px;font-weight:600">${escapeHtml(label)}</span>`;
    blocks.push({
      html: `<div style="border:1px solid #c7d2fe;border-radius:10px;padding:10px 14px;margin:6px 0">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
            <span><span style="font-weight:700;color:${INDIGO}">${i + 1}. ${escapeHtml(e.topic)}</span>${e.statusLabel ? badge(e.statusLabel, THEMES.failed.bg, THEMES.failed.ink) : ''}${e.solveCount > 1 ? badge(`Solved ${e.solveCount} times`, '#e5e7eb', '#374151') : ''}</span>
            <span style="color:${MUTED};font-size:12px">${escapeHtml(e.date)}</span>
          </div>
          <div style="color:${INK};font-weight:600;word-break:break-word">${mathTextToHtml(e.problem, { mode: 'input' })}</div>
          ${e.answer ? `<div style="color:#374151;margin-top:4px;line-height:1.6">${e.statusLabel ? 'Result' : 'Solution'}: ${mathTextToHtml(e.answer)}</div>` : ''}
        </div>`,
      text: [`${i + 1}. ${e.topic} (${e.date})${e.statusLabel ? ` - ${e.statusLabel}` : ''}`, `Problem: ${e.problem}`, e.answer ? `${e.statusLabel ? 'Result' : 'Solution'}: ${stripMathMarkers(e.answer)}` : ''].filter(Boolean).join('\n'),
    });
  });
  return renderBlocks(jsPDF, blocks);
}

async function renderBlocks(jsPDF, blocks) {
  // Off screen, at the sheet's real width so lines wrap as they will print.
  const sheet = el(
    'div',
    `position:fixed;left:-${SHEET_PX * 3}px;top:0;width:${SHEET_PX}px;background:#ffffff;color:${INK};` +
      `font-family:${getComputedStyle(document.body).fontFamily};font-size:14px;line-height:1.5;` +
      'pointer-events:none;-webkit-font-smoothing:antialiased'
  );
  sheet.setAttribute('aria-hidden', 'true');
  // Unique, so two exports in quick succession each capture their own sheet.
  const sheetId = `pdf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  sheet.dataset.pdfSheet = sheetId;
  const nodes = blocks.map((b) => {
    const node = el('div', 'padding:2px 0', b.html);
    sheet.appendChild(node);
    return node;
  });
  document.body.appendChild(sheet);

  try {
    await waitForImages(sheet);
    if (document.fonts?.ready) await document.fonts.ready;
    const heights = nodes.map((n) => n.getBoundingClientRect().height);
    const pages = paginate(heights, CONTENT_H * PX_PER_MM);

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    for (let p = 0; p < pages.length; p += 1) {
      if (p > 0) doc.addPage();
      const onPage = new Set(pages[p]);
      nodes.forEach((n, i) => { n.style.display = onPage.has(i) ? '' : 'none'; });

      const canvas = await html2canvas(sheet, {
        scale: SCALE,
        backgroundColor: '#ffffff',
        logging: false,
        // The capture works on a copy of the page: bring the sheet on screen
        // and drop dark mode there, never on the page the user is looking at.
        onclone: (copy) => {
          copy.documentElement.classList.remove('dark');
          const copied = copy.querySelector(`[data-pdf-sheet="${sheetId}"]`);
          if (copied) copied.style.left = '0px';
        },
      });

      // A page taller than the content area (one block bigger than a page)
      // is scaled down to fit rather than cut.
      let w = CONTENT_W;
      let h = canvas.height / SCALE / PX_PER_MM;
      if (h > CONTENT_H) { w *= CONTENT_H / h; h = CONTENT_H; }
      doc.addImage(canvas.toDataURL('image/jpeg', 0.85), 'JPEG', MARGIN, MARGIN, w, h);

      // The text layer: each block's words, invisible, where the block is.
      doc.setFontSize(9);
      let y = MARGIN;
      for (const i of pages[p]) {
        const lines = doc.splitTextToSize(pdfSafe(blocks[i].text), CONTENT_W);
        doc.text(lines, MARGIN, y + 3, { renderingMode: 'invisible' });
        y += (heights[i] / PX_PER_MM) * (w / CONTENT_W);
      }
    }

    const count = doc.getNumberOfPages();
    for (let p = 1; p <= count; p += 1) {
      doc.setPage(p);
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.text('Generated by MasterMath - mastermath.app', MARGIN, PAGE_H - 8);
      doc.text(`Page ${p} of ${count}`, PAGE_W - MARGIN, PAGE_H - 8, { align: 'right' });
    }
    return doc;
  } finally {
    sheet.remove();
  }
}
