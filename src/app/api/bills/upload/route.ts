import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { getDemoOrgId } from "@/db/queries";
import { storeFile } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export async function POST(req: Request) {
  try {
    const orgId = await getDemoOrgId();
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Use PDF, PNG, JPEG, or WebP.` },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_BYTES / 1024 / 1024}MB).` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { url } = await storeFile(buffer, file.name, file.type);

    const [bill] = await db
      .insert(schema.bills)
      .values({
        orgId,
        status: "draft",
        source: "upload",
        fileUrl: url,
        fileName: file.name,
        fileMime: file.type,
      })
      .returning();

    await db.insert(schema.billEvents).values({
      billId: bill.id,
      event: "created",
      payload: { source: "upload", fileName: file.name, sizeBytes: file.size },
    });

    return NextResponse.json({ billId: bill.id });
  } catch (e) {
    console.error("Upload failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 }
    );
  }
}
