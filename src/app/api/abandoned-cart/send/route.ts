import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emailProvider } from "@/lib/email";
import { senderNameFor } from "@/lib/brand";
import { abandonedCartEmail } from "@/lib/email/templates";
import { getOrgSettings } from "@/lib/settings";
import { abandonedCartCallbackUrl, verifyQstashSignature } from "@/lib/qstash";
import { publicEventName } from "@/lib/eventDisplayName";
import { checkoutResumeToken } from "@/lib/checkoutResume";

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
    include: { person: true, event: true, ticketType: true, landingVersion: { select: { slug: true } } },
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
  // The pause switch (/admin/settings/abandoned-cart) — checked here too,
  // not just at scheduling time in /api/register/draft, so turning it off
  // also silences reminders already sitting in QStash's queue from
  // before the switch was flipped, not just new ones going forward.
  if (!orgSettings.abandonedCartEmailsEnabled) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  // Manicuristas Imparables has its one-page checkout: the reminder opens it
  // already filled with her draft (lib/checkoutResume.ts, 2026-11-02), on the
  // version of the page she came from. Every other event: its page.
  const base = process.env.APP_BASE_URL || "";
  let eventUrl = `${base}/${registration.event.slug}`;
  if (registration.event.theme === "IMPARABLES") {
    try {
      const page = registration.landingVersion ? `/v/${registration.landingVersion.slug}` : `/${registration.event.slug}`;
      eventUrl = `${base}${page}/checkout?retomar=${encodeURIComponent(checkoutResumeToken(registration.id))}`;
    } catch {
      // No APP_SECRET_KEY to sign with: the event's page, as before.
    }
  }

  const { subject, text, html } = abandonedCartEmail({
    step,
    firstName: registration.person.firstName ?? "",
    eventName: publicEventName(registration.event),
    eventCity: registration.event.city,
    eventUrl,
    ticketTypeName: registration.ticketType?.name,
    orgName: orgSettings.name,
  });

  try {
    const sent = await emailProvider.sendTransactional({ to: registration.person.email, subject, text, html, fromName: senderNameFor(registration.event) });
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
