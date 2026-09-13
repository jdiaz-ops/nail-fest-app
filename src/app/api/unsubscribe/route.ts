import { NextRequest, NextResponse } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";
import { revokeConsent } from "@/lib/consent";

// RFC 8058 one-click unsubscribe: mail clients POST here automatically with
// no human interaction when someone hits "unsubscribe" in Gmail/Outlook's
// own UI. GET handles a human clicking the link in the email body. Both
// revoke MARKETING consent immediately — one-click unsubscribe explicitly
// must not require a confirmation step. The actual write (see its own
// comment on the exact two-step shape) is shared with the bounce/spam
// -complaint auto-suppression in lib/email/tracking.ts.

async function revoke(token: string) {
  const { valid, personId } = verifyUnsubscribeToken(token);
  if (!valid || !personId) return false;
  await revokeConsent(personId, "MARKETING");
  return true;
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const ok = token ? await revoke(token) : false;
  return new NextResponse(
    ok
      ? "<p>Listo, no recibirás más correos de marketing de Nail Fest. Seguirás recibiendo la información operativa de los eventos a los que te registres.</p>"
      : "<p>Este enlace no es válido.</p>",
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const ok = token ? await revoke(token) : false;
  return NextResponse.json({ ok });
}
