/** Money actually received, by currency (2026-11-02) — what one buyer paid for her ticket («Entradas emitidas»), or
 * an event's sales (its summary): its APPROVED payments, an upgrade's difference included, net of what went back in
 * a partial refund. One refunded in full is REFUNDED, and anything still pending, declined or failed paid nothing.
 * Pesos whole; dollars (PayPal) in cents. */
export interface PaidTotal {
  pesos: number;
  usdCents: number;
}

export interface PaidPayment {
  status: string;
  amountInCents: number;
  refundedCents: number;
  currency: string;
}

export function paidTotal(payments: PaidPayment[]): PaidTotal {
  let copCents = 0;
  let usdCents = 0;
  for (const p of payments) {
    if (p.status !== "APPROVED") continue;
    const net = Math.max(0, p.amountInCents - p.refundedCents);
    if (p.currency === "USD") usdCents += net;
    else copCents += net;
  }
  return { pesos: Math.round(copCents / 100), usdCents };
}

/** "$90.000". */
export function formatPesos(pesos: number): string {
  return `$${pesos.toLocaleString("es-CO")}`;
}

/** "US$25", "US$25,50". */
export function formatUsd(cents: number): string {
  const decimals = cents % 100 === 0 ? 0 : 2;
  return `US$${(cents / 100).toLocaleString("es-CO", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

/** "$90.000", "US$25", or both ("$90.000 + US$25") — null when nothing was paid. */
export function formatPaid(total: PaidTotal): string | null {
  const parts = [total.pesos > 0 ? formatPesos(total.pesos) : null, total.usdCents > 0 ? formatUsd(total.usdCents) : null];
  const paid = parts.filter((part): part is string => part !== null);
  return paid.length > 0 ? paid.join(" + ") : null;
}
