// Shared helpers for stills.mjs and render.mjs (run through fv.sh, which installs playwright-core).
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export async function launch() {
  return chromium.launch(existsSync(CHROME) ? { executablePath: CHROME } : {});
}

export function arg(argv, name, dflt) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : dflt;
}

export function langsOf(proj, argv, video) {
  const l = arg(argv, '--lang', 'all');
  return l === 'all' ? video.langs : [l];
}

// Open the composition for one language, wait for __ready, return {page, meta, warnings, errors}.
export async function openComp(browser, proj, lang) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + resolve(proj, 'index.html') + `?lang=${lang}&render`);
  await page.waitForFunction(() => window.__ready !== undefined, null, { timeout: 30000 });
  await page.evaluate(() => window.__ready);
  const meta = await page.evaluate(() => window.__meta);
  const warnings = await page.evaluate(() => window.__warnings);
  return { page, meta, warnings, errors };
}
