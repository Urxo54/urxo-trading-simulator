import { readFile, stat } from "node:fs/promises";
import path from "node:path";

type Instrument = "eurusd" | "xauusd" | "usatechidxusd";
type Timeframe = "MN1" | "W1" | "D1" | "H4" | "H1";

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

const instruments: Record<Instrument, string> = {
  eurusd: "eurusd-m1-bid-2024-01-01-2026-01-01.csv",
  xauusd: "xauusd-m1-bid-2024-01-01-2026-01-01.csv",
  usatechidxusd: "usatechidxusd-m1-bid-2024-01-01-2026-01-01.csv",
};

const intervals: Record<Timeframe, number> = {
  MN1: 30 * 24 * 60 * 60,
  W1: 7 * 24 * 60 * 60,
  D1: 24 * 60 * 60,
  H4: 4 * 60 * 60,
  H1: 60 * 60,
};

// Keep parsed candle arrays between requests. A promise cache also prevents
// simultaneous requests from parsing the same large CSV more than once.
const candleCache = new Map<string, { signature: string; candles: Candle[] }>();
const inFlight = new Map<string, Promise<Candle[]>>();

function bucketStart(timestamp: number, timeframe: Timeframe): number {
  const date = new Date(timestamp * 1000);
  if (timeframe === "MN1") {
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) / 1000;
  }
  if (timeframe === "W1") {
    const daysSinceMonday = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - daysSinceMonday);
    date.setUTCHours(0, 0, 0, 0);
    return date.getTime() / 1000;
  }
  return Math.floor(timestamp / intervals[timeframe]) * intervals[timeframe];
}

// Dukascopy files are chronological, so buckets can be aggregated in one pass.
// This avoids allocating a Map and sorting every candle on every page visit.
function aggregateCandles(csv: string, timeframe: Timeframe): Candle[] {
  const lines = csv.split(/\r?\n/);
  const candles: Candle[] = [];
  let current: Candle | null = null;
  let currentBucket = -1;

  for (let index = 1; index < lines.length; index += 1) {
    const row = lines[index];
    if (!row) continue;
    const columns = row.split(",");
    if (columns.length < 5) continue;

    const timestampMs = Number(columns[0]);
    const open = Number(columns[1]);
    const high = Number(columns[2]);
    const low = Number(columns[3]);
    const close = Number(columns[4]);

    if (
      !Number.isFinite(timestampMs) ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close)
    ) continue;

    const timestamp = Math.floor(timestampMs / 1000);
    const bucket = bucketStart(timestamp, timeframe);

    if (bucket !== currentBucket) {
      current = { time: bucket, open, high, low, close };
      candles.push(current);
      currentBucket = bucket;
    } else if (current) {
      current.high = Math.max(current.high, high);
      current.low = Math.min(current.low, low);
      current.close = close;
    }
  }

  return candles;
}

async function getCandles(instrument: Instrument, timeframe: Timeframe): Promise<Candle[]> {
  const key = `${instrument}:${timeframe}`;
  const filePath = path.join(process.cwd(), "data", "historical", instruments[instrument]);
  const fileStats = await stat(filePath);
  const signature = `${fileStats.size}:${fileStats.mtimeMs}`;
  const cached = candleCache.get(key);

  if (cached?.signature === signature) return cached.candles;

  const pending = inFlight.get(key);
  if (pending) return pending;

  const task = readFile(filePath, "utf8").then((csv) => {
    const candles = aggregateCandles(csv, timeframe);
    candleCache.set(key, { signature, candles });
    return candles;
  }).finally(() => {
    inFlight.delete(key);
  });

  inFlight.set(key, task);
  return task;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ instrument: string }> },
) {
  const { instrument: requestedInstrument } = await params;
  const instrument = requestedInstrument.toLowerCase() as Instrument;

  if (!Object.hasOwn(instruments, instrument)) {
    return Response.json({ error: "Unknown instrument." }, { status: 404 });
  }

  const searchParams = new URL(request.url).searchParams;
  const requestedTimeframe = searchParams.get("timeframe") ?? "H1";

  if (!Object.hasOwn(intervals, requestedTimeframe)) {
    return Response.json({ error: "Unknown timeframe." }, { status: 400 });
  }

  const timeframe = requestedTimeframe as Timeframe;

  try {
    const candles = await getCandles(instrument, timeframe);
    if (candles.length === 0) {
      return Response.json(
        { error: "The historical file contains no valid candles." },
        { status: 422 },
      );
    }

    return Response.json({
      instrument,
      timeframe,
      source: "Dukascopy",
      dateRange: "2024-01-01 to 2026-01-01",
      count: candles.length,
      candles,
    }, {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("Historical data load failed:", error);
    return Response.json(
      { error: "Historical data file could not be read." },
      { status: 500 },
    );
  }
}
