import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { queueMetaEvent } from "@/lib/meta/capi";
import { pushNewRegistrantToEventAudiences } from "@/lib/meta/audiences";
import { recordConsents, hasActiveConsent } from "@/lib/consent";
import { issueQrToken } from "@/lib/ticket";
import { sendTicketEmail } from "@/lib/sendTicketEmail";
import { clientIpFromHeaders, userAgentFromHeaders } from "@/lib/request";
import { splitName } from "@/lib/name";
import { getOrgSettings } from "@/lib/settings";

const bodySchema = z.object({
  eventSlug: z.string(),
  email: z.string().email(),
  // Required — matches the live form (see RegistrationForm.tsx), same
  // fields Ticket Tailor was collecting: WhatsApp number, cédula/NIT, and
  // profession are all required there too, not optional.
  phone: z.string().min(1),
  // Single field — "Nombre y Apellido - o - Razón Social", same as the
  // Ticket Tailor forms this replaces. Split server-side (lib/name.ts) so
  // downstream code (emails, CRM) still gets a firstName/lastName pair.
  fullName: z.string().min(1),
  city: z.string().min(1),
  profession: z.string().min(1),
  cedula: z.string().min(1),
  instagram: z.string().optional(),
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
  // Shared with the browser Pixel's client-side Purchase call (see
  // RegistrationForm.tsx) so Meta dedupes the pair instead of double-
  // counting — see MetaPixelScript.tsx for the full explanation.
  purchaseEventId: z.string().optional(),
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

  // See /admin/settings/banned-emails — checked before touching the CRM at
  // all, same as Ticket Tailor's own "Banned email addresses" block.
  const orgSettings = await getOrgSettings();
  const normalizedEmail = input.email.trim().toLowerCase();
  if (orgSettings.bannedEmails.includes(normalizedEmail)) {
    return NextResponse.json({ error: "not_permitted" }, { status: 403 });
  }

  const { firstName, lastName } = splitName(input.fullName);

  // Dedup on email — the whole point of the CRM being "one profile per
  // person" rather than one row per registration.
  const person = await db.person.upsert({
    where: { email: normalizedEmail },
    create: {
      email: normalizedEmail,
      phone: input.phone,
      firstName,
      lastName,
      city: input.city,
      profession: input.profession,
    },
    update: {
      phone: input.phone,
      firstName,
      lastName,
      city: input.city,
      profession: input.profession,
    },
  });

  // People re-submit the form for an event they already registered for
  // constantly — they forgot they did, or (most often) they just lost the
  // QR email and want it resent. `@@unique([personId, eventId])` means a
  // second `create()` here would throw instead of quietly duplicating —
  // reuse the existing registration and treat this as "resend my ticket",
  // which is what they actually want, rather than surfacing a DB error.
  const existingRegistration = await db.registration.findUnique({
    where: { personId_eventId: { personId: person.id, eventId: event.id } },
  });
  const isResend = Boolean(existingRegistration);

  const customFields = { cedula: input.cedula, instagram: input.instagram ?? null };
  const registration = existingRegistration
    ? await db.registration.update({ where: { id: existingRegistration.id }, data: { customFields } })
    : await db.registration.create({
        data: {
          eventId: event.id,
          personId: person.id,
          status: "CONFIRMED",
          confirmedAt: new Date(),
          customFields,
          utmSource: input.attribution?.utmSource,
          utmMedium: input.attribution?.utmMedium,
          utmCampaign: input.attribution?.utmCampaign,
          fbclid: input.attribution?.fbclid,
          ttclid: input.attribution?.ttclid,
          gclid: input.attribution?.gclid,
        },
      });

  let qrToken = registration.qrToken;
  if (!qrToken) {
    qrToken = issueQrToken(registration.id);
    await db.registration.update({ where: { id: registration.id }, data: { qrToken } });
  }

  // Record their consent choice from THIS submission either way — even on
  // a resend, it's a fresh explicit answer (they might have changed their
  // mind on marketing/ads since the first time) and consent is append-only
  // by design, so this never overwrites the earlier record, just adds to it.
  await recordConsents({
    personId: person.id,
    registrationId: registration.id,
    granted: {
      LOGISTICS: input.consents.logistics,
      MARKETING: input.consents.marketing,
      ADVERTISING: input.consents.advertising,
    },
  });

  // Push this one person straight into any "registrados a este evento"
  // Meta audience right now, instead of waiting for the cron — cheap (one
  // person, not a full resync), and never throws. See
  // pushNewRegistrantToEventAudiences() for what it does and doesn't cover.
  await pushNewRegistrantToEventAudiences(event.slug, person);

  // --- Transactional QR email — always sent; this is the LOGISTICS purpose,
  // which is a condition of registering at all, not an optional consent.
  // Never fails the registration itself: sendTicketEmail swallows its own
  // errors into an EmailLog row for a human to requeue. ---
  await sendTicketEmail({ person, event, qrToken });

  // --- Purchase → Meta CAPI, gated by the ADVERTISING consent, not just
  // "did they register". Sharing hashed identifiers with Meta is a distinct
  // purpose under Ley 1581 and needs its own opt-in. Skipped on a resend —
  // it's the same registration, not a second purchase; firing it again
  // would inflate the conversion count Meta uses for ad optimization. ---
  if (!isResend && (await hasActiveConsent(person.id, "ADVERTISING"))) {
    await queueMetaEvent({
      eventId: input.purchaseEventId ?? randomUUID(),
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

  return NextResponse.json({ ok: true, registrationId: registration.id, resent: isResend });
}
