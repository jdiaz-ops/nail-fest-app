import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { randomUUID } from "crypto";
import { requireUser } from "@/lib/auth/guard";

// Same shape as /api/admin/uploads/homepage-image — its own route (rather
// than a shared "upload any image" endpoint) so the Blob pathname prefix
// stays organized (link-images/ vs homepage-images/ vs event-images/) and
// each stays free to diverge later. Backs a single LinkPageLink's optional
// card background — see that model's own schema comment.
const MAX_BYTES = 5 * 1024 * 1024; // 5MB — plenty for a card image

export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "blob_not_configured" }, { status: 503 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "not_an_image" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 400 });
  }

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const pathname = `link-images/${randomUUID()}.${ext}`;

  const blob = await put(pathname, file, { access: "public" });
  return NextResponse.json({ ok: true, url: blob.url });
}
