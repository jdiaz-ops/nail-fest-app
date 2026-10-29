import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import { getOrgSettings } from "@/lib/settings";
import { formatDateInTz, utcToZonedInputValue } from "@/lib/dateFormat";
import { loadStages } from "@/lib/imparables/pricing";
import { salesState } from "@/lib/imparables/stages";
import StagesEditor from "./StagesEditor";

export const dynamic = "force-dynamic";

// The event's price stages (2026-10-29 — see lib/imparables/stages.ts): each
// with its cap, how many paid purchases it has, how many are left, when it
// closes and where it stands — on sale, closed at its cap, closed on its
// date, or still to come. Its cap, closing date and note can be changed
// here, and every change is kept with who made it and when.
export default async function StagesPage({ params }: { params: { id: string } }) {
  await requirePageUser(["ADMIN"]);
  const [event, types, changes, orgSettings] = await Promise.all([
    db.event.findUnique({ where: { id: params.id }, select: { id: true, startsAt: true } }),
    loadStages(params.id),
    db.pricingStageChange.findMany({
      where: { ticketType: { eventId: params.id } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { ticketType: { select: { name: true } } },
    }),
    getOrgSettings(),
  ]);
  if (!event) notFound();
  const tz = orgSettings.timezone;
  const when = (date: Date) => formatDateInTz(date, { dateStyle: "medium", timeStyle: "short" }, tz, orgSettings.language);
  const sales = salesState(types, new Date(), event.startsAt);

  return (
    <StagesEditor
      eventId={event.id}
      stages={sales.stages.map((s) => ({
        id: s.id,
        name: s.name,
        price: s.price,
        cap: s.cap,
        paid: s.paid,
        closesAt: s.closesAt ? when(s.closesAt) : null,
        closesAtInput: s.closesAt ? utcToZonedInputValue(s.closesAt, tz) : "",
        note: s.note ?? "",
        state: s.state,
      }))}
      changes={changes.map((c) => ({
        id: c.id,
        at: when(c.createdAt),
        by: c.changedByName,
        stage: c.ticketType.name,
        field: c.field,
        before: c.before,
        after: c.after,
      }))}
    />
  );
}
