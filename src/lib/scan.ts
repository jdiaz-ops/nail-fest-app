import { db } from "@/lib/db";
import { ticketHolderName, verifyQrToken } from "@/lib/ticket";
import type { ScanResult } from "@prisma/client";

// See the comment at its one use below — this is not "how long a re-entry
// takes", it's "how long a single physical scan can visibly linger before
// the next decode of the same still-in-frame QR should count as a new
// event". Real re-entries are minutes away at the soonest; this only needs
// to be longer than any plausible accidental hover.
const SCAN_DEDUP_WINDOW_MS = 60_000;

export interface ScanOutcome {
  result: ScanResult;
  personName?: string;
  eventName?: string;
  /** Set only on WRONG_EVENT — the event this ticket actually belongs to. */
  actualEventName?: string;
  previousScanAt?: Date;
}

export interface RecordScanOptions {
  /** The real/claimed moment of the physical scan — pass this when
   * replaying a scan that happened offline (see lib/offlineScan.ts and
   * /api/admin/scan/sync); omit for a normal live scan, where "now" is
   * correct either way. */
  scannedAt?: Date;
  /** Idempotency key from the client (crypto.randomUUID() at scan time).
   * A dropped connection means the client can't always tell whether its
   * own request already landed before it retries or syncs it — matching
   * on this instead of blindly inserting again is what stops a retried
   * or re-synced scan from creating a second ScanLog row / double-
   * incrementing checkedInCount. */
  clientScanId?: string;
}

/**
 * Verifies a scanned token against the event the scanner is currently set
 * to, logs the attempt either way (see ScanLog's comment on why this is
 * append-only), and — on a first valid scan — bumps checkedInCount so
 * /admin/registrations' aforo number reflects real door traffic.
 *
 * Never throws: a scan is a door-side, real-time interaction, so any
 * failure has to resolve to a result the scanner UI can show, not a 500.
 */
