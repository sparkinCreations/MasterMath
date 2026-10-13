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

async function audit(page, label) {
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
