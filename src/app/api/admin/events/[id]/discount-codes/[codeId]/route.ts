import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";

const bodySchema = z.object({ active: z.boolean() });

// Turns one of this event's discount codes off (or back on) — a code is
// never deleted, so the payments that used it keep saying which one.
export async function PATCH(req: NextRequest, { params }: { params: { id: string; codeId: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const { count } = await db.discountCode.updateMany({ where: { id: params.codeId, eventId: params.id }, data: { active: parsed.data.active } });
  if (count === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
