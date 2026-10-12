import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { moderateReview, type ModerationAction } from "@/lib/reviews";

const ACTIONS: ModerationAction[] = ["approve", "hide", "pending", "feature", "unfeature"];

// Moderation: approve / hide / back to pending / feature / unfeature.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN", "COORDINADOR"]);
  if ("response" in auth) return auth.response;
  const body = await req.json().catch(() => null);
  const action = body?.action as ModerationAction | undefined;
  if (!action || !ACTIONS.includes(action)) return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  try {
    const review = await moderateReview(params.id, action, auth.user.id);
    return NextResponse.json({ ok: true, status: review.status, featured: review.featured });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "moderation_failed" }, { status: 400 });
  }
}
