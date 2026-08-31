import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";

//
// Bulk-writes an already-parsed, already-deduped person list (produced
// client-side by lib/import/doorlistCsv.ts — see /admin/import)
// into Person/Registration/Consent. Deliberately NOT one Prisma call per
// person: at ~5,800+ people per city that's 15,000+ round trips, which
// blows past any serverless function timeout. Instead: batched raw
// upserts (ON CONFLICT DO UPDATE) for Person and Registration, then
// batched createMany for Consent — a handful of queries total instead of
// tens of thousands.
//
// No email, no QR, no Meta CAPI event here — this is historical/bulk data,
// not a live registration. Population into Meta Custom Audiences happens
// through the existing segment sync (see /admin/segments), which only
// needs Person + Registration + Consent to exist; it doesn't care how they
// got there.

const personSchema = z.object({
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string().nullable(),
  city: z.string().nullable(),
  profession: z.string().nullable(),
  cedula: z.string().nullable(),
  instagram: z.string().nullable(),
  ticketCount: z.number().int().min(1),
  checkedInCount: z.number().int().min(0),
});

const bodySchema = z.object({
  event: z.union([
    z.object({ mode: z.literal("existing"), slug: z.string() }),
    z.object({
      mode: z.literal("new"),
      slug: z.string().min(1),
      name: z.string().min(1),
      city: z.string().min(1),
      startsAt: z.string(), // ISO
      endsAt: z.string().nullable(),
      capacity: z.number().nullable(),
    }),
  ]),
  consent: z.object({
    marketing: z.boolean(),
    advertising: z.boolean(),
    // Explicit business decision, not a default (see the composer's own
    // comment on this field): the original registration never asked
    // these people about WhatsApp specifically, so marking
    // this granted on import is a real judgment call about scope, not a
    // formality — the admin sees the risk spelled out before checking it.
    whatsapp: z.boolean(),
  }),
  people: z.array(personSchema).min(1),
});

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const BATCH_SIZE = 1000;

