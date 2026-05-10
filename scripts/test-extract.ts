/**
 * Direct integration test: reads a sample PDF, calls the extraction
 * function, prints the parsed JSON. Useful to verify the Anthropic
 * key + model + tool schema without going through the UI.
 *
 * Run: npm run test:extract -- samples/01-acme-cloud.pdf
 */
import "./load-env";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { extractInvoice } from "../src/lib/extract";

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: tsx scripts/test-extract.ts <path/to/file.pdf>");
    process.exit(1);
  }
  const path = resolve(process.cwd(), arg);
  const buffer = await readFile(path);
  const ext = path.toLowerCase().split(".").pop();
  const mime =
    ext === "pdf"
      ? "application/pdf"
      : ext === "png"
      ? "image/png"
      : ext === "jpg" || ext === "jpeg"
      ? "image/jpeg"
      : "application/octet-stream";

  console.log(`Extracting ${path} (${mime}, ${buffer.length} bytes)...`);
  const t0 = Date.now();
  const result = await extractInvoice({ buffer, mime });
  console.log(`✓ Done in ${Date.now() - t0}ms`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
