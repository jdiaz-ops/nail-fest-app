import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { YoutubeError } from "@/lib/library/youtube";
import { connectChannel, connectSchema } from "@/lib/library/youtubeImport";

// Editar biblioteca → YouTube: the channel and its free Google key, saved
// once YouTube says both work.
export async function PATCH(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = connectSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", message: "Escribe tu canal así: @nombre." }, { status: 400 });
  try {
    const channel = await connectChannel(parsed.data);
    return NextResponse.json({ ok: true, channel: { title: channel.title, videoCount: channel.videoCount } });
  } catch (error) {
    if (error instanceof YoutubeError) return NextResponse.json({ error: error.problem, message: error.message }, { status: 400 });
    throw error;
  }
}
