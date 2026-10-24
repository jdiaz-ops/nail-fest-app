import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { LOCK_MINUTES, createMemberSession, isLocked, recordFailedLogin, setMemberCookie } from "@/lib/community/auth";

const bodySchema = z.object({ email: z.string().trim().toLowerCase().min(1).max(160), password: z.string().min(1).max(200) });

const WRONG = "El correo o la contraseña no coinciden.";
const LOCKED = `Demasiados intentos. Espera ${LOCK_MINUTES} minutos o pídenos un enlace para cambiar tu contraseña.`;

// "Entrar" (/cuenta/entrar): her email and password. The same answer
// whether or not the account exists; enough wrong passwords in a row lock
// it for a while.
export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", message: "Escribe tu correo y tu contraseña." }, { status: 400 });
  const { email, password } = parsed.data;

  const member = await db.communityMember.findUnique({ where: { email } });
  if (!member) return NextResponse.json({ error: "invalid_credentials", message: WRONG }, { status: 401 });
  if (isLocked(member)) return NextResponse.json({ error: "locked", message: LOCKED }, { status: 429 });
  if (!(await verifyPassword(password, member.passwordHash))) {
    const locked = await recordFailedLogin(member);
    return locked ? NextResponse.json({ error: "locked", message: LOCKED }, { status: 429 }) : NextResponse.json({ error: "invalid_credentials", message: WRONG }, { status: 401 });
  }
  if (member.resetRequestedAt) await db.communityMember.update({ where: { id: member.id }, data: { resetRequestedAt: null } });
  const token = await createMemberSession(member.id);
  return setMemberCookie(NextResponse.json({ ok: true }), token);
}
