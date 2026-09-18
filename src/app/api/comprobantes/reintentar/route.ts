import { NextRequest, NextResponse } from "next/server";
import { comprobanteRetryCallbackUrl, verifyQstashSignature } from "@/lib/qstash";
import { intentarEnviarComprobante } from "@/lib/comprobantes/send";

// QStash's own callback for a comprobante send retry — published by
// lib/qstash.ts's scheduleComprobanteRetry, called from both the create
// route (POST /api/comprobantes) and the manual retry route
// (/api/comprobantes/[id]/reintentar) whenever an attempt fails
// transiently. No session here (QStash calls this, not a logged-in
// browser) — the signature check is the only gate, same pattern as
// /api/broadcasts/process-chunk and friends.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!(await verifyQstashSignature(rawBody, req.headers.get("upstash-signature"), comprobanteRetryCallbackUrl()))) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody || "{}");
  const comprobanteId = body?.comprobanteId as string | undefined;
  if (!comprobanteId) {
    return NextResponse.json({ error: "missing_comprobanteId" }, { status: 400 });
  }

  const result = await intentarEnviarComprobante(comprobanteId);
  if (result.shouldRetry) {
    // Non-2xx so QStash redelivers with its own backoff — never
    // schedule a second, independent retry ourselves from in here (see
    // scheduleComprobanteRetry's own comment on why one publish is
    // enough).
    return NextResponse.json({ ok: false, retrying: true }, { status: 500 });
  }
  return NextResponse.json({ ok: result.ok });
}
