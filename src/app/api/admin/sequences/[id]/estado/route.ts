import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { setAsideCurrentMembers } from "@/lib/sequences/engine";
import type { SegmentFilter } from "@/lib/segments/builder";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ enabled: z.boolean(), includeExisting: z.boolean().optional() });

// Turning a sequence on or off (2026-10-30). On: whoever is already in its
// segment is set aside — never sent anything — unless the team chose to
// include them; from then on, whoever enters gets it (lib/sequences/engine.ts).
// Off: nothing goes out; whoever was on her way through it stays where she
// was, for when it's turned on again.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const sequence = await db.sequence.findUnique({ where: { id: params.id }, include: { segment: true, _count: { select: { steps: true } } } });
  if (!sequence) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (!parsed.data.enabled) {
    await db.sequence.update({ where: { id: sequence.id }, data: { enabled: false } });
    return NextResponse.json({ ok: true, enabled: false });
  }
  if (sequence._count.steps === 0) return NextResponse.json({ error: "no_steps", message: "Agrega al menos un paso antes de encenderla." }, { status: 400 });
  const setAside = parsed.data.includeExisting ? 0 : await setAsideCurrentMembers(sequence.id, sequence.segment.filter as unknown as SegmentFilter);
  await db.sequence.update({ where: { id: sequence.id }, data: { enabled: true, enabledAt: new Date() } });
  return NextResponse.json({ ok: true, enabled: true, setAside });
}
