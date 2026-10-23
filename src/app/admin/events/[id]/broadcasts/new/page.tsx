import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import { eventBroadcastAudienceCounts } from "@/lib/broadcastRecipients";
import EventBroadcastComposer from "../../../EventBroadcastComposer";

export const dynamic = "force-dynamic";

// ADMIN-only — see EventModuleShell's own comment.
export default async function NewEventBroadcastPage({
  params,
  searchParams,
}: {
  params: { id: string };
  // ?duplicate=<broadcastId> — set by the "Duplicar" action on the
  // broadcasts list (see that page's own comment). Same route/page as a
  // plain "new" correo, just pre-filled — nothing else about creation
  // changes, so this stays the one place a broadcast gets created.
  searchParams: { duplicate?: string };
}) {
  await requirePageUser(["ADMIN"]);
  const event = await db.event.findUnique({ where: { id: params.id } });
  if (!event) notFound();

  const [ticketTypes, counts, source] = await Promise.all([
    db.ticketType.findMany({ where: { eventId: params.id }, orderBy: { order: "asc" } }),
    eventBroadcastAudienceCounts(params.id),
    searchParams.duplicate
      ? // Scoped to eventId too, not just id — a duplicate link should
        // never let someone pull in another event's broadcast content by
        // editing the query string.
        db.emailBroadcast.findFirst({ where: { id: searchParams.duplicate, eventId: params.id } })
      : null,
  ]);

  const ticketTypeCounts = ticketTypes.map((t) => ({ id: t.id, name: t.name, ...(counts.byTicketType.get(t.id) ?? { count: 0, checkedIn: 0 }) }));

  return (
    <div>
      <h2 style={{ fontSize: 18, marginBottom: 16 }}>{source ? "Duplicar correo" : "Nuevo correo"}</h2>
      <EventBroadcastComposer
        eventId={params.id}
        eventFormat={event.format}
        ticketTypes={ticketTypeCounts}
        allBuyers={counts.all}
        initial={
          source
            ? {
                ticketTypeId: source.ticketTypeId,
                subject: source.subject,
                bodyHtml: source.bodyHtml ?? "",
                attachTicketPdf: source.attachTicketPdf,
                onlyCheckedIn: source.onlyCheckedIn,
                onlyNotCheckedIn: source.onlyNotCheckedIn,
              }
            : undefined
        }
      />
    </div>
  );
}
