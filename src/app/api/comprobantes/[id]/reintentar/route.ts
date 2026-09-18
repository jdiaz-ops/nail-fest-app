import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { intentarEnviarComprobante } from "@/lib/comprobantes/send";
import { scheduleComprobanteRetry } from "@/lib/qstash";

// The "Error — reintentar" button in "Enviados recientemente" — a person
// acting on their own stuck row, not QStash. Scoped to the CALLER's own
// comprobante (same "es una lista personal" reasoning as GET
// /api/comprobantes) — retrying someone else's isn't exposed anywhere in
// the UI, so this route doesn't allow it either.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN", "COORDINADOR"]);
  if ("response" in auth) return auth.response;

  const existing = await db.comprobante.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== auth.user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (existing.estado !== "ERROR") {
    return NextResponse.json({ error: "not_retryable" }, { status: 409 });
  }

  // Back to ENVIANDO with intentos reset to 0 — a fresh budget of
  // MAX_INTENTOS attempts, not "already at 5, immediately re-exhausted
  // on the next attempt." intentarEnviarComprobante's ENVIANDO check is
  // also what stops it treating this as the "already ERROR, nothing to
  // do" short-circuit it applies to a stray late QStash redelivery.
  await db.comprobante.update({ where: { id: params.id }, data: { estado: "ENVIANDO", intentos: 0, ultimoError: null } });

  const attempt = await intentarEnviarComprobante(params.id);
  if (attempt.shouldRetry) {
    await scheduleComprobanteRetry(params.id);
  }

  const fresh = await db.comprobante.findUnique({ where: { id: params.id } });
  return NextResponse.json({ ok: true, comprobante: fresh });
}
