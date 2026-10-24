import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { whatsappUrl } from "@/lib/library/portal";
import { LINK_DAYS, accessLinkUrl, createAccessLink } from "@/lib/library/portalAuth";

const bodySchema = z.object({ kind: z.enum(["RESET", "INVITE"]) });

// A one-time link for an instructor, made by the team (Editar biblioteca →
// Instructoras) and sent by hand over WhatsApp — nothing goes out from
// here: "Enlace para cambiar contraseña" (RESET, she has an account) or
// "Invitar a manejar su perfil" (INVITE, a profile the team made). A new
// link voids the earlier unused one of the same kind.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { kind } = parsed.data;

  const instructor = await db.instructor.findUnique({ where: { id: params.id }, include: { account: { select: { id: true, phone: true } } } });
  if (!instructor) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (kind === "INVITE" && instructor.account) return NextResponse.json({ error: "has_account", message: "Ya tiene cuenta: mándale un enlace para cambiar su contraseña." }, { status: 409 });
  if (kind === "RESET" && !instructor.account) return NextResponse.json({ error: "no_account", message: "Todavía no tiene cuenta: invítala a manejar su perfil." }, { status: 409 });

  const url = accessLinkUrl(await createAccessLink(instructor.id, kind));
  // The request she left is handled once the team has her link.
  if (kind === "RESET") await db.instructorAccount.update({ where: { id: instructor.account!.id }, data: { resetRequestedAt: null } });

  const firstName = instructor.name.split(" ")[0];
  const text =
    kind === "RESET"
      ? `Hola, ${firstName}. Este es el enlace para crear tu nueva contraseña del portal de instructoras de Nail Fest (sirve una vez, por ${LINK_DAYS} días): ${url}`
      : `Hola, ${firstName}. Ya tienes tu perfil en el directorio de instructoras de Nail Fest. Con este enlace creas tu cuenta para manejarlo tú: tu foto, lo que cuentas de ti, tus redes y tus videos (sirve una vez, por ${LINK_DAYS} días): ${url}`;
  const phone = instructor.account?.phone ?? instructor.whatsapp;
  return NextResponse.json({ ok: true, url, text, whatsapp: phone ? whatsappUrl(phone, text) : `https://wa.me/?text=${encodeURIComponent(text)}`, phone });
}
