import { NextRequest, NextResponse } from "next/server";
import { reviewCardData, reviewEligibilityForToken } from "@/lib/reviews";
import { reviewCardImage } from "@/lib/reviewCardImage";

// The attendee's own Instagram card (PNG), from the thank-you screen.
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const eligibility = await reviewEligibilityForToken(params.token);
  if (!eligibility.ok || !eligibility.existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const card = await reviewCardData(eligibility.existing.id);
  if (!card) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const image = reviewCardImage(card);
  image.headers.set("Content-Disposition", 'attachment; filename="mi-resena-nailfest.png"');
  return image;
}
