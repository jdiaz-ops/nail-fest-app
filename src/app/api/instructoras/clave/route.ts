import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { PASSWORD_FROM, phoneOf } from "@/lib/library/portal";
import { createInstructorSession, findAccessLink, setSessionCookie } from "@/lib/library/portalAuth";

const bodySchema = z.object({
  token: z.string().min(1).max(100),
  password: z.string().min(PASSWORD_FROM).max(200),
  // An invitation also makes her account.
  email: z.string().trim().toLowerCase().email().max(160).optional(),
  phone: z.string().max(40).optional(),
  acceptTerms: z.boolean().optional(),
});

const EXPIRED = "Este enlace ya se usó o venció. Pídele al equipo uno nuevo.";

// A link the team sent her by WhatsApp (/instructoras/clave/<token>): a new
// password (RESET), or her own account for a profile the team made
// (INVITE). Each link works once; afterwards she's logged in.
export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => String(i.path[0]));
    return NextResponse.json(
      { error: "invalid_body", fields, message: fields.includes("password") ? "La contraseña necesita al menos 8 caracteres." : "Revisa los datos." },
      { status: 400 },
    );
  }
  const input = parsed.data;
  const link = await findAccessLink(input.token);
  if (!link) return NextResponse.json({ error: "expired", message: EXPIRED }, { status: 410 });

  const existing = link.instructor.account;
  const phone = phoneOf(input.phone);
  if (!existing && (!input.email || !phone || !input.acceptTerms)) {
    const fields = [!input.email && "email", !phone && "phone", !input.acceptTerms && "acceptTerms"].filter(Boolean);
    return NextResponse.json({ error: "invalid_body", fields, message: "Completa tu correo, tu celular y acepta los términos del directorio." }, { status: 400 });
  }

  const passwordHash = await hashPassword(input.password);
  const now = new Date();
  let accountId: string | null;
  try {
    accountId = await db.$transaction(async (tx) => {
      // Used once — a second tap on the same link finds it spent.
      const { count } = await tx.instructorAccessLink.updateMany({ where: { id: link.id, usedAt: null }, data: { usedAt: now } });
      if (count === 0) return null;
      if (existing) {
        // A new password: every device she had open logs out.
        await tx.instructorSession.deleteMany({ where: { accountId: existing.id } });
        await tx.instructorAccount.update({ where: { id: existing.id }, data: { passwordHash, failedLogins: 0, lockedUntil: null, resetRequestedAt: null } });
        return existing.id;
      }
      const account = await tx.instructorAccount.create({ data: { instructorId: link.instructorId, email: input.email!, phone: phone!, passwordHash, termsAcceptedAt: now } });
      return account.id;
    });
  } catch (err) {
    // The email is already someone's: nothing was saved, the link still works.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "email_taken", fields: ["email"], message: "Ya hay una cuenta con ese correo." }, { status: 409 });
    }
    throw err;
  }
  if (!accountId) return NextResponse.json({ error: "expired", message: EXPIRED }, { status: 410 });

  const token = await createInstructorSession(accountId);
  return setSessionCookie(NextResponse.json({ ok: true, next: "/instructoras/portal" }), token);
}
