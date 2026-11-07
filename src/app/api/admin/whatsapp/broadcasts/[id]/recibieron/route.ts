import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { NotReachedError, segmentOfReached } from "@/lib/whatsapp/notReached";

// Difusiones → «Segmento: la recibieron» (2026-11-07): saves a segment of exactly the people it reached
// (lib/whatsapp/notReached.ts).
export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;
  try {
    return NextResponse.json({ ok: true, ...(await segmentOfReached(params.id)) });
  } catch (error) {
    if (!(error instanceof NotReachedError)) throw error;
    return NextResponse.json({ error: "reached", message: error.message }, { status: 400 });
  }
}
