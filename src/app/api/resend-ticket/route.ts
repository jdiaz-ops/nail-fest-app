import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import { sendTicketEmail } from "@/lib/sendTicketEmail";

// See /admin/settings/self-serve. Deliberately returns the same generic
// { ok: true } whether or not the email matched anything — same reasoning
// as a password-reset flow: confirming "that email isn't registered" to
// whoever's asking is a data leak, not a feature.

const bodySchema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  const settings = await getOrgSettings();
  if (!settings.selfServeResendEnabled) {
    return NextResponse.json({ error: "not_enabled" }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const person = await db.person.findUnique({ where: { email: parsed.data.email.trim().toLowerCase() } });
  if (person) {
    const registrations = await db.registration.findMany({
      where: { personId: person.id, status: "CONFIRMED", qrToken: { not: null } },
      include: { event: true },
      orderBy: { createdAt: "desc" },
      // A hard cap, not a real-world limit — just a ceiling against someone
      // hammering this endpoint for a person with a huge history.
      take: 10,
    });
    for (const registration of registrations) {
      if (!registration.qrToken) continue;
      await sendTicketEmail({
        person,
        event: registration.event,
        qrToken: registration.qrToken,
        registration: { id: registration.id, ticketTypeId: registration.ticketTypeId, ticketCount: registration.ticketCount },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
