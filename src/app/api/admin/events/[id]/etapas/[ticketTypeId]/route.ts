import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { getOrgSettings } from "@/lib/settings";
import { formatDateInTz, zonedTimeToUtc } from "@/lib/dateFormat";

const bodySchema = z.object({
  /** null: no cap. */
  cap: z.number().int().positive().nullable(),
  /** In the account's time zone, as a datetime-local input gives it: "2027-04-18T23:59". */
  closesAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  note: z.string().max(80),
});

// A price stage's cap, closing date and note, from «Etapas de precio»
// (/admin/events/[id]/etapas, 2026-10-29). Each field that changes is
// recorded (PricingStageChange) with who changed it and when, as the panel
// shows it. A cap raised above what's already paid opens a stage that had
// sold out again; one lowered to it or below closes it now.
export async function PATCH(req: NextRequest, { params }: { params: { id: string; ticketTypeId: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return NextResponse.json({ error: field === "cap" ? "invalid_cap" : field === "closesAt" ? "invalid_closes_at" : "invalid_body" }, { status: 400 });
  }
  const { cap, note } = parsed.data;

  const orgSettings = await getOrgSettings();
  const closesAt = zonedTimeToUtc(parsed.data.closesAt, orgSettings.timezone);
  if (Number.isNaN(closesAt.getTime())) return NextResponse.json({ error: "invalid_closes_at" }, { status: 400 });

  const type = await db.ticketType.findUnique({ where: { id: params.ticketTypeId } });
  if (!type || type.eventId !== params.id) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const paid = await db.registration.aggregate({
    where: { ticketTypeId: type.id, status: "CONFIRMED", payments: { some: { status: "APPROVED" } } },
    _sum: { ticketCount: true },
  });
  const sold = paid._sum.ticketCount ?? 0;
  const soldOutAt = cap === null || cap > sold ? null : (type.stageSoldOutAt ?? new Date());

  const when = (date: Date | null) => (date ? formatDateInTz(date, { dateStyle: "medium", timeStyle: "short" }, orgSettings.timezone, orgSettings.language) : null);
  const capText = (value: number | null) => (value === null ? "Sin cupo" : String(value));
  const changes = [
    type.stageCap !== cap && { field: "cap", before: capText(type.stageCap), after: capText(cap) },
    type.hideAfter?.getTime() !== closesAt.getTime() && { field: "closesAt", before: when(type.hideAfter), after: when(closesAt) },
    (type.stageNote ?? "") !== note.trim() && { field: "note", before: type.stageNote ?? "", after: note.trim() },
  ].filter((c): c is { field: string; before: string | null; after: string | null } => Boolean(c));

  await db.$transaction([
    db.ticketType.update({
      where: { id: type.id },
      data: { stageCap: cap, hideAfter: closesAt, stageNote: note.trim() || null, stageSoldOutAt: soldOutAt },
    }),
    ...changes.map((c) =>
      db.pricingStageChange.create({
        data: { ticketTypeId: type.id, field: c.field, before: c.before, after: c.after, changedById: user.id, changedByName: user.name?.trim() || user.username },
      })
    ),
  ]);
  return NextResponse.json({ ok: true, changed: changes.length });
}
