import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { summarizeReviews } from "@/lib/reviews";

// "Generar resumen": one Claude call over the event's comments, cached on
// the event. Deliberately a click, never a page-load side effect.
export const maxDuration = 60;

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN", "COORDINADOR"]);
  if ("response" in auth) return auth.response;
  try {
    return NextResponse.json({ ok: true, summary: await summarizeReviews(params.id) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "summary_failed";
    return NextResponse.json({ error: message === "ia_not_configured" ? "La clave de Claude (ANTHROPIC_API_KEY) no está configurada en Vercel." : message }, { status: 400 });
  }
}
