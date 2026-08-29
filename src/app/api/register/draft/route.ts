import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { splitName } from "@/lib/name";
import { getOrgSettings } from "@/lib/settings";

// Real abandoned-cart tracking: fired from RegistrationForm.tsx's email
// field onBlur — the earliest point in the flow where we know who someone
// is. Deliberately lenient (only eventSlug + email are required) and
// deliberately narrow in what it does: it only ever writes a STARTED
// registration row, never CONFIRMED, and never touches anything that
// implies real consent (no email sent, no Consent row, no Meta CAPI event,
// no Custom Audience push — those all stay gated behind the real submit in
// /api/register). A STARTED row is just "someone got this far and gave us
// an email" — see the RegistrationStatus enum's own comment in
// schema.prisma.
//
// Fire-and-forget from the client (same pattern as tracking.ts's
// keepalive fetch) — this must never block or error the visible form, so
// every failure path here returns 200 with ok:false rather than a real
// HTTP error.
const bodySchema = z.object({
  eventSlug: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  fullName: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  city: z.string().optional(),
  profession: z.string().optional(),
  ticketTypeId: z.string().optional(),
  ticketCount: z.number().int().positive().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 200 });
    }
    const input = parsed.data;

    const event = await db.event.findUnique({ where: { slug: input.eventSlug } });
    if (!event || event.status === "DRAFT") {
      return NextResponse.json({ ok: false, error: "event_not_found" }, { status: 200 });
    }

    const normalizedEmail = input.email.trim().toLowerCase();
    const orgSettings = await getOrgSettings();
    if (orgSettings.bannedEmails.includes(normalizedEmail)) {
      return NextResponse.json({ ok: false, error: "not_permitted" }, { status: 200 });
    }

    const sentFirstLast = Boolean(input.firstName?.trim());
    const { firstName, lastName } = sentFirstLast
      ? { firstName: input.firstName!.trim(), lastName: (input.lastName ?? "").trim() }
      : splitName(input.fullName ?? "");

    // Never overwrite real data with a blank on an update — a draft save
    // can fire multiple times as someone fills in more fields, and later
    // fires must not blank out what an earlier one (or a past real
    // registration) already captured. `undefined` tells Prisma "leave this
    // field alone"; only a real submit (POST /api/register) is allowed to
    // write an intentional null.
    const person = await db.person.upsert({
      where: { email: normalizedEmail },
      create: {
        email: normalizedEmail,
        phone: input.phone || null,
        firstName: firstName || null,
        lastName: lastName || null,
        city: input.city || null,
        profession: input.profession || null,
      },
      update: {
        phone: input.phone || undefined,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        city: input.city || undefined,
        profession: input.profession || undefined,
      },
    });

    const existingRegistration = await db.registration.findUnique({
      where: { personId_eventId: { personId: person.id, eventId: event.id } },
    });

    // A CONFIRMED (or even CANCELLED) row already answers "did this person
    // reach checkout" — never downgrade or otherwise touch it from here.
    // Only a genuinely new person, or one still mid-draft, gets written.
    if (existingRegistration && existingRegistration.status !== "STARTED") {
      return NextResponse.json({ ok: true, skipped: true });
    }

    // Only attach a ticket type if it's real and on sale — otherwise leave
    // it unset rather than reject the draft outright; this endpoint never
    // fails the visible form.
    let ticketTypeId: string | null | undefined = undefined;
    if (input.ticketTypeId) {
      const ticketType = await db.ticketType.findUnique({ where: { id: input.ticketTypeId } });
      if (ticketType && ticketType.eventId === event.id && ticketType.status === "ON_SALE") {
        ticketTypeId = ticketType.id;
      }
    }

    if (existingRegistration) {
      await db.registration.update({
        where: { id: existingRegistration.id },
        data: {
          ticketTypeId,
          ticketCount: input.ticketCount ?? undefined,
          utmSource: existingRegistration.utmSource ?? input.utmSource,
          utmMedium: existingRegistration.utmMedium ?? input.utmMedium,
          utmCampaign: existingRegistration.utmCampaign ?? input.utmCampaign,
        },
      });
    } else {
      await db.registration.create({
        data: {
          eventId: event.id,
          personId: person.id,
          status: "STARTED",
          ticketTypeId: ticketTypeId ?? null,
          ticketCount: input.ticketCount ?? 1,
          utmSource: input.utmSource,
          utmMedium: input.utmMedium,
          utmCampaign: input.utmCampaign,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    // Never let a draft-save failure be visible — this is a background
    // signal, not a step in the real checkout flow.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
