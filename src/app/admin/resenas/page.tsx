import Link from "next/link";
import { fraunces900 as fraunces } from "@/fonts";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import { getOrgSettings } from "@/lib/settings";
import { formatDateInTz } from "@/lib/dateFormat";
import { publicEventName } from "@/lib/eventDisplayName";
import { reviewsByEdition } from "@/lib/reviews";
import ReviewModerationList, { type ModerationRow } from "@/components/reviews/ReviewModerationList";


export const dynamic = "force-dynamic";

// Reseñas, the global module (top nav, next to Páginas): every review of
// every event in one moderation queue, with an event filter. The sorteo,
// the Claude summary and the sample data stay on each event's own page
// (/admin/events/<id>/resenas), linked from here.
export default async function ReviewsModulePage({ searchParams }: { searchParams: { evento?: string } }) {
  await requirePageUser(["ADMIN", "COORDINADOR"]);
  const orgSettings = await getOrgSettings();
  const { timezone, language } = orgSettings;
  const eventFilter = (searchParams.evento ?? "").trim() || null;

  const [events, pendingByEvent, reviews, editions] = await Promise.all([
    db.event.findMany({ where: { reviews: { some: {} } }, orderBy: { startsAt: "desc" }, select: { id: true, name: true, publicName: true, startsAt: true } }),
    db.review.groupBy({ by: ["eventId"], where: { status: "PENDING" }, _count: { _all: true } }),
    db.review.findMany({
      where: eventFilter ? { eventId: eventFilter } : {},
      orderBy: { createdAt: "desc" },
      take: 300,
      include: {
        photos: { orderBy: { position: "asc" } },
        person: { select: { id: true, firstName: true, lastName: true, city: true } },
        event: { select: { id: true, name: true, publicName: true } },
        registration: { select: { scans: { where: { result: "VALID_FIRST" }, orderBy: { scannedAt: "asc" }, take: 1, select: { scannedAt: true } } } },
      },
    }),
    reviewsByEdition(),
  ]);

  const dt = (d: Date) => formatDateInTz(d, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }, timezone, language);
  const rows: ModerationRow[] = reviews.map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    instagramHandle: r.instagramHandle,
    publishConsent: r.publishConsent,
    raffleOptIn: r.raffleOptIn,
    status: r.status,
    featured: r.featured,
    createdLabel: dt(r.createdAt),
    scannedLabel: r.registration.scans[0] ? dt(r.registration.scans[0].scannedAt) : null,
    personId: r.person.id,
    personName: [r.person.firstName, r.person.lastName].filter(Boolean).join(" ") || "—",
    city: r.person.city,
    photos: r.photos.map((p) => p.url),
    isSample: r.isSample,
    eventName: publicEventName(r.event),
    eventId: r.event.id,
  }));
  const pendingTotal = pendingByEvent.reduce((n, p) => n + p._count._all, 0);
  const avg = (n: number | null) => (n == null ? "—" : n.toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
  const pct = (n: number | null) => (n == null ? "—" : `${Math.round(n * 100)} %`);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 className={fraunces.className} style={{ fontWeight: 900, fontSize: 28, margin: "0 0 4px" }}>
          Reseñas
        </h1>
        <p style={{ color: "#5b5f6b", margin: 0, maxWidth: 760 }}>
          Todas las reseñas de todos los eventos, para aprobar, destacar u ocultar. Nada se publica sin aprobar.
          {pendingTotal > 0 ? ` Hay ${pendingTotal} pendientes.` : " No hay pendientes."} El sorteo, el resumen con Claude y los datos de muestra están en la pestaña Reseñas de cada evento.
        </p>
        <p style={{ margin: "10px 0 0", fontSize: 13.5 }}>
          <Link href="/admin/resenas/textos">Textos de la página de reseña (formulario, gracias y mensajes) →</Link>
        </p>
      </div>

      {editions.length > 0 && (
        <div style={{ overflowX: "auto", border: "1px solid #e3e1dc", borderRadius: 12, background: "#fff", marginBottom: 20 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#8a8478", fontSize: 11 }}>
                <th style={{ padding: "8px 12px" }}>Evento</th>
                <th style={{ padding: "8px 12px" }}>Promedio</th>
                <th style={{ padding: "8px 12px" }}>Reseñas</th>
                <th style={{ padding: "8px 12px" }}>Respondió</th>
                <th style={{ padding: "8px 12px" }}>Pendientes</th>
                <th style={{ padding: "8px 12px" }}></th>
              </tr>
            </thead>
            <tbody>
              {editions.map((e) => {
                const pending = pendingByEvent.find((p) => p.eventId === e.eventId)?._count._all ?? 0;
                return (
                  <tr key={e.eventId} style={{ borderTop: "1px solid #f0efec", fontWeight: eventFilter === e.eventId ? 700 : 400 }}>
                    <td style={{ padding: "8px 12px" }}>
                      <Link href={`/admin/resenas?evento=${e.eventId}`}>{e.name}</Link>
                    </td>
                    <td style={{ padding: "8px 12px" }}>{avg(e.average)}</td>
                    <td style={{ padding: "8px 12px" }}>{e.count}</td>
                    <td style={{ padding: "8px 12px" }}>{pct(e.responseRate)}</td>
                    <td style={{ padding: "8px 12px", color: pending > 0 ? "#8a5a1f" : "#5b5f6b", fontWeight: pending > 0 ? 700 : 400 }}>{pending}</td>
                    <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                      <Link href={`/admin/events/${e.eventId}/resenas`}>Sorteo y resumen →</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Evento</span>
        <Link href="/admin/resenas" style={{ fontSize: 13, fontWeight: 700, padding: "6px 12px", borderRadius: 999, border: "1px solid #e3e1dc", background: eventFilter ? "#fff" : "#0b2e2c", color: eventFilter ? "#17181c" : "#fff", textDecoration: "none" }}>
          Todos
        </Link>
        {events.map((e) => (
          <Link key={e.id} href={`/admin/resenas?evento=${e.id}`} style={{ fontSize: 13, fontWeight: 700, padding: "6px 12px", borderRadius: 999, border: "1px solid #e3e1dc", background: eventFilter === e.id ? "#0b2e2c" : "#fff", color: eventFilter === e.id ? "#fff" : "#17181c", textDecoration: "none" }}>
            {publicEventName(e)}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p style={{ color: "#5b5f6b", fontSize: 14 }}>
          Todavía no hay reseñas. Para ver cómo quedan, entra a un evento → Reseñas → "Crear 12 reseñas de muestra".
        </p>
      ) : (
        <ReviewModerationList rows={rows} />
      )}
    </div>
  );
}
