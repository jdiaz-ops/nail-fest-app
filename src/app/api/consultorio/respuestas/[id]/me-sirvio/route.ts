import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { wrote } from "@/lib/community/auth";
import { visibleAnswer } from "@/lib/community/data";
import { consultorioPoster } from "@/lib/community/gate";

const bodySchema = z.object({ on: z.boolean() });

// «Me sirvió»: one per person and answer, never for one's own. The
// answer's count goes with the votes.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const gate = await consultorioPoster();
  if ("response" in gate) return gate.response;
  const { identity } = gate;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const answer = await db.consultorioAnswer.findFirst({ where: { id: params.id, ...visibleAnswer } });
  if (!answer) return NextResponse.json({ error: "not_found", message: "Esa respuesta ya no está." }, { status: 404 });
  if (wrote(identity, answer)) return NextResponse.json({ error: "own", message: "No puedes votar tu propia respuesta." }, { status: 400 });

  const voter =
    identity.kind === "MEMBER" ? { memberId: identity.member.id } : identity.kind === "INSTRUCTOR" ? { instructorId: identity.instructor.id } : { adminUserId: identity.adminUserId };
  if (parsed.data.on) {
    try {
      await db.$transaction([
        db.consultorioVote.create({ data: { answerId: answer.id, ...voter } }),
        db.consultorioAnswer.update({ where: { id: answer.id }, data: { usefulCount: { increment: 1 } } }),
      ]);
    } catch (err) {
      // Already voted (another tab): nothing to change.
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
    }
  } else {
    await db.$transaction(async (tx) => {
      const { count } = await tx.consultorioVote.deleteMany({ where: { answerId: answer.id, ...voter } });
      if (count > 0) await tx.consultorioAnswer.update({ where: { id: answer.id }, data: { usefulCount: { decrement: count } } });
    });
  }
  const fresh = await db.consultorioAnswer.findUnique({ where: { id: answer.id }, select: { usefulCount: true } });
  return NextResponse.json({ ok: true, usefulCount: fresh?.usefulCount ?? 0 });
}
