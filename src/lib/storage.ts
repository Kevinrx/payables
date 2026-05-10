import { put } from "@vercel/blob";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * Stores an uploaded file. Uses Vercel Blob when BLOB_READ_WRITE_TOKEN is set,
 * falls back to public/uploads/ for local dev (so you can demo the app without
 * provisioning Blob storage).
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

  const uploadsDir = resolve(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const safe = `${Date.now()}-${slugify(filename)}`;
  await writeFile(resolve(uploadsDir, safe), buffer);
  return { url: `/uploads/${safe}` };
}

function slugify(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}
