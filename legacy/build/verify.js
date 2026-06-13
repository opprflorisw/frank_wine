// Quick headless check of the consolidated app. Run: node verify.js  (from build/)
const { chromium } = require('C:/Users/fwyer/node_modules/playwright');
const path = require('path');
const base = 'file:///' + path.resolve(__dirname, '..').replace(/\\/g, '/') + '/';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1480, height: 900 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  const pages = ['index.html','regions.html','houses.html','grapes.html','villages.html','best-regions.html','trips.html'];
  for (const f of pages) {
    errors.length = 0;
    await page.goto(base + f, { waitUntil: 'networkidle' });
    await page.waitForTimeout(350);
    const logo = await page.$eval('.nav .logo', e => e.textContent.replace(/\s+/g,' ').trim()).catch(()=> 'NO NAV');
    const title = await page.title();
    console.log(`${f.padEnd(18)} logo="${logo}" | title="${title}" | errors: ${errors.length ? errors.join(';') : 'none'}`);
  }
  await page.goto(base + 'index.html', { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
  await page.screenshot({ path: path.resolve(__dirname,'../../frank_overview.png') });
  await browser.close();
})();
