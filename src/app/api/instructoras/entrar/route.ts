import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { normalizeUsername } from "@/lib/library/portal";
import { LOCK_MINUTES, createInstructorSession, isLocked, recordFailedLogin, setSessionCookie } from "@/lib/library/portalAuth";

const bodySchema = z.object({ login: z.string().trim().min(1).max(160), password: z.string().min(1).max(200) });

const WRONG = "El usuario o la contraseña no coinciden.";
const LOCKED = `Demasiados intentos. Espera ${LOCK_MINUTES} minutos o pídenos un enlace para cambiar tu contraseña.`;

// The portal's login: her username or her email, and her password. The
// same answer whether or not the account exists; enough wrong passwords
// in a row lock it for a while.
export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", message: "Escribe tu usuario o tu correo, y tu contraseña." }, { status: 400 });
  const { login, password } = parsed.data;

  const account = login.includes("@")
    ? await db.instructorAccount.findUnique({ where: { email: login.toLowerCase() } })
    : await db.instructorAccount.findFirst({ where: { instructor: { slug: normalizeUsername(login) } } });
  if (!account) return NextResponse.json({ error: "invalid_credentials", message: WRONG }, { status: 401 });
  if (isLocked(account)) return NextResponse.json({ error: "locked", message: LOCKED }, { status: 429 });

  if (!(await verifyPassword(password, account.passwordHash))) {
    const locked = await recordFailedLogin(account);
    return locked ? NextResponse.json({ error: "locked", message: LOCKED }, { status: 429 }) : NextResponse.json({ error: "invalid_credentials", message: WRONG }, { status: 401 });
  }

  // She remembered it: an earlier "olvidé mi contraseña" is moot.
  if (account.resetRequestedAt) await db.instructorAccount.update({ where: { id: account.id }, data: { resetRequestedAt: null } });
  const token = await createInstructorSession(account.id);
  return setSessionCookie(NextResponse.json({ ok: true, next: "/instructoras/portal" }), token);
}
