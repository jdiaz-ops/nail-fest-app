import { NextRequest, NextResponse } from "next/server";
import { incrementLinkClicks } from "@/lib/linkPage";

// Deliberately public/unauthenticated — fired by anyone browsing
// nailfest.co/links (see TrackedLink.tsx's navigator.sendBeacon call).
// No rate limiting or dedup: same "simple raw counter" scope as
// LinkPageLink.clickCount's own schema comment, not analytics-grade.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  await incrementLinkClicks(params.id);
  // Always 204, even for an unknown id — a beacon call has nothing
  // listening for a response and must never surface as a console error.
  return new NextResponse(null, { status: 204 });
}
