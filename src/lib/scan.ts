import { db } from "@/lib/db";
import { verifyQrToken } from "@/lib/ticket";
import type { ScanResult } from "@prisma/client";

export interface ScanOutcome {
  result: ScanResult;
  personName?: string;
  eventName?: string;
  /** Set only on WRONG_EVENT — the event this ticket actually belongs to. */
  actualEventName?: string;
  previousScanAt?: Date;
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
export async function recordScan(token: string, scannedForEventId: string, scannerLabel?: string): Promise<ScanOutcome> {
  const { valid, registrationId } = verifyQrToken(token);

  if (!valid || !registrationId) {
    await db.scanLog.create({
      data: { token, result: "INVALID_TOKEN", scannedForEventId, scannerLabel },
    });
    return { result: "INVALID_TOKEN" };
  }

  const registration = await db.registration.findUnique({
    where: { id: registrationId },
    include: { person: true, event: true },
  });

  if (!registration) {
    await db.scanLog.create({
      data: { token, result: "NOT_FOUND", scannedForEventId, scannerLabel },
    });
    return { result: "NOT_FOUND" };
  }

  const personName = [registration.person.firstName, registration.person.lastName].filter(Boolean).join(" ") || registration.person.email;

  if (registration.eventId !== scannedForEventId) {
    await db.scanLog.create({
      data: { registrationId, token, result: "WRONG_EVENT", scannedForEventId, scannerLabel },
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
    await db.scanLog.create({
      data: { registrationId, token, result: "VALID_REENTRY", scannedForEventId, scannerLabel },
    });
    return { result: "VALID_REENTRY", personName, eventName: registration.event.name, previousScanAt: previousScan.scannedAt };
  }

  await db.$transaction([
    db.scanLog.create({
      data: { registrationId, token, result: "VALID_FIRST", scannedForEventId, scannerLabel },
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
