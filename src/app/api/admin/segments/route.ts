import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

// Protected by middleware (same Basic Auth as the rest of /admin/api).
// Creates a named, reusable segment AND links it for automatic Meta sync
// in one step — there's no separate "enable sync" toggle. The cron
// (/api/meta/sync-audiences) picks up the new SegmentMetaSync row (status
// PENDING) on its next run; no manual trigger from here.

const conditionSchema = z.union([
  z.object({ field: z.literal("event"), eventSlug: z.string() }),
  z.object({ field: z.literal("city"), city: z.string() }),
  z.object({ field: z.literal("profession"), profession: z.string() }),
]);

const bodySchema = z.object({
  name: z.string().min(1),
  filter: z.object({
    include: z.array(conditionSchema),
    exclude: z.array(conditionSchema),
  }),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const { name, filter } = parsed.data;

  const segment = await db.segmentDefinition.create({ data: { name, filter } });
  await db.segmentMetaSync.create({ data: { segmentId: segment.id } });

  return NextResponse.json({ ok: true, segmentId: segment.id });
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