export async function recordScan(
  token: string,
  scannedForEventId: string,
  scannerLabel?: string,
  opts: RecordScanOptions = {}
): Promise<ScanOutcome> {
  const { scannedAt, clientScanId } = opts;

  // Idempotent replay: this exact client-generated attempt was already
  // recorded (e.g. the offline sync retried a batch after a partial
  // failure, or a live request's response never reached the phone but
  // the write did land) — return what actually happened instead of
  // re-processing it, which would double-count a check-in.
  if (clientScanId) {
    const existing = await db.scanLog.findUnique({
      where: { clientScanId },
      include: { registration: { include: { person: true, event: true } } },
    });
    if (existing) {
      const titular = existing.registration
        ? [existing.registration.person.firstName, existing.registration.person.lastName].filter(Boolean).join(" ") ||
          existing.registration.person.email
        : undefined;
      return {
        result: existing.result,
        personName: titular ? ticketHolderName(titular, verifyQrToken(existing.token).ticketNumber ?? 1) : undefined,
        eventName: existing.registration?.event.name,
      };
    }
  }

  const { valid, registrationId, ticketNumber = 1 } = verifyQrToken(token);

  if (!valid || !registrationId) {
    await db.scanLog.create({
      data: { token, result: "INVALID_TOKEN", scannedForEventId, scannerLabel, scannedAt, clientScanId },
    });
    return { result: "INVALID_TOKEN" };
  }

  const registration = await db.registration.findUnique({
    where: { id: registrationId },
    include: { person: true, event: true },
  });

  // A ticket number past the order's own count (e.g. the order was later
  // edited down from 2 tickets to 1) is not a ticket that exists anymore.
  if (!registration || ticketNumber > registration.ticketCount) {
    await db.scanLog.create({
      data: { token, result: "NOT_FOUND", scannedForEventId, scannerLabel, scannedAt, clientScanId },
    });
    return { result: "NOT_FOUND" };
  }

  const personName = ticketHolderName(
    [registration.person.firstName, registration.person.lastName].filter(Boolean).join(" ") || registration.person.email,
    ticketNumber
  );

  if (registration.eventId !== scannedForEventId) {
    await db.scanLog.create({
      data: { registrationId, token, result: "WRONG_EVENT", scannedForEventId, scannerLabel, scannedAt, clientScanId },
    });
    return { result: "WRONG_EVENT", personName, actualEventName: registration.event.name };
  }

  // Same TICKET scanned before → re-entry, not an error. Per ticket, not
  // per registration: the acompañante's own QR entering after the titular
  // is a first entry of its own, and counts toward checkedInCount. Look up
  // the most recent prior VALID_FIRST/VALID_REENTRY of this exact token so
  // the UI can show "ya había entrado a las HH:MM" instead of a checkmark.
  // An undo (CHECKIN_UNDONE, see undoCheckIn below) after the last valid
  // scan means this ticket is NOT in: the next scan is a first entry again.
  const latestRelevant = await db.scanLog.findFirst({
    where: { registrationId, token, result: { in: ["VALID_FIRST", "VALID_REENTRY", "CHECKIN_UNDONE"] } },
    orderBy: { scannedAt: "desc" },
  });
  const previousScan = latestRelevant && latestRelevant.result !== "CHECKIN_UNDONE" ? latestRelevant : null;

  if (previousScan) {
    // Real-world case caught in testing: a staff member holds the phone
    // steady over a QR that already scanned successfully (helping the next
    // person, distracted, etc.). The client only debounces 2.5s of the SAME
    // decode loop staying on screen (ScannerTab.tsx's RESCAN_COOLDOWN_MS) —
    // past that it treats each decode as a brand-new scan, with a fresh
    // clientScanId every time, so the earlier idempotency check above never
    // catches it. Left unguarded, that logs a fresh VALID_REENTRY roughly
    // every 2.5s for as long as the phone sits there — inflating reingreso
    // counts and cluttering the check-in history with scans that never
    // happened. A genuine re-entry (someone actually leaving and coming
    // back) is realistically minutes away at the soonest, so anything this
    // close to the last logged scan for the SAME registration is almost
    // certainly the same physical moment repeated, not a new one: report it
    // exactly like the real scan that started it, but don't write a second
    // row for it.
    const effectiveNow = scannedAt ?? new Date();
    const isLikelySameLingeringScan = effectiveNow.getTime() - previousScan.scannedAt.getTime() < SCAN_DEDUP_WINDOW_MS;
    if (!isLikelySameLingeringScan) {
      await db.scanLog.create({
        data: { registrationId, token, result: "VALID_REENTRY", scannedForEventId, scannerLabel, scannedAt, clientScanId },
      });
    }
    return { result: "VALID_REENTRY", personName, eventName: registration.event.name, previousScanAt: previousScan.scannedAt };
  }

  await db.$transaction([
    db.scanLog.create({
      data: { registrationId, token, result: "VALID_FIRST", scannedForEventId, scannerLabel, scannedAt, clientScanId },
    }),
    // Capped at ticketCount: each ticket's token can only take this branch
    // once (a second scan of it is VALID_REENTRY above), and tokens past
    // ticketCount are rejected as NOT_FOUND — see the ScanLog model comment.
    db.registration.update({
      where: { id: registrationId },
      data: {
        checkedInCount: { increment: 1 },
        // They'd written they couldn't make it and came anyway: they're
        // here, so they count again (see lib/registrationWithdrawal.ts).
        ...(registration.status === "CANCELLED" && registration.cancelledAt ? { status: "CONFIRMED" as const, cancelledAt: null, cancelledById: null } : {}),
      },
    }),
  ]);

  return { result: "VALID_FIRST", personName, eventName: registration.event.name };
}

export type UndoCheckInOutcome = { ok: true; personName?: string } | { ok: false; reason: "invalid_token" | "not_found" | "wrong_event" | "not_checked_in" };

/**
 * Undoes one ticket's check-in — a test scan by the team, a tap on the
 * wrong person at the door — so the aforo numbers stay honest. Appends a
 * CHECKIN_UNDONE row (nothing is deleted) and takes one off the
 * registration's checkedInCount; the next scan of this ticket is a first
 * entry again (see recordScan). Also undoes a count that came from an
 * imported doorlist with no scan row behind it.
 */
