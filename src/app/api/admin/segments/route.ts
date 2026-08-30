import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { filterSchema } from "@/lib/segments/schema";
import { syncSegmentAudience } from "@/lib/meta/audiences";
import { requireUser } from "@/lib/auth/guard";

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
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

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

// Editing an already-created (and possibly already Meta-synced) segment —
// SegmentComposer.tsx's edit mode. Re-syncs immediately on save, same
// reasoning as the first sync on create: the whole point of editing is
// that the audience's real membership should reflect the new criteria
// right away, not after up to a day's wait for the cron. Renaming is
// safe — see ensureCustomerListAudience's own comment on why this reuses
// the audience id already on file instead of a name-based lookup.
const patchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  filter: filterSchema,
});

export async function PATCH(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const { id, name, filter } = parsed.data;

  try {
    await db.segmentDefinition.update({ where: { id }, data: { name, filter } });
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // A segment created before Meta sync existed, or one whose first sync
  // never ran, might have no SegmentMetaSync row yet — create it now
  // rather than erroring, same as if it were a brand-new segment.
  await db.segmentMetaSync.upsert({
    where: { segmentId: id },
    create: { segmentId: id },
    update: {},
  });

  const resync = await syncSegmentAudience(id).catch((err) => ({
    status: "ERROR" as const,
    error: err instanceof Error ? err.message : String(err),
  }));

  return NextResponse.json({ ok: true, segmentId: id, resync });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  // SegmentMetaSync cascades via the FK on delete? No — schema uses
  // onDelete: RESTRICT (Prisma default), so remove the link first.
  await db.segmentMetaSync.deleteMany({ where: { segmentId: id } });
  await db.segmentDefinition.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
