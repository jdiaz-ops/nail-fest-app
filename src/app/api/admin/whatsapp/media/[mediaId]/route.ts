import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { fetchMedia } from "@/lib/whatsapp/meta";

// An inbound photo / voice note / video / document, streamed from Meta
// for the Bandeja's thread view — the file is never stored on our side
// (Meta keeps it 30 days; after that this answers 404 and the thread
// says so). Staff-only: the media id alone must not be enough to fetch
// a customer's picture.
export async function GET(req: NextRequest, { params }: { params: { mediaId: string } }) {
  const auth = await requireUser(["ADMIN", "COORDINADOR"]);
  if ("response" in auth) return auth.response;
  if (!/^[\w.-]{1,128}$/.test(params.mediaId)) return NextResponse.json({ error: "invalid_media_id" }, { status: 400 });

  const media = await fetchMedia(params.mediaId).catch((err) => {
    console.error("whatsapp media fetch failed", params.mediaId, err);
    return null;
  });
  if (!media || !media.body) {
    return NextResponse.json({ error: "media_unavailable", message: "WhatsApp guarda los archivos 30 días; este ya no está disponible." }, { status: 404 });
  }
  const filename = req.nextUrl.searchParams.get("nombre");
  return new NextResponse(media.body, {
    headers: {
      "Content-Type": media.mime,
      "Cache-Control": "private, max-age=86400",
      ...(media.size ? { "Content-Length": String(media.size) } : {}),
      ...(filename ? { "Content-Disposition": `inline; filename="${filename.replace(/["\r\n]/g, "")}"` } : {}),
    },
  });
}
