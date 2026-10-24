import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { QUESTIONS_PER_DAY, firstIssue, questionSchema } from "@/lib/community/consultorio";
import { authorColumns } from "@/lib/community/auth";
import { postsSince, uniqueQuestionSlug } from "@/lib/community/data";
import { consultorioPoster, isOwnConsultorioPhoto } from "@/lib/community/gate";

const MESSAGES: Record<string, string> = {
  topic: "Elige de qué trata.",
  title: "Escribe tu pregunta (al menos 10 letras).",
  body: "Los detalles van hasta 2.000 caracteres.",
  photoUrl: "Vuelve a subir la foto.",
};

// "Haz tu pregunta" (/consultorio/preguntar).
export async function POST(req: NextRequest) {
  const gate = await consultorioPoster();
  if ("response" in gate) return gate.response;
  const { identity } = gate;

  const parsed = questionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const { field, message } = firstIssue(parsed.error, MESSAGES);
    return NextResponse.json({ error: "invalid_body", fields: [field], message }, { status: 400 });
  }
  const input = parsed.data;
  if (input.photoUrl && !isOwnConsultorioPhoto(input.photoUrl, identity)) {
    return NextResponse.json({ error: "invalid_body", fields: ["photoUrl"], message: MESSAGES.photoUrl }, { status: 400 });
  }
  if (identity.kind !== "TEAM") {
    const today = await postsSince(identity, new Date(Date.now() - 86_400_000));
    if (today.questions >= QUESTIONS_PER_DAY) {
      return NextResponse.json({ error: "too_many", message: `Ya hiciste ${QUESTIONS_PER_DAY} preguntas hoy. Mañana puedes hacer más.` }, { status: 429 });
    }
  }
  const question = await db.consultorioQuestion.create({
    data: { ...authorColumns(identity), slug: await uniqueQuestionSlug(input.title), topic: input.topic, title: input.title, body: input.body, photoUrl: input.photoUrl ?? null },
  });
  return NextResponse.json({ ok: true, slug: question.slug });
}
