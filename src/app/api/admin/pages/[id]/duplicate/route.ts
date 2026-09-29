import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { createInfoPage } from "@/lib/infoPages";
import { parseLandingBlocks } from "@/lib/landingBlocks/types";

const bodySchema = z.object({ title: z.string().trim().min(1) });

// A copy of a page under a new title: same event, intro, blocks and button
// settings, a new address built from the new title, and always a draft —
// nothing goes public before the admin has looked at the copy.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const source = await db.infoPage.findUnique({ where: { id: params.id } });
  if (!source) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const copy = await createInfoPage({
    eventId: source.eventId,
    title: parsed.data.title,
    intro: source.intro,
    blocks: parseLandingBlocks(source.blocks),
    published: false,
    showRegisterButton: source.showRegisterButton,
    showTopRegisterButton: source.showTopRegisterButton,
  });
  return NextResponse.json({ ok: true, id: copy.id, slug: copy.slug });
}
