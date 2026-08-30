import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";

// Same "most recent row wins" pattern as lib/meta/audiences.ts's own
// getConnection() — one shared helper so meta.ts, templates.ts, the
// webhook route and inbox.ts all read the exact same connection instead
// of five copies of this query drifting apart.
export async function getWhatsAppConnection() {
  const conn = await db.whatsAppConnection.findFirst({ orderBy: { createdAt: "desc" } });
  if (!conn) {
    throw new Error("No WhatsAppConnection configured — see docs/WHATSAPP_SETUP.md and CRM → WhatsApp → Conexión.");
  }
  return { ...conn, token: decryptSecret(conn.accessTokenEnc) };
}

/** Non-throwing variant for read paths that just want to show connection
 * status (e.g. the webhook's verify handshake, the Conexión page) without
 * a try/catch at every call site. */
export async function getWhatsAppConnectionOrNull() {
  const conn = await db.whatsAppConnection.findFirst({ orderBy: { createdAt: "desc" } });
  if (!conn) return null;
  return { ...conn, token: decryptSecret(conn.accessTokenEnc) };
}
