import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guard";
import { YoutubeError } from "@/lib/library/youtube";
import { importUploadsPage } from "@/lib/library/youtubeImport";

// Hundreds of videos come in 50 at a time: the tab asks page after page,
// so no request runs long, and shows how far it got.
export const maxDuration = 60;

const bodySchema = z.object({ pageToken: z.string().max(200).nullable().optional() });

export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, ...(await importUploadsPage(parsed.data.pageToken ?? null)) });
  } catch (error) {
    if (error instanceof YoutubeError) return NextResponse.json({ error: error.problem, message: error.message }, { status: 400 });
    throw error;
  }
}
