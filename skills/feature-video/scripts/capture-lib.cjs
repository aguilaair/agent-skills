// Capture helper for a project's throwaway Playwright script (CommonJS, so NODE_PATH works).
//
//   const { shoot } = require('./capture-lib.cjs');
//   await shoot(page, __dirname, 'after-dialog', {
//     dialog: '[role=dialog]',
//     maxRate: page.getByLabel('Max rate per pass (kg/ha)'),
//   }, { redact: ['nav[aria-label=breadcrumb]'], hide: ['nextjs-portal'] });
//
// redact blurs names of farms and people, prices; hide removes dev-only chrome.
//
// Writes shots/<id>.png (the viewport) and merges {src, w, h, dpr, targets, url} into shots/shots.json.
// Target rects are in screenshot pixels. Shots of one page share coordinates, so the camera can
// cross-fade between them without jumping.
const fs = require('node:fs');
const path = require('node:path');

async function shoot(page, project, id, targets = {}, opts = {}) {
  const dir = path.join(project, 'shots');
  fs.mkdirSync(dir, { recursive: true });
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  const vp = page.viewportSize();
  const css = [
    ...(opts.redact || []).map((s) => `${s}{filter:blur(9px)!important}`),
    ...(opts.hide || []).map((s) => `${s}{visibility:hidden!important}`),
  ].join('\n');
  const style = css ? await page.addStyleTag({ content: css }) : null;
  await page.mouse.move(vp.width - 2, vp.height - 2); // no hover states in the still
  if (opts.settle !== 0) await page.waitForTimeout(opts.settle ?? 400);
  const rects = {};
  for (const [name, sel] of Object.entries(targets)) {
    const loc = typeof sel === 'string' ? page.locator(sel).first() : sel;
    const b = await loc.boundingBox();
    if (!b) throw new Error(`shoot ${id}: target "${name}" is not visible`);
    rects[name] = [b.x, b.y, b.width, b.height].map((v) => Math.round(v * dpr));
  }
  await page.screenshot({ path: path.join(dir, `${id}.png`) });
  if (style) await style.evaluate((el) => el.remove());
  const file = path.join(dir, 'shots.json');
  const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  all[id] = { src: `shots/${id}.png`, w: Math.round(vp.width * dpr), h: Math.round(vp.height * dpr), dpr, targets: rects, url: page.url() };
  fs.writeFileSync(file, JSON.stringify(all, null, 1));
  console.log(`shot ${id}: ${Object.keys(rects).join(', ') || '(no targets)'}`);
}

module.exports = { shoot };
