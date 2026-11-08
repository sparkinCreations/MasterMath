import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// The home page's hero recording (1.70.2): every file HeroVideo asks for
// exists, and each stays within its weight (it is the first thing the home
// page loads). Re-recorded by scripts/record-hero.mjs.
const root = path.resolve(import.meta.dirname, '..');
const hero = path.join(root, 'public', 'hero');
const kB = (f) => fs.statSync(path.join(hero, f)).size / 1024;

test('every hero file exists, light and dark, and is light enough', () => {
  for (const theme of ['light', 'dark']) {
    for (const [file, budget] of [
      [`solve-${theme}-1600.webm`, 300], [`solve-${theme}-1600.mp4`, 350],
      [`solve-${theme}-800.webm`, 150], [`solve-${theme}-800.mp4`, 180],
      [`solve-${theme}-poster.webp`, 90],
    ]) {
      assert.ok(fs.existsSync(path.join(hero, file)), file);
      assert.ok(kB(file) <= budget, `${file}: ${kB(file).toFixed(0)} kB > ${budget} kB`);
    }
  }
});

test('the component names exactly those files, and the AI illustration is gone', () => {
  const src = fs.readFileSync(path.join(root, 'src', 'components', 'HeroVideo.jsx'), 'utf8');
  for (const pattern of ['/hero/solve-${theme}-1600.webm', '/hero/solve-${theme}-1600.mp4', '/hero/solve-${theme}-800.webm', '/hero/solve-${theme}-800.mp4', '/hero/solve-${theme}-poster.webp']) {
    assert.ok(src.includes(pattern), pattern);
  }
  const home = fs.readFileSync(path.join(root, 'src', 'pages', 'Home.jsx'), 'utf8');
  assert.match(home, /<HeroVideo /);
  assert.doesNotMatch(home, /home-desk|created with AI/);
  assert.equal(fs.existsSync(path.join(root, 'public', 'home-desk-1600.webp')), false);
});
