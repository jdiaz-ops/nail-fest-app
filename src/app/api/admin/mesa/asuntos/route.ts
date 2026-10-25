import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guard";
import { createSubjects } from "@/lib/mesa/data";
import { mesaErrorResponse } from "@/lib/mesa/http";

// La Mesa → Asuntos → «Pedir 5 asuntos»: Claude's subject lines (and the
// greeting) for an upcoming edition, written from the pieces it has.
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const bodySchema = z.object({ edition: z.number().int().min(1).max(10_000) });

export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  try {
    const subjects = await createSubjects(parsed.data.edition);
    return NextResponse.json({ ok: true, ids: subjects.map((s) => s.id) });
  } catch (error) {
    return mesaErrorResponse(error);
  }
}
