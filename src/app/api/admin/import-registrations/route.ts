import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

// Protected by middleware (same Basic Auth as the rest of /admin/api).
//
// Bulk-writes an already-parsed, already-deduped person list (produced
// client-side by lib/import/ticketTailorDoorlist.ts — see /admin/import)
// into Person/Registration/Consent. Deliberately NOT one Prisma call per
// person: at ~5,800+ people per city that's 15,000+ round trips, which
// blows past any serverless function timeout. Instead: one batched raw
// upsert for Person (ON CONFLICT DO UPDATE, keeps existing ids), then
// batched createManyAndReturn for Registration, then batched createMany
// for Consent — a handful of queries total instead of tens of thousands.
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
  checkedIn: z.boolean(),
  ticketCount: z.number(),
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

  // 3. Skip people who already have a registration for this event (safe to
  // re-run the same file twice — e.g. a corrected export — without
  // creating duplicate registrations/consents). Person data above still
  // got refreshed either way.
  const existingRegs = await db.registration.findMany({
    where: { eventId: event.id, personId: { in: [...personIdByEmail.values()] } },
    select: { personId: true },
  });
  const alreadyRegisteredIds = new Set(existingRegs.map((r) => r.personId));

  const toRegister = people.filter((p) => {
    const personId = personIdByEmail.get(p.email);
    return personId && !alreadyRegisteredIds.has(personId);
  });

  let created = 0;
  for (const batch of chunk(toRegister, BATCH_SIZE)) {
    const registrationsData = batch.map((p) => ({
      eventId: event.id,
      personId: personIdByEmail.get(p.email)!,
      status: "CONFIRMED" as const,
      confirmedAt: new Date(),
      checkedIn: p.checkedIn,
      customFields: {
        cedula: p.cedula,
        instagram: p.instagram,
        importedFrom: "ticket-tailor-doorlist",
        ticketCount: p.ticketCount,
      },
    }));

    const inserted = await db.registration.createManyAndReturn({
      data: registrationsData,
      select: { id: true, personId: true },
    });
    created += inserted.length;

    const consentsData = inserted.flatMap((r) => {
      const rows: Array<{
        personId: string;
        registrationId: string;
        purpose: "LOGISTICS" | "MARKETING" | "ADVERTISING";
        granted: boolean;
      }> = [{ personId: r.personId, registrationId: r.id, purpose: "LOGISTICS", granted: true }];
      if (consent.marketing) {
        rows.push({ personId: r.personId, registrationId: r.id, purpose: "MARKETING" as const, granted: true });
      }
      if (consent.advertising) {
        rows.push({ personId: r.personId, registrationId: r.id, purpose: "ADVERTISING" as const, granted: true });
      }
      return rows;
    });
    for (const consentBatch of chunk(consentsData, BATCH_SIZE)) {
      await db.consent.createMany({ data: consentBatch });
    }
  }

  return NextResponse.json({
    ok: true,
    event: { slug: event.slug, name: event.name },
    totalPeopleInFile: people.length,
    created,
    alreadyRegistered: people.length - toRegister.length,
    checkedInCount: toRegister.filter((p) => p.checkedIn).length,
    professionsCreated,
  });
}
