// Manicuristas Imparables' price stages (2026-10-26; by date and cap since
// 2026-10-29): each one of the event's ticket types on sale, in their order
// — Etapa Creyente, Etapa Decidida, Precio full — with its price, the date
// it closes (TicketType.hideAfter) and how many it sells at that price
// (TicketType.stageCap; none for the last). The stage on sale is the first,
// in order, whose date hasn't come and whose cap paid purchases haven't
// reached; with none left, the last one: the full price. One that sold out
// stays closed (TicketType.stageSoldOutAt) even if a refund frees a place:
// the price never goes down. lib/imparables/pricing.ts reads it all from the
// database (getActiveStage), the only source of what it costs — the cover,
// the bar, the closing, the checkout, the payments and the emails.

import { utcToZonedInputValue } from "@/lib/dateFormat";

export interface StageTicketType {
  id: string;
  name: string;
  /** TicketType.stageSlug: "creyente", "decidida", "full"… */
  slug?: string | null;
  price: number;
  /** The same ticket in US dollars, in cents (TicketType.priceUsdCents), when it has one. */
  usdCents?: number | null;
  status: string;
  /** Before it, the stage isn't on sale yet: the waiting list, when it's the first one. */
  hideUntil: Date | null;
  /** When it closes. */
  hideAfter: Date | null;
  /** How many it sells at its price (TicketType.stageCap); null: no cap. */
  cap?: number | null;
  /** Its tickets bought and paid (an APPROVED payment): what its cap counts. */
  paid?: number;
  /** When it sold out, once it did (TicketType.stageSoldOutAt). */
  soldOutAt?: Date | null;
  /** The words after its date: «cierre de Nail Fest Cali» (TicketType.stageNote). */
  note?: string | null;
  order: number;
}

/** "current": on sale. "past": closed on its date. "soldout": closed at its cap. "future": still to come. */
export type StageState = "past" | "current" | "soldout" | "future";

export interface PriceStage {
  id: string;
  name: string;
  slug: string | null;
  price: number;
  /** In US dollars, in cents, when the ticket has a USD price. */
  usdCents: number | null;
  opensAt: Date | null;
  closesAt: Date | null;
  cap: number | null;
  paid: number;
  note: string | null;
  state: StageState;
}

/** "sale": a price is on sale today. "waitlist": the first one opens later. "closed": the last one's date came. */
export type SalesMode = "sale" | "waitlist" | "closed";

export interface SalesState {
  mode: SalesMode;
  /** Every ticket type on sale (status ON_SALE), in its order. */
  stages: PriceStage[];
  /** The full price: the last stage, struck beside every other one's (2026-10-29). */
  full: PriceStage | null;
  /** The stage whose price holds now — the first open one, or the full price with none left (getActiveStage). */
  active: PriceStage | null;
  /** The same, while it's on sale (mode "sale"). */
  current: PriceStage | null;
  /** The first one after it still to come; in the waiting list, the one that opens. */
  next: PriceStage | null;
  /** Its places left under its cap; null without one. */
  remaining: number | null;
  /** The stage before it, closed: by its cap («agotada») or its date («cerrada»), and when — unknown for a cap reached with no record of when. */
  previous: { stage: PriceStage; reason: "cap" | "date"; closedAt: Date | null } | null;
  countdown: { to: Date; label: string } | null;
}

/** How a stage stands closed, if it is: on its date, or at its cap — whichever came first. */
function closure(t: StageTicketType, now: Date): { reason: "cap" | "date"; at: Date | null } | null {
  const soldOutAt = t.soldOutAt ?? null;
  const capReached = soldOutAt !== null || (t.cap != null && (t.paid ?? 0) >= t.cap);
  if (t.hideAfter && now >= t.hideAfter && (!soldOutAt || soldOutAt >= t.hideAfter)) return { reason: "date", at: t.hideAfter };
  return capReached ? { reason: "cap", at: soldOutAt } : null;
}

export function salesState(types: StageTicketType[], now: Date, eventStartsAt: Date): SalesState {
  const onSale = types.filter((t) => t.status === "ON_SALE").sort((a, b) => a.order - b.order);
  const closures = onSale.map((t) => closure(t, now));
  const open = closures.findIndex((c) => c === null);
  // The first open one; with none left, the last: the full price.
  const at = open >= 0 ? open : onSale.length - 1;
  const waiting = open >= 0 && Boolean(onSale[open]!.hideUntil && now < onSale[open]!.hideUntil!);

  const stages = onSale.map((t, i): PriceStage => {
    const closed = closures[i];
    const state: StageState = closed ? (closed.reason === "cap" ? "soldout" : "past") : i === open && !waiting ? "current" : "future";
    return {
      id: t.id,
      name: t.name,
      slug: t.slug ?? null,
      price: t.price,
      usdCents: t.usdCents ?? null,
      opensAt: t.hideUntil,
      closesAt: t.hideAfter,
      cap: t.cap ?? null,
      paid: t.paid ?? 0,
      note: t.note?.trim() || null,
      state,
    };
  });

  const active = stages[at] ?? null;
  const mode: SalesMode = !active || open < 0 ? "closed" : waiting ? "waitlist" : "sale";
  const current = mode === "sale" ? active : null;
  const next = waiting ? active : current ? (stages.slice(at + 1).find((s) => s.state === "future") ?? null) : null;
  const remaining = active && active.cap !== null ? Math.max(0, active.cap - active.paid) : null;
  const before = current && at > 0 ? closures[at - 1] : null;
  const previous = before ? { stage: stages[at - 1]!, reason: before.reason, closedAt: before.at } : null;

  let countdown: SalesState["countdown"] = null;
  if (current) {
    // Until the price goes up; with no price after this one, until the congress starts.
    if (next && current.closesAt) countdown = { to: current.closesAt, label: "Este precio termina en" };
    else if (eventStartsAt > now) countdown = { to: eventStartsAt, label: "El congreso empieza en" };
  } else if (next?.opensAt) {
    countdown = { to: next.opensAt, label: "La venta abre en" };
  }
  return { mode, stages, full: stages[stages.length - 1] ?? null, active, current, next, remaining, previous, countdown };
}

