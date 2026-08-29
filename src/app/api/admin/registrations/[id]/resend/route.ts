import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { sendTicketEmail } from "@/lib/sendTicketEmail";

// The "Reenviar" button in the Issued tickets modal — an admin resending
// on someone's behalf (they lost the email, or it bounced and they just
// fixed a typo'd address), as opposed to /api/resend-ticket which is the
// public self-serve version gated by OrgSettings.selfServeResendEnabled.
// Same underlying sendTicketEmail as both that route and /api/register —
// one real send path, not a second copy that could drift.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const registration = await db.registration.findUnique({
    where: { id: params.id },
    include: { person: true, event: true },
  });
  if (!registration || !registration.qrToken) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const result = await sendTicketEmail({
    person: registration.person,
    event: registration.event,
    qrToken: registration.qrToken,
    registration: { id: registration.id, ticketTypeId: registration.ticketTypeId, ticketCount: registration.ticketCount },
  });

  return NextResponse.json(result);
}
