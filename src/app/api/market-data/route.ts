import { readdir } from "node:fs/promises";
import path from "node:path";
import { historicalMarkets, inspectHistoricalCsv } from "@/lib/market-data";

export const runtime = "nodejs";

const earliestAcceptedTimestamp = Date.UTC(2024, 0, 10);
const latestAcceptedTimestamp = Date.UTC(2025, 11, 20);

function isCompletePeriod(inspection: {
  count: number;
  firstTimestamp: number | null;
  lastTimestamp: number | null;
}) {
  return (
    inspection.count > 0 &&
    inspection.firstTimestamp !== null &&
    inspection.lastTimestamp !== null &&
    inspection.firstTimestamp <= earliestAcceptedTimestamp &&
    inspection.lastTimestamp >= latestAcceptedTimestamp &&
    inspection.lastTimestamp < Date.UTC(2026, 0, 1)
  );
}

export async function GET() {
  const directory = path.join(process.cwd(), "data", "historical");

  let entries: string[];
  try {
    entries = await readdir(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return Response.json({
        period: "2024–2025",
        markets: historicalMarkets.map((market) => ({
          id: market.id,
          label: market.label,
          status: "missing",
          count: 0,
          sizeBytes: 0,
          modifiedAt: null,
        })),
      });
    }
    console.error("Market data directory could not be read:", error);
    return Response.json(
      { error: "Could not inspect the local market data folder." },
      { status: 500 },
    );
  }

  const markets = await Promise.all(
    historicalMarkets.map(async (market) => {
      const finalPath = path.join(directory, market.fileName);

      if (entries.includes(market.fileName)) {
        try {
          const inspection = await inspectHistoricalCsv(finalPath);
          const complete = isCompletePeriod(inspection);
          return {
            id: market.id,
            label: market.label,
            status: complete ? "ready" : inspection.count > 0 ? "partial" : "invalid",
            fileName: market.fileName,
            ...inspection,
          };
        } catch (error) {
          console.error(`Could not inspect ${market.fileName}:`, error);
          return {
            id: market.id,
            label: market.label,
            status: "error",
            count: 0,
            sizeBytes: 0,
            modifiedAt: null,
          };
        }
      }

      const buildingName = `${market.fileName}.building`;
      if (entries.includes(buildingName)) {
        try {
          const inspection = await inspectHistoricalCsv(path.join(directory, buildingName));
          return {
            id: market.id,
            label: market.label,
            status: "partial",
            fileName: buildingName,
            ...inspection,
          };
        } catch (error) {
          console.error(`Could not inspect building dataset ${buildingName}:`, error);
        }
      }

      const partialNames = entries
        .filter((name) => name.startsWith(`${market.fileName}.`) && name.endsWith(".part"))
        .sort();

      if (partialNames.length > 0) {
        const partialName = partialNames[partialNames.length - 1];
        try {
          const inspection = await inspectHistoricalCsv(path.join(directory, partialName));
          return {
            id: market.id,
            label: market.label,
            status: "partial",
            fileName: partialName,
            ...inspection,
          };
        } catch (error) {
          console.error(`Could not inspect partial ${partialName}:`, error);
          return {
            id: market.id,
            label: market.label,
            status: "partial",
            fileName: partialName,
            count: 0,
            sizeBytes: 0,
            modifiedAt: null,
          };
        }
      }

      return {
        id: market.id,
        label: market.label,
        status: "missing",
        count: 0,
        sizeBytes: 0,
        modifiedAt: null,
      };
    }),
  );

  return Response.json({ period: "2024–2025", markets });
}
