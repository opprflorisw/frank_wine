const { chromium } = require("C:/Users/fwyer/node_modules/playwright");
const BASE = "http://localhost:4173";
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE " + m.text()); });
  page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message));

  async function go(path) { await page.goto(BASE + path, { waitUntil: "networkidle" }); await page.waitForTimeout(700); }

  // MAP
  await go("/");
  const regions = await page.$$eval("#map path.reg", (e) => e.length);
  const labels = await page.$$eval("#map text.rlabel", (e) => e.length);
  await page.screenshot({ path: "verify_map.png" });
  await page.click('#map path.reg[d]'); // click first region
  await page.waitForTimeout(1100);
  const detailName = await page.$eval(".detail .dhead h2", (e) => e.textContent).catch(() => "NONE");
  const houses = await page.$$eval(".detail .prod", (e) => e.length);
  await page.screenshot({ path: "verify_map_region.png" });
  console.log(`MAP: regions=${regions} labels=${labels} | selected="${detailName}" housesInPanel=${houses}`);

  // table pages via direct nav
  await go("/houses");
  const hrows = await page.$$eval(".tablewrap tbody tr", (e) => e.length);
  console.log("HOUSES rows:", hrows);
  await go("/regions");
  const rcards = await page.$$eval(".grid .rcardL", (e) => e.length);
  console.log("REGIONS cards:", rcards);
  await go("/grapes");
  const grows = await page.$$eval(".tablewrap tbody tr", (e) => e.length);
  console.log("GRAPES rows:", grows);
  await go("/best");
  const brows = await page.$$eval(".tablewrap tbody tr", (e) => e.length);
  console.log("BEST rows:", brows);
  await go("/trips");
  const tcards = await page.$$eval(".tcard", (e) => e.length);
  await page.screenshot({ path: "verify_trips.png" });
  console.log("TRIPS cards:", tcards);

  // AI CHAT round-trip
  await go("/ask");
  await page.fill(".chat-input input", "Which houses should I visit in Champagne?");
  await page.click(".chat-input .btn");
  await page.waitForTimeout(4000);
  const bubbles = await page.$$eval(".msg .bubble", (e) => e.map((b) => b.textContent.slice(0, 80)));
  await page.screenshot({ path: "verify_ask.png" });
  console.log("CHAT bubbles:", JSON.stringify(bubbles));

  console.log("ERRORS:", errors.length ? "\n  " + errors.join("\n  ") : "none");
  await browser.close();
})();
