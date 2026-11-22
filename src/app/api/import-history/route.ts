import { spawn } from "node:child_process";
import { appendFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { historicalMarkets, inspectHistoricalCsv } from "@/lib/market-data";

export const runtime = "nodejs";
export const maxDuration = 600;

const months = Array.from({ length: 24 }, (_, index) => {
  const date = new Date(Date.UTC(2024, index, 1));
  const nextDate = new Date(Date.UTC(2024, index + 1, 1));
  return {
    from: date.toISOString().slice(0, 10),
    to: nextDate.toISOString().slice(0, 10),
    key: date.toISOString().slice(0, 7),
    start: date.getTime(),
    end: nextDate.getTime(),
  };
});

let importInProgress = false;

function send(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  payload: Record<string, unknown>,
) {
  try {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
  } catch {
    // The browser may leave the page while a download is running.
  }
}

async function runDownloader(
  args: string[],
  onOutput: (message: string) => void,
  setChild: (child: ReturnType<typeof spawn>) => void,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("npx", args, {
      cwd: process.cwd(),
      shell: process.platform === "win32",
      windowsHide: true,
    });
    setChild(child);

    let outputTail = "";
    const collect = (chunk: Buffer) => {
      const message = chunk.toString().trim();
      if (!message) return;
      outputTail = `${outputTail}\n${message}`.slice(-3000);
      onOutput(message);
    };

    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `Dukascopy exited with code ${code ?? 1}.${outputTail ? ` Details: ${outputTail}` : ""}`,
          ),
        );
      }
    });
  });
}

export async function POST() {
  if (importInProgress) {
    return Response.json(
      { error: "A historical data download is already running." },
      { status: 409 },
    );
  }

  importInProgress = true;
  const dataDirectory = path.join(process.cwd(), "data", "historical");
  const stagingDirectory = path.join(dataDirectory, ".import-staging");
  let activeChild: ReturnType<typeof spawn> | null = null;
  let cancelled = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let completedUnits = 0;
      const totalUnits = historicalMarkets.length * months.length;

      try {
        await mkdir(stagingDirectory, { recursive: true });

        for (const market of historicalMarkets) {
          if (cancelled) throw new Error("Download was cancelled.");

          const assembledPath = path.join(dataDirectory, `${market.fileName}.building`);
          await rm(assembledPath, { force: true });
          let hasHeader = false;
          let marketCandleCount = 0;
          let csvHeader: string | null = null;

          for (const month of months) {
            if (cancelled) throw new Error("Download was cancelled.");

            const fileStem = `${market.id}-m1-bid-${month.from}-${month.to}`;
            const monthlyPath = path.join(stagingDirectory, `${fileStem}.csv`);
            let inspection: Awaited<ReturnType<typeof inspectHistoricalCsv>> | null = null;

            try {
              inspection = await inspectHistoricalCsv(monthlyPath);
              if (
                inspection.count === 0 ||
                inspection.firstTimestamp === null ||
                inspection.lastTimestamp === null ||
                inspection.firstTimestamp < month.start ||
                inspection.lastTimestamp >= month.end
              ) {
                inspection = null;
              }
            } catch {
              inspection = null;
            }

            if (!inspection) {
              await rm(monthlyPath, { force: true });
              send(controller, encoder, {
                type: "progress",
                instrument: market.id,
                label: market.label,
                month: month.key,
                monthCurrent: months.indexOf(month) + 1,
                monthTotal: months.length,
                completedUnits,
                totalUnits,
                message: `Downloading ${market.label} · ${month.key}...`,
              });

              const args = [
                "--yes",
                "dukascopy-node",
                "-i",
                market.id,
                "-from",
                month.from,
                "-to",
                month.to,
                "-t",
                "m1",
                "-f",
                "csv",
                "-dir",
                stagingDirectory,
                "-fn",
                fileStem,
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

              await runDownloader(
                args,
                (message) => {
                  send(controller, encoder, {
                    type: "log",
                    instrument: market.id,
                    message: message.slice(-500),
                  });
                },
                (child) => {
                  activeChild = child;
                },
              );

              if (cancelled) throw new Error("Download was cancelled.");
              inspection = await inspectHistoricalCsv(monthlyPath);
              if (
                inspection.count === 0 ||
                inspection.firstTimestamp === null ||
                inspection.lastTimestamp === null ||
                inspection.firstTimestamp < month.start ||
                inspection.lastTimestamp >= month.end
              ) {
                throw new Error(
                  `${market.label} · ${month.key}: downloaded file failed validation. It will not be added to the final dataset.`,
                );
              }
            }

            const csv = await readFile(monthlyPath, "utf8");
            const lines = csv.split(/\r?\n/);
            const header = lines.shift()?.trim();

            if (!header || !header.startsWith("timestamp,")) {
              throw new Error(`${market.label} · ${month.key}: CSV header is missing or invalid.`);
            }

            const dataRows = lines.filter((line) => line.trim().length > 0);
            if (dataRows.length !== inspection.count) {
              throw new Error(
                `${market.label} · ${month.key}: CSV row validation failed (${dataRows.length} rows, ${inspection.count} valid candles).`,
              );
            }
            if (csvHeader !== null && csvHeader !== header) {
              throw new Error(`${market.label} · ${month.key}: CSV format changed between monthly files.`);
            }

            if (!hasHeader) {
              csvHeader = header;
              await writeFile(assembledPath, `${header}\n`, "utf8");
              hasHeader = true;
            }
            await appendFile(assembledPath, `${dataRows.join("\n")}\n`, "utf8");

            marketCandleCount += inspection.count;
            completedUnits += 1;
            send(controller, encoder, {
              type: "month-completed",
              instrument: market.id,
              label: market.label,
              month: month.key,
              monthCurrent: months.indexOf(month) + 1,
              monthTotal: months.length,
              completedUnits,
              totalUnits,
              count: inspection.count,
              message: `${market.label} · ${month.key} verified`,
            });
          }

          const finalInspection = await inspectHistoricalCsv(assembledPath);
          const expectedStart = Date.UTC(2024, 0, 10);
          const expectedEnd = Date.UTC(2025, 11, 20);
          if (
            finalInspection.count !== marketCandleCount ||
            finalInspection.firstTimestamp === null ||
            finalInspection.lastTimestamp === null ||
            finalInspection.firstTimestamp > expectedStart ||
            finalInspection.lastTimestamp < expectedEnd
          ) {
            throw new Error(
              `${market.label}: the assembled 2024–2025 dataset failed full-period validation.`,
            );
          }

          await rename(assembledPath, path.join(dataDirectory, market.fileName));
          send(controller, encoder, {
            type: "completed",
            instrument: market.id,
            label: market.label,
            count: finalInspection.count,
            sizeBytes: finalInspection.sizeBytes,
          });
        }

        send(controller, encoder, {
          type: "done",
          message: "All three 2024–2025 datasets downloaded, assembled and verified.",
          completedUnits,
          totalUnits,
        });
      } catch (error) {
        send(controller, encoder, {
          type: "error",
          message: error instanceof Error ? error.message : "Historical data download failed.",
        });
      } finally {
        importInProgress = false;
        try {
          controller.close();
        } catch {
          // The stream was already cancelled by the client.
        }
      }
    },
    cancel() {
      cancelled = true;
      activeChild?.kill();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
