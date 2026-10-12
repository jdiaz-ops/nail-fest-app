import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { drawRaffle, updateRaffle } from "@/lib/reviews";

// PATCH edits the raffle's terms while it hasn't been drawn; POST draws
// it once (winners + backups, recorded with its seed) — see lib/reviews.ts.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;
  const body = await req.json().catch(() => ({}));
  try {
    const raffle = await updateRaffle(params.id, {
      closesAt: typeof body?.closesAt === "string" && !Number.isNaN(Date.parse(body.closesAt)) ? new Date(body.closesAt) : undefined,
      prizeCount: typeof body?.prizeCount === "number" ? body.prizeCount : undefined,
      prizeLabel: typeof body?.prizeLabel === "string" ? body.prizeLabel : undefined,
    });
    return NextResponse.json({ ok: true, raffle });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "update_failed" }, { status: 400 });
  }
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;
  try {
    return NextResponse.json({ ok: true, ...(await drawRaffle(params.id)) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "draw_failed" }, { status: 400 });
  }
}
