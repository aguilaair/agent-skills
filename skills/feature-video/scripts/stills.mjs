// Contact sheet of the composition. usage: fv.sh stills <project> [--lang en] [t1 t2 ...]
// Without times it takes one frame mid-line and one just after every beat (deduplicated within 0.4s).
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launch, openComp, arg } from './lib.mjs';

const argv = process.argv.slice(2);
const proj = resolve(argv[0]);
const video = JSON.parse(readFileSync(resolve(proj, 'video.json'), 'utf8'));
const lang = arg(argv, '--lang', video.langs[0]);
const times = argv.slice(1).filter((a, i, all) => a !== '--lang' && all[i - 1] !== '--lang').map(Number).filter((n) => !Number.isNaN(n));

const browser = await launch();
const { page, meta, warnings, errors } = await openComp(browser, proj, lang);
let ts = times;
if (!ts.length) {
  const tl = JSON.parse(readFileSync(resolve(proj, `build/timeline-${lang}.json`), 'utf8'));
  const beats = await page.evaluate(() => window.__beats);
  const cand = [...tl.lines.map((l) => (l.t0 + l.t1) / 2), ...beats.map((b) => b + 0.7), meta.dur - 0.5].sort((a, b) => a - b);
  ts = [];
  for (const t of cand) if (!ts.length || t - ts[ts.length - 1] > 0.4) ts.push(+t.toFixed(2));
}
const dir = resolve(proj, `build/stills-${lang}`);
mkdirSync(dir, { recursive: true });
const files = [];
for (const t of ts) {
  await page.evaluate((t) => window.__seek(t), t);
  const f = resolve(dir, `t${t.toFixed(2).padStart(6, '0')}.png`);
  await page.screenshot({ path: f });
  files.push({ f, t });
}
// contact sheet, 4 across
const cols = 4, W = 480, H = 270;
const sheet = await browser.newPage({ viewport: { width: cols * (W + 12) + 12, height: 400 } });
const html = `<body style="margin:0;background:#111;font:600 14px Inter,system-ui;color:#fff;display:flex;flex-wrap:wrap;gap:12px;padding:12px;width:${cols * (W + 12)}px">` +
  files.map(({ f, t }) => `<div><img src="file://${f}" style="width:${W}px;height:${H}px;display:block"><div style="padding:4px 2px">${t.toFixed(2)}s</div></div>`).join('') + '</body>';
const sheetHtml = resolve(dir, 'sheet.html');
writeFileSync(sheetHtml, html);
await sheet.goto('file://' + sheetHtml);
await sheet.waitForLoadState('load');
const out = resolve(proj, `build/stills-${lang}.png`);
await sheet.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(`${out}  (${files.length} frames, film ${meta.dur.toFixed(1)}s, ${lang})`);
for (const e of errors) console.log('PAGE ERROR ' + e);
for (const w of warnings) console.log('WARNING ' + w);
