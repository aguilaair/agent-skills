// Render a bento HTML file to a 2x PNG, full page. Run through render.sh.
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const [html, out] = process.argv.slice(2);
if (!html || !out) { console.error('usage: render.sh <page.html> <out.png>'); process.exit(2); }
const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch(existsSync(chrome) ? { executablePath: chrome } : {});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
await page.goto('file://' + resolve(html), { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: resolve(out), fullPage: true });
const { w, h } = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }));
console.log(`${resolve(out)} ${w * 2}x${h * 2}${w > 1600 ? '  WARNING: page wider than 1600px, something overflows' : ''}`);
await browser.close();
