import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import { getOrgSettings } from "@/lib/settings";
import { formatDateInTz } from "@/lib/dateFormat";
import { discountLabel } from "@/lib/discounts";
import DiscountCodesEditor from "./DiscountCodesEditor";

export const dynamic = "force-dynamic";

// This event's discount codes (2026-10-29) — typed at its one-page checkout
// (/[eventSlug]/checkout). Each with how many paid purchases used it and
// what it took off them; a code is turned off, never deleted. See the
// DiscountCode model and lib/discounts.ts.
export default async function DiscountCodesPage({ params }: { params: { id: string } }) {
  await requirePageUser(["ADMIN"]);
  const [codes, ticketTypes, used, orgSettings] = await Promise.all([
    db.discountCode.findMany({ where: { eventId: params.id }, orderBy: { createdAt: "desc" }, include: { ticketType: { select: { name: true } } } }),
    db.ticketType.findMany({ where: { eventId: params.id, price: { gt: 0 } }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
    db.payment.groupBy({
      by: ["discountCodeId"],
      where: { discountCode: { eventId: params.id }, status: "APPROVED" },
      _count: { _all: true },
      _sum: { discountCents: true },
    }),
    getOrgSettings(),
  ]);
  const usedBy = new Map(used.map((row) => [row.discountCodeId, row]));

  return (
    <DiscountCodesEditor
      eventId={params.id}
      ticketTypes={ticketTypes}
      codes={codes.map((c) => ({
        id: c.id,
        code: c.code,
        label: discountLabel(c),
        ticketTypeName: c.ticketType?.name ?? null,
        maxUses: c.maxUses,
        uses: usedBy.get(c.id)?._count._all ?? 0,
        discountedCents: usedBy.get(c.id)?._sum.discountCents ?? 0,
        expires: c.expiresAt ? formatDateInTz(c.expiresAt, { dateStyle: "medium" }, orgSettings.timezone, orgSettings.language) : null,
        expired: Boolean(c.expiresAt && c.expiresAt < new Date()),
        active: c.active,
        note: c.note,
      }))}
    />
  );
}
