import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { filterSchema } from "@/lib/segments/schema";
import { syncSegmentAudience } from "@/lib/meta/audiences";

// Protected by middleware (same Basic Auth as the rest of /admin/api).
// Creates a named, reusable segment AND links it for automatic Meta sync
// in one step — there's no separate "enable sync" toggle. Also fires the
// FIRST sync immediately (awaited, not left for the cron) so the audience
// exists in Meta the moment you save, instead of waiting up to a day —
// the cron (/api/meta/sync-audiences) then keeps it current going forward.

const bodySchema = z.object({
  name: z.string().min(1),
  filter: filterSchema,
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const { name, filter } = parsed.data;

  const segment = await db.segmentDefinition.create({ data: { name, filter } });
  await db.segmentMetaSync.create({ data: { segmentId: segment.id } });

  // Best-effort — if this throws (e.g. Meta token not connected yet), the
  // segment still saves; it just shows PENDING/ERROR until the cron's next
  // run instead of OK immediately. Never fails the save itself.
  const firstSync = await syncSegmentAudience(segment.id).catch((err) => ({
    error: err instanceof Error ? err.message : String(err),
  }));

  return NextResponse.json({ ok: true, segmentId: segment.id, firstSync });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  // SegmentMetaSync cascades via the FK on delete? No — schema uses
  // onDelete: RESTRICT (Prisma default), so remove the link first.
  await db.segmentMetaSync.deleteMany({ where: { segmentId: id } });
  await db.segmentDefinition.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
