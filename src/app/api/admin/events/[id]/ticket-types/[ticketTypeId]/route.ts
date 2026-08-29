import { NextRequest, NextResponse } from "next/server";
import { updateTicketType, deleteTicketType, ticketTypeBodySchema } from "@/lib/ticketTypes";
import { requireUser } from "@/lib/auth/guard";

export async function PATCH(req: NextRequest, { params }: { params: { ticketTypeId: string } }) {
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
  try {
    const ticketType = await updateTicketType(params.ticketTypeId, {
      ...data,
      hideUntil: data.hideUntil ? new Date(data.hideUntil) : null,
      hideAfter: data.hideAfter ? new Date(data.hideAfter) : null,
    });
    return NextResponse.json({ ok: true, ticketType });
  } catch (err) {
    console.error("update ticket type failed", err);
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { ticketTypeId: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  try {
    await deleteTicketType(params.ticketTypeId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("delete ticket type failed", err);
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
