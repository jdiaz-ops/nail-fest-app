import { CHUNK_WATCHDOG_SECONDS } from "@/lib/qstash";

/** A send that says SENDING but nobody is working: no invocation holds
 * its lock and the watchdog that should have picked it up hasn't (its
 * delay plus a margin has passed since the lock expired). Only then is
 * the manual "Reanudar envío" worth showing — otherwise the chunk
 * continuation / watchdog (lib/qstash.ts) is already on it. */
export function isBroadcastStuck(b: { status: string; lockedUntil: Date | null }, now: Date = new Date()): boolean {
  if (b.status !== "SENDING") return false;
  // Between chunks the lock is briefly null while the continuation lands;
  // with no timestamp to judge by, lean on the watchdog: a send that is
  // genuinely dead has an EXPIRED lock (the dying invocation's claim),
  // never a null one.
  if (!b.lockedUntil) return false;
  return now.getTime() - b.lockedUntil.getTime() > (CHUNK_WATCHDOG_SECONDS + 90) * 1000;
}
