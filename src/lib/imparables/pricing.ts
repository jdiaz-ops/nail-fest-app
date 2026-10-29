import { db } from "@/lib/db";
import { dollars, pesos, salesState, stageLine, type PriceStage, type SalesState, type StageTicketType } from "./stages";

// Where Manicuristas Imparables' prices come from (2026-10-29): its stages as
// the database has them right now — its ticket types on sale, each with its
// paid purchases — and the one on sale (lib/imparables/stages.ts). The page,
// the checkout, /api/register, the payments' confirmation and the emails all
// ask here: nothing else says what a ticket costs.

/** The event's ticket types as price stages, each with its tickets bought and paid. */
export async function loadStages(eventId: string): Promise<StageTicketType[]> {
  const [types, paid] = await Promise.all([
    db.ticketType.findMany({ where: { eventId }, orderBy: { order: "asc" } }),
    // Paid: confirmed with an approved payment. A pending purchase, or a ticket given away, takes no place in a stage.
    db.registration.groupBy({
      by: ["ticketTypeId"],
      where: { eventId, status: "CONFIRMED", ticketTypeId: { not: null }, payments: { some: { status: "APPROVED" } } },
      _sum: { ticketCount: true },
    }),
  ]);
  const paidBy = new Map(paid.map((row) => [row.ticketTypeId, row._sum.ticketCount ?? 0]));
  return types.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.stageSlug,
    price: t.price,
    usdCents: t.priceUsdCents,
    status: t.status,
    hideUntil: t.hideUntil,
    hideAfter: t.hideAfter,
    cap: t.stageCap,
    paid: paidBy.get(t.id) ?? 0,
    soldOutAt: t.stageSoldOutAt,
    note: t.stageNote,
    order: t.order,
  }));
}

/** The stage whose price holds at `now` (`active`; `current` while it's on sale) with what its texts need — its
 * places left, the next one, how the one before it closed. The one source of truth of the price. */
export async function getActiveStage(event: { id: string; startsAt: Date }, now: Date = new Date()): Promise<SalesState> {
  return salesState(await loadStages(event.id), now, event.startsAt);
}

/** A purchase just confirmed as paid (lib/payments/confirmRegistrationPayment.ts): if it filled its stage's cap,
 * the stage closes for good. The purchase itself is honored at the price it paid, even past the cap — better than
 * a refund. */
export async function closeStageIfFull(ticketTypeId: string | null, now: Date = new Date()): Promise<void> {
  if (!ticketTypeId) return;
  const type = await db.ticketType.findUnique({ where: { id: ticketTypeId }, select: { stageCap: true, stageSoldOutAt: true } });
  if (!type || type.stageCap === null || type.stageSoldOutAt) return;
  const paid = await db.registration.aggregate({
    where: { ticketTypeId, status: "CONFIRMED", payments: { some: { status: "APPROVED" } } },
    _sum: { ticketCount: true },
  });
  if ((paid._sum.ticketCount ?? 0) >= type.stageCap) {
    await db.ticketType.updateMany({ where: { id: ticketTypeId, stageSoldOutAt: null }, data: { stageSoldOutAt: now } });
  }
}

/** What the one-page checkout sells (/[eventSlug]/checkout, ImpCheckout.tsx): the stage on sale, against the full
 * price, in pesos and — when both have one — in dollars. */
export interface CheckoutTicket {
  id: string;
  name: string;
  price: number;
  /** The full price, struck beside it — when it's another stage's and higher. */
  fullPrice: number | null;
  usdCents: number | null;
  fullUsdCents: number | null;
  min: number;
  max: number;
}

/** The checkout's ticket and the line under its prices, for the stage on sale (null: none is). */
export async function checkoutOffer(sales: SalesState, timezone: string): Promise<{ ticket: CheckoutTicket; line: string | null } | null> {
  const { current, full } = sales;
  if (!current) return null;
  const type = await db.ticketType.findUnique({ where: { id: current.id }, select: { minPerOrder: true, maxPerOrder: true } });
  const struck = full && full.id !== current.id && full.price > current.price ? full : null;
  return {
    ticket: {
      id: current.id,
      name: current.name,
      price: current.price,
      fullPrice: struck?.price ?? null,
      usdCents: current.usdCents,
      fullUsdCents: current.usdCents && struck?.usdCents && struck.usdCents > current.usdCents ? struck.usdCents : null,
      min: Math.max(1, type?.minPerOrder ?? 1),
      max: Math.max(1, type?.maxPerOrder ?? 1),
    },
    line: stageLine(sales, timezone),
  };
}

const SHARE = "compartir esto con una colega es un buen regalo.";

/** What the confirmation email says about the price (2026-10-29): «Compraste en la Etapa Creyente a $90.000» — the
 * stage and what was really paid for each ticket — and, bought before the full price, «Hoy el precio ya es de
 * $120.000: compartir esto con una colega es un buen regalo.» once it went up, or «Luego sube a $120.000: …» while it
 * hasn't yet (the email goes out the moment it's paid). Null for anything not bought at a price stage. */
export async function purchaseNote(registrationId: string, now: Date = new Date()): Promise<{ bought: string; share: string | null } | null> {
  const registration = await db.registration.findUnique({
    where: { id: registrationId },
    include: {
      event: { select: { id: true, startsAt: true } },
      payments: { where: { status: "APPROVED" }, orderBy: { updatedAt: "desc" }, take: 1 },
    },
  });
  const payment = registration?.payments[0];
  if (!registration || !payment) return null;
  const sales = await getActiveStage(registration.event, now);
  const stage = sales.stages.find((s) => (payment.stageSlug ? s.slug === payment.stageSlug : s.id === registration.ticketTypeId));
  if (!stage?.slug) return null;

  const usd = payment.currency === "USD";
  const count = Math.max(1, registration.ticketCount);
  const each = Math.round(payment.amountInCents / count);
  const paid = usd ? dollars(each) : pesos(each / 100);
  const priceOf = (s: PriceStage) => (usd && s.usdCents ? dollars(s.usdCents) : pesos(s.price));
  const name = stage.name.trim();
  const bought = /^etapa\b/i.test(name)
    ? `Compraste en la ${name} a ${paid}${count > 1 ? " cada una" : ""}`
    : `Compraste a ${paid}${count > 1 ? " cada una" : ""}, ${name.charAt(0).toLowerCase()}${name.slice(1)}`;

  const at = sales.stages.indexOf(stage);
  const then = sales.stages[at + 1];
  let share: string | null = null;
  if (then) {
    const today = sales.active;
    share =
      today && today.price > stage.price ? `Hoy el precio ya es de ${priceOf(today)}: ${SHARE}` : `Luego sube a ${priceOf(then)}: ${SHARE}`;
  }
  return { bought, share };
}
