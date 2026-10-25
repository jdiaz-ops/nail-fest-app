import { NextRequest, NextResponse } from "next/server";
import { recordVote } from "@/lib/mesa/votes";

// A tap on an option in La Mesa's email, recorded by the page it opens
// (/la-mesa/voto/<token>) once it's on screen — so a mail scanner that
// only fetches the link doesn't vote for her. The token is signed for her,
// the piece and the option (lib/mesa/votes.ts); a preview's records nothing.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  const outcome = await recordVote(token);
  if (outcome === "invalid") return NextResponse.json({ error: "invalid" }, { status: 400 });
  return NextResponse.json({ ok: true, outcome });
}
