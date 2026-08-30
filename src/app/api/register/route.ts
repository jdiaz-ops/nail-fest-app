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
import { getCheckoutQuestions, LOCKED_KEYS, type LockedKey } from "@/lib/checkoutForm";
import { isKnownCityLabel } from "@/lib/cityMatch";

const bodySchema = z.object({
  eventSlug: z.string(),
  email: z.string().email(),
  // Only sent when the "email" question's confirmEmail is on (Ticket
  // Tailor's "ask twice to catch typos") — see CheckoutFormEditor.tsx.
  emailConfirm: z.string().optional(),
  phone: z.string(),
  // Exactly one of fullName (Format: "Full name", the default) or
  // firstName/lastName (Format: "First & Last Name") is populated, never
  // both — see RegistrationForm.tsx. fullName gets split server-side
  // (lib/name.ts: first word vs. the rest) when that's the one sent;
  // firstName/lastName are used directly, no guessing, when they are.
  fullName: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  city: z.string(),
  profession: z.string(),
  // The "Entradas" step (EventRegistration.tsx) — omitted entirely for
  // events with no TicketType rows yet (older/seeded events), which keep
  // registering exactly as before: ticketCount defaults to 1, no ticket
  // type stored.
  ticketTypeId: z.string().optional(),
  ticketCount: z.number().int().positive().optional(),
  // Everything that isn't one of the five fields above — cedula, and
  // whatever questions exist in /admin/settings/checkout-form (Instagram
  // by default, plus anything an admin added) — keyed by CheckoutQuestion.key.
  // Stored as Registration.customFields verbatim; see checkoutForm.ts.
  customFields: z.record(z.string()).default({}),
  consents: z.object({
    logistics: z.literal(true), // required — can't register without it
    marketing: z.boolean().default(false),
    advertising: z.boolean().default(false),
    whatsapp: z.boolean().default(false),
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
  // Same gate as the public page (see /[eventSlug]/page.tsx) — belt and
  // suspenders in case this endpoint is ever hit directly for a Draft
  // event's slug instead of through the (already-gated) form.
  if (event.status === "DRAFT") {
    return NextResponse.json({ error: "event_not_found" }, { status: 404 });
  }

  // Required-ness for phone/city/profession/cedula/every custom question
  // comes from live /admin/settings/checkout-form config, not a fixed zod
  // schema — that's the whole point of that editor actually changing what
  // this endpoint accepts. fullName/email are hard-required regardless of
  // what's stored (same as Ticket Tailor: Name/Email have no "Required"
  // toggle at all, they're just always on) since the rest of the CRM
  // (dedup key, personalization) depends on both existing.
  const questions = await getCheckoutQuestions();
  const requiredByKey = new Map(questions.map((q) => [q.key, q.required]));
  const missing: string[] = [];
  const LOCKED_TO_FIELD: Record<LockedKey, string | undefined> = {
    fullName: undefined, // always required, checked separately
    email: undefined, // always required, checked separately
    phone: input.phone,
    city: input.city,
    profession: input.profession,
    cedula: input.customFields.cedula,
  };
  for (const key of LOCKED_KEYS) {
    if (key === "fullName" || key === "email") continue;
    if (requiredByKey.get(key) && !LOCKED_TO_FIELD[key]?.trim()) missing.push(key);
  }
  for (const q of questions.filter((q) => !q.locked)) {
    if (q.required && !input.customFields[q.key]?.trim()) missing.push(q.key);
  }

  // fullName's own required-ness, split by nameFormat (see the field's own
  // comment on bodySchema above) — firstName is the one that actually
  // needs to be non-empty either way, lastName stays optional (matches
  // splitName's own leniency for a single-word name).
  const sentFirstLast = Boolean(input.firstName?.trim());
  const { firstName, lastName } = sentFirstLast
    ? { firstName: input.firstName!.trim(), lastName: (input.lastName ?? "").trim() }
    : splitName(input.fullName ?? "");
  if (!firstName) missing.push("fullName");

  const emailQuestion = questions.find((q) => q.key === "email");
  if (missing.length > 0) {
    return NextResponse.json({ error: "missing_required_fields", fields: missing }, { status: 400 });
  }

  // "Ask twice to catch typos" — see the confirmEmail field's own comment
  // on CheckoutQuestion. Checked here too (not just client-side in
  // RegistrationForm.tsx) so a direct API call can't skip it.
  if (
    emailQuestion?.confirmEmail &&
    (!input.emailConfirm || input.emailConfirm.trim().toLowerCase() !== input.email.trim().toLowerCase())
  ) {
    return NextResponse.json({ error: "email_mismatch" }, { status: 400 });
  }

  // City must be a real municipality from the canonical list (see
  // CityAutocomplete.tsx and lib/cityMatch.ts) — checked here too, not
  // just client-side, so a direct API call can't put free text back into
  // Person.city and undo the whole point of this feature (clean city data
  // for stats/segments going forward). Empty is fine when the question
  // isn't required — that's already enforced by the missing-fields check
  // above; this only rejects a NON-empty value that isn't a real city.
  if (input.city.trim() && !isKnownCityLabel(input.city)) {
    return NextResponse.json({ error: "invalid_city" }, { status: 400 });
  }

  // See /admin/settings/banned-emails — checked before touching the CRM at
  // all, same as Ticket Tailor's own "Banned email addresses" block.
  const orgSettings = await getOrgSettings();
  const normalizedEmail = input.email.trim().toLowerCase();
  if (orgSettings.bannedEmails.includes(normalizedEmail)) {
    return NextResponse.json({ error: "not_permitted" }, { status: 403 });
  }

  // Fetched before the ticket-type capacity check below so a resend can
  // exclude the person's OWN prior reservation from "how many are already
  // taken" — otherwise resubmitting the same order would look like it's
  // competing with itself for the last spot.
  const existingPerson = await db.person.findUnique({ where: { email: normalizedEmail } });
  const existingRegistrationForCapacityCheck = existingPerson
    ? await db.registration.findUnique({ where: { personId_eventId: { personId: existingPerson.id, eventId: event.id } } })
    : null;

  let ticketCount = 1;
  if (input.ticketTypeId) {
    const ticketType = await db.ticketType.findUnique({ where: { id: input.ticketTypeId } });
    if (!ticketType || ticketType.eventId !== event.id || ticketType.status !== "ON_SALE") {
      return NextResponse.json({ error: "invalid_ticket_type" }, { status: 400 });
    }
    ticketCount = input.ticketCount ?? 1;
    if (ticketCount < ticketType.minPerOrder || ticketCount > ticketType.maxPerOrder) {
      return NextResponse.json({ error: "invalid_ticket_quantity" }, { status: 400 });
    }
    // Only CONFIRMED registrations compete for real inventory — a STARTED
    // draft from someone who abandoned checkout (see /api/register/draft)
    // must not block a real buyer from the last spot.
    const sold = await db.registration.aggregate({
      where: {
        ticketTypeId: input.ticketTypeId,
        status: "CONFIRMED",
        id: existingRegistrationForCapacityCheck ? { not: existingRegistrationForCapacityCheck.id } : undefined,
      },
      _sum: { ticketCount: true },
    });
    const remaining = ticketType.quantity - (sold._sum.ticketCount ?? 0);
    if (ticketCount > remaining) {
      return NextResponse.json({ error: "sold_out" }, { status: 400 });
    }
  }

  // Dedup on email — the whole point of the CRM being "one profile per
  // person" rather than one row per registration. city/profession here are
  // exactly what /admin/crm/segments and Broadcasts filter on (see
  // lib/segments/builder.ts) — same live value, not a separate copy.
  const person = await db.person.upsert({
    where: { email: normalizedEmail },
    create: {
      email: normalizedEmail,
      phone: input.phone || null,
      firstName,
      lastName,
      city: input.city || null,
      profession: input.profession || null,
    },
    update: {
      phone: input.phone || null,
      firstName,
      lastName,
      city: input.city || null,
      profession: input.profession || null,
    },
  });

  // People re-submit the form for an event they already registered for
  // constantly — they forgot they did, or (most often) they just lost the
  // QR email and want it resent. `@@unique([personId, eventId])` means a
  // second `create()` here would throw instead of quietly duplicating —
  // reuse the existing registration and treat this as "resend my ticket",
  // which is what they actually want, rather than surfacing a DB error.
  //
  // The existing row can also be a STARTED draft (an abandoned-cart row —
  // see /api/register/draft) that never reached this real submit before.
  // That's not a resend, it's a first real confirmation, so it's tracked
  // separately from "was this row already CONFIRMED" below — that's the
  // question that actually matters for the Meta Purchase CAPI gate further
  // down, not merely "did some row already exist".
  const existingRegistration = await db.registration.findUnique({
    where: { personId_eventId: { personId: person.id, eventId: event.id } },
  });
  const isResend = Boolean(existingRegistration);
  const wasAlreadyConfirmed = existingRegistration?.status === "CONFIRMED";

  const customFields = input.customFields;
  const registration = existingRegistration
    ? await db.registration.update({
        where: { id: existingRegistration.id },
        data: {
          customFields,
          ticketTypeId: input.ticketTypeId ?? null,
          ticketCount,
          status: "CONFIRMED",
          confirmedAt: existingRegistration.confirmedAt ?? new Date(),
        },
      })
    : await db.registration.create({
        data: {
          eventId: event.id,
          personId: person.id,
          status: "CONFIRMED",
          confirmedAt: new Date(),
          customFields,
          ticketTypeId: input.ticketTypeId ?? null,
          ticketCount,
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
      WHATSAPP: input.consents.whatsapp,
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
  await sendTicketEmail({
    person,
    event,
    qrToken,
    registration: { id: registration.id, ticketTypeId: registration.ticketTypeId, ticketCount: registration.ticketCount },
  });

  // --- Purchase → Meta CAPI, gated by the ADVERTISING consent, not just
  // "did they register". Sharing hashed identifiers with Meta is a distinct
  // purpose under Ley 1581 and needs its own opt-in. Skipped only when the
  // row was ALREADY CONFIRMED before this request (a real resend — same
  // registration, not a second purchase; firing it again would inflate the
  // conversion count Meta uses for ad optimization). A STARTED→CONFIRMED
  // graduation is a first real purchase and must still fire. ---
  if (!wasAlreadyConfirmed && (await hasActiveConsent(person.id, "ADVERTISING"))) {
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
