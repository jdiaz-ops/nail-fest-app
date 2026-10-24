import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { submissionSchema } from "@/lib/library/portal";
import { requirePortalUser } from "@/lib/library/portalAuth";

// Waiting for the team at once, at most.
const PENDING_UP_TO = 5;

const MESSAGES: Record<string, string> = {
  youtube: "Pega el enlace de tu video en YouTube.",
  title: "Ponle un título (al menos 3 letras).",
  theme: "Elige el tema.",
  level: "Elige el nivel.",
  description: "La descripción va hasta 1.000 caracteres.",
};

// "Enviar un video" (Mis videos): her own YouTube link and its ficha, for
// the team to decide on — no payment and no promise it gets published.
// Her first one carries the content permission.
export async function POST(req: NextRequest) {
  const auth = await requirePortalUser();
  if ("response" in auth) return auth.response;
  const { instructor, account } = auth.user;

  const parsed = submissionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    return NextResponse.json({ error: "invalid_body", fields: [field], message: MESSAGES[field] ?? "Revisa los datos." }, { status: 400 });
  }
  const input = parsed.data;
  if (!account.contentTermsAcceptedAt && !input.acceptContent) {
    return NextResponse.json({ error: "content_terms", fields: ["acceptContent"], message: "Para enviar tu primer video, acepta el permiso de uso de contenido." }, { status: 400 });
  }
  const pending = await db.instructorVideoSubmission.count({ where: { instructorId: instructor.id, status: "PENDING" } });
  if (pending >= PENDING_UP_TO) {
    return NextResponse.json({ error: "too_many", message: `Ya tienes ${PENDING_UP_TO} videos esperando revisión. Envía más cuando el equipo los revise.` }, { status: 429 });
  }

  await db.$transaction([
    db.instructorVideoSubmission.create({
      data: {
        instructorId: instructor.id,
        youtubeId: input.youtube,
        title: input.title,
        theme: input.theme,
        level: input.level,
        description: input.description,
        products: input.products,
        tags: input.tags,
      },
    }),
    ...(account.contentTermsAcceptedAt ? [] : [db.instructorAccount.update({ where: { id: account.id }, data: { contentTermsAcceptedAt: new Date() } })]),
  ]);
  return NextResponse.json({ ok: true });
}
