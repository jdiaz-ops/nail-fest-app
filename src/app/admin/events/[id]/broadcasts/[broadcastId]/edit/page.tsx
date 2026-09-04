import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import EventBroadcastComposer from "../../../../EventBroadcastComposer";

export const dynamic = "force-dynamic";

// "Editar" from the broadcasts list (see that page's own comment — the
// link only ever shows for a QUEUED row). Still re-checks status here
// too: a stale tab, or landing on this URL right as the daily send-due
// cron fires, could otherwise open an editor for a broadcast that's no
// longer QUEUED. Shows a plain message instead of silently redirecting,
// so it's clear WHY editing isn't available, not just that the page
// bounced — the real, atomic guard is still [broadcastId]/route.ts's
// PATCH (this is just the friendlier front door).
export default async function EditEventBroadcastPage({
  params,
}: {
  params: { id: string; broadcastId: string };
}) {
  await requirePageUser(["ADMIN"]);
  const event = await db.event.findUnique({ where: { id: params.id } });
  if (!event) notFound();

  // eventId-scoped, not just id — same reasoning as the "Duplicar" fetch
  // in new/page.tsx: a broadcast id from a different event should never
  // be reachable by editing the URL.
  const broadcast = await db.emailBroadcast.findFirst({ where: { id: params.broadcastId, eventId: params.id } });
  if (!broadcast) notFound();

  if (broadcast.status !== "QUEUED") {
    return (
      <div>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Editar correo</h2>
        <p style={{ fontSize: 14, color: "#5b5f6b" }}>
          Este correo ya no se puede editar — solo los correos programados que aún no se han enviado admiten cambios.
        </p>
        <Link href={`/admin/events/${event.id}/broadcasts`} style={{ fontSize: 13 }}>
          ← Volver a correos del evento
        </Link>
      </div>
    );
  }

  const [ticketTypes, allBuyersCount] = await Promise.all([
    db.ticketType.findMany({ where: { eventId: params.id }, orderBy: { order: "asc" } }),
    db.registration.count({ where: { eventId: params.id, status: "CONFIRMED" } }),
  ]);
  const ticketTypeCounts = await Promise.all(
    ticketTypes.map(async (t) => ({
      id: t.id,
      name: t.name,
      count: await db.registration.count({ where: { eventId: params.id, status: "CONFIRMED", ticketTypeId: t.id } }),
    }))
  );

  return (
    <div>
      <h2 style={{ fontSize: 18, marginBottom: 16 }}>Editar correo</h2>
      <EventBroadcastComposer
        eventId={params.id}
        ticketTypes={ticketTypeCounts}
        allBuyersCount={allBuyersCount}
        editing={{
          id: broadcast.id,
          ticketTypeId: broadcast.ticketTypeId,
          subject: broadcast.subject,
          bodyHtml: broadcast.bodyHtml ?? "",
          attachTicketPdf: broadcast.attachTicketPdf,
          scheduleKind: broadcast.scheduleKind,
          scheduledAt: broadcast.scheduledAt ? broadcast.scheduledAt.toISOString() : null,
          scheduleOffsetMinutes: broadcast.scheduleOffsetMinutes,
        }}
      />
    </div>
  );
}
