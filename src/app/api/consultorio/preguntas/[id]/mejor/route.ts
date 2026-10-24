import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { wrote } from "@/lib/community/auth";
import { visibleAnswer } from "@/lib/community/data";
import { consultorioPoster } from "@/lib/community/gate";

const bodySchema = z.object({ answerId: z.string().min(1).max(60).nullable() });

// «La que me resolvió»: whoever asked (or the team) marks the answer that
// solved it — or takes the mark back with null.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const gate = await consultorioPoster();
  if ("response" in gate) return gate.response;
  const { identity } = gate;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const question = await db.consultorioQuestion.findUnique({ where: { id: params.id } });
  if (!question) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (identity.kind !== "TEAM" && !wrote(identity, question)) {
    return NextResponse.json({ error: "forbidden", message: "Solo quien preguntó puede marcarla." }, { status: 403 });
  }
  const { answerId } = parsed.data;
  if (answerId && !(await db.consultorioAnswer.findFirst({ where: { id: answerId, questionId: question.id, ...visibleAnswer }, select: { id: true } }))) {
    return NextResponse.json({ error: "not_found", message: "Esa respuesta ya no está." }, { status: 404 });
  }
  await db.consultorioQuestion.update({ where: { id: question.id }, data: { bestAnswerId: answerId } });
  return NextResponse.json({ ok: true });
}
