import type { PrismaClient } from "@prisma/client";

// The real 9 categories from the live registration form (same wording used
// on nailfest's previous-platform forms across events) — kept 1:1 so historical
// imports (see /admin/import) map onto these without inventing new labels.
// Exported (not just used here) so lib/professions.ts can sort by this
// order instead of alphabetically — alphabetical sorts by the leading
// emoji's codepoint, not the form's actual intended order.
export const PROFESSIONS = [
  "💅 Soy manicurista profesional",
  "📚 Soy estudiante de un programa técnico o carrera enfocada en manos y pies",
  "🎨 Soy aficionada al nail art (me pinto las uñas en casa como hobby)",
  "🎖️ Soy propietaria o gerente de salón/spa de uñas",
  "🏫 Soy propietaria o gerente de una academia de uñas",
  "📦 Soy distribuidor, mayorista o tienda multimarca especializada en productos para uñas",
  "🎤 Soy educadora de uñas profesional",
  "🤝 Represento una marca de productos para uñas",
  "❌ Ninguna de las anteriores",
];

/**
 * Baseline data: profession options + one test event. Shared by the local
 * `npm run db:seed` script and the one-time production seed endpoint
 * (`/api/admin/seed`) — same logic, two ways to trigger it, since this
 * session can't reach the production DB directly to run it itself.
 */
export async function seedBaseline(db: PrismaClient) {
  for (const [order, label] of PROFESSIONS.entries()) {
    await db.professionOption.upsert({ where: { label }, update: {}, create: { label, order } });
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
