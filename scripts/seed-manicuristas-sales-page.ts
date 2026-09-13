// One-time content load: writes the full "guion de venta" copy for
// Manicuristas Imparables into that event's own Description field — the
// SAME field/editor every other event already uses (admin's "Descripción"
// rich-text box, EventForm.tsx), rendered by the SAME public page code
// path (EventRegistration.tsx's descriptionHtml, next to the untouched
// registration/checkout sidebar). No new schema, no new render branch, no
// new admin screen — this script exists only because that much text is
// impractical to paste by hand into the rich-text editor once, not
// because the mechanism itself is new.
//
// This is the CLI path (needs DATABASE_URL). No terminal handy? Use the
// one-tap admin page instead: /admin/dev/seed-sales-copy — same content
// (src/lib/salesCopy/manicuristasImparables.ts), same guardrails, hit
// from the phone while logged into /admin.
//
// Touches ONLY the Event.description column for the one event you name —
// never any other field on that event (startsAt, zoomMeetingId, format,
// etc. are all left exactly as they are), and refuses to run at all
// without a real --slug so it can never guess the wrong event.
//
// Run with:
//   npx tsx scripts/seed-manicuristas-sales-page.ts --slug <event-slug>
// Add --force to overwrite a description that isn't empty (without it,
// the script stops and shows you the current content instead of
// clobbering something someone already wrote by hand).
import { PrismaClient } from "@prisma/client";
import { sanitizeEventDescription } from "../src/lib/sanitizeHtml";
import { MANICURISTAS_SALES_PAGE_HTML } from "../src/lib/salesCopy/manicuristasImparables";

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

  if (event.description && event.description.trim() && !force) {
    console.log(
      `El evento "${event.name}" (${slug}) ya tiene una Descripción guardada (${event.description.length} caracteres). ` +
        "No la voy a sobrescribir sin --force. Descripción actual:\n\n" +
        event.description
    );
    return;
  }

  await db.event.update({
    where: { slug },
    data: { description: sanitizeEventDescription(MANICURISTAS_SALES_PAGE_HTML) },
  });

  console.log(
    `Listo — la Descripción de "${event.name}" (${slug}) ya tiene la landing de venta completa. ` +
      "Revísala en /admin/events (editar evento) o en la página pública del evento."
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
