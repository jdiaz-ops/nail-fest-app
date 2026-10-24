import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { recountAnswers } from "@/lib/community/data";

const bodySchema = z.object({ kind: z.enum(["question", "answer"]), id: z.string().min(1).max(60), hidden: z.boolean() });

// The team hides a question or an answer from the Consultorio (or shows it
// again) — nothing is deleted. A hidden answer stops being «La que me
// resolvió» and stops counting.
export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN", "COORDINADOR"]);
  if ("response" in auth) return auth.response;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { kind, id, hidden } = parsed.data;

  if (kind === "question") {
    const updated = await db.consultorioQuestion.updateMany({ where: { id }, data: { hidden } });
    if (updated.count === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }
  const answer = await db.consultorioAnswer.findUnique({ where: { id }, select: { questionId: true } });
  if (!answer) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await db.consultorioAnswer.update({ where: { id }, data: { hidden } });
  if (hidden) await db.consultorioQuestion.updateMany({ where: { id: answer.questionId, bestAnswerId: id }, data: { bestAnswerId: null } });
  await recountAnswers([answer.questionId]);
  return NextResponse.json({ ok: true });
}
