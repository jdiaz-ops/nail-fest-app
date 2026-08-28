import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";

// RFC 8058 one-click unsubscribe: mail clients POST here automatically with
// no human interaction when someone hits "unsubscribe" in Gmail/Outlook's
// own UI. GET handles a human clicking the link in the email body. Both
// revoke MARKETING consent immediately — one-click unsubscribe explicitly
// must not require a confirmation step.

async function revoke(token: string) {
  const { valid, personId } = verifyUnsubscribeToken(token);
  if (!valid || !personId) return false;

  const latest = await db.consent.findFirst({
    where: { personId, purpose: "MARKETING" },
    orderBy: { grantedAt: "desc" },
  });
  if (latest) {
    await db.consent.update({ where: { id: latest.id }, data: { revokedAt: new Date() } });
  }
  await db.consent.create({
    data: { personId, purpose: "MARKETING", granted: false, revokedAt: new Date() },
  });
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
