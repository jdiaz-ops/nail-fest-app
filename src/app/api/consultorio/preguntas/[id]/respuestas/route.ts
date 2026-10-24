import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ANSWERS_PER_DAY, answerSchema, firstIssue } from "@/lib/community/consultorio";
import { authorColumns } from "@/lib/community/auth";
import { postsSince, visibleQuestion } from "@/lib/community/data";
import { consultorioPoster } from "@/lib/community/gate";

// An answer to a question (/consultorio/<pregunta>): it goes up right away,
// and the question goes back to the top of «Recientes».
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const gate = await consultorioPoster();
  if ("response" in gate) return gate.response;
  const { identity } = gate;

  const parsed = answerSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const { field, message } = firstIssue(parsed.error, { body: "Escribe tu respuesta (hasta 2.000 caracteres)." });
    return NextResponse.json({ error: "invalid_body", fields: [field], message }, { status: 400 });
  }
  const question = await db.consultorioQuestion.findFirst({ where: { id: params.id, ...visibleQuestion }, select: { id: true } });
  if (!question) return NextResponse.json({ error: "not_found", message: "Esta pregunta ya no está en el Consultorio." }, { status: 404 });
  if (identity.kind !== "TEAM") {
    const today = await postsSince(identity, new Date(Date.now() - 86_400_000));
    if (today.answers >= ANSWERS_PER_DAY) {
      return NextResponse.json({ error: "too_many", message: "Ya respondiste mucho hoy. Mañana puedes seguir." }, { status: 429 });
    }
  }
  const now = new Date();
  const [answer] = await db.$transaction([
    db.consultorioAnswer.create({ data: { ...authorColumns(identity), questionId: question.id, body: parsed.data.body, createdAt: now } }),
    db.consultorioQuestion.update({ where: { id: question.id }, data: { answerCount: { increment: 1 }, lastActivityAt: now } }),
  ]);
  return NextResponse.json({ ok: true, id: answer.id });
}
