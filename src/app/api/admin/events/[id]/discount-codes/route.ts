import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { getOrgSettings } from "@/lib/settings";
import { zonedTimeToUtc } from "@/lib/dateFormat";
import { normalizeCode } from "@/lib/discounts";

const bodySchema = z.object({
  code: z.string().min(1).max(40),
  kind: z.enum(["percent", "amount"]),
  // A percentage (1–95) or whole COP (from $1.000).
  value: z.number().int().positive(),
  ticketTypeId: z.string().min(1).nullable().optional(),
  maxUses: z.number().int().positive().nullable().optional(),
  // "2027-03-31": valid through the end of that day, in the org's own time zone.
  expiresOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  note: z.string().trim().max(120).nullable().optional(),
});

// A new discount code for this event's checkout — /admin/events/[id]/descuentos
// (DiscountCodesEditor.tsx). See the DiscountCode model and lib/discounts.ts.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  const input = parsed.data;

  const code = normalizeCode(input.code);
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  if (input.kind === "percent" && input.value > 95) return NextResponse.json({ error: "percent_too_big" }, { status: 400 });
  if (input.kind === "amount" && input.value < 1000) return NextResponse.json({ error: "amount_too_small" }, { status: 400 });

  const event = await db.event.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!event) return NextResponse.json({ error: "event_not_found" }, { status: 404 });
  if (input.ticketTypeId) {
    const ticketType = await db.ticketType.findUnique({ where: { id: input.ticketTypeId }, select: { eventId: true } });
    if (ticketType?.eventId !== event.id) return NextResponse.json({ error: "invalid_ticket_type" }, { status: 400 });
  }
  if (await db.discountCode.findUnique({ where: { eventId_code: { eventId: event.id, code } }, select: { id: true } })) {
    return NextResponse.json({ error: "code_taken" }, { status: 409 });
  }

  const { timezone } = await getOrgSettings();
  const discountCode = await db.discountCode.create({
    data: {
      eventId: event.id,
      code,
      percentOff: input.kind === "percent" ? input.value : null,
      amountOffCop: input.kind === "amount" ? input.value : null,
      ticketTypeId: input.ticketTypeId ?? null,
      maxUses: input.maxUses ?? null,
      expiresAt: input.expiresOn ? zonedTimeToUtc(`${input.expiresOn}T23:59:59`, timezone) : null,
      note: input.note || null,
    },
  });
  return NextResponse.json({ ok: true, discountCode });
}
