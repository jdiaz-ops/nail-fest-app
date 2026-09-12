import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import type { RegistrationStatus } from "@prisma/client";
import { pushNewRegistrantToEventAudiences } from "@/lib/meta/audiences";
import { recordConsents } from "@/lib/consent";
import { finalizeConfirmedRegistration } from "@/lib/registrationConfirmation";
import { buildCheckoutUrl } from "@/lib/payments/wompi";
import { clientIpFromHeaders, userAgentFromHeaders } from "@/lib/request";
import { splitName } from "@/lib/name";
import { getOrgSettings } from "@/lib/settings";
import { getCheckoutQuestions, LOCKED_KEYS, type LockedKey } from "@/lib/checkoutForm";
import { isKnownCityLabel } from "@/lib/cityMatch";
import { WORLD_COUNTRIES } from "@/lib/worldCountries";

// The real registration path — the single busiest route on launch day —
// synchronously awaits several real external calls in series (Meta CAPI,
// the ticket email, WhatsApp if that automation is on) after the DB
// writes; those don't overlap by design (see each call's own comment on
// why), so their latencies stack. The platform default (15s on Vercel
// Pro) is normally plenty, but this is cheap insurance against a single
// slow upstream (SES/Resend, Meta) turning into an avoidable 504 during
// the exact traffic window this matters most for.
export const maxDuration = 30;

