import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { saveSequence, sequenceProblem, sequenceSchema } from "@/lib/sequences/save";

export const dynamic = "force-dynamic";

// A new sequence (CRM → Secuencias, 2026-10-30) — saved off: turning it on is
// /api/admin/sequences/[id]/estado.
export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;
  const parsed = sequenceSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", message: parsed.error.issues[0]?.message ?? "Revisa los datos." }, { status: 400 });
  const problem = await sequenceProblem(parsed.data);
  if (problem) return NextResponse.json({ error: "invalid", message: problem }, { status: 400 });
  const id = await saveSequence(null, parsed.data);
  return NextResponse.json({ ok: true, id });
}
