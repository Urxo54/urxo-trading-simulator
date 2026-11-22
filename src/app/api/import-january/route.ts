import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const maxDuration = 600;

let importInProgress = false;

const instruments = [
  { id: "eurusd", label: "EUR/USD" },
  { id: "xauusd", label: "Gold (XAU/USD)" },
  { id: "usatechidxusd", label: "NAS100" },
] as const;

function send(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  payload: Record<string, unknown>,
) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
}

export async function POST() {
  if (importInProgress) {
    return Response.json(
      { error: "An import is already running." },
      { status: 409 },
    );
  }

  importInProgress = true;
  const outputDirectory = path.join(process.cwd(), "data", "historical");

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        await mkdir(outputDirectory, { recursive: true });

        for (let index = 0; index < instruments.length; index += 1) {
          const instrument = instruments[index];

          send(controller, encoder, {
            type: "progress",
            instrument: instrument.id,
            label: instrument.label,
            current: index + 1,
            total: instruments.length,
            message: `Downloading ${instrument.label}...`,
          });

          const args = [
            "--yes",
            "dukascopy-node",
            "-i",
            instrument.id,
            "-from",
            "2025-01-01",
            "-to",
            "2025-02-01",
            "-t",
            "m1",
            "-f",
            "csv",
            "-dir",
            "./data/historical",
            "--retries",
            "5",
            "--retry-pause",
            "2000",
            "--batch-size",
            "1",
            "--batch-pause",
            "1000",
            "--cache",
          ];

          const exitCode = await new Promise<number>((resolve, reject) => {
            const child = spawn("npx", args, {
              cwd: process.cwd(),
              shell: process.platform === "win32",
              windowsHide: true,
            });

            child.stdout.on("data", (chunk: Buffer) => {
              const message = chunk.toString().trim();
              if (message) {
                send(controller, encoder, {
                  type: "log",
                  instrument: instrument.id,
                  message: message.slice(-500),
                });
              }
            });

            child.stderr.on("data", (chunk: Buffer) => {
              const message = chunk.toString().trim();
              if (message) {
                send(controller, encoder, {
                  type: "log",
                  instrument: instrument.id,
                  message: message.slice(-500),
                });
              }
            });

            child.on("error", reject);
            child.on("close", (code) => resolve(code ?? 1));
          });

          if (exitCode !== 0) {
            throw new Error(`${instrument.label}: downloader exited with code ${exitCode}`);
          }

          send(controller, encoder, {
            type: "completed",
            instrument: instrument.id,
            label: instrument.label,
          });
        }

        send(controller, encoder, {
          type: "done",
          message: "January 2025 data downloaded for all three markets.",
        });
      } catch (error) {
        send(controller, encoder, {
          type: "error",
          message: error instanceof Error ? error.message : "Import failed.",
        });
      } finally {
        importInProgress = false;
        controller.close();
      }
    },
    cancel() {
      importInProgress = false;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
