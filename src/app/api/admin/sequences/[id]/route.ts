import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { saveSequence, sequenceProblem, sequenceSchema } from "@/lib/sequences/save";

export const dynamic = "force-dynamic";

// A sequence's name, segment, event and steps, saved as the editor has them
// (2026-10-30). On or off stays as it was.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;
  if (!(await db.sequence.findUnique({ where: { id: params.id }, select: { id: true } }))) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const parsed = sequenceSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", message: parsed.error.issues[0]?.message ?? "Revisa los datos." }, { status: 400 });
  const problem = await sequenceProblem(parsed.data);
  if (problem) return NextResponse.json({ error: "invalid", message: problem }, { status: 400 });
  await saveSequence(params.id, parsed.data);
  return NextResponse.json({ ok: true, id: params.id });
}
