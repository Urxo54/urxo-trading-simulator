import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { inspectHistoricalCsv } from "../src/lib/market-data.ts";
import {
  buildDukascopyArgs,
  createUtcDateRange,
  isInspectionWithinRange,
} from "../src/lib/import-history.ts";

test("builds Dukascopy CLI arguments for a three-day EUR/USD test range", () => {
  const range = createUtcDateRange("2025-01-06", "2025-01-09");
  const args = buildDukascopyArgs({
    instrument: "eurusd",
    range,
    directory: ".test-import-staging",
    fileName: "eurusd-m1-bid-2025-01-06-2025-01-09",
  });

  assert.deepEqual(args, [
    "--yes",
    "dukascopy-node",
    "-i", "eurusd",
    "-from", "2025-01-06",
    "-to", "2025-01-09",
    "-t", "m1",
    "-f", "csv",
    "-dir", ".test-import-staging",
    "-fn", "eurusd-m1-bid-2025-01-06-2025-01-09",
    "--retries", "5",
    "--retry-pause", "2000",
    "--batch-size", "10",
    "--batch-pause", "1000",
    "--retry-on-empty",
    "--cache",
  ]);
});

test("accepts only valid, increasing UTC calendar date ranges", () => {
  assert.deepEqual(createUtcDateRange("2025-01-06", "2025-01-09"), {
    from: "2025-01-06",
    to: "2025-01-09",
    start: Date.UTC(2025, 0, 6),
    end: Date.UTC(2025, 0, 9),
  });

  assert.throws(() => createUtcDateRange("2025-02-30", "2025-03-01"));
  assert.throws(() => createUtcDateRange("2025-01-09", "2025-01-06"));
  assert.throws(() => createUtcDateRange("2025-1-6", "2025-01-09"));
});

test("validates a small three-day CSV without touching production history", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "urxo-import-smoke-"));
  const csvPath = path.join(directory, "eurusd-three-days.csv");
  t.after(() => rm(directory, { recursive: true, force: true }));

  const range = createUtcDateRange("2025-01-06", "2025-01-09");
  const csv = [
    "timestamp,open,high,low,close",
    "1736121600000,1.0300,1.0310,1.0290,1.0305",
    "1736208000000,1.0305,1.0320,1.0300,1.0315",
    "1736380740000,1.0315,1.0330,1.0310,1.0325",
    "",
  ].join("\n");
  await writeFile(csvPath, csv, "utf8");

  const inspection = await inspectHistoricalCsv(csvPath, { force: true });

  assert.equal(inspection.count, 3);
  assert.equal(inspection.firstTimestamp, 1736121600000);
  assert.equal(inspection.lastTimestamp, 1736380740000);
  assert.equal(isInspectionWithinRange(inspection, range, 1), true);
  assert.equal(isInspectionWithinRange(inspection, range, 0), false);
});

test("rejects empty and out-of-range download results", () => {
  const range = createUtcDateRange("2025-01-06", "2025-01-09");

  assert.equal(
    isInspectionWithinRange(
      { count: 0, firstTimestamp: null, lastTimestamp: null },
      range,
      1,
    ),
    false,
  );
  assert.equal(
    isInspectionWithinRange(
      { count: 2, firstTimestamp: range.start - 60_000, lastTimestamp: range.end - 60_000 },
      range,
      1,
    ),
    false,
  );
  assert.equal(
    isInspectionWithinRange(
      { count: 2, firstTimestamp: range.start, lastTimestamp: range.end },
      range,
      1,
    ),
    false,
  );
});
