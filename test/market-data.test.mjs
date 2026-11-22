import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { inspectHistoricalCsv } from "../src/lib/market-data.ts";

async function makeCsv(t, contents) {
  const directory = await mkdtemp(path.join(tmpdir(), "urxo-market-data-"));
  const filePath = path.join(directory, "candles.csv");
  await writeFile(filePath, contents, "utf8");
  t.after(() => rm(directory, { recursive: true, force: true }));
  return filePath;
}

test("inspects valid candles and ignores malformed or impossible OHLC rows", async (t) => {
  const filePath = await makeCsv(
    t,
    [
      "timestamp,open,high,low,close",
      "1700000000000,1.1000,1.1200,1.0900,1.1100",
      "not-a-timestamp,1,2,0.5,1.5",
      "1700000060000,1.1100,1.1000,1.0800,1.0900",
      "1700000120000,1.1100,1.1300,1.1000,1.1200",
      "",
    ].join("\n"),
  );

  const result = await inspectHistoricalCsv(filePath, { force: true });

  assert.equal(result.count, 2);
  assert.equal(result.firstTimestamp, 1700000000000);
  assert.equal(result.lastTimestamp, 1700000120000);
  assert.ok(result.sizeBytes > 0);
  assert.ok(Number.isFinite(Date.parse(result.modifiedAt)));
});

test("supports Windows-style CRLF CSV files", async (t) => {
  const filePath = await makeCsv(
    t,
    "timestamp,open,high,low,close\r\n1700000000000,1,2,0.5,1.5\r\n",
  );

  const result = await inspectHistoricalCsv(filePath, { force: true });

  assert.equal(result.count, 1);
  assert.equal(result.firstTimestamp, 1700000000000);
  assert.equal(result.lastTimestamp, 1700000000000);
});

test("force option bypasses the inspection cache after a file changes", async (t) => {
  const filePath = await makeCsv(
    t,
    "timestamp,open,high,low,close\n1700000000000,1,2,0.5,1.5\n",
  );

  const first = await inspectHistoricalCsv(filePath, { force: true });
  await writeFile(
    filePath,
    [
      "timestamp,open,high,low,close",
      "1700000000000,1,2,0.5,1.5",
      "1700000060000,1,2,0.5,1.5",
    ].join("\n"),
    "utf8",
  );

  const refreshed = await inspectHistoricalCsv(filePath, { force: true });

  assert.equal(first.count, 1);
  assert.equal(refreshed.count, 2);
});
