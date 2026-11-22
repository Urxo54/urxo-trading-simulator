import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createInterface } from "node:readline";

export const historicalMarkets = [
  {
    id: "eurusd",
    label: "EUR/USD",
    fileName: "eurusd-m1-bid-2024-01-01-2026-01-01.csv",
  },
  {
    id: "xauusd",
    label: "Gold (XAU/USD)",
    fileName: "xauusd-m1-bid-2024-01-01-2026-01-01.csv",
  },
  {
    id: "usatechidxusd",
    label: "NAS100",
    fileName: "usatechidxusd-m1-bid-2024-01-01-2026-01-01.csv",
  },
] as const;

export type HistoricalMarketId = (typeof historicalMarkets)[number]["id"];

export type CsvInspection = {
  count: number;
  firstTimestamp: number | null;
  lastTimestamp: number | null;
  sizeBytes: number;
  modifiedAt: string;
};

export async function inspectHistoricalCsv(filePath: string): Promise<CsvInspection> {
  const fileStats = await stat(filePath);
  const lines = createInterface({
    input: createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  let count = 0;
  let firstTimestamp: number | null = null;
  let lastTimestamp: number | null = null;

  for await (const line of lines) {
    if (!line || line.startsWith("timestamp,")) continue;

    const columns = line.split(",");
    if (columns.length < 5) continue;

    const timestamp = Number(columns[0]);
    const open = Number(columns[1]);
    const high = Number(columns[2]);
    const low = Number(columns[3]);
    const close = Number(columns[4]);

    if (
      !Number.isSafeInteger(timestamp) ||
      timestamp <= 0 ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close) ||
      open <= 0 ||
      high <= 0 ||
      low <= 0 ||
      close <= 0 ||
      high < low ||
      high < Math.max(open, close) ||
      low > Math.min(open, close)
    ) {
      continue;
    }

    count += 1;
    if (firstTimestamp === null || timestamp < firstTimestamp) firstTimestamp = timestamp;
    if (lastTimestamp === null || timestamp > lastTimestamp) lastTimestamp = timestamp;
  }

  return {
    count,
    firstTimestamp,
    lastTimestamp,
    sizeBytes: fileStats.size,
    modifiedAt: fileStats.mtime.toISOString(),
  };
}
