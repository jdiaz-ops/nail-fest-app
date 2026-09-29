import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { createInfoPage, infoPageSchema } from "@/lib/infoPages";
import type { LandingBlock } from "@/lib/landingBlocks/types";

export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = infoPageSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const event = await db.event.findUnique({ where: { id: parsed.data.eventId }, select: { id: true } });
  if (!event) return NextResponse.json({ error: "event_not_found" }, { status: 404 });

  const page = await createInfoPage({ ...parsed.data, blocks: parsed.data.blocks as LandingBlock[] });
  return NextResponse.json({ ok: true, id: page.id, slug: page.slug });
}
