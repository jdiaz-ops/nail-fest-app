import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import { getBroadcastFailureBreakdown } from "@/lib/whatsapp/broadcasts";
import FailureBreakdown from "@/components/FailureBreakdown";

export const dynamic = "force-dynamic";

// "Fallidos" from the Difusiones history — who didn't get this difusión
// and, per Meta's own reason, what to do about each group. See
// lib/whatsapp/failureCategories.ts.
export default async function WhatsAppBroadcastFailuresPage({ params }: { params: { id: string } }) {
  await requirePageUser(["ADMIN"]);
  const broadcast = await db.whatsAppBroadcast.findUnique({ where: { id: params.id }, include: { template: true, segment: true, event: true } });
  if (!broadcast) notFound();
  const groups = await getBroadcastFailureBreakdown(broadcast.id);
  return (
    <FailureBreakdown
      title={`Fallidos · ${broadcast.template.name}`}
      subtitle={`${broadcast.segment?.name ?? broadcast.event?.name ?? "Difusión"} — cada grupo es un motivo distinto con su propia acción. Solo los grupos marcados "Se reintenta" entran en el reintento.`}
      groups={groups.map((g) => ({
        key: g.category,
        label: g.label,
        action: g.action,
        retryable: g.retryable,
        people: g.people.map((p) => ({ name: p.name, contact: p.phone, detail: p.detail })),
      }))}
      csvUrl={`/api/admin/whatsapp/broadcasts/${broadcast.id}/failed-csv`}
      retryUrl={`/api/admin/whatsapp/broadcasts/${broadcast.id}/retry`}
      channel="whatsapp"
      backHref="/admin/crm/whatsapp/difusiones"
      backLabel="Volver a difusiones"
    />
  );
}
