import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const bodySchema = z.object({
  registrationId: z.string().min(1),
  transactionId: z.string().min(1),
  instagram: z.string().trim().min(1).max(80),
});

// After paying (/[eventSlug]/pago): the optional question the one-page
// checkout leaves for later (2026-10-29) — the buyer's Instagram/TikTok,
// kept under the checkout question's own key ("instagram", lib/checkoutForm.ts)
// as before. Only for that registration's own approved payment: the
// transaction id Wompi sent the buyer back with (PayPal's order id, paying
// in dollars) is what says it's theirs.
export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  const { registrationId, transactionId, instagram } = parsed.data;

  const payment = await db.payment.findUnique({
    where: { providerReference: transactionId },
    select: { registrationId: true, status: true, registration: { select: { customFields: true } } },
  });
  if (!payment || payment.registrationId !== registrationId || payment.status !== "APPROVED") {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const saved = payment.registration.customFields;
  const current = saved && typeof saved === "object" && !Array.isArray(saved) ? (saved as Record<string, unknown>) : {};
  await db.registration.update({ where: { id: registrationId }, data: { customFields: { ...current, instagram } as Prisma.InputJsonValue } });
  return NextResponse.json({ ok: true });
}
