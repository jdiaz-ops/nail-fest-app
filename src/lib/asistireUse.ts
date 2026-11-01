import { Prisma, type AsistireStep } from "@prisma/client";
import { db } from "@/lib/db";
import { asistireRegistrationId, asistireSampleEventId } from "@/lib/imparables/asistire";

// «Asistiré»'s count (2026-11-01, the team): how many people made their image and how many took it — downloaded
// it, or shared it straight from the phone — per event (AsistireUse in schema.prisma). Her page says so at each
// step (components/imparables/ImpAsistire.tsx, through /api/asistire/uso); nothing of her photo is sent.

/** A browser's id on the event's public link, made on her phone (ImpAsistire.tsx). */
const VISITOR = /^[A-Za-z0-9_-]{8,64}$/;

export type AsistireUseResult = "ok" | "not_found" | "invalid_visitor";

/** Counts one step of the person behind a link: her registration on her own link, her browser on the event's public one. */
export async function recordAsistireUse(token: string, step: AsistireStep, visitor: string | null): Promise<AsistireUseResult> {
  const id = asistireRegistrationId(token);
  if (!id) return "not_found";
  const sampleEventId = asistireSampleEventId(id);
  let who: { eventId: string; person: string; personal: boolean };
  if (sampleEventId) {
    if (!visitor || !VISITOR.test(visitor)) return "invalid_visitor";
    const event = await db.event.findUnique({ where: { id: sampleEventId }, select: { id: true } });
    if (!event) return "not_found";
    who = { eventId: event.id, person: `v:${visitor}`, personal: false };
  } else {
    const registration = await db.registration.findUnique({ where: { id }, select: { eventId: true } });
    if (!registration) return "not_found";
    who = { eventId: registration.eventId, person: `r:${id}`, personal: true };
  }
  const where = { eventId_person_step: { eventId: who.eventId, person: who.person, step } };
  try {
    await db.asistireUse.upsert({ where, create: { ...who, step }, update: { times: { increment: 1 } } });
  } catch (err) {
    // The same step twice at once: the other one made the row.
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
    await db.asistireUse.update({ where, data: { times: { increment: 1 } } });
  }
  return "ok";
}

export type AsistireCounts = {
  created: { personal: number; public: number };
  downloaded: { personal: number; public: number };
};

/** People per step, by link, for an event's summary. */
export async function asistireCounts(eventId: string): Promise<AsistireCounts> {
  const rows = await db.asistireUse.groupBy({ by: ["step", "personal"], where: { eventId }, _count: { _all: true } });
  const of = (step: AsistireStep, personal: boolean) => rows.find((r) => r.step === step && r.personal === personal)?._count._all ?? 0;
  return {
    created: { personal: of("CREATED", true), public: of("CREATED", false) },
    downloaded: { personal: of("DOWNLOADED", true), public: of("DOWNLOADED", false) },
  };
}
