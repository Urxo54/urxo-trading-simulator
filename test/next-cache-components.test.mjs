import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const appDirectory = path.resolve("src/app");
const forbiddenRouteConfig = /export\\s+const\\s+(runtime|dynamic|dynamicParams|revalidate|fetchCache)\\s*=/;

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectSourceFiles(entryPath));
    } else if (/\\.(?:js|jsx|ts|tsx)$/.test(entry.name)) {
      files.push(entryPath);
    }
  }

  return files;
}

test("Cache Components is enabled in the Next.js configuration", async () => {
  const config = await readFile(path.resolve("next.config.ts"), "utf8");
  assert.match(config, /cacheComponents\\s*:\\s*true/);
});

test("App Router files do not export legacy route segment options with Cache Components", async () => {
  const files = await collectSourceFiles(appDirectory);
  const violations = [];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    const match = source.match(forbiddenRouteConfig);
    if (match) {
      violations.push(`${path.relative(process.cwd(), file)} exports ${match[1]}`);
    }
  }

  assert.deepEqual(violations, [], violations.join("\\n"));
});
