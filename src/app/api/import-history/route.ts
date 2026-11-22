import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { historicalMarkets, inspectHistoricalCsv } from "@/lib/market-data";

export const runtime = "nodejs";
export const maxDuration = 600;

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

export async function POST() {
  if (importInProgress) {
    return Response.json(
      { error: "A historical data download is already running." },
      { status: 409 },
    );
  }

  importInProgress = true;
  const outputDirectory = path.join(process.cwd(), "data", "historical");
  let activeChild: ReturnType<typeof spawn> | null = null;
  let cancelled = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        await mkdir(outputDirectory, { recursive: true });

        for (let index = 0; index < historicalMarkets.length; index += 1) {
          if (cancelled) throw new Error("Download was cancelled.");

          const market = historicalMarkets[index];
          send(controller, encoder, {
            type: "progress",
            instrument: market.id,
            label: market.label,
            current: index + 1,
            total: historicalMarkets.length,
            message: `Downloading ${market.label} · 2024–2025...`,
          });

          const args = [
            "--yes",
            "dukascopy-node",
            "-i",
            market.id,
            "-from",
            "2024-01-01",
            "-to",
            "2026-01-01",
            "-t",
            "m1",
            "-f",
            "csv",
            "-dir",
            outputDirectory,
            "--retries",
            "5",
            "--retry-pause",
            "2000",
            "--batch-size",
            "1",
            "--batch-pause",
            "1000",
            "--retry-on-empty",
            "--cache",
          ];

          const exitCode = await new Promise<number>((resolve, reject) => {
            const child = spawn("npx", args, {
              cwd: process.cwd(),
              shell: process.platform === "win32",
              windowsHide: true,
            });
            activeChild = child;

            child.stdout.on("data", (chunk: Buffer) => {
              const message = chunk.toString().trim();
              if (message) {
                send(controller, encoder, {
                  type: "log",
                  instrument: market.id,
                  message: message.slice(-500),
                });
              }
            });

            child.stderr.on("data", (chunk: Buffer) => {
              const message = chunk.toString().trim();
              if (message) {
                send(controller, encoder, {
                  type: "log",
                  instrument: market.id,
                  message: message.slice(-500),
                });
              }
            });

            child.once("error", reject);
            child.once("close", (code) => {
              activeChild = null;
              resolve(code ?? 1);
            });
          });

          if (cancelled) throw new Error("Download was cancelled.");
          if (exitCode !== 0) {
            throw new Error(`${market.label}: downloader exited with code ${exitCode}. Review the download log above.`);
          }

          const filePath = path.join(outputDirectory, market.fileName);
          let inspection;
          try {
            inspection = await inspectHistoricalCsv(filePath);
          } catch {
            throw new Error(
              `${market.label}: downloader finished, but the expected CSV file was not created. The download is not marked as complete.`,
            );
          }

          if (inspection.count === 0) {
            throw new Error(`${market.label}: the CSV file exists but contains no valid candles.`);
          }

          send(controller, encoder, {
            type: "completed",
            instrument: market.id,
            label: market.label,
            count: inspection.count,
            sizeBytes: inspection.sizeBytes,
          });
        }

        send(controller, encoder, {
          type: "done",
          message: "All three 2024–2025 datasets downloaded and verified.",
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
