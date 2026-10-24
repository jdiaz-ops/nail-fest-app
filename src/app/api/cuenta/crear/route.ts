import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { getLibrarySettings } from "@/lib/library/settings";
import { firstIssue, memberSignupSchema } from "@/lib/community/consultorio";
import { createMemberSession, setMemberCookie } from "@/lib/community/auth";
import { viewerCanSeeSamples } from "@/lib/reviewsViewer";

const MESSAGES: Record<string, string> = {
  name: "Escribe tu nombre (al menos 2 letras).",
  city: "Escribe tu ciudad.",
  email: "Revisa tu correo.",
  password: "La contraseña necesita al menos 8 caracteres.",
  acceptTerms: "Para crear tu cuenta, acepta las reglas del Consultorio y la política de privacidad.",
};

// "Crea tu cuenta" (/cuenta/crear): her name and city (shown with what she
// posts), her email and a password. Linked to her CRM contact when the
// email is already there. Open while the Consultorio is published — or for
// the team, to try it. Nothing is sent to her.
export async function POST(req: NextRequest) {
  const parsed = memberSignupSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const { field, message } = firstIssue(parsed.error, MESSAGES);
    return NextResponse.json({ error: "invalid_body", fields: [field], message }, { status: 400 });
  }
  const input = parsed.data;
  if (input.website) return NextResponse.json({ ok: true });

  const [settings, staff] = await Promise.all([getLibrarySettings(), viewerCanSeeSamples()]);
  if (!settings.consultorioPublished && !staff) return NextResponse.json({ error: "closed", message: "El Consultorio todavía no está abierto." }, { status: 404 });

  const person = await db.person.findUnique({ where: { email: input.email }, select: { id: true } });
  let memberId: string;
  try {
    const member = await db.communityMember.create({
      data: {
        name: input.name,
        city: input.city,
        email: input.email,
        passwordHash: await hashPassword(input.password),
        termsAcceptedAt: new Date(),
        personId: person?.id ?? null,
      },
    });
    memberId = member.id;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "email_taken", fields: ["email"], message: "Ya hay una cuenta con ese correo. Entra con él." }, { status: 409 });
    }
    throw err;
  }
  const token = await createMemberSession(memberId);
  return setMemberCookie(NextResponse.json({ ok: true }), token);
}
