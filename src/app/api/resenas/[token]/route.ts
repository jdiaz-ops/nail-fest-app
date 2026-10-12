import { NextRequest, NextResponse } from "next/server";
import { submitReview } from "@/lib/reviews";

// The review form's submit. The token in the URL is the registration's
// own signed qrToken (see lib/reviews.ts); photos were uploaded first
// through ./foto and arrive here as the URLs it returned.
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const b = body as Record<string, unknown>;
  const result = await submitReview(params.token, {
    rating: Number(b.rating),
    comment: typeof b.comment === "string" ? b.comment : null,
    instagramHandle: typeof b.instagramHandle === "string" ? b.instagramHandle : null,
    publishConsent: b.publishConsent === true,
    raffleOptIn: b.raffleOptIn === true,
    photoUrls: Array.isArray(b.photoUrls) ? b.photoUrls.filter((u): u is string => typeof u === "string") : [],
  });
  if (!result.ok) {
    const status = result.error === "invalid_token" || result.error === "not_found" ? 404 : result.error === "already_reviewed" ? 409 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true, reviewId: result.review.id });
}
