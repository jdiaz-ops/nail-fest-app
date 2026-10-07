import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import { getEmailBroadcastFailureBreakdown } from "@/lib/broadcasts";
import FailureBreakdown from "@/components/FailureBreakdown";

export const dynamic = "force-dynamic";

// Email twin of /admin/crm/whatsapp/difusiones/[id]/fallidos — refused
// sends, bounces and complaints for one event correo, grouped by what to
// do about them (lib/email/failureCategories.ts).
export default async function EventBroadcastFailuresPage({ params }: { params: { id: string; broadcastId: string } }) {
  await requirePageUser(["ADMIN"]);
  const broadcast = await db.emailBroadcast.findFirst({ where: { id: params.broadcastId, eventId: params.id } });
  if (!broadcast) notFound();
  const groups = await getEmailBroadcastFailureBreakdown(broadcast.id);
  return (
    <FailureBreakdown
      title={`Fallidos · ${broadcast.subject}`}
      subtitle='Incluye los que fallaron antes de salir, los rebotes y las quejas de spam. Solo los grupos marcados "Se reintenta" entran en el reintento.'
      groups={groups.map((g) => ({
        key: g.category,
        label: g.label,
        action: g.action,
        retryable: g.retryable,
        people: g.people.map((p) => ({ name: p.name, contact: p.email, detail: p.detail, status: p.status })),
      }))}
      csvUrl={`/api/admin/events/${params.id}/broadcasts/${broadcast.id}/failed-csv`}
      retryUrl={`/api/admin/events/${params.id}/broadcasts/${broadcast.id}/retry`}
      channel="email"
      backHref={`/admin/events/${params.id}/broadcasts`}
      backLabel="Volver a correos del evento"
    />
  );
}
