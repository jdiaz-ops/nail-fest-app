import { NextRequest, NextResponse } from "next/server";
import { createTicketType, ticketTypeBodySchema } from "@/lib/ticketTypes";
import { requireUser } from "@/lib/auth/guard";

// Mirrors our previous ticketing platform's own "Add a new ticket type"
// modal field for field — see TicketTypeModal.tsx and the TicketType model's own comment
// in schema.prisma.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = ticketTypeBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  if (parsed.data.minPerOrder > parsed.data.maxPerOrder) {
    return NextResponse.json({ error: "min_greater_than_max" }, { status: 400 });
  }
  const data = parsed.data;
  const hideUntil = data.hideUntil ? new Date(data.hideUntil) : null;
  const hideAfter = data.hideAfter ? new Date(data.hideAfter) : null;

  const ticketType = await createTicketType(params.id, {
    ...data,
    hideUntil,
    hideAfter,
  });
  return NextResponse.json({ ok: true, ticketType });
}
