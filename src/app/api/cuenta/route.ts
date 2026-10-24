import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { firstIssue, memberUpdateSchema } from "@/lib/community/consultorio";
import { getMember, signInFirst } from "@/lib/community/auth";

const MESSAGES: Record<string, string> = {
  name: "Escribe tu nombre (al menos 2 letras).",
  city: "Escribe tu ciudad.",
  email: "Revisa tu correo.",
  newPassword: "La nueva contraseña necesita al menos 8 caracteres.",
};

// "Mi cuenta": her name and city (they go with what she posts), her email
// and her password — the last two ask for the current password first.
export async function PATCH(req: NextRequest) {
  const member = await getMember();
  if (!member) return signInFirst();
  const parsed = memberUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const { field, message } = firstIssue(parsed.error, MESSAGES);
    return NextResponse.json({ error: "invalid_body", fields: [field], message }, { status: 400 });
  }
  const input = parsed.data;
  const data: Prisma.CommunityMemberUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.city !== undefined) data.city = input.city;
  const changingEmail = input.email !== undefined && input.email !== member.email;
  if (changingEmail || input.newPassword) {
    if (!input.currentPassword || !(await verifyPassword(input.currentPassword, member.passwordHash))) {
      return NextResponse.json({ error: "wrong_password", fields: ["currentPassword"], message: "Tu contraseña actual no coincide." }, { status: 400 });
    }
    if (changingEmail) data.email = input.email;
    if (input.newPassword) data.passwordHash = await hashPassword(input.newPassword);
  }
  try {
    await db.communityMember.update({ where: { id: member.id }, data });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "email_taken", fields: ["email"], message: "Ya hay una cuenta con ese correo." }, { status: 409 });
    }
    throw err;
  }
  return NextResponse.json({ ok: true });
}
