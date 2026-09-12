import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";

// Marks/unmarks one template as THE pre-event attendance poll (see
// WhatsAppTemplate.isAttendancePoll's own schema comment) — a plain admin
// toggle, never touched by syncTemplates()'s own upsert, so re-syncing
// with Meta never silently clears it.
const bodySchema = z.object({ isAttendancePoll: z.boolean() });

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const template = await db.whatsAppTemplate.update({
    where: { id: params.id },
    data: { isAttendancePoll: parsed.data.isAttendancePoll },
  });
  return NextResponse.json({ ok: true, template });
}
