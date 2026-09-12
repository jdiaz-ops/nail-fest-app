import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emailProvider } from "@/lib/email";
import { abandonedCartEmail } from "@/lib/email/templates";
import { getOrgSettings } from "@/lib/settings";
import { abandonedCartCallbackUrl, verifyQstashSignature } from "@/lib/qstash";

// QStash's callback for one abandoned-cart reminder (see
// lib/abandonedCart.ts / lib/qstash.ts's scheduleAbandonedCartEmail) —
// same signature-verification shape as /api/whatsapp/send-scheduled.
//
// Every check below is a legitimate "nothing to do, return ok" case, not
// an error: the registration converted (CONFIRMED) or was cancelled since
// this was scheduled, this exact reminder already went out (a QStash
// retry, or both this and a manual re-trigger landed close together), the
// event got unpublished, or the address is banned. Only a real send
// failure returns non-2xx so QStash retries with its own backoff.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!(await verifyQstashSignature(rawBody, req.headers.get("upstash-signature"), abandonedCartCallbackUrl()))) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody || "{}");
  const registrationId = body?.registrationId as string | undefined;
  const step = body?.step as 1 | 2 | undefined;
  if (!registrationId || (step !== 1 && step !== 2)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const registration = await db.registration.findUnique({
    where: { id: registrationId },
    include: { person: true, event: true, ticketType: true },
  });

  if (!registration || registration.status !== "STARTED") {
    return NextResponse.json({ ok: true, skipped: true });
  }
  if (step === 1 && registration.cartEmail1SentAt) {
    return NextResponse.json({ ok: true, skipped: true });
  }
  if (step === 2 && registration.cartEmail2SentAt) {
    return NextResponse.json({ ok: true, skipped: true });
  }
  if (registration.event.status === "DRAFT") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const orgSettings = await getOrgSettings();
  if (orgSettings.bannedEmails.includes(registration.person.email)) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const { subject, text, html } = abandonedCartEmail({
    step,
    firstName: registration.person.firstName ?? "",
    eventName: registration.event.name,
    eventCity: registration.event.city,
    eventUrl: `${process.env.APP_BASE_URL || ""}/${registration.event.slug}`,
    ticketTypeName: registration.ticketType?.name,
    orgName: orgSettings.name,
  });

  try {
    const sent = await emailProvider.sendTransactional({ to: registration.person.email, subject, text, html });
    await db.emailLog.create({
      data: {
        kind: "TRANSACTIONAL",
        personId: registration.person.id,
        toEmail: registration.person.email,
        providerMessageId: sent.providerMessageId,
        status: "SENT",
      },
    });
    await db.registration.update({
      where: { id: registration.id },
      data: step === 1 ? { cartEmail1SentAt: new Date() } : { cartEmail2SentAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    await db.emailLog.create({
      data: { kind: "TRANSACTIONAL", personId: registration.person.id, toEmail: registration.person.email, status: "FAILED" },
    });
    console.error("abandoned-cart send failed", registrationId, step, err);
    return NextResponse.json({ error: "send_failed" }, { status: 500 });
  }
}
