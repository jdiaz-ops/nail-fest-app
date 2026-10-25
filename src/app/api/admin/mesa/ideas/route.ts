import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guard";
import { createIdeas } from "@/lib/mesa/data";
import { mesaErrorResponse } from "@/lib/mesa/http";
import { MESA_PIECE_SECTIONS, type MesaPieceSection } from "@/lib/mesa/sections";

// La Mesa → «Pedir 5 ideas»: Claude's ideas for a section, about a theme if
// the team wrote one, saved as waiting for the team.
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const bodySchema = z.object({
  section: z.string().refine((s): s is MesaPieceSection => (MESA_PIECE_SECTIONS as string[]).includes(s)),
  topic: z
    .string()
    .trim()
    .max(60)
    .optional()
    .transform((t) => t || null),
});

export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  try {
    const pieces = await createIdeas(parsed.data.section as MesaPieceSection, parsed.data.topic);
    return NextResponse.json({ ok: true, ids: pieces.map((p) => p.id) });
  } catch (error) {
    return mesaErrorResponse(error);
  }
}
