import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { NotReachedError, segmentOfNotReached } from "@/lib/whatsapp/notReached";

// Difusiones → «Segmento: no la recibieron» (2026-11-07): saves a segment of the ones it didn't reach — its
// conditions, without the people it did (lib/whatsapp/notReached.ts).
export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;
  try {
    return NextResponse.json({ ok: true, ...(await segmentOfNotReached(params.id)) });
  } catch (error) {
    if (!(error instanceof NotReachedError)) throw error;
    return NextResponse.json({ error: "not_reached", message: error.message }, { status: 400 });
  }
}
