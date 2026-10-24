import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { INSTRUCTOR_SPECIALTIES, profileSchema } from "@/lib/library/portal";
import { isOwnPhotoUrl, requirePortalUser } from "@/lib/library/portalAuth";

const MESSAGES: Record<string, string> = {
  name: "Escribe tu nombre (al menos 2 letras).",
  city: "Escribe tu ciudad.",
  bio: "«Sobre ti» va hasta 300 caracteres.",
  specialties: "Elige hasta 5 especialidades.",
  instagram: "Revisa tu Instagram: tu usuario o el enlace de tu perfil.",
  tiktok: "Revisa tu TikTok: tu usuario o el enlace de tu perfil.",
  youtube: "Revisa tu canal de YouTube: el enlace o tu @usuario.",
  whatsapp: "Revisa el WhatsApp: escríbelo con el indicativo si no es de Colombia.",
  photoUrl: "Vuelve a subir tu foto.",
};

// Her profile from the portal — the onboarding's steps and "Mi perfil",
// one field or all of them. Only what's hers to change: the seal,
// "Destacada", "Ha estado en" and the approval stay with the team. After
// the approval her changes show as she saves them.
export async function PATCH(req: NextRequest) {
  const auth = await requirePortalUser();
  if ("response" in auth) return auth.response;
  const { instructor } = auth.user;

  const parsed = profileSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    return NextResponse.json({ error: "invalid_body", fields: [field], message: MESSAGES[field] ?? "Revisa los datos." }, { status: 400 });
  }
  const data = parsed.data;

  // Her photo: one she uploaded herself, the one she had, or none.
  if (data.photoUrl && data.photoUrl !== instructor.photoUrl && !isOwnPhotoUrl(data.photoUrl, instructor.id)) {
    return NextResponse.json({ error: "invalid_body", fields: ["photoUrl"], message: MESSAGES.photoUrl }, { status: 400 });
  }
  // The list's specialties, plus any the team had given her.
  if (data.specialties?.some((s) => !(INSTRUCTOR_SPECIALTIES as readonly string[]).includes(s) && !instructor.specialties.includes(s))) {
    return NextResponse.json({ error: "invalid_body", fields: ["specialties"], message: MESSAGES.specialties }, { status: 400 });
  }

  await db.instructor.update({ where: { id: instructor.id }, data });
  return NextResponse.json({ ok: true });
}
