import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { randomUUID } from "crypto";
import { consultorioPoster, photoFolderOf } from "@/lib/community/gate";

const MAX_BYTES = 5 * 1024 * 1024;

// The photo of a question, uploaded before she sends it — into her own
// folder, which is what the question's route checks.
export async function POST(req: NextRequest) {
  const gate = await consultorioPoster();
  if ("response" in gate) return gate.response;
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "blob_not_configured", message: "No se pudo subir la foto. Vuelve a intentarlo más tarde." }, { status: 503 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "no_file", message: "Elige una foto." }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "not_an_image", message: "Elige una foto (JPG o PNG)." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "too_large", message: "La foto pesa más de 5 MB." }, { status: 400 });

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const blob = await put(`${photoFolderOf(gate.identity)}/${randomUUID()}.${ext}`, file, { access: "public" });
  return NextResponse.json({ ok: true, url: blob.url });
}
