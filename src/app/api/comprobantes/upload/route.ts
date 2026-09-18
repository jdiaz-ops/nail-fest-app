import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { randomUUID } from "crypto";
import { requireUser } from "@/lib/auth/guard";

// The safe copy every comprobante points at (see Comprobante's own schema
// comment) — uploaded here BEFORE the /api/comprobantes create call, so a
// photo is never lost even if the create/send step fails. Accepts an
// image (already compressed client-side — see lib/comprobantes/
// imageCompression.ts — to well under this cap) or a PDF (facturas that
// arrive by WhatsApp, sent as-is per the spec).
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_PDF_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN", "COORDINADOR"]);
  if ("response" in auth) return auth.response;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "blob_not_configured" }, { status: 503 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }

  const isPdf = file.type === "application/pdf";
  const isImage = file.type.startsWith("image/");
  if (!isPdf && !isImage) {
    return NextResponse.json({ error: "tipo_no_soportado" }, { status: 400 });
  }
  if (isImage && file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 400 });
  }
  if (isPdf && file.size > MAX_PDF_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 400 });
  }

  const ext = (file.name.split(".").pop() || (isPdf ? "pdf" : "jpg")).toLowerCase().replace(/[^a-z0-9]/g, "") || (isPdf ? "pdf" : "jpg");
  const pathname = `comprobantes/${randomUUID()}.${ext}`;

  const blob = await put(pathname, file, { access: "public" });
  return NextResponse.json({ ok: true, url: blob.url, mime: file.type });
}
