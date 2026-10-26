import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { recordConsents } from "@/lib/consent";
import { isObviouslyDeadEmail } from "@/lib/emailDomainCheck";
import { queueMetaEvent } from "@/lib/meta/capi";
import { splitName } from "@/lib/name";
import { clientIpFromHeaders, userAgentFromHeaders } from "@/lib/request";
import { getOrgSettings } from "@/lib/settings";
import { WORLD_COUNTRIES } from "@/lib/worldCountries";
import { waitlistLabel } from "@/lib/imparables/waitlist";

// Joining an event's waiting list (Manicuristas Imparables' page before its
// first price stage opens — components/imparables/ImpWaitlistForm.tsx).
// The person goes into the CRM like a registration would put her — one
// profile per email, never blanking what an earlier form already saved —
// with the event's waiting-list label and the same four consents the
// registration form's acceptance line covers (its own line under the
// button says the same). Nothing is sent to her from here: the team writes
// to the label when the sale opens. Meta gets a Lead, deduplicated with the
// Pixel's by `leadEventId`.

const bodySchema = z.object({
  eventSlug: z.string().min(1),
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  // E.164, built by the form from the picked country's code.
  phone: z.string().regex(/^\+\d{7,15}$/),
  city: z.string().trim().min(1).max(80),
  country: z.string().length(2),
  website: z.string().optional(),
  fbc: z.string().optional(),
  fbp: z.string().optional(),
  leadEventId: z.string().max(100).optional(),
  sourceUrl: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const input = parsed.data;
  // Honeypot: same answer as any bad request, and nothing written.
  if (input.website) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  if (!WORLD_COUNTRIES.some((c) => c.iso2 === input.country)) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const event = await db.event.findUnique({ where: { slug: input.eventSlug } });
  if (!event || event.status === "DRAFT") return NextResponse.json({ error: "event_not_found" }, { status: 404 });

  const email = input.email.toLowerCase();
  const orgSettings = await getOrgSettings();
  if (orgSettings.bannedEmails.includes(email)) return NextResponse.json({ error: "not_permitted" }, { status: 403 });
  if (await isObviouslyDeadEmail(email)) return NextResponse.json({ error: "email_domain_invalid" }, { status: 400 });

  const { firstName, lastName } = splitName(input.fullName);
  const label = waitlistLabel(event);
  const person = await db.person.upsert({
    where: { email },
    create: {
      email,
      phone: input.phone,
      firstName,
      lastName: lastName || null,
      city: input.city,
      country: input.country,
      labels: { connectOrCreate: { where: { name: label }, create: { name: label } } },
    },
    // Fresh answers from her own hands win; a field she left out never blanks one saved before.
    update: {
      phone: input.phone,
      firstName,
      lastName: lastName || undefined,
      city: input.city,
      country: input.country,
      labels: { connectOrCreate: { where: { name: label }, create: { name: label } } },
    },
  });

  await recordConsents({
    personId: person.id,
    registrationId: null,
    granted: { LOGISTICS: true, MARKETING: true, ADVERTISING: true, WHATSAPP: true },
  });

  try {
    await queueMetaEvent({
      eventId: input.leadEventId || crypto.randomUUID(),
      eventName: "Lead",
      eventSourceUrl: input.sourceUrl || `${process.env.APP_BASE_URL ?? ""}/${event.slug}`,
      userData: {
        email,
        phone: input.phone,
        clientIpAddress: clientIpFromHeaders(),
        clientUserAgent: userAgentFromHeaders(),
        fbc: input.fbc,
        fbp: input.fbp,
      },
    });
  } catch (err) {
    // Meta never undoes a sign-up already saved.
    console.error("waitlist Lead event failed", err);
  }

  return NextResponse.json({ ok: true, firstName });
}
