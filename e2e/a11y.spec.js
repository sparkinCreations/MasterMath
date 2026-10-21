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
      await page.addInitScript((dark) => { localStorage.setItem('darkMode', String(dark)); }, scheme === 'dark');
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
      await page.getByRole('button', { name: 'Functions: x^2 - 4*x + 3' }).click();
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

    test('the solver with a validation error, and with a solution and graph', async ({ page }) => {
      await page.goto('/solver');
      await page.getByRole('button', { name: 'Algebra: 2*x + 5 = 11' }).click();
      await page.locator('#problem').fill('hello world');
      await page.getByRole('button', { name: 'Solve Problem' }).click();
      await expect(page.getByRole('alert')).toContainText('valid math problem');
      await audit(page, `solver with validation error (${scheme})`);

      await page.locator('#problem').fill('x^2 - 4*x + 3');
      await page.getByRole('button', { name: 'Solve Problem' }).click();
      await expect(page.locator('[aria-label="Solution"]')).toContainText('Final Answer:');
      await expect(page.getByRole('group', { name: 'Graph view controls' })).toBeVisible();
      await audit(page, `solver with solution and graph (${scheme})`);
    });
  });
}
