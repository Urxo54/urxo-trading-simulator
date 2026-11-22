import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { GET } from "../src/app/api/historical/[instrument]/route.ts";

const fileName = "eurusd-m1-bid-2024-01-01-2026-01-01.csv";

async function withHistoricalData(t, csv) {
  const originalDirectory = process.cwd();
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "urxo-history-route-"));
  const dataDirectory = path.join(temporaryDirectory, "data", "historical");

  await mkdir(dataDirectory, { recursive: true });
  await writeFile(path.join(dataDirectory, fileName), csv, "utf8");
  process.chdir(temporaryDirectory);

  t.after(async () => {
    process.chdir(originalDirectory);
    await rm(temporaryDirectory, { recursive: true, force: true });
  });
}

function request(timeframe = "H1", instrument = "eurusd") {
  return new Request(
    `http://localhost/api/historical/${instrument}?timeframe=${timeframe}`,
  );
}

function params(instrument = "eurusd") {
  return { params: Promise.resolve({ instrument }) };
}

test("returns 404 for an unknown instrument", async () => {
  const response = await GET(request("H1", "unknown"), params("unknown"));
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "Unknown instrument." });
});

test("returns 400 for an unsupported timeframe", async () => {
  const response = await GET(request("M15"), params());
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Unknown timeframe." });
});

test("aggregates minute candles into ordered H1 candles with correct OHLC values", async (t) => {
  await withHistoricalData(
    t,
    [
      "timestamp,open,high,low,close",
      "1704067200000,1.1000,1.1200,1.0900,1.1100",
      "1704067260000,1.1100,1.1300,1.0800,1.1250",
      "1704070800000,1.1250,1.1400,1.1200,1.1350",
      "bad-row",
    ].join("\n"),
  );

  const response = await GET(request("H1"), params());
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.instrument, "eurusd");
  assert.equal(body.timeframe, "H1");
  assert.equal(body.count, 2);
  assert.deepEqual(body.candles, [
    {
      time: 1704067200,
      open: 1.1,
      high: 1.13,
      low: 1.08,
      close: 1.125,
    },
    {
      time: 1704070800,
      open: 1.125,
      high: 1.14,
      low: 1.12,
      close: 1.135,
    },
  ]);
});

test("aggregates H4 and D1 data into their respective UTC time buckets", async (t) => {
  await withHistoricalData(
    t,
    [
      "timestamp,open,high,low,close",
      "1704067200000,1.0,1.2,0.9,1.1",
      "1704070800000,1.1,1.3,1.0,1.2",
      "1704110400000,1.2,1.4,1.1,1.3",
    ].join("\n"),
  );

  const h4Response = await GET(request("H4"), params());
  const h4 = await h4Response.json();
  assert.equal(h4Response.status, 200);
  assert.equal(h4.count, 2);
  assert.equal(h4.candles[0].time, 1704067200);
  assert.equal(h4.candles[0].open, 1);
  assert.equal(h4.candles[0].high, 1.3);
  assert.equal(h4.candles[0].low, 0.9);
  assert.equal(h4.candles[0].close, 1.2);

  const d1Response = await GET(request("D1"), params());
  const d1 = await d1Response.json();
  assert.equal(d1Response.status, 200);
  assert.equal(d1.count, 1);
  assert.equal(d1.candles[0].open, 1);
  assert.equal(d1.candles[0].high, 1.4);
  assert.equal(d1.candles[0].low, 0.9);
  assert.equal(d1.candles[0].close, 1.3);
});

test("returns 422 when the historical CSV has no valid candles", async (t) => {
  await withHistoricalData(
    t,
    "timestamp,open,high,low,close\ninvalid,row,without,numbers,here\n",
  );

  const response = await GET(request("H1"), params());
  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), {
    error: "The historical file contains no valid candles.",
  });
});
