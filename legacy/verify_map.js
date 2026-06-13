/* Headless check of the flat 2D map page. Run from repo root:  node frank_wine/verify_map.js */
const { chromium } = require('C:/Users/fwyer/node_modules/playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const url = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
  const outDir = path.resolve(__dirname, 'build/data');
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1360, height: 760 } });
  const errors = [], logs = [];
  page.on('console', m => { logs.push(`[${m.type()}] ${m.text()}`); if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));

  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('.rrow[data-id="champagne"]', { timeout: 8000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, 'map_overview.png') });

  // 1) click a region (sidebar row) -> region detail + zoom
  await page.click('.rrow[data-id="champagne"]');
  await page.waitForTimeout(900);
  const regionName = await page.textContent('#dName');
  await page.screenshot({ path: path.join(outDir, 'map_region.png') });

  // 1b) click an appellation chip -> outline its area on the map
  await page.waitForSelector('#dApps .app.btn', { timeout: 4000 });
  const appName = await page.$eval('#dApps .app.btn', el => el.dataset.app);
  await page.click('#dApps .app.btn');
  await page.waitForTimeout(900);
  const appAreaPolys = await page.$$eval('#gAppArea polygon', els => els.length);
  const appLabel = await page.textContent('#gAppArea .appLabel').catch(() => '(none)');
  await page.screenshot({ path: path.join(outDir, 'map_appellation.png') });

  // 2) click a village on the map -> village detail
  await page.waitForSelector('.towng', { timeout: 4000 });
  await page.$$eval('.towng', els => { if (els[0]) els[0].dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await page.waitForTimeout(800);
  const kindV = await page.textContent('.dtag').catch(() => '(no tag)');
  const villageName = await page.textContent('#dName');
  await page.screenshot({ path: path.join(outDir, 'map_village.png') });

  // 3) back to region, then click a house row -> house detail
  await page.click('#dBack');
  await page.waitForTimeout(500);
  await page.click('#dProds .prod');
  await page.waitForTimeout(500);
  const kindH = await page.textContent('.dtag').catch(() => '(no tag)');
  const houseName = await page.textContent('#dName');
  await page.screenshot({ path: path.join(outDir, 'map_house.png') });

  const pass = errors.length === 0;
  console.log('=== verify_map ===');
  console.log('RESULT:', pass ? 'PASS' : 'FAIL');
  console.log('region:', JSON.stringify(regionName));
  console.log('appellation:', JSON.stringify(appName), '| area polygons:', appAreaPolys, '| label:', JSON.stringify(appLabel));
  console.log('village view tag/name:', JSON.stringify(kindV), JSON.stringify(villageName));
  console.log('house view tag/name:', JSON.stringify(kindH), JSON.stringify(houseName));
  console.log('console error count:', errors.length);
  if (errors.length) console.log('--- errors ---\n' + errors.slice(0, 20).join('\n'));

  await browser.close();
  process.exit(pass ? 0 : 1);
})();
