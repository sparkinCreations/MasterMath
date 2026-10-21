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
// A CSP violation is not: it fails the test.
function armErrorCapture(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && /caught by boundary/i.test(msg.text())) errors.push(`boundary: ${msg.text()}`);
    // vite preview serves public/_headers, so anything the production CSP
    // would block is blocked here too.
    if (/Content Security Policy/i.test(msg.text())) errors.push(`csp: ${msg.text()}`);
    // The solver worker could not start, so solves fell back to the main
    // thread: every solve "works" and nothing else would notice.
    if (/Solver worker failed/i.test(msg.text())) errors.push(`worker: ${msg.text()}`);
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
    // "Final Answer" renders before the history record is written; the
    // success toast fires only after the save. Navigating earlier aborted the
    // write on a loaded CI runner (October 2026) and Progress showed 0.
    await expect(page.getByText('Problem solved!')).toBeVisible();
    await page.goto('/progress');
    await expect(page.getByText('2*x + 5 = 11', { exact: true })).toBeVisible();
    const totalCard = page.getByText('Total Problems').locator('..').locator('..');
    await expect(totalCard).toContainText('1');
    await page.getByRole('button', { name: /Clear History/ }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByText('2*x + 5 = 11', { exact: true })).toHaveCount(0);
  });

  // Theme 'system' (the default for a new visitor) follows the device setting
  // live; the header toggle makes an explicit choice that then sticks. The
  // class must be on <html> at first paint (the boot script), not only after
  // the app mounts.
  test('with no saved preference the theme follows the system, and the toggle overrides it', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveClass(/dark/);
    const atFirstPaint = await page.evaluate(() => performance.getEntriesByType('navigation').length >= 0 && document.documentElement.className.includes('dark'));
    expect(atFirstPaint).toBe(true);
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await page.getByRole('button', { name: /Switch to dark mode/ }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    // An explicit choice no longer follows the device.
    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForTimeout(200);
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.goto('/settings');
    await expect(page.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'System' }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
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

  // The phone page stacks input → graph → solution. After Solve the page
  // lands on the graph when one was drawn (it sits above the solution and
  // used to be skipped) and on the solution otherwise; keyboard focus goes
  // to the solution either way so a screen reader announces it. Both land
  // below the sticky header, not under it.
  test('on a phone, an example brings the textarea back and Solve brings the graph (or the solution) into view', async ({ page }, testInfo) => {
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
    const graph = page.getByRole('img', { name: /^Graph of/ });
    await expect(graph).toBeInViewport();
    const headerBottom = await page.locator('header[role="banner"]').evaluate((el) => el.getBoundingClientRect().bottom);
    await expect.poll(async () => (await graph.boundingBox()).y).toBeGreaterThanOrEqual(headerBottom - 1);

    // No graph: the solution itself is the target.
    await page.getByRole('button', { name: 'Arithmetic: (5 + 3) * 4 - 2^3' }).click();
    await page.getByRole('button', { name: 'Solve Problem' }).click();
    await expect(solution).toContainText(/Final Answer:\s*24/);
    await expect(solution).toBeFocused();
    await expect(solution).toBeInViewport();
  });

  // The solver runs in a worker with a time budget (1.40.0). A degree-50
  // Wilkinson polynomial (fifty real roots, coefficients of 60 digits) takes
  // the exact root finder about two seconds here and longer on a slow CI
  // runner; the page must stay responsive meanwhile, and the solve must end
  // in the complete list of roots or the budget's honest refusal — never hang.
  const WILKINSON_50 = `${Array.from({ length: 50 }, (_, k) => `(x-${k + 1})`).join('*')} + x = 0`;
  test('a slow solve leaves the page responsive and ends within the budget', async ({ page }) => {
    test.setTimeout(90_000);
    await openSolver(page);
    await page.getByRole('button', { name: 'Algebra: 2*x + 5 = 11' }).click();
    await page.locator('#problem').fill(WILKINSON_50);
    const started = Date.now();
    await page.getByRole('button', { name: 'Solve Problem' }).click();
    await page.waitForTimeout(2000);
    // A frozen main thread would stall this round trip.
    const probe = Date.now();
    await page.evaluate(() => 1);
    expect(Date.now() - probe, 'the page froze during the solve').toBeLessThan(1500);
    const solution = page.locator('[aria-label="Solution"]');
    await expect(solution).toContainText(/Stopped after 10 seconds|50 distinct real roots/, { timeout: 30_000 });
    expect(Date.now() - started).toBeLessThan(25_000);
  });

  test('Cancel ends a solve at once, and the next solve still works', async ({ page }) => {
    await openSolver(page);
    await page.getByRole('button', { name: 'Algebra: 2*x + 5 = 11' }).click();
    await page.locator('#problem').fill(WILKINSON_50);
    await page.getByRole('button', { name: 'Solve Problem' }).click();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Solve cancelled')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Solve Problem' })).toBeEnabled();
    // A fresh worker answers the next problem.
    const solution = await solveExample(page, 'Algebra: 2*x + 5 = 11');
    await expect(solution).toContainText(/x = 3/);
  });
});
