import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { getOrgSettings } from "@/lib/settings";
import { zonedTimeToUtc } from "@/lib/dateFormat";

// "Fechas de inscripción" — puts the real sign-up date (from Ticket Tailor's
// orders export, see lib/import/ordersCsv.ts) on registrations the doorlist
// import created, which were all stamped with the day of the import. That
// date is what the per-day curve, the weekday breakdown and the velocity
// comparison read.
//
// Only touches registrations that came from the doorlist import
// (customFields.importedFrom) — a registration made in our own app already
// has its true date and is never changed. Nothing else on the row (or on
// the person) is written. Matching: email first, cédula as the fallback.
// Safe to run again: the same file sets the same dates.

const bodySchema = z.object({
  eventSlug: z.string().min(1),
  entries: z
    .array(
      z.object({
        email: z.string().min(1),
        cedula: z.string().nullable(),
        orderedAtLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
      })
    )
    .min(1),
});

const normCedula = (raw: unknown) => (typeof raw === "string" ? raw.replace(/\D/g, "").replace(/^0+/, "") : "");

export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  const { eventSlug, entries } = parsed.data;

  const [event, orgSettings] = await Promise.all([db.event.findUnique({ where: { slug: eventSlug } }), getOrgSettings()]);
  if (!event) return NextResponse.json({ error: "event_not_found" }, { status: 404 });

  const regs = await db.registration.findMany({
    where: { eventId: event.id },
    select: { id: true, customFields: true, person: { select: { email: true } } },
  });
  const byEmail = new Map(regs.map((r) => [r.person.email.toLowerCase(), r]));
  const byCedula = new Map<string, (typeof regs)[number]>();
  for (const r of regs) {
    const fields = r.customFields && typeof r.customFields === "object" && !Array.isArray(r.customFields) ? (r.customFields as Record<string, unknown>) : {};
    const c = normCedula(fields.cedula);
    // Too short to identify anyone — see AttendanceForecastSection's own check.
    if (c.length >= 5 && !byCedula.has(c)) byCedula.set(c, r);
  }

  const updates = new Map<string, Date>();
  let matchedByEmail = 0;
  let matchedByCedula = 0;
  let notFound = 0;
  let notImported = 0;
  for (const e of entries) {
    let reg = byEmail.get(e.email.toLowerCase());
    if (reg) matchedByEmail++;
    else {
      const c = normCedula(e.cedula);
      reg = c.length >= 5 ? byCedula.get(c) : undefined;
      if (reg) matchedByCedula++;
      else {
        notFound++;
        continue;
      }
    }
    const fields = reg.customFields && typeof reg.customFields === "object" && !Array.isArray(reg.customFields) ? (reg.customFields as Record<string, unknown>) : {};
    if (fields.importedFrom !== "ticket-tailor-doorlist") {
      notImported++;
      continue;
    }
    const at = zonedTimeToUtc(e.orderedAtLocal, orgSettings.timezone);
    if (Number.isNaN(at.getTime())) continue;
    // Two file rows landing on the same registration (email for one,
    // cédula for another) — the earlier date wins, same as within a file.
    const prev = updates.get(reg.id);
    if (!prev || at < prev) updates.set(reg.id, at);
  }

  // Prisma keeps DateTime columns as UTC wall-clock `timestamp` — the ISO
  // string (…Z) cast to timestamp is exactly that, independent of the DB
  // session's own timezone setting.
  const pairs = [...updates.entries()];
  for (let i = 0; i < pairs.length; i += 1000) {
    const values = pairs.slice(i, i + 1000).map(([id, at]) => Prisma.sql`(${id}, ${at.toISOString()}::timestamp)`);
    await db.$executeRaw`
      UPDATE "Registration" AS r
      SET "createdAt" = v.at, "confirmedAt" = v.at
      FROM (VALUES ${Prisma.join(values)}) AS v(id, at)
      WHERE r.id = v.id
    `;
  }

  return NextResponse.json({
    ok: true,
    event: { name: event.name },
    updated: pairs.length,
    matchedByEmail,
    matchedByCedula,
    notFound,
    notImported,
  });
}
