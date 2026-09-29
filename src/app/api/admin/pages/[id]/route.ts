import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { infoPageSchema, updateInfoPage } from "@/lib/infoPages";
import type { LandingBlock } from "@/lib/landingBlocks/types";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = infoPageSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const existing = await db.infoPage.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const event = await db.event.findUnique({ where: { id: parsed.data.eventId }, select: { id: true } });
  if (!event) return NextResponse.json({ error: "event_not_found" }, { status: 404 });

  const page = await updateInfoPage(params.id, { ...parsed.data, blocks: parsed.data.blocks as LandingBlock[] });
  return NextResponse.json({ ok: true, id: page.id, slug: page.slug });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  await db.infoPage.delete({ where: { id: params.id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
