// Pilot capture: spreading-map download, before (#4069) and after. usage: node capture.cjs before|after
const { chromium } = require('playwright');
const { clerk, clerkSetup } = require('@clerk/testing/playwright');
const { shoot } = require('./capture-lib.cjs');

const MODE = process.argv[2];
const BASE = process.env.WEB_BASE;
const REVIEWED_FIELD = 268; // highest rate 75,000 kg/ha
const UNREVIEWED_FIELD = 257;
const P = __dirname;
const OPTS = { hide: ['nextjs-portal'] };
const snap = (page, id, targets) => shoot(page, P, id, targets, OPTS);

(async () => {
  await clerkSetup({ publishableKey: process.env.CLERK_PUBLISHABLE_KEY, secretKey: process.env.CLERK_SECRET_KEY });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => console.log('pageerror:', e.message));
  await page.goto(`${BASE}/sign-in`);
  await clerk.signIn({ page, emailAddress: process.env.SIGN_IN_EMAIL });

  const openTable = async (field) => {
    await page.goto(`${BASE}/fields/${field}?tab=spreading`);
    await page.getByRole('button', { name: 'Download', exact: true }).first().waitFor({ timeout: 60000 });
    await page.waitForTimeout(800);
  };
  const dl = () => page.getByRole('button', { name: 'Download', exact: true }).first();
  const row = () => page.locator('tbody tr').filter({ has: dl() }).first();

  if (MODE === 'before') {
    await openTable(REVIEWED_FIELD);
    await snap(page, 'before-table', { dl: dl(), row: row(), table: page.locator('table').first() });
  }

  if (MODE === 'after') {
    await openTable(REVIEWED_FIELD);
    const header = page.getByRole('columnheader', { name: 'Map settings' });
    await snap(page, 'after-table', { dl: dl(), row: row(), table: page.locator('table').first(), settingsHead: header });

    await dl().click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    const field = (id) => dialog.locator(`#${id}`).locator('xpath=..');
    const targets = () => ({
      dialog,
      maxRate: field('maxRate'),
      maxInput: dialog.locator('#maxRate'),
      hint: field('maxRate').locator('p'),
      humidity: field('humidity'),
      humInput: dialog.locator('#humidity'),
      humHint: field('humidity').locator('p'),
      submit: dialog.locator('button[type=submit]'),
    });
    await snap(page, 'after-dialog', targets());
    await dialog.locator('#maxRate').fill('25000');
    await snap(page, 'after-dialog-25k', targets());
    await dialog.locator('#humidity').fill('12');
    await snap(page, 'after-dialog-filled', targets());
    await page.keyboard.press('Escape');

    await openTable(UNREVIEWED_FIELD);
    await dl().click();
    await dialog.waitFor();
    await snap(page, 'unreviewed-dialog', {
      dialog,
      warning: dialog.getByText('has not been reviewed yet'),
      submit: dialog.locator('button[type=submit]'),
    });
  }

  if (MODE === 'settings') {
    // run after setting the saved values on the local DB copy
    await openTable(REVIEWED_FIELD);
    const header = page.getByRole('columnheader', { name: 'Map settings' });
    const idx = await header.evaluate((th) => [...th.parentElement.children].indexOf(th));
    await snap(page, 'after-table-settings', {
      dl: dl(), row: row(), settingsHead: header,
      settingsCell: row().locator('td').nth(idx),
    });
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
