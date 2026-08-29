import { db } from "@/lib/db";
import { verifyQrToken } from "@/lib/ticket";
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
      return {
        result: existing.result,
        personName: existing.registration
          ? [existing.registration.person.firstName, existing.registration.person.lastName].filter(Boolean).join(" ") ||
            existing.registration.person.email
          : undefined,
        eventName: existing.registration?.event.name,
      };
    }
  }

  const { valid, registrationId } = verifyQrToken(token);

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

  if (!registration) {
    await db.scanLog.create({
      data: { token, result: "NOT_FOUND", scannedForEventId, scannerLabel, scannedAt, clientScanId },
    });
    return { result: "NOT_FOUND" };
  }

  const personName = [registration.person.firstName, registration.person.lastName].filter(Boolean).join(" ") || registration.person.email;

  if (registration.eventId !== scannedForEventId) {
    await db.scanLog.create({
      data: { registrationId, token, result: "WRONG_EVENT", scannedForEventId, scannerLabel, scannedAt, clientScanId },
    });
    return { result: "WRONG_EVENT", personName, actualEventName: registration.event.name };
  }

  // Same registration scanned before → re-entry, not an error. Look up the
  // most recent prior VALID_FIRST/VALID_REENTRY for this registration so the
  // UI can show "ya había entrado a las HH:MM" instead of just a checkmark.
  const previousScan = await db.scanLog.findFirst({
    where: { registrationId, result: { in: ["VALID_FIRST", "VALID_REENTRY"] } },
    orderBy: { scannedAt: "desc" },
  });

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
    // Capped at ticketCount by the fact that a second scan of the same
    // registration always takes the VALID_REENTRY branch above, never this
    // one — see the ScanLog model comment.
    db.registration.update({
      where: { id: registrationId },
      data: { checkedInCount: { increment: 1 } },
    }),
  ]);

  return { result: "VALID_FIRST", personName, eventName: registration.event.name };
}
