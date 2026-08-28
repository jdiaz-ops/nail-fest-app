import type { PrismaClient } from "@prisma/client";

const PROFESSIONS = ["Manicurista", "Estilista", "Estudiante", "Maquillista", "Otro"];

/**
 * Baseline data: profession options + one test event. Shared by the local
 * `npm run db:seed` script and the one-time production seed endpoint
 * (`/api/admin/seed`) — same logic, two ways to trigger it, since this
 * session can't reach the production DB directly to run it itself.
 */
export async function seedBaseline(db: PrismaClient) {
  for (const label of PROFESSIONS) {
    await db.professionOption.upsert({ where: { label }, update: {}, create: { label } });
  }

  const event = await db.event.upsert({
    where: { slug: "bogota-2026" },
    update: {},
    create: {
      slug: "bogota-2026",
      name: "Nail Fest Bogotá 2026",
      city: "Bogotá",
      startsAt: new Date("2026-11-14T14:00:00-05:00"),
      endsAt: new Date("2026-11-14T20:00:00-05:00"),
      capacity: 10000,
    },
  });

  return { eventSlug: event.slug };
}
