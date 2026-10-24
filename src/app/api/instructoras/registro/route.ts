import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { getLibrarySettings } from "@/lib/library/settings";
import { signupSchema, usernameProblem } from "@/lib/library/portal";
import { createInstructorSession, setSessionCookie } from "@/lib/library/portalAuth";
import { viewerCanSeeSamples } from "@/lib/reviewsViewer";

// "Crea tu cuenta" (/instructoras/unirme/cuenta): her username (her
// profile's address), email, WhatsApp and password. Makes her profile as a
// draft — nothing shows until she sends it and the team approves it — and
// logs her in to the onboarding. Nothing is sent to her.
export async function POST(req: NextRequest) {
  const parsed = signupSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => String(i.path[0]));
    const message = fields.includes("email")
      ? "Revisa tu correo."
      : fields.includes("phone")
        ? "Revisa tu celular: escríbelo con el indicativo si no es de Colombia (+52…)."
        : fields.includes("password")
          ? "La contraseña necesita al menos 8 caracteres."
          : fields.includes("acceptTerms")
            ? "Para crear tu cuenta, acepta los términos del directorio."
            : "Revisa los datos.";
    return NextResponse.json({ error: "invalid_body", fields, message }, { status: 400 });
  }
  const input = parsed.data;
  // The box people never see came back filled in: a bot. It's told "ok".
  if (input.website) return NextResponse.json({ ok: true });

  const [settings, staff] = await Promise.all([getLibrarySettings(), viewerCanSeeSamples()]);
  if (!settings.portalOpen && !staff) return NextResponse.json({ error: "closed", message: "El registro todavía no está abierto." }, { status: 404 });

  const problem = usernameProblem(input.username);
  if (problem) return NextResponse.json({ error: "username", fields: ["username"], message: problem }, { status: 400 });

  const [taken, emailTaken] = await Promise.all([
    db.instructor.findUnique({ where: { slug: input.username }, select: { id: true } }),
    db.instructorAccount.findUnique({ where: { email: input.email }, select: { id: true } }),
  ]);
  if (taken) return NextResponse.json({ error: "username_taken", fields: ["username"], message: "Ese usuario ya existe. Prueba otro." }, { status: 409 });
  if (emailTaken) {
    return NextResponse.json({ error: "email_taken", fields: ["email"], message: "Ya hay una cuenta con ese correo. Entra con tu usuario o tu correo." }, { status: 409 });
  }

  const passwordHash = await hashPassword(input.password);
  let accountId: string;
  try {
    const instructor = await db.instructor.create({
      data: {
        slug: input.username,
        // Hers to fill in on the onboarding's first steps.
        name: input.username,
        city: "",
        invited: false,
        account: { create: { email: input.email, phone: input.phone, passwordHash, termsAcceptedAt: new Date() } },
      },
      include: { account: { select: { id: true } } },
    });
    accountId = instructor.account!.id;
  } catch (err) {
    // Someone took the same username or email a moment before.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "taken", fields: ["username"], message: "Ese usuario o ese correo ya tiene cuenta. Prueba otro." }, { status: 409 });
    }
    throw err;
  }

  const token = await createInstructorSession(accountId);
  return setSessionCookie(NextResponse.json({ ok: true, next: "/instructoras/portal/bienvenida" }), token);
}
