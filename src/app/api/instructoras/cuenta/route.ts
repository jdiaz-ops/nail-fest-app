import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { PASSWORD_FROM, phoneOf } from "@/lib/library/portal";
import { requirePortalUser } from "@/lib/library/portalAuth";

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(160).optional(),
  phone: z.string().max(40).optional(),
  currentPassword: z.string().max(200).optional(),
  newPassword: z.string().min(PASSWORD_FROM).max(200).optional(),
});

// "Cuenta" in the portal: her email, her WhatsApp and her password. The
// email and the password ask for the current password first.
export async function PATCH(req: NextRequest) {
  const auth = await requirePortalUser();
  if ("response" in auth) return auth.response;
  const { account } = auth.user;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    const message = field === "email" ? "Revisa tu correo." : field === "newPassword" ? "La nueva contraseña necesita al menos 8 caracteres." : "Revisa los datos.";
    return NextResponse.json({ error: "invalid_body", fields: [field], message }, { status: 400 });
  }
  const input = parsed.data;
  const data: Prisma.InstructorAccountUpdateInput = {};

  if (input.phone !== undefined) {
    const phone = phoneOf(input.phone);
    if (!phone) return NextResponse.json({ error: "invalid_body", fields: ["phone"], message: "Revisa tu celular: escríbelo con el indicativo si no es de Colombia." }, { status: 400 });
    data.phone = phone;
  }
  const changingEmail = input.email !== undefined && input.email !== account.email;
  if (changingEmail || input.newPassword) {
    if (!input.currentPassword || !(await verifyPassword(input.currentPassword, account.passwordHash))) {
      return NextResponse.json({ error: "wrong_password", fields: ["currentPassword"], message: "Tu contraseña actual no coincide." }, { status: 400 });
    }
    if (changingEmail) data.email = input.email;
    if (input.newPassword) data.passwordHash = await hashPassword(input.newPassword);
  }

  try {
    await db.instructorAccount.update({ where: { id: account.id }, data });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "email_taken", fields: ["email"], message: "Ya hay una cuenta con ese correo." }, { status: 409 });
    }
    throw err;
  }
  return NextResponse.json({ ok: true });
}
