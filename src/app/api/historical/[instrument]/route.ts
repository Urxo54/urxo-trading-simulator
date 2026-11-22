import { readFile } from "node:fs/promises";
import path from "node:path";

type Instrument = "eurusd" | "xauusd" | "usatechidxusd";
type Timeframe = "D1" | "H4" | "H1";

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

const instruments: Record<Instrument, string> = {
  eurusd: "eurusd-m1-bid-2025-01-01-2025-02-01.csv",
  xauusd: "xauusd-m1-bid-2025-01-01-2025-02-01.csv",
  usatechidxusd: "usatechidxusd-m1-bid-2025-01-01-2025-02-01.csv",
};

const intervals: Record<Timeframe, number> = {
  D1: 24 * 60 * 60,
  H4: 4 * 60 * 60,
  H1: 60 * 60,
};

function aggregateCandles(rows: string[], timeframe: Timeframe): Candle[] {
  const interval = intervals[timeframe];
  const candles = new Map<number, Candle>();

  for (const row of rows) {
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
    ) {
      continue;
    }

    const timestamp = Math.floor(timestampMs / 1000);
    const bucketTime = Math.floor(timestamp / interval) * interval;
    const existing = candles.get(bucketTime);

    if (!existing) {
      candles.set(bucketTime, {
        time: bucketTime,
        open,
        high,
        low,
        close,
      });
    } else {
      existing.high = Math.max(existing.high, high);
      existing.low = Math.min(existing.low, low);
      existing.close = close;
    }
  }

  return Array.from(candles.values()).sort((a, b) => a.time - b.time);
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
  const filePath = path.join(
    process.cwd(),
    "data",
    "historical",
    instruments[instrument],
  );

  try {
    const csv = await readFile(filePath, "utf8");
    const rows = csv.trim().split(/\r?\n/).slice(1);
    const candles = aggregateCandles(rows, timeframe);

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
      dateRange: "2025-01-01 to 2025-02-01",
      count: candles.length,
      candles,
    });
  } catch (error) {
    console.error("Historical data load failed:", error);
    return Response.json(
      { error: "Historical data file could not be read." },
      { status: 500 },
    );
  }
}
