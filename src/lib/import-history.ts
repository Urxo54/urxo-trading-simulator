export interface CsvInspectionSummary {
  count: number;
  firstTimestamp: number | null;
  lastTimestamp: number | null;
}

export interface UtcDateRange {
  from: string;
  to: string;
  start: number;
  end: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Dukascopy treats "from" as inclusive and "to" as exclusive.
 * Dates are UTC calendar dates in YYYY-MM-DD format.
 */
export function createUtcDateRange(from: string, to: string): UtcDateRange {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(from) || !datePattern.test(to)) {
    throw new Error("Dates must use YYYY-MM-DD format.");
  }

  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) ||
      new Date(start).toISOString().slice(0, 10) !== from ||
      new Date(end).toISOString().slice(0, 10) !== to ||
      end <= start) {
    throw new Error("The end date must be later than the valid start date.");
  }

  return { from, to, start, end };
}

export function buildDukascopyArgs(options: {
  instrument: string;
  range: UtcDateRange;
  directory: string;
  fileName: string;
}): string[] {
  const { instrument, range, directory, fileName } = options;
  return [
    "--yes",
    "dukascopy-node",
    "-i",
    instrument,
    "-from",
    range.from,
    "-to",
    range.to,
    "-t",
    "m1",
    "-f",
    "csv",
    "-dir",
    directory,
    "-fn",
    fileName,
    "--retries",
    "5",
    "--retry-pause",
    "2000",
    "--batch-size",
    "10",
    "--batch-pause",
    "1000",
    "--retry-on-empty",
    "--cache",
  ];
}

/**
 * Reject empty, out-of-range, or suspiciously incomplete downloads.
 * The edge tolerance is configurable so short-range tests don't inherit
 * the seven-day tolerance used for monthly production chunks.
 */
export function isInspectionWithinRange(
  inspection: CsvInspectionSummary,
  range: UtcDateRange,
  edgeToleranceDays = 7,
): boolean {
  if (
    !Number.isFinite(edgeToleranceDays) ||
    edgeToleranceDays < 0 ||
    inspection.count <= 0 ||
    inspection.firstTimestamp === null ||
    inspection.lastTimestamp === null
  ) {
    return false;
  }

  const tolerance = edgeToleranceDays * DAY_MS;
  return (
    inspection.firstTimestamp >= range.start &&
    inspection.lastTimestamp < range.end &&
    inspection.firstTimestamp <= range.start + tolerance &&
    inspection.lastTimestamp >= range.end - tolerance
  );
}
