import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import EventBroadcastComposer from "../../../EventBroadcastComposer";

export const dynamic = "force-dynamic";

export default async function NewEventBroadcastPage({ params }: { params: { id: string } }) {
  const event = await db.event.findUnique({ where: { id: params.id } });
  if (!event) notFound();

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
      <h2 style={{ fontSize: 18, marginBottom: 16 }}>Nuevo correo</h2>
      <EventBroadcastComposer eventId={params.id} ticketTypes={ticketTypeCounts} allBuyersCount={allBuyersCount} />
    </div>
  );
}
