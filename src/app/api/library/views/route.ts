import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recordVideoView } from "@/lib/library/data";

// One view of a video's page (components/library/ViewPing) — the count
// behind "Lo más visto esta semana". Only real, visible videos count.
const bodySchema = z.object({ videoId: z.string().min(1).max(60) });

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const counted = await recordVideoView(parsed.data.videoId);
  return NextResponse.json({ ok: counted });
}
