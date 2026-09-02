import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { requireUser } from "@/lib/auth/guard";

// Video needs a DIFFERENT upload mechanism than homepage-image's own
// route: Vercel's Node serverless functions cap request bodies around
// 4.5MB, well under any real video clip, even a short well-compressed
// one — homepage-image's plain req.formData() → put() pattern simply
// can't carry a video file server-side. This route instead issues a
// short-lived CLIENT upload token (@vercel/blob/client's handleUpload) —
// the browser then PUTs the file straight to Blob storage, bypassing
// this function's body limit entirely. See HomepageEditorForm.tsx for
// the matching client-side upload() call.
const MAX_BYTES = 20 * 1024 * 1024; // 20MB — a short, well-compressed loop, not a full clip

export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "blob_not_configured" }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        // Re-checked here too, not just at the top of this handler — this
        // callback is what actually authorizes the token Vercel hands
        // back to the browser, so it's the real gate, not the earlier
        // requireUser call (that one just fails fast on the common case).
        if (!pathname.startsWith("homepage-videos/")) {
          throw new Error("Unexpected upload path");
        }
        return {
          allowedContentTypes: ["video/mp4", "video/webm"],
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "upload_failed" }, { status: 400 });
  }
}
