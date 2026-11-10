// Records the home page's hero video: the real Solver, typing x² − 4x + 3
// under Functions, solving it, the graph drawing its zeros and minimum, and
// then the steps (1.70.2; later scrolled on to the steps). Re-run it when the Solver's look changes.
//
//   node scripts/record-hero.mjs [url]      (default https://mastermath.app)
//
// Needs Playwright's Chromium (a devDependency) and ffmpeg with libvpx-vp9
// and libx264. Writes, for each theme, to public/hero/:
//   solve-<theme>-1600.webm / .mp4   1600 × 900, for wide screens
//   solve-<theme>-800.webm  / .mp4   800 × 450, for phones
//   solve-<theme>-poster.webp        the solved frame: shown before the video
//                                    plays, and instead of it for reduced motion
//
// Frames come from Chrome's screencast at 1600 × 900: a 1152 × 648 page at
// 1.39× (was 1440 × 810 at 1.11×). The home page shows the video
// about 1000 px wide, so the Solver's text plays at nearly its own size; at
// 1440 it was shrunk to about a third. 1152 keeps the two-column layout
// (lg is 1024). Timed as captured, then encoded at 25 fps. The "Problem solved!" toast is hidden so
// it does not cover the graph.

import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PAGE_W = 1152;
const PAGE_H = 648;
const url = (process.argv[2] || 'https://mastermath.app').replace(/\/$/, '');
const out = path.resolve(import.meta.dirname, '..', 'public', 'hero');
fs.mkdirSync(out, { recursive: true });

async function record(theme) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `hero-${theme}-`));
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: PAGE_W, height: PAGE_H }, deviceScaleFactor: 1600 / PAGE_W });
  const page = await context.newPage();
  await page.addInitScript((dark) => {
    localStorage.setItem('darkMode', String(dark));
    localStorage.setItem('solutionMode', 'all');
  }, theme === 'dark');
  await page.goto(`${url}/solver`);
  await page.addStyleTag({ content: '.fixed.top-20.right-4 { display: none !important; }' });
  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'Functions' }).click();
  // Open on the cards: the topic, the empty problem box, the empty graph.
  const cards = await page.getByText('What are you working on?').first().evaluate((e) => e.getBoundingClientRect().top + window.scrollY);
  await page.evaluate((y) => window.scrollTo(0, y), Math.max(0, cards - 40));
  await page.waitForTimeout(500);

  const cdp = await context.newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', async (f) => {
    frames.push({ t: f.metadata.timestamp, data: f.data });
    try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch { /* closing */ }
  });
  await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1, maxWidth: 1600, maxHeight: 900 });
  await page.waitForTimeout(900);
  await page.locator('#problem').click();
  await page.locator('#problem').pressSequentially('x^2 - 4*x + 3', { delay: 120 });
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Solve Problem' }).click();
  // Off the page, so no button or example is left in its hover state as the
  // page scrolls under the pointer (the poster is the last frame).
  await page.mouse.move(PAGE_W - 1, 1);
  await page.locator('[aria-label="Solution"]').getByText('Final Answer').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(1800);
  // An eased scroll of about a second.
  const scrollTo = async (to) => {
    const from = await page.evaluate(() => window.scrollY);
    for (let i = 1; i <= 30; i += 1) {
      const k = i / 30;
      const eased = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      await page.evaluate((y) => window.scrollTo(0, y), from + (to - from) * eased);
      await page.waitForTimeout(33);
    }
  };
  const top = (locator) => locator.evaluate((e) => e.getBoundingClientRect().top + window.scrollY);
  // Down to the problem box's top: the box and the graph, held.
  await scrollTo((await top(page.locator('#problem'))) - 12);
  await page.waitForTimeout(2400);
  // Then the steps: the method is the point, and the last frame is
  // the poster. A 648-px page cannot hold the graph and the steps at once.
  await scrollTo((await top(page.locator('[aria-label="Solution"]'))) - 12);
  await page.waitForTimeout(3200);
  // The screencast sends a frame only when the page changes: the hold at the
  // end has none, so the last frame lasts until here.
  const stoppedAt = Date.now() / 1000;
  await cdp.send('Page.stopScreencast');
  await page.waitForTimeout(300);
  await browser.close();

  // Each frame held until the next, as captured; the last until the stop.
  const name = (i) => `f${String(i).padStart(4, '0')}.png`;
  frames.forEach((f, i) => fs.writeFileSync(path.join(dir, name(i)), Buffer.from(f.data, 'base64')));
  const lastHold = Math.max(0.1, stoppedAt - frames[frames.length - 1].t);
  const list = frames.map((f, i) => `file '${name(i)}'\nduration ${((frames[i + 1]?.t ?? f.t + lastHold) - f.t).toFixed(3)}`);
  list.push(`file '${name(frames.length - 1)}'`);
  fs.writeFileSync(path.join(dir, 'list.txt'), list.join('\n'));

  const ffmpeg = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
  for (const w of [1600, 800]) {
    const vf = `scale=${w}:${(w * 9) / 16}:flags=lanczos,fps=25,format=yuv420p`;
    const input = ['-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt')];
    ffmpeg([...input, '-vf', vf, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '41', '-row-mt', '1', '-deadline', 'good', '-an', path.join(out, `solve-${theme}-${w}.webm`)]);
    ffmpeg([...input, '-vf', vf, '-c:v', 'libx264', '-preset', 'slow', '-crf', '29', '-tune', 'animation', '-movflags', '+faststart', '-an', path.join(out, `solve-${theme}-${w}.mp4`)]);
  }
  ffmpeg(['-i', path.join(dir, name(frames.length - 1)), '-vf', 'scale=1600:900', '-quality', '82', path.join(out, `solve-${theme}-poster.webp`)]);
  fs.rmSync(dir, { recursive: true, force: true });
  const seconds = stoppedAt - frames[0].t;
  console.log(`${theme}: ${frames.length} frames, ${seconds.toFixed(1)} s`);
}

await record('light');
await record('dark');
for (const f of fs.readdirSync(out).sort()) console.log(`  ${f.padEnd(26)} ${(fs.statSync(path.join(out, f)).size / 1024).toFixed(0)} kB`);
