import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getWhatsAppConnection } from "@/lib/whatsapp/connection";
import { subscribeAppToWaba } from "@/lib/whatsapp/meta";

// Re-runs the "subscribe this app to the WABA's webhook list" call for
// the connection already on file — for a connection saved before this
// fix existed (see subscribeAppToWaba's own comment on "shadow
// delivery"), or if the automatic attempt at save time failed. Reuses
// the already-stored, already-decrypted token — no need to re-enter it.
export async function POST() {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  try {
    const conn = await getWhatsAppConnection();
    await subscribeAppToWaba(conn.wabaId, conn.token);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("whatsapp connection: manual re-subscribe failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "subscribe_failed" }, { status: 502 });
  }
}
