/**
 * Copies the visual surface of the codebase into `.design-brief/codebase/`
 * preserving relative paths, so the whole folder can be dragged into a
 * design tool. Skips db/lib (non-visual logic).
 */
import { copyFileSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const DEST = resolve(ROOT, ".design-brief/codebase");

const FILES = [
  "src/app/globals.css",
  "src/app/layout.tsx",
  "src/app/page.tsx",
  "src/app/bills/page.tsx",
  "src/app/bills/[id]/page.tsx",
  "src/app/bills/new/page.tsx",
  "src/app/bills/import/page.tsx",
  "src/app/aging/page.tsx",
  "src/app/vendors/page.tsx",
  // Loading skeletons
  "src/app/bills/loading.tsx",
  "src/app/bills/[id]/loading.tsx",
  "src/app/aging/loading.tsx",
  "src/app/vendors/loading.tsx",
  // Components (all of them — they ARE the design surface)
  "src/components/app-header.tsx",
  "src/components/summary-cards.tsx",
  "src/components/status-badge.tsx",
  "src/components/bills-table.tsx",
  "src/components/bill-actions.tsx",
  "src/components/bill-editor.tsx",
  "src/components/bill-event-timeline.tsx",
  "src/components/file-preview.tsx",
  "src/components/file-uploader.tsx",
  "src/components/csv-importer.tsx",
  "src/components/create-manual-bill-link.tsx",
  "src/components/extraction-pending.tsx",
  "src/components/line-item-splits-dialog.tsx",
  "src/components/repeat-bill-dialog.tsx",
  "src/components/schedule-payment-dialog.tsx",
];

// Wipe and recreate so deletions are reflected.
rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });

let totalBytes = 0;
const copied: string[] = [];
const missing: string[] = [];

for (const rel of FILES) {
  const src = resolve(ROOT, rel);
  const dst = resolve(DEST, rel);
  try {
    const bytes = statSync(src).size;
    mkdirSync(dirname(dst), { recursive: true });
    copyFileSync(src, dst);
    totalBytes += bytes;
    copied.push(rel);
  } catch {
    missing.push(rel);
  }
}

// Manifest at the root of codebase/ so the design tool can see the file tree.
const manifest = [
  "# Codebase: design surface",
  "",
  "Just the files that affect how the app looks — components, page-level layouts,",
  "loading skeletons, and global CSS. Excludes DB schema, server actions, and",
  "other non-visual logic.",
  "",
  `Generated ${new Date().toISOString()}`,
  "",
  "## Files",
  "",
  ...copied.map((f) => `- \`${f}\``),
  ...(missing.length > 0
    ? ["", "## Missing (skipped)", "", ...missing.map((f) => `- \`${f}\``)]
    : []),
  "",
].join("\n");
writeFileSync(resolve(DEST, "README.md"), manifest);

console.log(`✓ Wrote ${DEST}`);
console.log(`  ${copied.length} files copied, ${totalBytes.toLocaleString()} total source bytes`);
if (missing.length > 0) console.log(`  ${missing.length} missing: ${missing.join(", ")}`);

// Also write a top-level manifest with git context for the brief.
try {
  const branch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim();
  const sha = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  const top = `Bundled from branch ${branch} @ ${sha}\n${copied.length} files\n${totalBytes.toLocaleString()} source bytes\n`;
  writeFileSync(resolve(ROOT, ".design-brief/MANIFEST.txt"), top);
} catch {
  // git not available, skip
}