const bodySchema = z.object({
  eventSlug: z.string(),
  email: z.string().email(),
  // Only sent when the "email" question's confirmEmail is on (matches our
  // previous ticketing platform's "ask twice to catch typos") — see CheckoutFormEditor.tsx.
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
  // País de residencia (ISO2, e.g. "CO") — NOT the phone's own dial code.
  // Those are genuinely separate now (someone can live in Venezuela with
  // a US phone number, see RegistrationForm.tsx's own comment) — `phone`
  // above already carries whatever dial code the person actually picked
  // for their number, independent of this. Hard-required regardless of
  // any admin config, same treatment as email/fullName — this isn't a
  // customizable CheckoutQuestion, it's a fixed structural field.
  country: z.string().min(1),
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
  // Honeypot — see RegistrationForm.tsx's own comment on the field
  // itself. Always empty from the real form; a script filling every
  // input it finds is the only thing likely to populate it.
  website: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const input = parsed.data;

  // Honeypot tripped — same response shape as any other validation
  // failure (nothing that tells an automated caller WHY this failed
  // differently from a normal bad request), and nothing touches the DB:
  // no Person, no Registration, no email/WhatsApp send, no Meta event.
  if (input.website) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

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
  // A second, narrowed-non-null binding used only inside the
  // attemptRegistration transaction closure further down — TS doesn't
  // carry the `if (!event) return` narrowing above through that nested
  // function declaration, even though `event` itself is a plain `const`.
  // Every other, non-nested use of `event` in this route keeps using the
  // original binding unchanged.
  const confirmedEvent = event;

  // Required-ness for phone/city/profession/cedula/every custom question
  // comes from live /admin/settings/checkout-form config, not a fixed zod
  // schema — that's the whole point of that editor actually changing what
  // this endpoint accepts. fullName/email are hard-required regardless of
  // what's stored (same as our previous ticketing platform: Name/Email have
  // no "Required" toggle at all, they're just always on) since the rest of the CRM
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

  // País must be a real ISO2 from the same list the form itself offers —
  // same "never trust the client" reasoning as the city check below.
  if (!WORLD_COUNTRIES.some((c) => c.iso2 === input.country)) {
    return NextResponse.json({ error: "invalid_country" }, { status: 400 });
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
  //
  // Only enforced for someone who says they live in Colombia (input.country
  // === "CO") — that's the only country with a real municipality list to
  // validate against (see RegistrationForm.tsx's own city-field comment).
  // Keyed off País (residence), NOT the phone's dial code — those are
  // separate now (a Colombian resident might register with a foreign
  // phone number, and that shouldn't switch off city validation). Anyone
  // living elsewhere gets a free-text city instead, both client- and
  // server-side.
  if (input.country === "CO" && input.city.trim() && !isKnownCityLabel(input.city)) {
    return NextResponse.json({ error: "invalid_city" }, { status: 400 });
  }

  // See /admin/settings/banned-emails — checked before touching the CRM at
  // all, same as our previous ticketing platform's own "Banned email addresses" block.
  const orgSettings = await getOrgSettings();
  const normalizedEmail = input.email.trim().toLowerCase();
  if (orgSettings.bannedEmails.includes(normalizedEmail)) {
    return NextResponse.json({ error: "not_permitted" }, { status: 403 });
  }

  // Fetched before the capacity checks below so a resend can exclude the
  // person's OWN prior reservation from "how many are already taken" —
  // otherwise resubmitting the same order would look like it's competing
  // with itself for the last spot.
  const existingPerson = await db.person.findUnique({ where: { email: normalizedEmail } });
  const existingRegistrationForCapacityCheck = existingPerson
    ? await db.registration.findUnique({ where: { personId_eventId: { personId: existingPerson.id, eventId: event.id } } })
    : null;

  let ticketCount = 1;
  // Declared out here (not just inside the `if` below) so the transaction
  // closure further down can still read its `.quantity` — see that
  // closure's own comment on why the actual remaining-count check happens
  // there instead of right here.
  let ticketType: Awaited<ReturnType<typeof db.ticketType.findUnique>> = null;
  if (input.ticketTypeId) {
    // Only the type-existence/status/min-max checks happen here, outside
    // the transaction below — those never change based on a concurrent
    // registration, so there's nothing to protect them from. The actual
    // quantity-remaining check moves inside the transaction (see its own
    // comment) since THAT one is exactly the race a concurrent request can
    // hit.
    ticketType = await db.ticketType.findUnique({ where: { id: input.ticketTypeId } });
    if (!ticketType || ticketType.eventId !== event.id || ticketType.status !== "ON_SALE") {
      return NextResponse.json({ error: "invalid_ticket_type" }, { status: 400 });
    }
    ticketCount = input.ticketCount ?? 1;
    if (ticketCount < ticketType.minPerOrder || ticketCount > ticketType.maxPerOrder) {
      return NextResponse.json({ error: "invalid_ticket_quantity" }, { status: 400 });
    }
  }

  const customFields = input.customFields;

  // Capacity check + the person/registration writes, all inside one
  // transaction — closes a real race: reading "how many sold" and then
  // writing the new registration used to be two separate, unprotected
  // queries, so two requests arriving for the true last spot at the same
  // moment could BOTH read "1 remaining" and both succeed, overselling
  // past the real cap.
  //
  // This used to reach for Postgres SERIALIZABLE isolation on the WHOLE
  // transaction instead of the row lock below — reverted after finding a
  // real problem with it under actual load: SERIALIZABLE detects
  // conflicts at the INDEX-PAGE level, not just "did these two requests
  // touch the same row", so concurrent INSERTs into Registration spuriously
  // abort each other even between totally UNRELATED registrations (two
  // different people, two different events, nothing to actually conflict
  // over) — verified live: 50 simultaneous registrations with no shared
  // ticket type at all still threw 16-20 real 500s. A retry loop (tried
  // next) softened but never eliminated it, because the whole table pays
  // that tax on every write regardless of whether there's a real resource
  // being contended.
  //
  // `SELECT ... FOR UPDATE` on the specific TicketType row is the
  // targeted fix: it locks ONLY the one ticket type actually being sold,
  // so two people racing for the last spot of THAT type serialize
  // correctly (the second one's SELECT just waits until the first
  // commits, then sees the up-to-date count), while every registration
  // for a different ticket type — or no ticket type at all, the common
  // "plain event" case — never contends with anything and runs at
  // normal Postgres throughput. No special isolation level needed; the
  // lock IS the synchronization point.
  //
  // Only TicketType.quantity is enforced here — the real, always-enforced
  // cap whenever a ticket type exists (mandatory field, no "unlimited"
  // option). Event.capacity ("aforo" on Eventos/Resumen) is deliberately
  // NOT checked: an earlier version of this route enforced both, but that
  // means the ticket type's own configured quantity — the number an
  // admin explicitly set as "this many tickets exist" — could get
  // silently overridden by a smaller, separately-set aforo, including by
  // mistake (aforo defaults to whatever was typed when the event was
  // created, easy to leave stale or wrong). The ticket type IS the source
  // of truth for how many can go out; aforo stays a display-only number
  // on the dashboards until there's a real design for how the two should
  // reconcile when they disagree, not silently enforced as a second,
  // possibly-wrong ceiling underneath it.
  async function attemptRegistration() {
    return db.$transaction(async (tx) => {
      if (input.ticketTypeId) {
        // The lock — every concurrent request for THIS ticket type queues
        // up here and proceeds one at a time; nothing else in the app
        // reads/writes a single TicketType row inside its own
        // transaction, so this can't deadlock against another code path.
        await tx.$queryRaw`SELECT id FROM "TicketType" WHERE id = ${input.ticketTypeId} FOR UPDATE`;
        const sold = await tx.registration.aggregate({
          where: {
            ticketTypeId: input.ticketTypeId,
            status: "CONFIRMED",
            id: existingRegistrationForCapacityCheck ? { not: existingRegistrationForCapacityCheck.id } : undefined,
          },
          _sum: { ticketCount: true },
        });
        const remaining = ticketType!.quantity - (sold._sum.ticketCount ?? 0);
        if (ticketCount > remaining) {
          return { error: "sold_out" as const };
        }
      }

      // Dedup on email — the whole point of the CRM being "one profile
        // per person" rather than one row per registration. city/profession
        // here are exactly what /admin/crm/segments and Broadcasts filter
        // on (see lib/segments/builder.ts) — same live value, not a
        // separate copy.
        const person = await tx.person.upsert({
          where: { email: normalizedEmail },
          create: {
            email: normalizedEmail,
            phone: input.phone || null,
            firstName,
            lastName,
            city: input.city || null,
            profession: input.profession || null,
            country: input.country,
          },
          update: {
            phone: input.phone || null,
            firstName,
            lastName,
            city: input.city || null,
            profession: input.profession || null,
            country: input.country,
          },
        });

        // People re-submit the form for an event they already registered
        // for constantly — they forgot they did, or (most often) they
        // just lost the QR email and want it resent.
        // `@@unique([personId, eventId])` means a second `create()` here
        // would throw instead of quietly duplicating — reuse the
        // existing registration and treat this as "resend my ticket",
        // which is what they actually want, rather than surfacing a DB
        // error.
        //
        // The existing row can also be a STARTED draft (an
        // abandoned-cart row — see /api/register/draft) that never
        // reached this real submit before. That's not a resend, it's a
        // first real confirmation, so it's tracked separately from "was
        // this row already CONFIRMED" below — that's the question that
        // actually matters for the Meta Purchase CAPI gate further down,
        // not merely "did some row already exist".
        const existingRegistration = await tx.registration.findUnique({
          where: { personId_eventId: { personId: person.id, eventId: confirmedEvent.id } },
        });
        const isResend = Boolean(existingRegistration);
        const wasAlreadyConfirmed = existingRegistration?.status === "CONFIRMED";

        // A paid ticket type (TicketType.price > 0) goes to PENDING_PAYMENT
        // instead of straight to CONFIRMED — see /api/webhooks/wompi and
        // lib/payments/confirmRegistrationPayment.ts for what actually
        // confirms it once Wompi says the transaction is APPROVED. A
        // resend of something ALREADY confirmed (they paid before, this is
        // just a re-submit — e.g. they lost the ticket email) must never
        // regress back to PENDING_PAYMENT and ask them to pay twice.
        const isPaidTicket = Boolean(ticketType && ticketType.price > 0);
        const nextStatus: RegistrationStatus = wasAlreadyConfirmed ? "CONFIRMED" : isPaidTicket ? "PENDING_PAYMENT" : "CONFIRMED";

        const registration = existingRegistration
          ? await tx.registration.update({
              where: { id: existingRegistration.id },
              data: {
                customFields,
                ticketTypeId: input.ticketTypeId ?? null,
                ticketCount,
                status: nextStatus,
                confirmedAt: nextStatus === "CONFIRMED" ? existingRegistration.confirmedAt ?? new Date() : existingRegistration.confirmedAt,
              },
            })
          : await tx.registration.create({
              data: {
                eventId: confirmedEvent.id,
                personId: person.id,
                status: nextStatus,
                confirmedAt: nextStatus === "CONFIRMED" ? new Date() : null,
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

      return { error: null, person, registration, isResend, wasAlreadyConfirmed };
    });
  }

  // Two Prisma error codes are worth retrying here, not treating as a
  // real 500 — both are ordinary outcomes of real concurrent traffic,
  // not bugs:
  //   P2034 — a genuine deadlock or lock-wait conflict. The FOR UPDATE
  //   lock above makes the ticket-type-contention case wait instead of
  //   abort (see attemptRegistration's own comment on why that replaced
  //   SERIALIZABLE isolation), so this should now be rare — kept as a
  //   safety net, not the primary mechanism it used to be.
  //   P2002 — the `@@unique([personId, eventId])` constraint: the one
  //   real remaining race for a registration with NO ticket type (so no
  //   lock above protects it) is the exact same person double-submitting
  //   at the exact same instant (an impatient double-click, or a resend
  //   racing a fresh submit) — two concurrent transactions can both see
  //   "no existing registration yet" and both try to create one. A
  //   retry re-reads and correctly takes the update ("resend") branch
  //   instead of create, the same as a normal, non-simultaneous resend
  //   already does.
  const MAX_ATTEMPTS = 5;
  let result: Awaited<ReturnType<typeof attemptRegistration>> | undefined;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      result = await attemptRegistration();
      break;
    } catch (err) {
      const code = err instanceof Error && "code" in err ? err.code : undefined;
      const isRetryable = code === "P2034" || code === "P2002";
      if (!isRetryable || attempt === MAX_ATTEMPTS) throw err;
      const backoffMs = 30 * attempt + Math.floor(Math.random() * 40);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
  if (!result) throw new Error("attemptRegistration exhausted retries without a result"); // unreachable — the loop above always either returns or throws

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const { person, registration, isResend, wasAlreadyConfirmed } = result;

  // Record their consent choice from THIS submission either way — even on
  // a resend, it's a fresh explicit answer (they might have changed their
  // mind on marketing/ads since the first time) and consent is append-only
  // by design, so this never overwrites the earlier record, just adds to
  // it. Recorded regardless of paid/free and regardless of whether the
  // payment ever actually completes — they gave this answer the moment
  // they submitted the form, which is the real "condition of registering"
  // moment, not whichever moment Wompi later confirms the charge.
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

  // --- Paid ticket, not yet confirmed: send them to Wompi instead of
  // finalizing anything. No QR email, no WhatsApp, no Purchase CAPI yet —
  // all of that waits for a real APPROVED transaction (see
  // /api/webhooks/wompi and /[eventSlug]/pago). A retried checkout (they
  // abandoned Wompi and resubmitted the form) lands right back here and
  // gets a FRESH Payment row/reference — see that model's own comment on
  // why it's one row per attempt, not one per registration. ---
  if (registration.status === "PENDING_PAYMENT") {
    const amountInCents = ticketType!.price * registration.ticketCount * 100;
    const payment = await db.payment.create({
      data: { registrationId: registration.id, amountInCents, currency: "COP" },
    });
    const checkoutUrl = buildCheckoutUrl({
      reference: payment.id,
      amountInCents,
      currency: "COP",
      redirectUrl: `${process.env.APP_BASE_URL ?? ""}/${event.slug}/pago?registrationId=${registration.id}`,
      customerEmail: person.email,
    });
    return NextResponse.json({ ok: true, requiresPayment: true, registrationId: registration.id, checkoutUrl });
  }

  // --- Free ticket, or a resend of something already CONFIRMED — the
  // exact same finalize step a paid confirmation runs once Wompi approves
  // it (see lib/registrationConfirmation.ts), so the two paths can never
  // quietly drift apart on what "confirmed" actually delivers. ---
  // zoomJoinUrl (in finalizeConfirmedRegistration's own return value) is
  // deliberately NOT surfaced here — see that function's own comment on
  // why the personal join link isn't handed out at registration time at
  // all, on any channel.
  const { whatsappTicketLinkSent } = await finalizeConfirmedRegistration({
    person,
    event,
    registration,
    wasAlreadyConfirmed,
    purchaseEventId: input.purchaseEventId,
    fbc: input.fbc,
    fbp: input.fbp,
    clientIpAddress: clientIpFromHeaders(),
    clientUserAgent: userAgentFromHeaders(),
  });

  return NextResponse.json({ ok: true, registrationId: registration.id, resent: isResend, whatsappTicketLinkSent });
}
