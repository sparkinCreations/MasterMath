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
  { label: 'Functions: x^2 - 4*x + 3', answer: /domain: all real numbers; range: y ≥ -1/, graph: true }, // the function itself is typeset (x^{2} in the MathML), the summary is plain text
  { label: 'Algebra: 2*x + 5 = 11', answer: /x = 3/, graph: true },
  { label: 'Trigonometry: sin(x) = 1/2', answer: /π\/6/, graph: true },
  { label: 'Arithmetic: (5 + 3) * 4 - 2^3', answer: /24/, graph: false },
];

const HEAVY_CHUNK = /\/assets\/(mathjs|algebrite|charts|pdf|html2canvas|purify|shared|katex)-/;

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

// On a phone only the first four example cards show; the rest open with
// "Show all N examples".
async function pickExample(page, label) {
  // isVisible() does not wait, and a role query never finds a display:none
  // card, so wait for the examples heading before deciding.
  await page.getByText('Try an example:').waitFor();
  const button = page.getByRole('button', { name: label });
  if (!(await button.isVisible())) await page.getByRole('button', { name: /Show all \d+ examples/ }).click();
  await button.click();
}

async function solveExample(page, label) {
  await pickExample(page, label);
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
    // Step-through is the default for a new visitor; most tests want the
    // whole solution at once. The one test of the default opts out.
    await page.addInitScript(() => {
      try { if (!sessionStorage.getItem('e2e-keep-default-mode') && !localStorage.getItem('solutionMode')) localStorage.setItem('solutionMode', 'all'); } catch { /* no storage */ }
    });
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
    await expect(page.getByRole('heading', { name: /See the method, not just the answer/ })).toBeVisible();
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
    await pickExample(page, 'Integrals: 2*x + 1');
    await page.getByLabel('Enter your problem').fill('sin(x^2)');
    await page.getByRole('button', { name: 'Solve Problem' }).click();
    const solution = page.locator('[aria-label="Solution"]');
    await expect(solution).toContainText('Beyond this solver');
    await page.goto('/progress');
    await expect(page.getByText('Problems Worked Through', { exact: true })).toBeVisible();
    await expect(page.getByText('Problems Worked Through', { exact: true }).locator('..').locator('..')).toContainText('0');
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
    const totalCard = page.getByText('Problems Worked Through', { exact: true }).locator('..').locator('..');
    await expect(totalCard).toContainText('1');
    await page.getByRole('button', { name: /Clear History/ }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByText('2*x + 5 = 11', { exact: true })).toHaveCount(0);
  });

  // Two quick solves leave one outcome toast, not a stack; a history entry
  // reopens in the Solver with its saved solution (1.58.0).
  test('solve toasts replace each other, and Open in Solver brings a history entry back', async ({ page }) => {
    await openSolver(page);
    for (const p of ['x + 1 = 2', '2*x + 5 = 11']) {
      await page.locator('#problem').fill(p);
      await page.getByRole('button', { name: 'Solve Problem' }).click();
      await expect(page.locator('[aria-label="Solution"]')).toContainText('Final Answer:');
      await expect(page.getByText('Problem solved!')).toBeVisible();
    }
    await expect(page.getByText('Problem solved!')).toHaveCount(1);
    await page.goto('/progress');
    await page.getByRole('link', { name: /Open in Solver: 2\*x \+ 5 = 11/ }).click();
    await expect(page).toHaveURL(/\/solver$/);
    await expect(page.locator('#problem')).toHaveValue('2*x + 5 = 11');
    await expect(page.locator('[aria-label="Solution"]')).toContainText('Final Answer:');
    await expect(page.locator('[aria-label="Solution"]')).toContainText('x = 3');
    // Reopening is not a solve: the entry is not counted again.
    await page.goto('/progress');
    await expect(page.getByText(/Solved \d+ times/)).toHaveCount(0);
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

  test('a new visitor steps through the solution, and Show all is remembered', async ({ page }) => {
    await page.addInitScript(() => { try { sessionStorage.setItem('e2e-keep-default-mode', '1'); } catch { /* no storage */ } });
    await openSolver(page);
    // Init scripts run in registration order, so the suite's "Show all"
    // script ran before this test's opt-out on the first load; clear what it
    // wrote and load again as a true first visit.
    await page.evaluate(() => localStorage.removeItem('solutionMode'));
    await page.reload();
    await expect(page.getByRole('button', { name: 'Solve Problem' })).toBeVisible();
    await pickExample(page, 'Algebra: 2*x + 5 = 11');
    await page.getByRole('button', { name: 'Solve Problem' }).click();
    const solution = page.locator('[aria-label="Solution"]');
    await expect(page.getByRole('button', { name: 'Step through' })).toHaveAttribute('aria-pressed', 'true');
    await expect(solution).toContainText(/Step 1 of \d+/);
    await expect(solution).not.toContainText('Final Answer:');
    await page.getByRole('button', { name: 'Show all', exact: true }).click();
    await expect(solution).toContainText('Final Answer:');
    await page.reload();
    await pickExample(page, 'Algebra: 2*x + 5 = 11');
    await page.getByRole('button', { name: 'Solve Problem' }).click();
    await expect(page.getByRole('button', { name: 'Show all', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(solution).toContainText('Final Answer:');
  });

  test('the solver opens on a topic, remembers it, explains a disabled Solve, and shows a notation hint', async ({ page }) => {
    await openSolver(page);
    // A new visitor starts on Auto-detect (1.53.0).
    await expect(page.getByRole('combobox').first()).toContainText('Auto-detect');
    await expect(page.getByRole('button', { name: 'Solve Problem' })).toBeDisabled();
    await expect(page.getByText('Type a problem above, or pick an example below, to enable Solve.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Notation guide' })).toBeVisible();
    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Integrals' }).click();
    await page.reload();
    await expect(page.getByRole('combobox').first()).toContainText('Integrals');
    // The guide opens as a dialog, closes on Escape, and links to the manual.
    await page.getByRole('button', { name: 'Notation guide' }).click();
    const dialog = page.getByRole('dialog', { name: 'Notation guide' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('lim x->0 (sin(x)/x)');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Notation guide' })).toBeFocused();
    await page.getByRole('button', { name: 'Notation guide' }).click();
    await page.getByRole('link', { name: /full guide in the User Manual/ }).click();
    await expect(page).toHaveURL(/usermanual#entering-your-problem/);
    await expect(page.getByRole('heading', { name: 'Step 2: Enter Your Problem' })).toBeInViewport();
  });

  test('a validation error clears the previous answer and graph', async ({ page }) => {
    await openSolver(page);
    const solution = await solveExample(page, 'Algebra: 2*x + 5 = 11');
    await expect(page.locator('[role="img"][aria-label] svg.recharts-surface').first()).toBeVisible();
    await page.locator('#problem').fill('hello world');
    await page.getByRole('button', { name: 'Solve Problem' }).click();
    await expect(page.getByRole('alert')).toContainText('valid math problem');
    await expect(solution).not.toContainText('Final Answer:');
    await expect(page.getByRole('heading', { name: 'Graph View' })).toBeVisible();
  });

  test('an answer goes away once the input or the topic no longer matches it', async ({ page }) => {
    await openSolver(page);
    const solution = await solveExample(page, 'Algebra: 2*x + 5 = 11');
    // A stray space is the same problem: the answer stays.
    await page.locator('#problem').fill('2*x + 5 = 11 ');
    await expect(solution).toContainText('Final Answer:');
    // A different problem: the old steps and graph would read as its answer.
    await page.locator('#problem').fill('2*x + 5 = 13');
    await expect(solution).not.toContainText('Final Answer:');
    await expect(page.getByRole('heading', { name: 'Graph View' })).toBeVisible();
    // Solve again, then change only the topic.
    await page.getByRole('button', { name: 'Solve Problem' }).click();
    await expect(solution).toContainText('Final Answer:');
    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Functions' }).click();
    await expect(solution).not.toContainText('Final Answer:');
  });

  test('the topic list closes on a tap outside it', async ({ page }) => {
    await openSolver(page);
    await page.getByRole('combobox').first().click();
    await expect(page.getByRole('option', { name: 'Limits' })).toBeVisible();
    // A pointerdown on blank page, as a touch screen delivers it (no focus change).
    await page.locator('h1').dispatchEvent('pointerdown', { bubbles: true });
    await expect(page.getByRole('option', { name: 'Limits' })).toHaveCount(0);
  });

  test('a bare expression under Algebra offers to differentiate, integrate or analyse it', async ({ page }) => {
    await openSolver(page);
    await page.locator('#problem').fill('x^2 + 3x');
    await page.getByRole('button', { name: 'Solve Problem' }).click();
    await expect(page.getByRole('note')).toContainText('looks like an expression');
    await page.getByRole('button', { name: 'Differentiate it' }).click();
    await expect(page.getByRole('combobox').first()).toContainText('Derivatives');
    await expect(page.locator('[aria-label="Solution"]')).toContainText(/2x \+ 3/);
    await expect(page.getByRole('note')).toHaveCount(0);
  });

  test('↑ recalls each past problem once, ↓ steps back, and a new solve clears the last error toast', async ({ page }) => {
    await openSolver(page);
    for (const p of ['x + 1 = 2', 'x + 2 = 5']) {
      await page.locator('#problem').fill(p);
      await page.getByRole('button', { name: 'Solve Problem' }).click();
      await expect(page.locator('[aria-label="Solution"]')).toContainText('Final Answer:');
      await page.getByRole('button', { name: 'Close notification' }).first().click();
    }
    await page.locator('#problem').fill('');
    await page.locator('#problem').focus();
    const values = [];
    for (let i = 0; i < 3; i += 1) { await page.keyboard.press('ArrowUp'); values.push(await page.locator('#problem').inputValue()); }
    expect(values).toEqual(['x + 2 = 5', 'x + 1 = 2', 'x + 1 = 2']);
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('#problem')).toHaveValue('x + 2 = 5');
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('#problem')).toHaveValue('');
    await expect(page.getByRole('combobox').first()).toContainText('Auto-detect');
    // A parse error leaves a red toast that stays; the next solve clears it.
    // It is shown all at once — no step-through, no "Step 1 of 2" over an
    // error — and the reason is said once, in the box.
    await page.locator('#problem').fill('sin()');
    await page.getByRole('button', { name: 'Solve Problem' }).click();
    await expect(page.getByText(/Couldn't read that input/)).toBeVisible();
    const notes = page.locator('[aria-label="Solution"]');
    await expect(notes).toContainText('Notes:');
    await expect(notes).toContainText('What went wrong:');
    await expect(notes).not.toContainText(/Step \d+ of \d+/);
    await expect(page.getByRole('button', { name: 'Reveal next step' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Step through' })).toHaveCount(0);
    expect(await notes.getByText(/has nothing inside it/).count()).toBe(1);
    await page.locator('#problem').fill('x + 3 = 4');
    await page.getByRole('button', { name: 'Solve Problem' }).click();
    await expect(page.getByText('Problem solved!')).toBeVisible();
    await expect(page.getByText(/Couldn't read that input/)).toHaveCount(0);
  });

  test('a differential equation and a matrix are refused honestly', async ({ page }) => {
    await openSolver(page);
    await page.locator('#problem').fill("y'' + y = 0");
    await page.getByRole('button', { name: 'Solve Problem' }).click();
    await expect(page.locator('[aria-label="Solution"]')).toContainText('Differential equations are not supported');
    await expect(page.getByText('Problem solved!')).toHaveCount(0);
    await page.locator('#problem').fill('determinant of [[1,2],[3,4]]');
    await page.getByRole('button', { name: 'Solve Problem' }).click();
    await expect(page.locator('[aria-label="Solution"]')).toContainText(/matrices are not supported yet/i);
  });

  test('on a phone four example cards show and the rest open on demand', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phone layout only');
    await openSolver(page);
    // Easiest first: the four that show are arithmetic and precalculus.
    await expect(page.getByRole('button', { name: 'Arithmetic: (5 + 3) * 4 - 2^3' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Derivatives: x^2 + 3*x' })).toBeHidden();
    await page.getByRole('button', { name: /Show all \d+ examples/ }).click();
    await expect(page.getByRole('button', { name: 'Derivatives: x^2 + 3*x' })).toBeVisible();
    await page.getByRole('button', { name: 'Fewer examples' }).click();
    await expect(page.getByRole('button', { name: 'Derivatives: x^2 + 3*x' })).toBeHidden();
  });

  test('the Symbols strip inserts at the caret, previews the typed math, and remembers being open', async ({ page }) => {
    await openSolver(page);
    await expect(page.locator('#symbol-strip')).toHaveCount(0);
    await page.getByRole('button', { name: 'Symbols' }).click();
    await expect(page.getByRole('group', { name: 'Insert a math symbol' })).toBeVisible();
    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Algebra' }).click();
    // The topic picks the group; every group stays a tap away.
    await expect(page.getByRole('button', { name: 'Algebra', pressed: true })).toBeVisible();
    await page.getByRole('button', { name: 'Calculus' }).click();
    await expect(page.getByRole('button', { name: 'Insert an indefinite integral' })).toBeVisible();
    await page.getByRole('button', { name: 'Basic' }).click();
    await page.locator('#problem').click();
    await page.getByRole('button', { name: 'Insert plus' }).click();
    await expect(page.locator('#problem')).toHaveValue(' + ');
    // Clear empties the box and keeps the topic.
    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(page.locator('#problem')).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Clear' })).toHaveCount(0);
    await expect(page.getByRole('combobox').first()).toContainText('Algebra');
    await page.getByRole('button', { name: 'Insert a square root' }).click();
    // The caret is inside the parentheses, so typing continues there.
    await page.keyboard.type('x+1');
    // Move the caret past the closing parenthesis. Not with the End key:
    // under Playwright's Chromium on macOS, End scrolls the textarea and
    // leaves the caret where it was, so " = 3" landed inside the radical and
    // the suite failed on every Mac while passing on Linux CI.
    await page.locator('#problem').evaluate((el) => el.setSelectionRange(el.value.length, el.value.length));
    await page.keyboard.type(' = 3');
    await expect(page.locator('#problem')).toHaveValue('√(x+1) = 3');
    // The preview typesets it (a KaTeX radical), and the problem solves.
    await expect(page.locator('.katex .sqrt').first()).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('[aria-label="Solution"]')).toContainText('x = 8');
    await page.reload();
    await expect(page.getByRole('group', { name: 'Insert a math symbol' })).toBeVisible();
    await page.getByRole('button', { name: 'Symbols' }).click();
    await expect(page.locator('#symbol-strip')).toHaveCount(0);
  });

  test('the keypad types at the caret, keeps the phone keyboard closed, and remembers its state', async ({ page, isMobile }) => {
    await openSolver(page);
    const keypad = page.getByRole('group', { name: 'Keypad' });
    const box = page.locator('#problem');
    // Open on a phone (the main pointer is a finger), closed with a mouse.
    if (isMobile) {
      await expect(keypad).toBeVisible();
    } else {
      await expect(keypad).toHaveCount(0);
      await expect(box).not.toHaveAttribute('inputmode', 'none');
      await page.getByRole('button', { name: 'Keypad' }).click();
      await expect(keypad).toBeVisible();
    }
    await expect(page.getByRole('button', { name: 'Keypad' })).toHaveAttribute('aria-expanded', 'true');
    await expect(box).toHaveAttribute('inputmode', 'none');
    const press = async (name) => keypad.getByRole('button', { name, exact: true }).click();
    for (const name of ['3', 'x', 'To the power', '2', 'Minus', '5', 'x', 'Plus', '2', 'Equals', '0']) await press(name);
    await expect(box).toHaveValue('3x^2 - 5x + 2 = 0');
    // Backspace takes " = " whole; the arrows move the caret, and typing
    // lands there.
    await press('Backspace');
    await press('Backspace');
    await expect(box).toHaveValue('3x^2 - 5x + 2');
    await press('Move left');
    await press('Move left');
    await press('Move left');
    await press('Move left');
    await press('Backspace');
    await expect(box).toHaveValue('3x^2 - 5 + 2');
    await press('x');
    for (let i = 0; i < 4; i += 1) await press('Move right');
    await press('Equals');
    await press('0');
    await expect(box).toHaveValue('3x^2 - 5x + 2 = 0');
    await expect(page.locator('.katex').first()).toBeVisible();
    await page.getByRole('button', { name: 'Solve Problem' }).click();
    await expect(page.locator('[aria-label="Solution"]')).toContainText('Final Answer:');
    // Closed, the phone keyboard is back, and it stays closed after a reload.
    await page.getByRole('button', { name: 'Keypad' }).click();
    await expect(keypad).toHaveCount(0);
    await expect(box).not.toHaveAttribute('inputmode', 'none');
    await page.reload();
    await expect(page.getByText('Try an example:')).toBeVisible();
    await expect(keypad).toHaveCount(0);
  });

  test('practice: a similar problem, checked by maths, with hints, another one and the example', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('solutionMode', 'all'));
    await openSolver(page);
    await page.locator('#problem').fill('x^2-5x+6=0');
    await page.getByRole('button', { name: 'Solve Problem' }).click();
    const tryIt = page.getByRole('button', { name: 'Try a similar one' });
    await tryIt.click();
    const dialog = page.getByRole('dialog', { name: 'Practice' });
    // The set is the same for every student: the first is x² − 11x + 28 = 0.
    await expect(dialog.locator('.katex-mathml annotation').first()).toHaveText('x^{2} - 11x + 28 = 0', { timeout: 20000 });
    const answer = dialog.getByLabel('Your answer');
    await expect(answer).toBeFocused();
    await answer.fill('4');
    await dialog.getByRole('button', { name: 'Check' }).click();
    await expect(dialog.getByText('That one is right, but there is one more solution.')).toBeVisible();
    await answer.fill('5, 7');
    await answer.press('Enter');
    await expect(dialog.getByText('x = 5 does not satisfy the equation: there the left side is -2 and the right side is 0.')).toBeVisible();
    await answer.fill('x = 7 or x = 4');
    await answer.press('Enter');
    await expect(dialog.getByText('Correct ✓')).toBeVisible();
    await expect(dialog.getByText('1 correct')).toBeVisible();
    // One step at a time, then everything.
    await dialog.getByRole('button', { name: 'Hint' }).click();
    await expect(dialog.getByRole('heading', { name: /^Step 1 of \d+$/ })).toBeVisible();
    await dialog.getByRole('button', { name: 'Show solution' }).click();
    await expect(dialog.getByRole('heading', { name: 'Solution' })).toBeVisible();
    // The worked example it came from.
    await dialog.getByRole('button', { name: 'Look at the example' }).click();
    const example = dialog.locator('[id$="-example"]');
    await expect(example).toBeVisible();
    expect(await example.locator('ol > li').count()).toBeGreaterThan(2);
    // The next problem, a new answer box.
    await expect(dialog.getByRole('button', { name: 'Another one' })).toBeVisible({ timeout: 20000 });
    await dialog.getByRole('button', { name: 'Another one' }).click();
    await expect(dialog.getByText(/^Problem 2 of/)).toBeVisible();
    await expect(answer).toHaveValue('');
    // A derivative: any equal form is right.
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(tryIt).toBeFocused();
    await page.locator('#problem').fill('d/dx x^3');
    await page.getByRole('button', { name: 'Solve Problem' }).click();
    await page.getByRole('button', { name: 'Try a similar one' }).click();
    await expect(dialog.locator('.katex-mathml annotation').first()).toHaveText('\\frac{d}{dx} x^{4}', { timeout: 20000 });
    await answer.fill('x^3*4');
    await answer.press('Enter');
    await expect(dialog.getByText('Correct ✓')).toBeVisible();
    await dialog.getByRole('button', { name: 'Close practice' }).click();
    await expect(dialog).toHaveCount(0);
    // An inequality: a solution set, in either notation, with what it asks for.
    await page.locator('#problem').fill('x^2 - 4 > 0');
    await page.getByRole('button', { name: 'Solve Problem' }).click();
    await page.getByRole('button', { name: 'Try a similar one' }).click();
    await expect(dialog.locator('.katex-mathml annotation').first()).toHaveText('x^{2} - 16 > 0', { timeout: 20000 });
    await expect(dialog.getByText('Give the solution set.')).toBeVisible();
    await answer.fill('x > 4');
    await answer.press('Enter');
    await expect(dialog.getByText('x = -5 satisfies the inequality, but your answer leaves it out.')).toBeVisible();
    await answer.fill('(-inf, -4) U (4, inf)');
    await answer.press('Enter');
    await expect(dialog.getByText('Correct ✓')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('the home page plays a real recording of the solver, which pauses, and is a still under reduced motion', async ({ page, browser }) => {
    await page.goto('/');
    const video = page.locator('figure video');
    await expect(video).toHaveAttribute('poster', '/hero/solve-light-poster.webp');
    await expect(page.locator('figcaption')).toHaveText('A real recording of the solver.');
    // It plays (muted, looping), and the button pauses and resumes it.
    await expect.poll(() => video.evaluate((v) => v.muted && v.loop && !v.paused && v.currentTime > 0), { timeout: 10000 }).toBe(true);
    const src = await video.evaluate((v) => v.currentSrc);
    expect(src).toMatch(/\/hero\/solve-light-(1600|800)\.(webm|mp4)$/);
    await page.getByRole('button', { name: 'Pause the demonstration' }).click();
    await expect.poll(() => video.evaluate((v) => v.paused)).toBe(true);
    await page.getByRole('button', { name: 'Play the demonstration' }).click();
    await expect.poll(() => video.evaluate((v) => v.paused)).toBe(false);
    // Reduced motion: the solved frame alone, no video downloaded.
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const still = await ctx.newPage();
    const videoRequests = [];
    still.on('request', (r) => { if (/\.(webm|mp4)$/.test(r.url())) videoRequests.push(r.url()); });
    await still.goto(page.url());
    await expect(still.locator('figure img[src="/hero/solve-light-poster.webp"]')).toBeVisible();
    await expect(still.locator('figure video')).toHaveCount(0);
    expect(videoRequests).toEqual([]);
    await ctx.close();
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

  // What the solver understood is shown before the first step (1.58.0).
  test('an integral shows what it read, in textbook form, above the steps', async ({ page }) => {
    await openSolver(page);
    await page.locator('#problem').fill('∫ sec³x dx');
    await page.getByRole('button', { name: 'Solve Problem' }).click();
    const solution = page.locator('[aria-label="Solution"]');
    await expect(solution).toContainText('Read as:');
    await expect(solution).toContainText('Final Answer:');
    await expect(solution).not.toContainText('sec*x');
  });

  // 1.60.0: the first three insights and mistakes, the rest one tap away;
  // a source under the insight that cites one; lessons elsewhere by topic.
  test('Show more reveals the rest of a list and folds it back, with sources and Learn more links', async ({ page }) => {
    await openSolver(page);
    await page.locator('#problem').fill('∫ x*e^x dx');
    await page.getByRole('button', { name: 'Solve Problem' }).click();
    const solution = page.locator('[aria-label="Solution"]');
    await expect(solution).toContainText('Final Answer:');
    const more = solution.getByRole('button', { name: /^Show \d+ more insights?$/ });
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    const list = page.locator(`[id="${await more.getAttribute('aria-controls')}"]`);
    await expect(list.locator(':scope > div')).toHaveCount(3);
    const label = await more.textContent();
    const total = 3 + Number(label.match(/\d+/)[0]);
    await more.click();
    await expect(list.locator(':scope > div')).toHaveCount(total);
    const fewer = solution.getByRole('button', { name: 'Show fewer insights' });
    await expect(fewer).toHaveAttribute('aria-expanded', 'true');
    await expect(fewer).toBeFocused();
    await fewer.click();
    await expect(list.locator(':scope > div')).toHaveCount(3);

    const source = solution.getByRole('link', { name: /Kasube/ });
    await expect(source).toHaveAttribute('href', 'https://doi.org/10.1080/00029890.1983.11971195');
    await expect(source).toHaveAttribute('target', '_blank');
    await expect(source).toHaveAttribute('rel', 'noopener noreferrer');

    await expect(solution.getByRole('heading', { name: 'Learn more' })).toBeVisible();
    const lesson = solution.getByRole('link', { name: /Integration techniques/ });
    await expect(lesson).toHaveAttribute('href', /^https:\/\/tutorial\.math\.lamar\.edu\//);
    await expect(lesson).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(lesson).toContainText('(opens in a new tab)');
  });

  // A long history: a page at a time, searchable, filtered by topic, and one
  // entry can be deleted (1.59.0). Seeded straight into IndexedDB.
  test('My Progress pages, searches and filters a long history, and deletes one entry', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => new Promise((resolve, reject) => {
      const open = indexedDB.open('MathMasterDB', 1);
      open.onupgradeneeded = () => {
        const store = open.result.createObjectStore('problemHistory', { keyPath: 'id', autoIncrement: true });
        store.createIndex('topic', 'topic', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      };
      open.onsuccess = () => {
        const tx = open.result.transaction(['problemHistory'], 'readwrite');
        const store = tx.objectStore('problemHistory');
        for (let i = 1; i <= 25; i += 1) {
          const topic = i <= 5 ? 'integrals' : 'algebra';
          store.add({ problem: topic === 'integrals' ? `∫ x^${i} dx` : `x + ${i} = ${2 * i}`, topic, solution: { status: 'solved', answer: topic === 'integrals' ? `∫(x^${i}) dx` : `x = ${i}` }, createdAt: new Date(Date.UTC(2026, 9, i)).toISOString() });
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      open.onerror = () => reject(open.error);
    }));
    await page.goto('/progress');
    await expect(page.getByRole('heading', { name: 'Your Problem History' })).toBeVisible();
    await expect(page.getByText('Showing 20 of 25')).toBeVisible();
    await expect(page.locator('main li')).toHaveCount(20);
    await page.getByRole('button', { name: 'Show 5 more' }).click();
    await expect(page.locator('main li')).toHaveCount(25);
    // Topic filters carry their counts.
    await page.getByRole('button', { name: /^Integrals \(5\)$/ }).click();
    await expect(page.getByText('Showing 5 of 5 matching (25 in all)')).toBeVisible();
    await page.getByRole('button', { name: /^All topics \(25\)$/ }).click();
    // Search ignores spacing.
    await page.getByRole('searchbox', { name: 'Search your problems and answers' }).fill('x+7=14');
    await expect(page.locator('main li')).toHaveCount(1);
    await expect(page.locator('main li')).toContainText('x = 7');
    // Delete that one entry, after confirming.
    await page.getByRole('button', { name: 'Delete from history: x + 7 = 14' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByText('Nothing in your history matches that.')).toBeVisible();
    await page.getByRole('button', { name: 'Clear search and filter' }).click();
    await expect(page.getByText('Showing 20 of 24')).toBeVisible();
    // Gone for good, not just from the screen.
    await page.reload();
    await expect(page.getByText('Showing 20 of 24')).toBeVisible();
  });

  // The comparison is a dated, sourced table one click from the home page (1.58.0).
  test('the home page links to the comparison, a real table with its date and sources', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /See how MasterMath compares/ }).click();
    await expect(page).toHaveURL(/\/compare$/);
    await expect(page).toHaveTitle(/How MasterMath Compares/);
    await expect(page.getByText(/Checked on \w+ \d+, 20\d\d/)).toBeVisible();
    const table = page.getByRole('table');
    // MasterMath's limits come before the table, and no column is singled out.
    await expect(page.getByRole('heading', { name: 'What MasterMath does not do' })).toBeVisible();
    await expect(page.getByText(/No word problems/)).toBeVisible();
    await expect(table.getByRole('columnheader')).toHaveText(['Feature', 'MasterMath', 'Photomath', 'Symbolab', 'Mathway', 'Wolfram|Alpha']);
    await expect(table.getByRole('rowheader', { name: 'Math topics' })).toBeVisible();
    await expect(table.getByRole('rowheader', { name: 'Step-by-step solutions for free' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Photomath', exact: true })).toHaveAttribute('href', 'https://photomath.com/');
    // The table scrolls inside its own box on a phone; the page never scrolls sideways.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('every page is reachable from the sidebar and an unknown URL gets a not-found page', async ({ page }) => {
    await page.goto('/');
    for (const [path, heading] of [
      ['/solver', /Master Some Math/],
      ['/progress', /Problem History/],
      ['/usermanual', /User Manual|Manual/],
      ['/faq', /Frequently Asked|FAQ/],
      ['/compare', /How MasterMath Compares/],
      ['/settings', /Settings/],
    ]) {
      // The sidebar starts collapsed (and inert); open it for each hop, since
      // following a link closes it again.
      await page.getByRole('button', { name: /Open navigation menu/ }).click();
      await page.locator(`a[href="${path}"]`).first().click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.locator('main')).toContainText(heading);
    }
    // An unknown URL says so and offers the way out, instead of silently
    // showing the home page.
    await page.goto('/this-page-does-not-exist');
    await expect(page).toHaveURL(/this-page-does-not-exist$/);
    await expect(page.getByRole('heading', { name: /Page not found/ })).toBeVisible();
    await expect(page).toHaveTitle(/Page not found/);
    await page.getByRole('link', { name: /Go to the home page/ }).click();
    await expect(page.getByRole('heading', { name: /See the method, not just the answer/ })).toBeVisible();
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
    await page.getByText('Try an example:').waitFor();
    const more = page.getByRole('button', { name: /Show all \d+ examples/ });
    if (await more.isVisible()) await more.click();
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
    await pickExample(page, 'Arithmetic: (5 + 3) * 4 - 2^3');
    await page.getByRole('button', { name: 'Solve Problem' }).click();
    await expect(solution).toContainText(/Final Answer:\s*24/);
    await expect(solution).toBeFocused();
    await expect(solution).toBeInViewport();
  });

  // A long answer used to bleed through the right border of its own card on a
  // phone (1.68.2): the column holding the heading and the answer is a flex
  // item, so min-width: auto held it at the formula's min-content width and
  // the overflow escaped outwards, no ancestor clipping it. The antiderivative
  // of 1/(x^4 + 1) — logs over sqrt(2) and both arctans — is about the widest
  // the solver produces, and it has to sit inside the card, unscrolled, with
  // the page still not scrolling sideways.
  test('on a phone the longest answer sits inside its card', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'phone', 'phone layout only');
    // 375px, not the iPhone 13's 390: the narrow end of the phones in use is
    // where the formula runs out of room, and 390 alone passed this even with
    // the fault in place.
    await page.setViewportSize({ width: 375, height: 812 });
    await openSolver(page);
    await page.getByLabel('Enter your problem').fill('integral of 1/(x^4+1) dx');
    await page.getByRole('button', { name: 'Solve Problem' }).click();
    const solution = page.locator('[aria-label="Solution"]');
    await expect(solution).toContainText('Final Answer:');
    await expect(solution).toContainText('arctan');
    const fit = await page.evaluate(() => {
      const heading = [...document.querySelectorAll('h3')].find((h) => /Final Answer/.test(h.textContent));
      const card = heading.closest('.rounded-xl');
      const box = card.querySelector('.overflow-x-auto');
      const root = document.documentElement;
      return {
        bleed: Math.round(box.getBoundingClientRect().right - card.getBoundingClientRect().right),
        needsScrolling: box.scrollWidth - box.clientWidth,
        reachable: box.getAttribute('tabindex'),
        page: root.scrollWidth - root.clientWidth,
      };
    });
    // Inside the card's padding, wrapped rather than scrolled, and with no tab
    // stop spent on a box that does not scroll.
    expect(fit.bleed).toBeLessThanOrEqual(0);
    expect(fit.needsScrolling).toBe(0);
    expect(fit.reachable).toBeNull();
    expect(fit.page).toBeLessThanOrEqual(0);
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
    await pickExample(page, 'Algebra: 2*x + 5 = 11');
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
    await pickExample(page, 'Algebra: 2*x + 5 = 11');
    await page.locator('#problem').fill(WILKINSON_50);
    await page.getByRole('button', { name: 'Solve Problem' }).click();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Solve cancelled')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Solve Problem' })).toBeEnabled();
    // A fresh worker answers the next problem.
    const solution = await solveExample(page, 'Algebra: 2*x + 5 = 11');
    await expect(solution).toContainText(/x = 3/);
  });

  test('a problem solved under another topic says so, and one tap switches the topic without losing the answer', async ({ page }) => {
    await openSolver(page);
    await pickExample(page, 'Algebra: 2*x + 5 = 11');
    await page.getByLabel('Enter your problem').fill('derivative of x^3');
    await page.getByRole('button', { name: 'Solve Problem' }).click();
    const solution = page.locator('[aria-label="Solution"]');
    await expect(solution).toContainText('Final Answer:');
    await expect(solution).toContainText('Solved as Derivatives. Your input uses derivative notation. You had Algebra selected.');
    // The notice replaces the "Solved as …" first step on screen.
    await expect(solution.getByText(/^Solved as Derivatives \(you chose/)).toHaveCount(0);
    await page.getByRole('button', { name: 'Switch topic to Derivatives' }).click();
    await expect(page.getByRole('combobox').first()).toContainText('Derivatives');
    await expect(solution).toContainText('Final Answer:');
    await expect(solution).toContainText('The topic is now Derivatives.');
    await expect(page.getByRole('button', { name: 'Switch topic to Derivatives' })).toHaveCount(0);
  });

  test('Auto-detect solves by the input and says what it detected, with no topic to switch', async ({ page }) => {
    await openSolver(page);
    await expect(page.getByRole('combobox').first()).toContainText('Auto-detect');
    const solution = page.locator('[aria-label="Solution"]');
    for (const [p, notice, answer] of [
      ['derivative of x^3', 'Detected as Derivatives. Your input uses derivative notation. Not what you meant? Choose a topic above.', /3x/],
      ['2x + 5 = 11', 'Detected as Algebra. Your input is an equation.', /x = 3/],
      ['sin(pi/6)', 'Detected as Trigonometry.', /1\/2|0\.5/],
      ['two plus one', 'Detected as Arithmetic.', /3/],
    ]) {
      await page.locator('#problem').fill(p);
      await page.getByRole('button', { name: 'Solve Problem' }).click();
      await expect(solution).toContainText(notice);
      await expect(solution).toContainText(answer);
      await expect(page.getByRole('button', { name: /Switch topic to/ })).toHaveCount(0);
      // The topic stays on Auto-detect.
      await expect(page.getByRole('combobox').first()).toContainText('Auto-detect');
    }
    // A bare expression is simplified and factored, with the offer to do more.
    await page.locator('#problem').fill('x^2 + 3x');
    await page.getByRole('button', { name: 'Solve Problem' }).click();
    await expect(solution).toContainText(/x\s*\(\s*x\s*\+\s*3\s*\)/);
    await expect(page.getByRole('button', { name: 'Differentiate it' })).toBeVisible();
  });

  // October 2026 review: the "Problem solved!" toast covered the theme
  // button, so a click there went nowhere for six seconds.
  test('right after a solve the header buttons are not covered by the toast', async ({ page }) => {
    await openSolver(page);
    await solveExample(page, 'Algebra: 2*x + 5 = 11');
    await expect(page.getByText('Problem solved!')).toBeVisible();
    // On desktop the header scrolls with the page and a solve scrolls to the
    // answer: go back up, as a user reaching for the button would.
    await page.evaluate(() => window.scrollTo(0, 0));
    const toggle = page.getByRole('button', { name: /Switch to (dark|light) mode/ });
    const box = await toggle.boundingBox();
    const onTop = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('button')?.getAttribute('aria-label') || '', { x: box.x + box.width / 2, y: box.y + box.height / 2 });
    expect(onTop).toMatch(/Switch to (dark|light) mode/);
    const wasDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    await toggle.click({ timeout: 2000 });
    await expect(page.locator('html')).toHaveClass(wasDark ? /^(?!.*\bdark\b)/ : /\bdark\b/);
  });

  // The history PDF is typeset too (1.54.0): ∞, √ and x² print as
  // themselves, and a problem solved twice is one entry.
  test('My Progress exports a typeset PDF, one entry per problem', async ({ page }) => {
    const fellBack = [];
    page.on('console', (msg) => { if (/Typeset PDF failed/.test(msg.text())) fellBack.push(msg.text()); });
    await openSolver(page);
    await pickExample(page, 'Algebra: 2*x + 5 = 11');
    for (let i = 0; i < 2; i += 1) {
      await page.getByRole('button', { name: 'Solve Problem' }).click();
      // The toast comes after the save; close it so the second one is new.
      await expect(page.getByText('Problem solved!')).toBeVisible();
      await page.getByRole('button', { name: 'Close notification' }).first().click();
      await expect(page.getByText('Problem solved!')).toHaveCount(0);
    }
    await page.goto('/progress');
    await expect(page.getByText('Solved 2 times')).toBeVisible();
    await expect(page.getByText('2*x + 5 = 11', { exact: true })).toHaveCount(1);
    await page.getByRole('button', { name: /^Export/ }).click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: 'Export as PDF' }).click(),
    ]);
    const pdf = readFileSync(await download.path()).toString('latin1');
    expect(fellBack, 'the typeset PDF fell back to plain text').toEqual([]);
    expect(pdf.startsWith('%PDF-')).toBe(true);
    expect((pdf.match(/\/Subtype\s*\/Image/g) || []).length).toBeGreaterThanOrEqual(1);
    expect(pdf).toContain('MasterMath Progress');
    expect(pdf).toContain('Problems worked through: 1');
  });

  // October 2026 roadmap P2: the PDF is the typeset solution and the graph
  // (images of the page, pdfTypeset.js) with a searchable text layer — not
  // the plain-text fallback. Dark mode too: the PDF is printed light.
  for (const scheme of ['light', 'dark']) {
    test(`Export as PDF saves the typeset solution with its graph (${scheme} mode)`, async ({ page }) => {
      const fellBack = [];
      page.on('console', (msg) => { if (/Typeset PDF failed/.test(msg.text())) fellBack.push(msg.text()); });
      await page.emulateMedia({ colorScheme: scheme });
      await openSolver(page);
      await pickExample(page, 'Algebra: 2*x + 5 = 11');
      await page.getByLabel('Enter your problem').fill('x^3 - 6x^2 + 11x - 6 = 0');
      await page.getByRole('button', { name: 'Solve Problem' }).click();
      await expect(page.locator('[aria-label="Solution"]')).toContainText('Final Answer:');
      await expect(page.locator('[data-export-graph] svg.recharts-surface')).toBeVisible();

      await page.getByRole('button', { name: /^Export/ }).click();
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('menuitem', { name: 'Export as PDF' }).click(),
      ]);
      const pdf = readFileSync(await download.path()).toString('latin1');
      expect(fellBack, 'the typeset PDF fell back to plain text').toEqual([]);
      expect(pdf.startsWith('%PDF-')).toBe(true);
      expect(pdf.length, 'a typical solution stays under 1 MB').toBeLessThan(1_000_000);
      const pages = (pdf.match(/\/Type\s*\/Page\b/g) || []).length;
      expect(pages).toBeGreaterThanOrEqual(1);
      expect(pages).toBeLessThanOrEqual(3);
      // One page image each (the graph is inside a page's image)...
      expect((pdf.match(/\/Subtype\s*\/Image/g) || []).length).toBe(pages);
      // ...and the words underneath, for search and copy.
      expect(pdf).toContain('Step-by-Step Solution');
      expect(pdf).toMatch(/Final Answer: x = 1\s+or\s+x = 2\s+or\s+x = 3/);
      expect(pdf).toContain(`Page ${pages} of ${pages}`);
    });
  }
});