/** What buying at `stage` saves against the full price (0 when there's none, or it's that one). */
export function saving(stage: Pick<PriceStage, "id" | "price">, full: Pick<PriceStage, "id" | "price"> | null): number {
  return full && full.id !== stage.id && full.price > stage.price ? full.price - stage.price : 0;
}

// ── How it reads ────────────────────────────────────────────────────────────

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** 79900 -> "$79.900", the same way everywhere (not left to the runtime's locale data). */
export function pesos(amount: number): string {
  return `$${String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

/** 2500 -> "US$25", 2550 -> "US$25.50" (cents). */
export function dollars(cents: number): string {
  return `US$${cents % 100 ? (cents / 100).toFixed(2) : cents / 100}`;
}

/** The wall-clock date of an instant in `timezone`: { year, month (0–11), day }. */
function localDate(date: Date, timezone: string): { year: number; month: number; day: number } {
  const [y, m, d] = utcToZonedInputValue(date, timezone).slice(0, 10).split("-").map(Number);
  return { year: y!, month: m! - 1, day: d! };
}

/** "1 de abril" */
export function dayMonth(date: Date, timezone: string): string {
  const d = localDate(date, timezone);
  return `${d.day} de ${MONTHS[d.month]}`;
}

/** A stage's last day: the one it closes on — the day before, when it closes at midnight. */
function lastDay(closesAt: Date): Date {
  return new Date(closesAt.getTime() - 60_000);
}

/** The last day a stage's price holds: "31 de marzo". */
export function untilDay(closesAt: Date, timezone: string): string {
  return dayMonth(lastDay(closesAt), timezone);
}


// ── What the page says about them (2026-10-29) ──────────────────────────────

/** In a capped stage's last 30%, the line under the button tells its places left. */
const FEW_LEFT_SHARE = 0.3;
/** For this long after the stage before today's closed, a small pill over that line says so. */
const CLOSED_PILL_MS = 7 * 86_400_000;

/** "18 de abril", "200 cupos" kept on one line wherever the line breaks. */
function together(text: string): string {
  return text.replace(/ /g, "\u00a0");
}

/** The line under the cover's and the closing's buttons (and the checkout's price) — its note only in the doubts
 * (2026-10-29):
 *   «Etapa Creyente · 200 cupos a $90.000 o hasta el 18 de abril · luego $120.000»,
 *   «Precio full · $150.000 · hasta el 27 de junio» —
 * and, under 30% of its cap left, «Quedan 41 cupos a $90.000 · luego $120.000». */
export function stageLine(sales: Pick<SalesState, "current" | "next" | "remaining">, timezone: string): string | null {
  const { current: stage, next, remaining } = sales;
  if (!stage) return null;
  const then = next ? ` · luego ${pesos(next.price)}` : "";
  if (stage.cap !== null && remaining !== null && remaining < stage.cap * FEW_LEFT_SHARE) {
    return `${remaining === 1 ? "Queda 1 cupo" : `Quedan ${together(`${remaining} cupos`)}`} a ${pesos(stage.price)}${then}`;
  }
  const until = stage.closesAt ? `hasta el ${together(untilDay(stage.closesAt, timezone))}` : "";
  if (stage.cap !== null) return `${stage.name} · ${together(`${stage.cap} cupos`)} a ${pesos(stage.price)}${until ? ` o ${until}` : ""}${then}`;
  return [stage.name, pesos(stage.price), until].filter(Boolean).join(" · ") + then;
}

/** The 7 days after the stage before today's closed: «Etapa Creyente agotada» (its cap) or «Etapa Creyente cerrada» (its date). */
export function stagePill(sales: Pick<SalesState, "current" | "previous">, now: Date): string | null {
  const closed = sales.previous;
  if (!sales.current || !closed?.closedAt) return null;
  const since = now.getTime() - closed.closedAt.getTime();
  if (since < 0 || since > CLOSED_PILL_MS) return null;
  return `${closed.stage.name} ${closed.reason === "cap" ? "agotada" : "cerrada"}`;
}

/** Every stage in a sentence, for «¿Por qué sube el precio?» — {{etapas}} in a question's answer:
 * «Etapa Creyente: $90.000, 200 cupos o hasta el 18 de abril, cierre de Nail Fest Cali. Etapa Decidida:
 * $120.000, 300 cupos o hasta el 30 de mayo. Después, $150.000 hasta el día del evento.» */
export function stagesSummary(stages: PriceStage[], timezone: string): string {
  return stages
    .map((stage, i) => {
      if (i > 0 && i === stages.length - 1) return `Después, ${pesos(stage.price)} hasta el día del evento.`;
      const until = stage.closesAt ? `hasta el ${untilDay(stage.closesAt, timezone)}${stage.note ? `, ${stage.note}` : ""}` : "";
      const terms = stage.cap !== null ? `${stage.cap} cupos${until ? ` o ${until}` : ""}` : until;
      return `${stage.name}: ${pesos(stage.price)}${terms ? `, ${terms}` : ""}.`;
    })
    .join(" ");
}
