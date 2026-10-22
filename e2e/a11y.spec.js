// Accessibility audit of the built app with axe-core, on every page, in light
// and dark mode, plus the Solver page in its three states (empty, showing a
// validation error, showing a solution with a graph).
//
// Rules: WCAG 2.0/2.1 A and AA. This is the part of AA a tool can check —
// contrast, names and roles, landmarks, language, parsing. Keyboard
// operability, focus order, reflow and meaningful sequence are checked by
// hand; see docs/ACCESSIBILITY.md for the full AA checklist and status.

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGES = ['/', '/solver', '/progress', '/usermanual', '/faq', '/privacypolicy', '/termsofservice', '/feedback', '/settings'];
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

// Audit the page in its final state: the solution card and steps fade in
// over half a second, and axe measured the blended, half-transparent text
// when the audit ran mid-fade (2.1:1 on a run that otherwise passed —
// outside review, October 2026). Wait for every running animation to finish
// and every element with an inline opacity to reach 1.
async function settled(page) {
  await page.waitForFunction(() =>
    // A looping animation (a spinner) never finishes; only finite ones are waited for.
    document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming?.().iterations === Infinity)
    && [...document.querySelectorAll('[style*="opacity"]')].every((e) => getComputedStyle(e).opacity === '1'));
}

async function audit(page, label) {
  await settled(page);
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const report = results.violations.map((v) =>
    `${v.id} (${v.impact}): ${v.help}\n${v.nodes.slice(0, 3).map((n) => `    ${n.target.join(' ')}\n      ${n.failureSummary.split('\n').join('\n      ')}`).join('\n')}`).join('\n\n');
  expect(results.violations, `${label}\n${report}`).toEqual([]);
}