export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const { event: eventInput, consent, people } = parsed.data;

  const event =
    eventInput.mode === "existing"
      ? await db.event.findUnique({ where: { slug: eventInput.slug } })
      : await db.event.upsert({
          where: { slug: eventInput.slug },
          update: {},
          create: {
            slug: eventInput.slug,
            name: eventInput.name,
            city: eventInput.city,
            startsAt: new Date(eventInput.startsAt),
            endsAt: eventInput.endsAt ? new Date(eventInput.endsAt) : null,
            capacity: eventInput.capacity ?? undefined,
          },
        });
  if (!event) {
    return NextResponse.json({ error: "event_not_found" }, { status: 404 });
  }

  // 1. Make sure every distinct profession value has a ProfessionOption row
  // (so it shows up in the segment/broadcast dropdowns) — small set,
  // sequential upsert is fine.
  const distinctProfessions = [...new Set(people.map((p) => p.profession).filter((p): p is string => !!p))];
  const professionsCreated: string[] = [];
  for (const label of distinctProfessions) {
    const existing = await db.professionOption.findUnique({ where: { label } });
    if (!existing) {
      await db.professionOption.create({ data: { label } });
      professionsCreated.push(label);
    }
  }

  // 2. Bulk upsert Person by email — raw SQL, batched. ON CONFLICT DO
  // UPDATE never touches `id`, so an existing person keeps their id (and
  // therefore keeps every Registration/Consent/MetaEvent already linked to
  // them from a prior event).
  for (const batch of chunk(people, BATCH_SIZE)) {
    const values = batch.map(
      (p) =>
        Prisma.sql`(${randomUUID()}, ${p.email}, ${p.phone}, ${p.firstName}, ${p.lastName}, ${p.city}, ${p.profession}, NOW(), NOW())`
    );
    await db.$executeRaw`
      INSERT INTO "Person" (id, email, phone, "firstName", "lastName", city, profession, "createdAt", "updatedAt")
      VALUES ${Prisma.join(values)}
      ON CONFLICT (email) DO UPDATE SET
        phone = EXCLUDED.phone,
        "firstName" = EXCLUDED."firstName",
        "lastName" = EXCLUDED."lastName",
        city = EXCLUDED.city,
        profession = EXCLUDED.profession,
        "updatedAt" = NOW()
    `;
  }

  const emails = people.map((p) => p.email);
  const personRows = await db.person.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true },
  });
  const personIdByEmail = new Map(personRows.map((p) => [p.email, p.id]));
  const personIds = [...personIdByEmail.values()];

  // 3. Who already had a registration for THIS event, before this call —
  // needed to know who's genuinely new (gets Consent rows) vs. an update
  // to an existing registration (re-running a corrected export refreshes
  // ticketCount/checkedInCount/customFields, but must never insert a
  // second LOGISTICS/MARKETING/ADVERTISING consent for someone already
  // recorded).
  const existingBefore = await db.registration.findMany({
    where: { eventId: event.id, personId: { in: personIds } },
    select: { personId: true },
  });
  const alreadyRegisteredIds = new Set(existingBefore.map((r) => r.personId));

  // 4. Upsert Registration by (personId, eventId) — raw SQL, batched. A
  // second import of the same event updates ticketCount/checkedInCount/
  // customFields in place instead of being silently skipped, so a
  // corrected or richer re-export (e.g. one that finally has accurate
  // check-in data) actually takes effect.
  for (const batch of chunk(people, BATCH_SIZE)) {
    const values = batch.map((p) => {
      const customFields = JSON.stringify({
        cedula: p.cedula,
        instagram: p.instagram,
        importedFrom: "ticket-tailor-doorlist",
      });
      return Prisma.sql`(${randomUUID()}, ${event.id}, ${personIdByEmail.get(p.email)}, 'CONFIRMED', NOW(), ${p.ticketCount}, ${p.checkedInCount}, ${customFields}::jsonb)`;
    });
    await db.$executeRaw`
      INSERT INTO "Registration" (id, "eventId", "personId", status, "confirmedAt", "ticketCount", "checkedInCount", "customFields")
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("personId", "eventId") DO UPDATE SET
        "ticketCount" = EXCLUDED."ticketCount",
        "checkedInCount" = EXCLUDED."checkedInCount",
        "customFields" = EXCLUDED."customFields"
    `;
  }

  const allRegs = await db.registration.findMany({
    where: { eventId: event.id, personId: { in: personIds } },
    select: { id: true, personId: true },
  });

  // 5. Consent — only for the newly-created registrations from this call.
  const newlyRegistered = allRegs.filter((r) => !alreadyRegisteredIds.has(r.personId));
  const consentsData: Array<{
    personId: string;
    registrationId: string;
    purpose: "LOGISTICS" | "MARKETING" | "ADVERTISING" | "WHATSAPP";
    granted: boolean;
  }> = [];
  for (const r of newlyRegistered) {
    consentsData.push({ personId: r.personId, registrationId: r.id, purpose: "LOGISTICS", granted: true });
    if (consent.marketing) {
      consentsData.push({ personId: r.personId, registrationId: r.id, purpose: "MARKETING", granted: true });
    }
    if (consent.advertising) {
      consentsData.push({ personId: r.personId, registrationId: r.id, purpose: "ADVERTISING", granted: true });
    }
    if (consent.whatsapp) {
      consentsData.push({ personId: r.personId, registrationId: r.id, purpose: "WHATSAPP", granted: true });
    }
  }
  for (const consentBatch of chunk(consentsData, BATCH_SIZE)) {
    await db.consent.createMany({ data: consentBatch });
  }

  const ticketsIssued = people.reduce((sum, p) => sum + p.ticketCount, 0);
  const ticketsCheckedIn = people.reduce((sum, p) => sum + p.checkedInCount, 0);

  return NextResponse.json({
    ok: true,
    event: { slug: event.slug, name: event.name },
    totalPeopleInFile: people.length,
    created: newlyRegistered.length,
    updated: personIds.length - newlyRegistered.length,
    peopleWithAnyCheckIn: people.filter((p) => p.checkedInCount > 0).length,
    ticketsIssued,
    ticketsCheckedIn,
    professionsCreated,
  });
}
