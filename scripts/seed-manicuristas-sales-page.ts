// One-time content load: writes the structured sales-script landing
// content for Manicuristas Imparables into that event's own
// salesPageContent column — a separate field from Event.description (see
// that column's own schema comment), rendered by
// components/salesPage/{SalesPageHero,SalesPageContent}.tsx instead of
// the plain rich-text block, right next to the untouched
// registration/checkout sidebar ([eventSlug]/page.tsx, EventRegistration.tsx).
//
// This is the CLI path (needs DATABASE_URL). No terminal handy? Use the
// one-tap admin page instead: /admin/dev/seed-sales-copy — same content
// (src/lib/salesPage/manicuristasImparables.ts), same guardrails, hit
// from the phone while logged into /admin.
//
// Touches ONLY the Event.salesPageContent column for the one event you
// name — never any other field on that event (startsAt, zoomMeetingId,
// format, description, etc. are all left exactly as they are), and
// refuses to run at all without a real --slug so it can never guess the
// wrong event.
//
// Run with:
//   npx tsx scripts/seed-manicuristas-sales-page.ts --slug <event-slug>
// Add --force to overwrite an already-set salesPageContent (without it,
// the script stops instead of clobbering something already loaded).
import { PrismaClient, Prisma } from "@prisma/client";
import { manicuristasImparablesSalesPage } from "../src/lib/salesPage/manicuristasImparables";

const db = new PrismaClient();

function parseArgs(argv: string[]) {
  const slugIdx = argv.indexOf("--slug");
  const slug = slugIdx >= 0 ? argv[slugIdx + 1] : undefined;
  const force = argv.includes("--force");
  return { slug, force };
}

async function main() {
  const { slug, force } = parseArgs(process.argv.slice(2));
  if (!slug) {
    throw new Error(
      "Falta --slug <event-slug>. No adivino cuál evento es — pásalo explícitamente " +
        "(el slug es la parte final de la URL pública, /<slug>)."
    );
  }

  const event = await db.event.findUnique({ where: { slug } });
  if (!event) {
    throw new Error(`No existe ningún evento con slug "${slug}". Revísalo en /admin/events.`);
  }

  if (event.salesPageContent && !force) {
    console.log(
      `El evento "${event.name}" (${slug}) ya tiene salesPageContent cargado. No lo voy a sobrescribir sin --force.`
    );
    return;
  }

  await db.event.update({
    where: { slug },
    data: { salesPageContent: manicuristasImparablesSalesPage as unknown as Prisma.InputJsonValue },
  });

  console.log(
    `Listo — "${event.name}" (${slug}) ya tiene la landing de venta completa (hero, tabla de valor, cronograma, ` +
      "speakers, FAQ). Revísala en la página pública del evento."
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
