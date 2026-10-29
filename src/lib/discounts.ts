import type { DiscountCode } from "@prisma/client";
import { db } from "@/lib/db";
import { pesos } from "@/lib/imparables/stages";

// Discount codes for an event's checkout (2026-10-29) — see the DiscountCode
// model. The checkout's box asks /api/checkout/discount what a code takes
// off; /api/register works it out again on its own before it creates the
// payment, so what Wompi charges never comes from the browser.

/** Wompi's smallest charge: a code can't take the total under it. */
export const MIN_TOTAL_CENTS = 1500_00;

export type DiscountError = "not_found" | "expired" | "used_up" | "not_for_ticket" | "too_big";

export const DISCOUNT_ERROR_MESSAGES: Record<DiscountError, string> = {
  not_found: "Ese código no existe o ya no está activo.",
  expired: "Ese código ya venció.",
  used_up: "Ese código ya se usó todas las veces que permitía.",
  not_for_ticket: "Ese código no aplica para esta entrada.",
  too_big: "Ese código no aplica para este precio.",
};

export type DiscountResult =
  | { ok: true; discountCode: DiscountCode; discountCents: number; totalCents: number; label: string }
  | { ok: false; error: DiscountError };

/** A code as stored and compared: no spaces, in capitals. */
export function normalizeCode(code: string): string {
  return code.replace(/\s+/g, "").toUpperCase();
}

/** What a code takes off a subtotal in cents: its percentage of it, or its fixed amount — never more than the subtotal. */
export function discountCentsFor(code: Pick<DiscountCode, "percentOff" | "amountOffCop">, subtotalCents: number): number {
  const off = code.percentOff ? Math.round((subtotalCents * code.percentOff) / 100) : (code.amountOffCop ?? 0) * 100;
  return Math.min(Math.max(off, 0), subtotalCents);
}

/** "−10%" or "−$20.000" */
export function discountLabel(code: Pick<DiscountCode, "percentOff" | "amountOffCop">): string {
  return code.percentOff ? `−${code.percentOff}%` : `−${pesos(code.amountOffCop ?? 0)}`;
}

/** Whether `code` applies to this event's ticket at this subtotal, and what's left to pay. A code's uses are
 * the payments already approved with it: a checkout left unpaid doesn't spend one. */
export async function resolveDiscount(params: {
  eventId: string;
  ticketTypeId: string | null;
  code: string;
  subtotalCents: number;
  now?: Date;
}): Promise<DiscountResult> {
  const code = normalizeCode(params.code);
  if (!code) return { ok: false, error: "not_found" };
  const discountCode = await db.discountCode.findUnique({ where: { eventId_code: { eventId: params.eventId, code } } });
  if (!discountCode || !discountCode.active) return { ok: false, error: "not_found" };
  if (discountCode.expiresAt && (params.now ?? new Date()) > discountCode.expiresAt) return { ok: false, error: "expired" };
  if (discountCode.ticketTypeId && discountCode.ticketTypeId !== params.ticketTypeId) return { ok: false, error: "not_for_ticket" };
  if (discountCode.maxUses != null) {
    const used = await db.payment.count({ where: { discountCodeId: discountCode.id, status: "APPROVED" } });
    if (used >= discountCode.maxUses) return { ok: false, error: "used_up" };
  }
  const discountCents = discountCentsFor(discountCode, params.subtotalCents);
  const totalCents = params.subtotalCents - discountCents;
  if (totalCents < MIN_TOTAL_CENTS) return { ok: false, error: "too_big" };
  return { ok: true, discountCode, discountCents, totalCents, label: discountLabel(discountCode) };
}
