// Manicuristas Imparables' price stages (2026-10-26): each stage is one of
// the event's own ticket types with its dates (TicketType.hideUntil /
// hideAfter) — Preventa 27 feb – 31 mar, General 1 abr – 20 jun, Última
// semana 21 – 26 jun — so the price on sale is always the one whose dates
// hold today; getPublicTicketTypes (lib/ticketTypes.ts) already offers only
// that one in the checkout. From the same rows the page tells what it costs
// today, what comes next and when — or, before the first stage opens, when
// the sale opens (the waiting list).

import { utcToZonedInputValue } from "@/lib/dateFormat";

export interface StageTicketType {
  id: string;
  name: string;
  price: number;
  status: string;
  hideUntil: Date | null;
  hideAfter: Date | null;
  /** Tickets left: quantity minus the confirmed ones. */
  remaining: number;
  order: number;
}

export type StageState = "past" | "current" | "soldout" | "future";

export interface PriceStage {
  id: string;
  name: string;
  price: number;
  opensAt: Date | null;
  closesAt: Date | null;
  state: StageState;
}

/** "sale": a price is on sale today. "waitlist": the first one opens later. "closed": none left to open. */
export type SalesMode = "sale" | "waitlist" | "closed";

export interface SalesState {
  mode: SalesMode;
  /** Every ticket type on sale (status ON_SALE), in the order its dates come. */
  stages: PriceStage[];
  /** Today's price: the cheapest one open with tickets left. */
  current: PriceStage | null;
  /** The first one still to open. */
  next: PriceStage | null;
  countdown: { to: Date; label: string } | null;
}

export function salesState(types: StageTicketType[], now: Date, eventStartsAt: Date): SalesState {
  const stages = types
    .filter((t) => t.status === "ON_SALE")
    .sort((a, b) => (a.hideUntil?.getTime() ?? -Infinity) - (b.hideUntil?.getTime() ?? -Infinity) || a.order - b.order)
    .map((t): PriceStage => {
      const state: StageState =
        t.hideAfter && now > t.hideAfter ? "past" : t.hideUntil && now < t.hideUntil ? "future" : t.remaining > 0 ? "current" : "soldout";
      return { id: t.id, name: t.name, price: t.price, opensAt: t.hideUntil, closesAt: t.hideAfter, state };
    });

  const open = stages.filter((s) => s.state === "current");
  const current = open.length ? open.reduce((cheapest, s) => (s.price < cheapest.price ? s : cheapest)) : null;
  const next = stages.filter((s) => s.state === "future").sort((a, b) => a.opensAt!.getTime() - b.opensAt!.getTime())[0] ?? null;
  const mode: SalesMode = current ? "sale" : next ? "waitlist" : "closed";

  let countdown: SalesState["countdown"] = null;
  if (current) {
    // Until the price goes up; with no price after this one, until the congress starts.
    if (next && current.closesAt) countdown = { to: current.closesAt, label: "Este precio termina en" };
    else if (eventStartsAt > now) countdown = { to: eventStartsAt, label: "El congreso empieza en" };
  } else if (next) {
    countdown = { to: next.opensAt!, label: "La venta abre en" };
  }
  return { mode, stages, current, next, countdown };
}

// ── How it reads ────────────────────────────────────────────────────────────

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** 79900 -> "$79.900", the same way everywhere (not left to the runtime's locale data). */
export function pesos(amount: number): string {
  return `$${String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
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

/** "1 abr" */
function shortDay(date: Date, timezone: string): { day: number; month: string; monthIndex: number } {
  const d = localDate(date, timezone);
  return { day: d.day, month: MONTHS[d.month]!.slice(0, 3), monthIndex: d.month };
}

/** A stage's last day is the one before the instant it closes (it closes at midnight). */
function lastDay(closesAt: Date): Date {
  return new Date(closesAt.getTime() - 60_000);
}

/** "27 feb – 31 mar", "21 – 26 jun", "hasta 31 mar", "desde 27 feb". */
export function stageDates(stage: Pick<PriceStage, "opensAt" | "closesAt">, timezone: string): string {
  const from = stage.opensAt ? shortDay(stage.opensAt, timezone) : null;
  const to = stage.closesAt ? shortDay(lastDay(stage.closesAt), timezone) : null;
  if (from && to) return from.monthIndex === to.monthIndex ? `${from.day} – ${to.day} ${to.month}` : `${from.day} ${from.month} – ${to.day} ${to.month}`;
  if (to) return `hasta ${to.day} ${to.month}`;
  if (from) return `desde ${from.day} ${from.month}`;
  return "";
}

/** Whole calendar days between two instants' dates in `timezone` (0 = same day). */
function calendarDays(from: Date, to: Date, timezone: string): number {
  const a = localDate(from, timezone);
  const b = localDate(to, timezone);
  return Math.round((Date.UTC(b.year, b.month, b.day) - Date.UTC(a.year, a.month, a.day)) / 86_400_000);
}

/** "en 30 días", "mañana", "hoy". */
export function inDays(to: Date, now: Date, timezone: string): string {
  const days = calendarDays(now, to, timezone);
  return days >= 2 ? `en ${days} días` : days === 1 ? "mañana" : "hoy";
}
