import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("sidebar exposes every workspace and system destination", async () => {
  const sidebar = await read("src/components/sidebar.tsx");
  for (const route of ["/", "/training", "/statistics", "/history", "/market-data", "/settings", "/help"]) {
    assert.ok(sidebar.includes('href:"' + route + '"'), "missing navigation destination " + route);
  }
  assert.match(sidebar, /lg:hidden/);
  assert.match(sidebar, /lg:flex/);
});

test("every sidebar destination has a page", async () => {
  for (const route of ["statistics", "history", "market-data", "settings", "help"]) {
    const page = await read("src/app/" + route + "/page.tsx");
    assert.match(page, /export default function/);
    assert.match(page, /<Sidebar\s*\/?\s*>/);
  }
  const dashboard = await read("src/app/page.tsx");
  const training = await read("src/app/training/page.tsx");
  assert.match(dashboard, /<Sidebar\s*\/?\s*>/);
  assert.match(training, /<Sidebar\s*\/?\s*>/);
});

test("market data page reads the real market-data API and supports refresh", async () => {
  const page = await read("src/app/market-data/page.tsx");
  assert.match(page, /fetch\("\/api\/market-data"/);
  assert.match(page, /onClick=\\{\\(\\)=>\\{setLoading\\(true\\);void refresh\\(\\);\\}\\}/);
  assert.match(page, /m\.count\.toLocaleString\(\)/);
});

test("settings persist preferences in browser storage and can restore defaults", async () => {
  const page = await read("src/app/settings/page.tsx");
  assert.match(page, /localStorage\.setItem\("urxo-settings"/);
  assert.match(page, /localStorage\.removeItem\("urxo-settings"/);
  assert.match(page, /Save settings/);
  assert.match(page, /Restore defaults/);
});

test("statistics and history never fabricate unavailable trading records", async () => {
  const statistics = await read("src/app/statistics/page.tsx");
  const history = await read("src/app/history/page.tsx");
  assert.match(statistics, /not implemented yet/);
  assert.match(history, /No saved sessions yet/);
});
