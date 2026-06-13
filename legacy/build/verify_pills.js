const { chromium } = require('C:/Users/fwyer/node_modules/playwright');
const path = require('path');
const base = 'file:///' + path.resolve(__dirname, '..').replace(/\\/g, '/') + '/';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));

  await page.goto(base + 'index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const regionPills = await page.$$eval('#gRlab rect.pill', e => e.filter(r => r.style.display !== 'none' && r.getAttribute('width')).length);
  const cityPills = await page.$$eval('#gCity rect.pill', e => e.filter(r => r.style.display !== 'none' && r.getAttribute('width')).length);
  await page.screenshot({ path: path.resolve(__dirname, 'data/pills_overview.png') });
  console.log('overview: regionPills sized=' + regionPills + ' cityPills sized=' + cityPills);

  // zoom into champagne (matches the user's screenshot)
  await page.click('.rrow[data-id="champagne"]');
  await page.waitForTimeout(1100);
  const townPills = await page.$$eval('#gTown rect.pill', e => e.filter(r => r.style.display !== 'none' && r.getAttribute('width')).length);
  const townLabels = await page.$$eval('#gTown text.tlabel', e => e.filter(t => t.style.display !== 'none').length);
  // sample a pill's geometry
  const sample = await page.$$eval('#gTown rect.pill', e => {
    const r = e.find(x => x.style.display !== 'none' && x.getAttribute('width'));
    return r ? { w: +r.getAttribute('width'), h: +r.getAttribute('height'), rx: +r.getAttribute('rx') } : null;
  });
  console.log('champagne: townPills sized=' + townPills + ' / townLabels visible=' + townLabels + ' | sample pill=' + JSON.stringify(sample));
  await page.screenshot({ path: path.resolve(__dirname, 'data/pills_champagne.png') });
  // deep zoom into the Reims/Montagne cluster to inspect pill quality up close
  const b = await page.$eval('#map', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await page.mouse.move(b.x + b.w * 0.5, b.y + b.h * 0.4);
  for (let i = 0; i < 7; i++) { await page.mouse.wheel(0, -240); await page.waitForTimeout(110); }
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.resolve(__dirname, 'data/pills_closeup.png'), clip: { x: b.x, y: b.y, width: b.w, height: b.h } });

  console.log('errors: ' + (errors.length ? errors.join('; ') : 'none'));
  await browser.close();
})();
