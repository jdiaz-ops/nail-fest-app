import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { PASSWORD_FROM } from "@/lib/community/consultorio";
import { createMemberSession, findMemberLink, setMemberCookie } from "@/lib/community/auth";

const bodySchema = z.object({ token: z.string().min(1).max(100), password: z.string().min(PASSWORD_FROM).max(200) });

const EXPIRED = "Este enlace ya se usó o venció. Pídele al equipo uno nuevo.";

// A link the team sent her (/cuenta/clave/<token>): a new password. It
// works once; every device she had open logs out, and she's in.
export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", fields: ["password"], message: "La contraseña necesita al menos 8 caracteres." }, { status: 400 });
  const link = await findMemberLink(parsed.data.token);
  if (!link) return NextResponse.json({ error: "expired", message: EXPIRED }, { status: 410 });

  const passwordHash = await hashPassword(parsed.data.password);
  const now = new Date();
  const done = await db.$transaction(async (tx) => {
    const { count } = await tx.communityAccessLink.updateMany({ where: { id: link.id, usedAt: null }, data: { usedAt: now } });
    if (count === 0) return false;
    await tx.communitySession.deleteMany({ where: { memberId: link.memberId } });
    await tx.communityMember.update({ where: { id: link.memberId }, data: { passwordHash, failedLogins: 0, lockedUntil: null, resetRequestedAt: null } });
    return true;
  });
  if (!done) return NextResponse.json({ error: "expired", message: EXPIRED }, { status: 410 });
  const token = await createMemberSession(link.memberId);
  return setMemberCookie(NextResponse.json({ ok: true }), token);
}
