import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { LINK_DAYS, createMemberLink, memberLinkUrl } from "@/lib/community/auth";

// A one-time link for a member's new password, made by the team and sent
// by hand (WhatsApp or email) — nothing goes out from here.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN", "COORDINADOR"]);
  if ("response" in auth) return auth.response;
  const member = await db.communityMember.findUnique({ where: { id: params.id } });
  if (!member) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const url = memberLinkUrl(await createMemberLink(member.id));
  await db.communityMember.update({ where: { id: member.id }, data: { resetRequestedAt: null } });
  const text = `Hola, ${member.name.split(" ")[0]}. Este es el enlace para crear tu nueva contraseña de tu cuenta en el Consultorio de Nail Fest (sirve una vez, por ${LINK_DAYS} días): ${url}`;
  return NextResponse.json({ ok: true, url, text, email: member.email });
}