export async function undoCheckIn(token: string, scannedForEventId: string, scannerLabel?: string): Promise<UndoCheckInOutcome> {
  const { valid, registrationId, ticketNumber = 1 } = verifyQrToken(token);
  if (!valid || !registrationId) return { ok: false, reason: "invalid_token" };
  const registration = await db.registration.findUnique({ where: { id: registrationId }, include: { person: true } });
  if (!registration || ticketNumber > registration.ticketCount) return { ok: false, reason: "not_found" };
  if (registration.eventId !== scannedForEventId) return { ok: false, reason: "wrong_event" };

  const latestRelevant = await db.scanLog.findFirst({
    where: { registrationId, token, result: { in: ["VALID_FIRST", "VALID_REENTRY", "CHECKIN_UNDONE"] } },
    orderBy: { scannedAt: "desc" },
    select: { result: true },
  });
  const inByScan = Boolean(latestRelevant && latestRelevant.result !== "CHECKIN_UNDONE");
  if (!inByScan && registration.checkedInCount <= 0) return { ok: false, reason: "not_checked_in" };

  await db.$transaction([
    db.scanLog.create({ data: { registrationId, token, result: "CHECKIN_UNDONE", scannedForEventId, scannerLabel } }),
    db.registration.updateMany({ where: { id: registrationId, checkedInCount: { gt: 0 } }, data: { checkedInCount: { decrement: 1 } } }),
  ]);
  const personName = ticketHolderName(
    [registration.person.firstName, registration.person.lastName].filter(Boolean).join(" ") || registration.person.email,
    ticketNumber
  );
  return { ok: true, personName };
}

/** Tokens currently checked in: those whose latest VALID_FIRST /
 * CHECKIN_UNDONE row is the former. One query, any number of tickets. */
async function checkedInTokensWhere(where: { registration?: { eventId: string }; registrationId?: { in: string[] } }): Promise<Set<string>> {
  const rows = await db.scanLog.findMany({
    where: { ...where, result: { in: ["VALID_FIRST", "CHECKIN_UNDONE"] } },
    orderBy: { scannedAt: "asc" },
    select: { token: true, result: true },
  });
  const state = new Map<string, boolean>();
  for (const r of rows) state.set(r.token, r.result === "VALID_FIRST");
  return new Set([...state.entries()].filter(([, on]) => on).map(([t]) => t));
}

export function checkedInTokensForEvent(eventId: string): Promise<Set<string>> {
  return checkedInTokensWhere({ registration: { eventId } });
}

export function checkedInTokensForRegistrations(registrationIds: string[]): Promise<Set<string>> {
  if (registrationIds.length === 0) return Promise.resolve(new Set());
  return checkedInTokensWhere({ registrationId: { in: registrationIds } });
}

/** Valid door scans (first entries and re-entries) of an event, leaving
 * out any scan a later undo cancelled — what the hour-of-day charts
 * should count. */
export async function entryScansForEvent(eventId: string): Promise<{ scannedAt: Date; result: "VALID_FIRST" | "VALID_REENTRY" }[]> {
  const rows = await db.scanLog.findMany({
    where: { scannedForEventId: eventId, result: { in: ["VALID_FIRST", "VALID_REENTRY", "CHECKIN_UNDONE"] } },
    orderBy: { scannedAt: "asc" },
    select: { token: true, result: true, scannedAt: true },
  });
  const undoneAfter = new Map<string, Date[]>();
  for (const r of rows) if (r.result === "CHECKIN_UNDONE") undoneAfter.set(r.token, [...(undoneAfter.get(r.token) ?? []), r.scannedAt]);
  return rows
    .filter((r) => r.result !== "CHECKIN_UNDONE" && !(undoneAfter.get(r.token) ?? []).some((u) => u.getTime() >= r.scannedAt.getTime()))
    .map((r) => ({ scannedAt: r.scannedAt, result: r.result as "VALID_FIRST" | "VALID_REENTRY" }));
}
