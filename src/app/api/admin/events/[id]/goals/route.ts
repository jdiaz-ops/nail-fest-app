import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";

// The report page's own "Meta" form (GoalsForm.tsx) — the decision
// targets on Event (see its schema comment). Its own small route, apart
// from the full event PATCH, so saving a goal never has to re-send the
// whole event.

const bodySchema = z.object({
  goalRegistrations: z.number().int().positive().nullable(),
  goalAttendance: z.number().int().positive().nullable(),
  referenceEventId: z.string().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  const { goalRegistrations, goalAttendance, referenceEventId } = parsed.data;
  if (referenceEventId) {
    const ref = await db.event.findUnique({ where: { id: referenceEventId }, select: { id: true } });
    if (!ref || ref.id === params.id) return NextResponse.json({ error: "invalid_reference" }, { status: 400 });
  }
  const event = await db.event.update({
    where: { id: params.id },
    data: { goalRegistrations, goalAttendance, referenceEventId: referenceEventId || null },
    select: { id: true, goalRegistrations: true, goalAttendance: true, referenceEventId: true },
  });
  return NextResponse.json({ ok: true, event });
}
