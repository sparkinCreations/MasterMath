// Smoke test of the built app in a real browser. Each test fails on any
// uncaught page error or error-boundary render, not just on its own
// assertions — that is how the September 2026 graph crash would have been
// caught. See playwright.config.js for why this exists.

import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

// One example per topic, as the Solver page lists them.
const EXAMPLES = [
  { label: 'Derivatives: x^2 + 3*x', answer: /2x \+ 3/, graph: true },
  { label: 'Integrals: ∫_0^1 x^2 dx', answer: /0.3333/, graph: true }, // KaTeX stacks 1/3; the decimal is plain text
  { label: 'Limits: lim x->0 (sin(x)/x)', answer: /= 1/, graph: true },
  { label: 'Functions: x^2 - 4*x + 3', answer: /x\^2 - 4x \+ 3/, graph: true },
  { label: 'Algebra: 2*x + 5 = 11', answer: /x = 3/, graph: true },
  { label: 'Trigonometry: sin(x) = 1/2', answer: /π\/6/, graph: true },
  { label: 'Arithmetic: (5 + 3) * 4 - 2^3', answer: /24/, graph: false },
];

const HEAVY_CHUNK = /\/assets\/(mathjs|algebrite|charts|pdf|html2canvas|purify|shared)-/;

// Fail the test on anything the app would show its "Something went wrong"
// boundary for, and on any uncaught exception. Solver-level console.error
// lines ("Integral solver error: …") are expected on refusals and ignored.
function armErrorCapture(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && /caught by boundary/i.test(msg.text())) errors.push(`boundary: ${msg.text()}`);
  });
  return errors;
}

async function openSolver(page) {
  await page.goto('/solver');
  await expect(page.getByRole('button', { name: 'Solve Problem' })).toBeVisible();
}

async function solveExample(page, label) {
  await page.getByRole('button', { name: label }).click();
  await page.getByRole('button', { name: 'Solve Problem' }).click();
  const solution = page.locator('[aria-label="Solution"]');
  // 'Final Answer:' is the label; a step may also say 'Final answer: 24'.
  await expect(solution).toContainText('Final Answer:');
  return solution;
}

test.describe('MasterMath smoke', () => {
  let errors;
  test.beforeEach(async ({ page }) => {
    errors = armErrorCapture(page);
  });
  test.afterEach(async () => {
    expect(errors, 'the page raised an error or rendered the error boundary').toEqual([]);
  });

  test('landing page renders once, shows the release version, and preloads no solver library', async ({ page }) => {
    // A first visit installs the service worker; it must not reload the page
    // when the worker claims it (it did until v1.34.1).
    let loads = 0;
    page.on('load', () => { loads += 1; });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Welcome to MasterMath/ })).toBeVisible();
    await expect(page.getByText(`v${pkg.version}`)).toBeVisible();
    const preloads = await page.locator('link[rel="modulepreload"]').evaluateAll((links) => links.map((l) => l.getAttribute('href')));
    expect(preloads.length).toBeGreaterThan(0);
    expect(preloads.filter((h) => HEAVY_CHUNK.test(h))).toEqual([]);
    // Nothing heavy was fetched either, whatever the preload tags say.
    const fetched = await page.evaluate(() => performance.getEntriesByType('resource').map((r) => r.name));
    expect(fetched.filter((h) => HEAVY_CHUNK.test(h))).toEqual([]);
    await page.waitForTimeout(3000);
    expect(loads, 'the first visit reloaded itself').toBe(1);
  });

  for (const ex of EXAMPLES) {
    test(`solves the ${ex.label.split(':')[0]} example`, async ({ page }) => {
      await openSolver(page);
      const solution = await solveExample(page, ex.label);
      await expect(solution).toContainText('Solved');
      await expect(solution).toContainText(ex.answer);
      if (ex.graph) {
        // A drawn graph is an SVG inside the labelled chart wrapper; the
        // September 2026 chunk-cycle crash died exactly here.
        await expect(page.locator('[role="img"][aria-label] svg.recharts-surface').first()).toBeVisible();
      }
    });
  }

  test('an unsupported problem is refused honestly and is not saved to history', async ({ page }) => {
    await openSolver(page);
    await page.getByRole('button', { name: 'Integrals: 2*x + 1' }).click();
    await page.getByLabel('Enter your problem').fill('sin(x^2)');
    await page.getByRole('button', { name: 'Solve Problem' }).click();
    const solution = page.locator('[aria-label="Solution"]');
    await expect(solution).toContainText('Beyond this solver');
    await page.goto('/progress');
    await expect(page.getByText('Total Problems')).toBeVisible();
    await expect(page.getByText('Total Problems').locator('..').locator('..')).toContainText('0');
    await expect(page.getByText('sin(x^2)', { exact: true })).toHaveCount(0);
  });

  test('a solve lands in Progress with the right count, and Clear History empties it', async ({ page }) => {
    await openSolver(page);
    await solveExample(page, 'Algebra: 2*x + 5 = 11');
    await page.goto('/progress');
    await expect(page.getByText('2*x + 5 = 11', { exact: true })).toBeVisible();
    const totalCard = page.getByText('Total Problems').locator('..').locator('..');
    await expect(totalCard).toContainText('1');
    await page.getByRole('button', { name: /Clear History/ }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByText('2*x + 5 = 11', { exact: true })).toHaveCount(0);
  });

  test('dark mode toggles, survives a reload, and the solver still renders in it', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Switch to dark mode/ }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await openSolver(page);
    await solveExample(page, 'Functions: x^2 - 4*x + 3');
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('every page is reachable from the sidebar and an unknown URL goes home', async ({ page }) => {
    await page.goto('/');
    for (const [path, heading] of [
      ['/solver', /Master Some Math/],
      ['/progress', /Learning Journey/],
      ['/usermanual', /User Manual|Manual/],
      ['/faq', /Frequently Asked|FAQ/],
      ['/settings', /Settings/],
    ]) {
      // The sidebar starts collapsed (and inert); open it for each hop, since
      // following a link closes it again.
      await page.getByRole('button', { name: /Open navigation menu/ }).click();
      await page.locator(`a[href="${path}"]`).first().click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.locator('main')).toContainText(heading);
    }
    await page.goto('/this-page-does-not-exist');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: /Welcome to MasterMath/ })).toBeVisible();
  });

  test('on a phone, an example brings the textarea back and Solve brings the solution into view', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'phone', 'phone layout only');
    await openSolver(page);
    const textarea = page.getByLabel('Enter your problem');
    const example = page.getByRole('button', { name: 'Functions: x^2 - 4*x + 3' });
    await example.scrollIntoViewIfNeeded();
    await expect(textarea).not.toBeInViewport();
    await example.click();
    await expect(textarea).toBeFocused();
    await expect(textarea).toBeInViewport();
    await page.getByRole('button', { name: 'Solve Problem' }).click();
    const solution = page.locator('[aria-label="Solution"]');
    await expect(solution).toContainText('Final Answer:');
    await expect(solution).toBeFocused();
    await expect(solution).toBeInViewport();
  });
});
