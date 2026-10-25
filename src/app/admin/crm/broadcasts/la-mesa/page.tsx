import { requirePageUser } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { getMesaAdminData } from "@/lib/mesa/data";
import { countSegment, type SegmentFilter } from "@/lib/segments/builder";
import { getOrgSettings } from "@/lib/settings";
import BroadcastTabs from "../BroadcastTabs";
import MesaAdmin from "./MesaAdmin";

export const dynamic = "force-dynamic";

// CRM → Broadcasts → La Mesa (2026-10-25): the newsletter's bank, its next
// editions and their sends, in the same place as the rest of the emails
// (./MesaAdmin.tsx). ADMIN-only, like Broadcasts.
export default async function BroadcastsMesaPage() {
  await requirePageUser(["ADMIN"]);
  const [data, segmentRows, lastSend, org] = await Promise.all([
    getMesaAdminData(),
    db.segmentDefinition.findMany({ orderBy: { createdAt: "desc" } }),
    db.emailBroadcast.findFirst({ where: { mesaEdition: { not: null }, status: { not: "CANCELLED" } }, orderBy: { createdAt: "desc" }, select: { segmentId: true } }),
    getOrgSettings(),
  ]);
  // Live member counts, as on Broadcasts' own composer.
  const segments = await Promise.all(segmentRows.map(async (s) => ({ id: s.id, name: s.name, memberCount: await countSegment(s.filter as unknown as SegmentFilter) })));
  return (
    <div>
      <BroadcastTabs />
      <MesaAdmin data={data} segments={segments} defaultSegmentId={lastSend?.segmentId ?? null} testEmail={org.replyToEmail ?? ""} />
    </div>
  );
}
