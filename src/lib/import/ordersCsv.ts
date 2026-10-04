// Parses Ticket Tailor's ORDERS export (Orders → Export — one row per order,
// with "Order date") — the one export that says WHEN each person signed up.
// The doorlist export (doorlistCsv.ts) has who and who checked in, but no
// date at all, so every imported registration was stamped with the import
// day instead. This file only carries the date back: one entry per email,
// matched on the server to the registration the doorlist import created.
// Pure functions, no DB — runs in the browser for the preview.

import { parseCsv } from "@/lib/import/doorlistCsv";

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n: number) => String(n).padStart(2, "0");

/** "Jun 8, 2026 12:29 AM" (or "Sat Aug 1, 2026 10:00 AM") -> "2026-06-08T00:29"
 * — still wall-clock time in the box office's timezone (Colombia for us);
 * the server converts it with the org's timezone. Null when unreadable. */
export function parseTicketTailorDate(raw: string): string | null {
  const m = raw.trim().match(/^(?:[A-Za-z]{3},?\s+)?([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
  if (m) {
    const month = MONTHS[m[1]!.toLowerCase()];
    if (!month) return null;
    let hour = Number(m[4]) % 12;
    if (m[6]!.toLowerCase() === "pm") hour += 12;
    return `${m[3]}-${pad(month)}-${pad(Number(m[2]))}T${pad(hour)}:${m[5]}`;
  }
  // ISO-ish fallback ("2026-06-08 00:29:00") in case an export uses it.
  const iso = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}T${iso[4]}:${iso[5]}` : null;
}

export interface OrderDateEntry {
  email: string;
  cedula: string | null;
  // Earliest order of this email — when they first signed up. Someone who
  // ordered twice (a second ticket later) still signed up on the first.
  orderedAtLocal: string;
}

export interface OrdersParseResult {
  entries: OrderDateEntry[];
  orders: number;
  tickets: number;
  skippedCancelled: number;
  skippedNoEmail: number;
  skippedBadDate: number;
  eventNames: string[];
  // The file's own "Event start" (local), to warn when it doesn't match
  // the event picked in the importer.
  eventStartLocal: string | null;
  firstOrderLocal: string | null;
  lastOrderLocal: string | null;
  // True when the header has no "Order date" column at all — e.g. someone
  // uploaded the doorlist export here by mistake.
  missingDateColumn: boolean;
}

export function parseOrdersCsv(text: string): OrdersParseResult {
  const table = parseCsv(text);
  const header = (table[0] ?? []).map((h) => h.trim());
  const col = (name: string) => header.indexOf(name);
  const iDate = col("Order date");
  const iEmail = col("Email") >= 0 ? col("Email") : col("Email address");
  const iCancelled = col("Order cancelled");
  const iTickets = col("Tickets purchased");
  const iEvent = col("Event name");
  const iStart = col("Event start");
  const iCedula = header.findIndex((h) => /c[ée]dula|documento de identidad/i.test(h));

  const result: OrdersParseResult = {
    entries: [],
    orders: 0,
    tickets: 0,
    skippedCancelled: 0,
    skippedNoEmail: 0,
    skippedBadDate: 0,
    eventNames: [],
    eventStartLocal: null,
    firstOrderLocal: null,
    lastOrderLocal: null,
    missingDateColumn: iDate < 0,
  };
  if (iDate < 0) return result;

  const byEmail = new Map<string, OrderDateEntry>();
  const eventNames = new Set<string>();
  for (const row of table.slice(1)) {
    if (row.length <= 1 && (row[0] ?? "").trim() === "") continue;
    const get = (i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");
    result.orders++;
    if (get(iCancelled) && get(iCancelled) !== "0") {
      result.skippedCancelled++;
      continue;
    }
    result.tickets += Number(get(iTickets)) || 0;
    if (get(iEvent)) eventNames.add(get(iEvent));
    if (!result.eventStartLocal && get(iStart)) result.eventStartLocal = parseTicketTailorDate(get(iStart));
    const email = get(iEmail).toLowerCase();
    if (!email) {
      result.skippedNoEmail++;
      continue;
    }
    const orderedAtLocal = parseTicketTailorDate(get(iDate));
    if (!orderedAtLocal) {
      result.skippedBadDate++;
      continue;
    }
    // Same normalization as the doorlist import's stored cédula, so the
    // server's cédula fallback compares like with like.
    const cedula = get(iCedula).replace(/\D/g, "").replace(/^0+/, "") || null;
    const prev = byEmail.get(email);
    // "YYYY-MM-DDTHH:mm" strings sort chronologically as plain text.
    if (!prev || orderedAtLocal < prev.orderedAtLocal) byEmail.set(email, { email, cedula: cedula ?? prev?.cedula ?? null, orderedAtLocal });
    else if (!prev.cedula && cedula) prev.cedula = cedula;
  }
  result.entries = [...byEmail.values()];
  result.eventNames = [...eventNames];
  const dates = result.entries.map((e) => e.orderedAtLocal).sort();
  result.firstOrderLocal = dates[0] ?? null;
  result.lastOrderLocal = dates[dates.length - 1] ?? null;
  return result;
}
