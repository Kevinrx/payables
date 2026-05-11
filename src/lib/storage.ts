import { put } from "@vercel/blob";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * Stores an uploaded file. Uses Vercel Blob when BLOB_READ_WRITE_TOKEN is set,
 * falls back to public/uploads/ for local dev. Refuses to attempt the local
 * fallback on Vercel — its /var/task is read-only, so silently trying mkdir
 * just produces a misleading ENOENT.
 */
export async function storeFile(
  buffer: Buffer,
  filename: string,
  mime: string
): Promise<{ url: string }> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const safe = `bills/${Date.now()}-${slugify(filename)}`;
    const { url } = await put(safe, buffer, {
      access: "public",
      contentType: mime,
      addRandomSuffix: false,
    });
    return { url };
  }

  // Vercel sets VERCEL=1 in every runtime. We can't write to disk there.
  if (process.env.VERCEL) {
    throw new Error(
      "File storage is not configured. Connect a Vercel Blob store to your project " +
      "(Storage tab → Create → Blob → Connect) so BLOB_READ_WRITE_TOKEN is set, then redeploy."
    );
  }

  const uploadsDir = resolve(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const safe = `${Date.now()}-${slugify(filename)}`;
  await writeFile(resolve(uploadsDir, safe), buffer);
  return { url: `/uploads/${safe}` };
}

function slugify(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}
