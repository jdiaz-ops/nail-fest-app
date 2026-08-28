import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { queueMetaEvent } from "@/lib/meta/capi";
import { recordConsents, hasActiveConsent } from "@/lib/consent";
import { issueQrToken } from "@/lib/ticket";
import { emailProvider } from "@/lib/email";
import { clientIpFromHeaders, userAgentFromHeaders } from "@/lib/request";
import { confirmationEmail } from "@/lib/email/templates";

const bodySchema = z.object({
  eventSlug: z.string(),
  email: z.string().email(),
  phone: z.string().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  city: z.string().min(1),
  profession: z.string().optional(),
  customFields: z.record(z.string()).optional(),
  consents: z.object({
    logistics: z.literal(true), // required — can't register without it
    marketing: z.boolean().default(false),
    advertising: z.boolean().default(false),
  }),
  attribution: z
    .object({
      utmSource: z.string().optional(),
      utmMedium: z.string().optional(),
      utmCampaign: z.string().optional(),
      fbclid: z.string().optional(),
      ttclid: z.string().optional(),
      gclid: z.string().optional(),
    })
    .optional(),
  fbc: z.string().optional(),
  fbp: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const input = parsed.data;

  const event = await db.event.findUnique({ where: { slug: input.eventSlug } });
  if (!event) {
    return NextResponse.json({ error: "event_not_found" }, { status: 404 });
  }

  // Dedup on email — the whole point of the CRM being "one profile per
  // person" rather than one row per registration.
  const person = await db.person.upsert({
    where: { email: input.email.trim().toLowerCase() },
    create: {
      email: input.email.trim().toLowerCase(),
      phone: input.phone,
      firstName: input.firstName,
      lastName: input.lastName,
      city: input.city,
      profession: input.profession,
    },
    update: {
      phone: input.phone,
      firstName: input.firstName,
      lastName: input.lastName,
      city: input.city,
      profession: input.profession,
    },
  });

  const registration = await db.registration.create({
    data: {
      eventId: event.id,
      personId: person.id,
      status: "CONFIRMED",
      confirmedAt: new Date(),
      customFields: input.customFields ?? {},
      utmSource: input.attribution?.utmSource,
      utmMedium: input.attribution?.utmMedium,
      utmCampaign: input.attribution?.utmCampaign,
      fbclid: input.attribution?.fbclid,
      ttclid: input.attribution?.ttclid,
      gclid: input.attribution?.gclid,
    },
  });

  const qrToken = issueQrToken(registration.id);
  await db.registration.update({ where: { id: registration.id }, data: { qrToken } });

  await recordConsents({
    personId: person.id,
    registrationId: registration.id,
    granted: {
      LOGISTICS: input.consents.logistics,
      MARKETING: input.consents.marketing,
      ADVERTISING: input.consents.advertising,
    },
  });

  // --- Transactional QR email — always sent; this is the LOGISTICS purpose,
  // which is a condition of registering at all, not an optional consent. ---
  try {
    // A real URL, not a base64 data: URI — Gmail and most inboxes silently
    // drop inline data: images in HTML mail (they render fine in a browser
    // preview, which is why this only shows up once real mail is tested).
    const qrImageUrl = `${process.env.APP_BASE_URL || ""}/api/ticket-qr/${qrToken}`;
    const { subject, text, html } = confirmationEmail({
      firstName: person.firstName ?? "",
      eventName: event.name,
      eventCity: event.city,
      startsAt: event.startsAt,
      qrImageUrl,
    });
    const sent = await emailProvider.sendTransactional({ to: person.email, subject, text, html });
    await db.emailLog.create({
      data: {
        kind: "TRANSACTIONAL",
        personId: person.id,
        toEmail: person.email,
        sesMessageId: sent.providerMessageId,
        status: "SENT",
      },
    });
  } catch (err) {
    // Never fail the registration because the email had a hiccup — log it
    // and let a human requeue the send. Losing the API response here would
    // be worse: the person would think they aren't registered when they are.
    await db.emailLog.create({
      data: {
        kind: "TRANSACTIONAL",
        personId: person.id,
        toEmail: person.email,
        status: "FAILED",
      },
    });
    console.error("confirmation email failed", err);
  }

  // --- Purchase → Meta CAPI, gated by the ADVERTISING consent, not just
  // "did they register". Sharing hashed identifiers with Meta is a distinct
  // purpose under Ley 1581 and needs its own opt-in. ---
  if (await hasActiveConsent(person.id, "ADVERTISING")) {
    await queueMetaEvent({
      eventId: randomUUID(),
      eventName: "Purchase",
      eventSourceUrl: `${process.env.APP_BASE_URL ?? ""}/${event.slug}`,
      userData: {
        email: person.email,
        phone: person.phone ?? undefined,
        clientIpAddress: clientIpFromHeaders(),
        clientUserAgent: userAgentFromHeaders(),
        fbc: input.fbc,
        fbp: input.fbp,
      },
      customData: {
        value: Number(process.env.META_PURCHASE_PLACEHOLDER_VALUE || "1"),
        currency: process.env.DEFAULT_CURRENCY || "COP",
      },
      registrationId: registration.id,
    });
  }

  return NextResponse.json({ ok: true, registrationId: registration.id });
}
