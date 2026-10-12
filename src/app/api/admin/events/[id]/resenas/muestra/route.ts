import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { createSampleReviews, deleteSampleReviews } from "@/lib/reviews";

// Sample reviews for one event — create (POST) / delete (DELETE). See
// lib/reviews.ts's createSampleReviews: staff-only visibility.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;
  try {
    return NextResponse.json({ ok: true, count: await createSampleReviews(params.id) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "sample_failed" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;
  return NextResponse.json({ ok: true, deleted: await deleteSampleReviews(params.id) });
}
