import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { YoutubeError } from "@/lib/library/youtube";
import { syncPlaylists } from "@/lib/library/youtubeImport";

// Editar biblioteca → YouTube: right after bringing the videos, the
// channel's playlists, one more clue for the autopilot.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;
  try {
    return NextResponse.json({ ok: true, ...(await syncPlaylists()) });
  } catch (error) {
    if (error instanceof YoutubeError) return NextResponse.json({ error: error.problem, message: error.message }, { status: 400 });
    throw error;
  }
}
