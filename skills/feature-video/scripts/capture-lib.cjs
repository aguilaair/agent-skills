// Capture helper for a project's throwaway Playwright script (CommonJS, so NODE_PATH works).
//
//   const { shoot } = require('./capture-lib.cjs');
//   await shoot(page, __dirname, 'after-dialog', {
//     dialog: '[role=dialog]',
//     maxRate: page.getByLabel('Max rate per pass (kg/ha)'),
//   }, { redact: ['nav[aria-label=breadcrumb]'], hide: ['nextjs-portal'], private: true, toasts: false });
//
// redact blurs names of farms and people, prices; hide removes dev-only chrome.
// private covers text that matches PRIVATE (tax IDs, emails), or your own regexes, wherever it shows.
// toasts: false hides sonner toasts, so one left over from an earlier step does not sit on this shot.
// hover: true keeps the mouse where it is, so a hover tooltip stays in the still.
//
// Writes shots/<id>.png (the viewport) and merges {src, w, h, dpr, targets, url} into shots/shots.json.
// Target rects are in screenshot pixels. Shots of one page share coordinates, so the camera can
// cross-fade between them without jumping. Check the rects in shots.json: a locator that matched
// an outer wrapper gives a ring around half the page.
const fs = require('node:fs');
const path = require('node:path');

// Brazilian CNPJ and CPF, a bare 14-digit tax ID, and email addresses.
const PRIVATE = [
  /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g,
  /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g,
  /\b\d{14}\b/g,
  /[\w.+-]+@[\w-]+\.[\w.]+/g,
];

// Cover private text. An element that holds only private text is blurred whole (data-fv-private);
// a match inside longer text gets an opaque box (headless Chromium does not render backdrop-filter,
// so a blur box would only tint it). Text behind a dialog's overlay is blurred as an element, so its
// box does not land on top of the dialog. Inputs whose value matches are blurred too.
async function coverPrivate(page, patterns = PRIVATE) {
  await page.evaluate((sources) => {
    const res = sources.map(([s, f]) => new RegExp(s, f.includes('g') ? f : f + 'g'));
    const matches = (t) => res.some((re) => { re.lastIndex = 0; return re.test(t); });
    for (const input of document.querySelectorAll('input, textarea')) {
      if (matches(input.value)) input.setAttribute('data-fv-private', '');
    }
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const boxes = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || !matches(n.textContent)) continue;
      const rest = res.reduce((t, re) => t.replace(re, ''), el.textContent).trim();
      if (rest === '') { el.setAttribute('data-fv-private', ''); continue; }
      for (const re of res) {
        re.lastIndex = 0;
        for (const m of n.textContent.matchAll(re)) {
          const r = document.createRange();
          r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
          for (const b of r.getClientRects()) {
            const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
            if (hit && (hit === el || el.contains(hit) || hit.contains(el))) boxes.push(b);
            else el.setAttribute('data-fv-private', '');
          }
        }
      }
    }
    for (const b of boxes) {
      const box = document.createElement('div');
      box.className = 'fv-cover';
      Object.assign(box.style, {
        position: 'fixed', left: `${b.left - 6}px`, top: `${b.top - 3}px`, width: `${b.width + 12}px`, height: `${b.height + 6}px`,
        background: '#d4d4d8', zIndex: 2147483647, pointerEvents: 'none', borderRadius: '4px',
      });
      document.body.appendChild(box);
    }
  }, patterns.map((re) => [re.source, re.flags]));
}

async function uncoverPrivate(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.fv-cover').forEach((e) => e.remove());
    document.querySelectorAll('[data-fv-private]').forEach((e) => e.removeAttribute('data-fv-private'));
  });
}

async function shoot(page, project, id, targets = {}, opts = {}) {
  const dir = path.join(project, 'shots');
  fs.mkdirSync(dir, { recursive: true });
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  const vp = page.viewportSize();
  const hide = [...(opts.hide || []), ...(opts.toasts === false ? ['[data-sonner-toaster]'] : [])];
  const redact = [...(opts.redact || []), ...(opts.private ? ['[data-fv-private]'] : [])];
  const css = [
    ...redact.map((s) => `${s}{filter:blur(9px)!important}`),
    ...hide.map((s) => `${s}{visibility:hidden!important}`),
  ].join('\n');
  if (!opts.hover) await page.mouse.move(vp.width - 2, vp.height - 2); // no hover states in the still
  if (opts.settle !== 0) await page.waitForTimeout(opts.settle ?? 400);
  if (opts.private) await coverPrivate(page, opts.private === true ? PRIVATE : opts.private);
  const style = css ? await page.addStyleTag({ content: css }) : null;
  const rects = {};
  try {
    for (const [name, sel] of Object.entries(targets)) {
      const loc = typeof sel === 'string' ? page.locator(sel).first() : sel;
      const b = await loc.boundingBox();
      if (!b) throw new Error(`shoot ${id}: target "${name}" is not visible`);
      rects[name] = [b.x, b.y, b.width, b.height].map((v) => Math.round(v * dpr));
    }
    await page.screenshot({ path: path.join(dir, `${id}.png`) });
  } finally {
    if (style) await style.evaluate((el) => el.remove());
    if (opts.private) await uncoverPrivate(page);
  }
  const file = path.join(dir, 'shots.json');
  const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  all[id] = { src: `shots/${id}.png`, w: Math.round(vp.width * dpr), h: Math.round(vp.height * dpr), dpr, targets: rects, url: page.url() };
  fs.writeFileSync(file, JSON.stringify(all, null, 1));
  console.log(`shot ${id}: ${Object.keys(rects).join(', ') || '(no targets)'}`);
}

module.exports = { shoot, coverPrivate, uncoverPrivate, PRIVATE };
