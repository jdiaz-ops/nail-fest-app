import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { youtubeId } from "@/lib/imparables/grabaciones";

// Saves Manicuristas Imparables' recordings (the admin's «Grabaciones», 2026-11-04): each talk's title, who gives it
// and its YouTube link — or none yet — and the last day they can be watched (null: 30 days after the congress). A link
// that isn't a YouTube video is refused, saying which row, so a buyer never meets a broken video. ADMIN only.
const bodySchema = z.object({
  until: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  items: z
    .array(
      z.object({
        title: z.string().max(200),
        speaker: z.string().max(200),
        url: z.string().max(500),
      })
    )
    .max(40),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const items = parsed.data.items
    .map((item) => ({ title: item.title.trim(), speaker: item.speaker.trim(), url: item.url.trim() }))
    .filter((item) => item.title || item.speaker || item.url);
  const wrong = items.findIndex((item) => item.url && !youtubeId(item.url));
  if (wrong !== -1) {
    return NextResponse.json({ error: "not_youtube", row: wrong }, { status: 400 });
  }

  try {
    await db.event.update({ where: { id: params.id }, data: { recordings: { until: parsed.data.until, items } } });
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
