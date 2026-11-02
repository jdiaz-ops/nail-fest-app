import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { saveVersion, versionSchema } from "@/lib/imparables/versionsSave";

export const dynamic = "force-dynamic";

// A version of the event's page, saved as the editor has it (2026-10-30) —
// pausing it included («Activa»).
export async function PUT(req: NextRequest, { params }: { params: { id: string; versionId: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;
  const version = await db.landingVersion.findUnique({ where: { id: params.versionId }, select: { eventId: true } });
  if (!version || version.eventId !== params.id) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const parsed = versionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", message: parsed.error.issues[0]?.message ?? "Revisa los datos." }, { status: 400 });
  const saved = await saveVersion(params.id, params.versionId, parsed.data);
  if ("problem" in saved) return NextResponse.json({ error: "invalid", message: saved.problem }, { status: 400 });
  return NextResponse.json({ ok: true, id: saved.id });
}

// Deleted from its editor's «Borrar versión» (2026-11-02, the team). Its link stops working (/v/<slug> no longer finds
// an event: 404). What came in through it stays — registrations, payments, visits — without it (onDelete: SetNull):
// on the versions' page they count toward the main page's.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string; versionId: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;
  const version = await db.landingVersion.findUnique({ where: { id: params.versionId }, select: { eventId: true } });
  if (!version || version.eventId !== params.id) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await db.landingVersion.delete({ where: { id: params.versionId } });
  return NextResponse.json({ ok: true });
}
