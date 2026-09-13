import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import SeedSalesCopyButton from "@/components/admin/SeedSalesCopyButton";

export const dynamic = "force-dynamic";

// One-tap admin utility, not linked from any nav — for loading the
// Manicuristas Imparables sales-page copy (src/lib/salesCopy/
// manicuristasImparables.ts) from a phone, no terminal/DATABASE_URL
// needed. Same content and guardrails as scripts/seed-manicuristas-sales-page.ts.
// Safe to leave in place after use: it only ever writes to whichever
// event you tap "Cargar" on, and never overwrites a non-empty
// Descripción without an explicit second confirmation.
export default async function SeedSalesCopyPage() {
  await requirePageUser(["ADMIN"]);

  const events = await db.event.findMany({
    where: { OR: [{ name: { contains: "manicurista", mode: "insensitive" } }, { name: { contains: "imparable", mode: "insensitive" } }] },
    orderBy: { startsAt: "desc" },
    select: { id: true, name: true, slug: true, format: true, description: true },
  });

  const fallback = events.length === 0;
  const list = fallback
    ? await db.event.findMany({
        orderBy: { startsAt: "desc" },
        take: 20,
        select: { id: true, name: true, slug: true, format: true, description: true },
      })
    : events;

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "24px 16px 80px" }}>
      <h1 style={{ fontSize: 20, margin: "0 0 6px" }}>Cargar landing de venta</h1>
      <p style={{ fontSize: 13.5, color: "#5b5f6b", margin: "0 0 20px" }}>
        Escribe la copy completa del guion de venta de Manicuristas Imparables en la Descripción del evento —
        el mismo campo que edita "Descripción" en Editar evento, y lo que se ve en la página pública.
      </p>
      {fallback && (
        <p style={{ fontSize: 12.5, color: "#8a5a1f", background: "#fdf1e6", padding: "8px 10px", borderRadius: 8, margin: "0 0 16px" }}>
          No encontré ningún evento con "manicurista" o "imparable" en el nombre — mostrando los últimos eventos en
          su lugar.
        </p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {list.map((event) => (
          <div key={event.id} style={{ border: "1px solid var(--border, #e3e1dc)", borderRadius: 12, padding: 14 }}>
            <p style={{ fontWeight: 700, margin: "0 0 2px" }}>{event.name}</p>
            <p style={{ fontSize: 12, color: "#5b5f6b", margin: "0 0 10px" }}>
              /{event.slug} · {event.format}
            </p>
            <SeedSalesCopyButton
              eventId={event.id}
              hasDescription={Boolean(event.description && event.description.trim())}
              descriptionLength={event.description?.length ?? 0}
            />
          </div>
        ))}
        {list.length === 0 && <p style={{ color: "#5b5f6b" }}>No hay eventos creados todavía.</p>}
      </div>
    </main>
  );
}
