import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

// Fire-and-forget from EventRegistration.tsx's openModal() — the one real
// top-of-funnel number this app had no record of (see Event.
// checkoutOpenedCount's own schema comment). Deliberately as small as
// tracking.ts's own track() calls: no session id, no dedup, just "the
// registration modal was opened one more time" — same raw-counter
// reasoning as LinkPageLink.clickCount, not analytics-grade attribution.
const bodySchema = z.object({ eventSlug: z.string().min(1) });

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
  await db.event
    .update({ where: { slug: parsed.data.eventSlug }, data: { checkoutOpenedCount: { increment: 1 } } })
    .catch(() => {
      /* unknown slug, or a transient DB blip — never worth failing the visible page for */
    });
  return NextResponse.json({ ok: true });
}