for (const scheme of ['light', 'dark']) {
  test.describe(`${scheme} mode`, () => {
    test.beforeEach(async ({ page }) => {
      // Dark mode is the app's own setting (a class on <html>), not the OS one.
      await page.addInitScript((dark) => { localStorage.setItem('darkMode', String(dark)); localStorage.setItem('solutionMode', 'all'); }, scheme === 'dark');
    });

    for (const path of PAGES) {
      test(`${path} has no WCAG A/AA violations`, async ({ page }) => {
        await page.goto(path);
        await expect(page.locator('main')).toBeVisible();
        if (scheme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/);
        await audit(page, `${path} (${scheme})`);
      });
    }

    // axe checks text contrast, not icon strokes (WCAG 1.4.11, non-text
    // contrast, is not an automated rule). The graph controls and the
    // navigation toggle shipped black on the dark card for that reason.
    test('icon-only buttons meet 3:1 against their background', async ({ page }) => {
      await page.goto('/solver');
      { await page.getByText('Try an example:').waitFor(); const b = page.getByRole('button', { name: 'Functions: x^2 - 4*x + 3' }); if (!(await b.isVisible())) await page.getByRole('button', { name: /Show all \d+ examples/ }).click(); await b.click(); }
      await page.getByRole('button', { name: 'Solve Problem' }).click();
      await expect(page.locator('[role="img"][aria-label] svg.recharts-surface').first()).toBeVisible();
      const low = await page.evaluate(() => {
        const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d');
        const rgb = (css) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = css; cx.fillRect(0, 0, 1, 1); return [...cx.getImageData(0, 0, 1, 1).data]; };
        const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
        const contrast = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
        const bgOf = (el) => { let e = el; while (e) { const c = rgb(getComputedStyle(e).backgroundColor); if (c[3] > 128) return c; e = e.parentElement; } return rgb(getComputedStyle(document.body).backgroundColor); };
        const out = [];
        for (const btn of document.querySelectorAll('button[aria-label]')) {
          const svg = btn.querySelector('svg');
          if (!svg || !btn.offsetParent) continue;
          const stroke = getComputedStyle(svg).stroke;
          const fg = rgb(/currentcolor/i.test(stroke) ? getComputedStyle(svg).color : stroke);
          const ratio = contrast(fg, bgOf(btn));
          if (ratio < 3) out.push(`${btn.getAttribute('aria-label')}: ${ratio.toFixed(2)}`);
        }
        return out;
      });
      expect(low, 'icon buttons below 3:1').toEqual([]);
    });

    // axe reports an element over a gradient background as "incomplete",
    // not as a violation, which is how a black card title on a dark gradient
    // header shipped. Measure headings against the nearest solid background.
    test('headings meet 4.5:1 against the nearest solid background', async ({ page }) => {
      await page.goto('/solver');
      await expect(page.getByRole('heading', { name: 'Graph View' })).toBeVisible();
      const low = await page.evaluate(() => {
        const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d');
        const rgb = (css) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = css; cx.fillRect(0, 0, 1, 1); return [...cx.getImageData(0, 0, 1, 1).data]; };
        const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
        const contrast = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
        const bgOf = (el) => { let e = el; while (e) { const c = rgb(getComputedStyle(e).backgroundColor); if (c[3] > 128) return c; e = e.parentElement; } return rgb(getComputedStyle(document.body).backgroundColor); };
        const out = [];
        for (const h of document.querySelectorAll('h1, h2, h3')) {
          if (!h.offsetParent) continue;
          // Gradient text (background-clip: text) has a transparent colour;
          // its contrast is the gradient's, which axe measures elsewhere.
          const fg = rgb(getComputedStyle(h).color);
          if (fg[3] < 128) continue;
          const ratio = contrast(fg, bgOf(h));
          if (ratio < 4.5) out.push(`${h.textContent.trim().slice(0, 40)}: ${ratio.toFixed(2)}`);
        }
        return out;
      });
      expect(low, 'headings below 4.5:1').toEqual([]);
    });

    test('the solver with a validation error, and with a solution and graph', async ({ page }) => {
      await page.goto('/solver');
      { await page.getByText('Try an example:').waitFor(); const b = page.getByRole('button', { name: 'Algebra: 2*x + 5 = 11' }); if (!(await b.isVisible())) await page.getByRole('button', { name: /Show all \d+ examples/ }).click(); await b.click(); }
      await page.locator('#problem').fill('hello world');
      await page.getByRole('button', { name: 'Solve Problem' }).click();
      await expect(page.getByRole('alert')).toContainText('valid math problem');
      await audit(page, `solver with validation error (${scheme})`);

      await page.getByRole('button', { name: 'Symbols' }).click();
      await page.locator('#problem').fill('x^2 - 4*x + 3');
      await audit(page, `solver with the symbol strip open and a preview (${scheme})`);
      await page.getByRole('button', { name: 'Notation guide' }).click();
      await expect(page.getByRole('dialog', { name: 'Notation guide' })).toBeVisible();
      await audit(page, `solver with the notation guide open (${scheme})`);
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Solve Problem' }).click();
      await expect(page.locator('[aria-label="Solution"]')).toContainText('Final Answer:');
      await expect(page.getByRole('group', { name: 'Graph view controls' })).toBeVisible();
      await audit(page, `solver with solution and graph (${scheme})`);

      // A routed solve: the "Solved as Derivatives" notice and its button.
      await page.locator('#problem').fill('derivative of x^3');
      await page.getByRole('button', { name: 'Solve Problem' }).click();
      await expect(page.getByRole('button', { name: 'Switch topic to Derivatives' })).toBeVisible();
      await audit(page, `solver with a routed solution (${scheme})`);
      // Under Auto-detect: the "Detected as" notice.
      await page.getByRole('combobox').first().click();
      await page.getByRole('option', { name: 'Auto-detect' }).click();
      await page.getByRole('button', { name: 'Solve Problem' }).click();
      await expect(page.locator('[aria-label="Solution"]')).toContainText('Detected as Derivatives.');
      await audit(page, `solver with an auto-detected solution (${scheme})`);

      // While solving: the Cancel button and the spinner. (The outline Cancel
      // text was black on the dark card until 1.52.4; no audit ran mid-solve.)
      // This integral runs to the 10-second budget, so the state holds. (Not
      // (x+1)/((x-1)^2*(x^2+1)) any more: since 1.53.1 that solves in under a
      // second, by partial fractions.)
      await page.locator('#problem').fill('∫ 1/(x^6+x+1) dx');
      await page.getByRole('button', { name: 'Solve Problem' }).click();
      await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
      await audit(page, `solver while solving (${scheme})`);
      await page.getByRole('button', { name: 'Cancel' }).click();
    });
  });
}

