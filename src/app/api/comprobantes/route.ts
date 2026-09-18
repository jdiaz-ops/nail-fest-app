import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { intentarEnviarComprobante } from "@/lib/comprobantes/send";
import { scheduleComprobanteRetry } from "@/lib/qstash";

// "Enviados recientemente" (Sección C) — always just the calling user's
// own last 20, never every user's, matching the doc's own "que envió el
// usuario" wording.
export async function GET() {
  const auth = await requireUser(["ADMIN", "COORDINADOR"]);
  if ("response" in auth) return auth.response;

  const comprobantes = await db.comprobante.findMany({
    where: { userId: auth.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json({ comprobantes });
}

const bodySchema = z.object({
  pendienteId: z.string().nullable(),
  medio: z.enum(["TARJETA_2832", "BOLD", "EFECTIVO", "REEMBOLSO", "OTRO"]),
  pagadoPor: z.string().min(1),
  nota: z.string().default(""),
  // Already uploaded to Blob via /api/comprobantes/upload — this route
  // only ever receives the resulting URLs, never raw file bytes (see
  // that route's own comment on why the upload happens first, as its own
  // step, before a comprobante row even exists).
  archivos: z.array(z.string()).min(1),
});

/** Creates the local record, then makes ONE inline send attempt right
 * away — most comprobantes reach the backend on this very request, so
 * the UI can show "Recibido" almost immediately instead of always
 * bouncing through a QStash round trip. Only a failure hands off to
 * QStash for the retry chain (see lib/comprobantes/send.ts). Never
 * throws past a failed send: "Nunca se pierde una foto" means this
 * request still returns 200 with the row's real (possibly still
 * ENVIANDO) estado, not a 500 — the row itself is the durable record. */
export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN", "COORDINADOR"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const data = parsed.data;

  const comprobante = await db.comprobante.create({
    data: {
      userId: auth.user.id,
      pendienteId: data.pendienteId,
      medio: data.medio,
      pagadoPor: data.pagadoPor,
      nota: data.nota || null,
      archivos: data.archivos,
    },
  });

  const attempt = await intentarEnviarComprobante(comprobante.id);
  if (attempt.shouldRetry) {
    await scheduleComprobanteRetry(comprobante.id);
  }

  const fresh = await db.comprobante.findUnique({ where: { id: comprobante.id } });
  return NextResponse.json({ ok: true, comprobante: fresh });
}
