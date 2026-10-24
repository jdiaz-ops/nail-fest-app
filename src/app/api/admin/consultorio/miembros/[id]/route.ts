import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { recountAnswers } from "@/lib/community/data";

const bodySchema = z.object({ blocked: z.boolean() });

// Block a member (she can't post, and what she posted is hidden) or let her
// back in. Nothing she posted is deleted.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN", "COORDINADOR"]);
  if ("response" in auth) return auth.response;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const updated = await db.communityMember.updateMany({ where: { id: params.id }, data: { blocked: parsed.data.blocked } });
  if (updated.count === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // The questions she answered count her answers again — or no longer.
  const answered = await db.consultorioAnswer.findMany({ where: { memberId: params.id }, select: { questionId: true }, distinct: ["questionId"] });
  await recountAnswers(answered.map((a) => a.questionId));
  return NextResponse.json({ ok: true });
}
