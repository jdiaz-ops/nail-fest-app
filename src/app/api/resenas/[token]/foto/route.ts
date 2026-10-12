import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { randomUUID } from "crypto";
import { reviewEligibilityForToken, reviewPhotoFolder } from "@/lib/reviews";

// One review photo, uploaded before the review itself is submitted — the
// form sends each picked file here and keeps the returned URL. Only an
// eligible token (scanned attendee, no review yet) may upload, and the
// file lands under the registration's own folder, which is what
// isOwnReviewPhotoUrl checks at submit time.
const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const eligibility = await reviewEligibilityForToken(params.token);
  if (!eligibility.ok) return NextResponse.json({ error: eligibility.reason }, { status: 404 });
  if (eligibility.existing) return NextResponse.json({ error: "already_reviewed" }, { status: 409 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "blob_not_configured" }, { status: 503 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "no_file" }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "not_an_image" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "too_large" }, { status: 400 });

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const blob = await put(`${reviewPhotoFolder(eligibility.registration.id)}/${randomUUID()}.${ext}`, file, { access: "public" });
  return NextResponse.json({ ok: true, url: blob.url });
}