// 1.53.0: the example buttons, tips, mistakes and the history list are
// typeset. What a screen reader gets for typeset maths is KaTeX's MathML;
// its visual HTML is aria-hidden. axe does not check any of this.
test.describe('typeset maths for screen readers', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('solutionMode', 'all'));
  });

  test('every typeset run is MathML to assistive tech, buttons are named by what they type, and steps and history are lists', async ({ page }) => {
    await page.goto('/solver');
    await page.getByText('Try an example:').waitFor();
    const more = page.getByRole('button', { name: /Show all \d+ examples/ });
    if (await more.isVisible()) await more.click();
    // An example button's name is the typed problem, not flattened MathML.
    const example = page.getByRole('button', { name: 'Algebra: 2*x + 5 = 11', exact: true });
    await expect(example.locator('math')).toHaveCount(1);
    await example.click();
    await page.getByRole('button', { name: 'Solve Problem' }).click();
    const solution = page.locator('[aria-label="Solution"]');
    await expect(solution).toContainText('Final Answer:');
    // The steps are an ordered list, one item per step.
    const steps = solution.getByRole('list').first();
    await expect(steps.getByRole('listitem').first()).toBeVisible();
    // Every KaTeX run on the page: visual HTML hidden, MathML present.
    const runs = await page.locator('.katex').evaluateAll((els) => els.map((e) => ({
      mathml: !!e.querySelector('.katex-mathml math'),
      hidden: e.querySelector('.katex-html')?.getAttribute('aria-hidden') === 'true',
    })));
    expect(runs.length).toBeGreaterThan(5);
    expect(runs.filter((r) => !r.mathml || !r.hidden)).toEqual([]);
    // A tip's formula is typeset too (Key Insights).
    await page.locator('#problem').fill('x^2 - 5x + 6 = 0');
    await page.getByRole('button', { name: 'Solve Problem' }).click();
    const insights = solution.locator('h3:has-text("Key Insights") + div');
    await expect(insights.locator('math').first()).toBeAttached();
    // History: a list, each problem typeset.
    await page.goto('/progress');
    const history = page.getByRole('list').filter({ has: page.locator('math') });
    await expect(history.getByRole('listitem')).toHaveCount(2);
    await expect(history.locator('.katex-html[aria-hidden="true"]').first()).toBeAttached();
  });

  for (const scheme of ['light', 'dark']) {
    test(`/progress with history has no WCAG A/AA violations (${scheme})`, async ({ page }) => {
      await page.addInitScript((dark) => localStorage.setItem('darkMode', String(dark)), scheme === 'dark');
      await page.goto('/solver');
      for (const p of ['x^2 - 5x + 6 = 0', 'derivative of x^3']) {
        await page.locator('#problem').fill(p);
        await page.getByRole('button', { name: 'Solve Problem' }).click();
        await expect(page.locator('[aria-label="Solution"]')).toContainText('Final Answer:');
      }
      await page.goto('/progress');
      await expect(page.locator('main .katex').first()).toBeVisible();
      await audit(page, `/progress with history (${scheme})`);
    });
  }
});

// Nothing is announced twice (1.53.0). axe does not check this. Read from
// Chromium's accessibility tree, the data screen readers consume:
// - a control named by aria-label whose content is also exposed (the
//   typeset example buttons: "Algebra: 2*x + 5 = 11" and then the MathML);
// - a description that repeats the name (a title equal to the aria-label
//   becomes the description: "Zoom in, button, Zoom in");
// - an option list exposed twice.
async function doubleReads(page) {
  const cdp = await page.context().newCDPSession(page);
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));
  const val = (p) => (p && typeof p.value === 'string' ? p.value.trim() : '');
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const exposedText = (n) => {
    let found = false;
    const walk = (c) => {
      if (found) return;
      if (!c.ignored && ['StaticText', 'math', 'img', 'image'].includes(val(c.role)) && val(c.name)) { found = true; return; }
      (c.childIds || []).map((id) => byId.get(id)).filter(Boolean).forEach(walk);
    };
    (n.childIds || []).map((id) => byId.get(id)).filter(Boolean).forEach(walk);
    return found;
  };
  const out = [];
  for (const n of nodes) {
    if (n.ignored) continue;
    const role = val(n.role); const name = val(n.name); const desc = val(n.description);
    if (name && desc && norm(name) === norm(desc)) out.push(`${role} "${name}": its description repeats its name`);
    const byAriaLabel = (n.name?.sources || []).some((s) => s.type === 'attribute' && s.attribute === 'aria-label' && val(s.value) === name && !s.superseded);
    if (['button', 'link', 'option', 'menuitem'].includes(role) && byAriaLabel && exposedText(n)) out.push(`${role} "${name}": named by aria-label, and its content is exposed too`);
  }
  const options = nodes.filter((n) => !n.ignored && val(n.role) === 'option').map((n) => val(n.name));
  const twice = options.filter((o, i) => o && options.indexOf(o) !== i);
  if (twice.length) out.push(`options exposed twice: ${[...new Set(twice)].join(', ')}`);
  return [...new Set(out)];
}

test('nothing on the Solver or Settings is announced twice', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('solutionMode', 'all'));
  await page.goto('/solver');
  await page.getByText('Try an example:').waitFor();
  const more = page.getByRole('button', { name: /Show all \d+ examples/ });
  if (await more.isVisible()) await more.click();
  await page.getByRole('button', { name: 'Symbols' }).click();
  await page.getByRole('combobox').first().click();
  await expect(page.getByRole('option', { name: 'Functions' })).toBeVisible();
  expect(await doubleReads(page), 'topic list open').toEqual([]);
  await page.getByRole('option', { name: 'Functions' }).click();
  await page.locator('#problem').fill('x^2 - 4*x + 3');
  await page.getByRole('button', { name: 'Solve Problem' }).click();
  await expect(page.getByRole('group', { name: 'Graph view controls' })).toBeVisible();
  // The icon buttons keep a name (their tooltip) and are found by it.
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Insert a square root' })).toBeVisible();
  expect(await doubleReads(page), 'solver with symbols, examples, solution and graph').toEqual([]);
  await page.goto('/settings');
  await expect(page.getByRole('button', { name: 'Degrees' })).toBeVisible();
  expect(await doubleReads(page), 'settings').toEqual([]);
});
