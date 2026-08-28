import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { randomUUID } from "crypto";

// Protected by middleware (same Basic Auth as the rest of /admin). Not
// tied to a specific event id — EventForm.tsx uploads the file the
// moment it's picked (before a brand-new event even has an id) and just
// carries the resulting URL in its own form state until Save.
const MAX_BYTES = 5 * 1024 * 1024; // 5MB — plenty for a hero image, small enough to stay cheap on Blob storage

export async function POST(req: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    // Real, distinct error — not "something went wrong" — so the admin
    // form can say exactly what's missing instead of a generic failure.
    return NextResponse.json({ error: "blob_not_configured" }, { status: 503 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "not_an_image" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 400 });
  }

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const pathname = `event-images/${randomUUID()}.${ext}`;

  const blob = await put(pathname, file, { access: "public" });
  return NextResponse.json({ ok: true, url: blob.url });
}
