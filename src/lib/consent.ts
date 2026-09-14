import type { ConsentPurpose } from "@prisma/client";
import { db } from "@/lib/db";

// Ley 1581 (Colombia): consent is per-purpose and revocable, never one
// blanket checkbox. LOGISTICS is required to register at all (it's what
// lets us email the ticket); MARKETING and ADVERTISING are optional and
// gate the broadcast composer / Meta audience sync respectively.

export const REQUIRED_CONSENTS: ConsentPurpose[] = ["LOGISTICS"];
export const OPTIONAL_CONSENTS: ConsentPurpose[] = ["MARKETING", "ADVERTISING", "WHATSAPP"];

export async function recordConsents(params: {
  personId: string;
  registrationId: string;
  granted: Partial<Record<ConsentPurpose, boolean>>;
}) {
  const purposes = Object.keys(params.granted) as ConsentPurpose[];
  await db.$transaction(
    purposes.map((purpose) =>
      db.consent.create({
        data: {
          personId: params.personId,
          registrationId: params.registrationId,
          purpose,
          granted: Boolean(params.granted[purpose]),
        },
      })
    )
  );
}

export async function hasActiveConsent(personId: string, purpose: ConsentPurpose): Promise<boolean> {
  const latest = await db.consent.findFirst({
    where: { personId, purpose },
    orderBy: { grantedAt: "desc" },
  });
  return Boolean(latest?.granted && !latest.revokedAt);
}

/** Same rule as hasActiveConsent (latest row for that purpose, granted
 * and not revoked), but for many people in ONE query instead of one
 * round trip per person — hasActiveConsent in a loop is fine for a
 * handful of people, but a segment of thousands (real Nail Fest segments
 * run in the thousands) turns that into thousands of sequential DB
 * calls, easily minutes long or past a serverless function's timeout.
 * Used anywhere a segment's whole membership needs a consent check at
 * once: the Difusiones pre-send eligibility preview and the broadcast
 * send loop itself. Returns the set of personIds with active consent. */
export async function bulkActiveConsent(personIds: string[], purpose: ConsentPurpose): Promise<Set<string>> {
  if (personIds.length === 0) return new Set();
  const rows = await db.consent.findMany({
    where: { personId: { in: personIds }, purpose },
    orderBy: { grantedAt: "desc" },
    select: { personId: true, granted: true, revokedAt: true },
  });
  // rows are ordered newest-first per the query above, but that order is
  // global, not per-person — keep only the first (= latest) row seen for
  // each personId, same "latest wins" semantics as hasActiveConsent.
  const latestByPerson = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!latestByPerson.has(row.personId)) latestByPerson.set(row.personId, row);
  }
  const active = new Set<string>();
  for (const [personId, row] of latestByPerson) {
    if (row.granted && !row.revokedAt) active.add(personId);
  }
  return active;
}

/** The one place that actually revokes a consent — both the person's own
 * one-click unsubscribe (/api/unsubscribe) and a bounce/spam-complaint
 * webhook (lib/email/tracking.ts's reputation-protection check) call this
 * instead of each writing their own copy. Matches the append-only shape
 * hasActiveConsent/bulkActiveConsent already read ("latest row wins"):
 * closes out the latest row's own revokedAt AND appends a fresh
 * granted:false row, same two writes /api/unsubscribe always did.
 * `registrationId` is left null — a revoke isn't tied to any one
 * registration. Pass `onlyIfActive: true` to skip the write entirely when
 * there's nothing active to revoke — the tracking-webhook caller uses
 * this so a dead address that keeps bouncing on every future send
 * doesn't grow a new Consent row on every single redelivery. */
export async function revokeConsent(
  personId: string,
  purpose: ConsentPurpose,
  opts?: { onlyIfActive?: boolean }
): Promise<void> {
  const latest = await db.consent.findFirst({
    where: { personId, purpose },
    orderBy: { grantedAt: "desc" },
  });
  if (opts?.onlyIfActive && !(latest?.granted && !latest.revokedAt)) return;

  if (latest) {
    await db.consent.update({ where: { id: latest.id }, data: { revokedAt: new Date() } });
  }
  await db.consent.create({
    data: { personId, purpose, granted: false, revokedAt: new Date() },
  });
}

// revokeConsentBulk (a chunked bulk-revoke, built for importing an
// external suppression list) lived here — removed along with
// Supresiones/Etiquetar/Higiene, its only callers. See git history if a
// future bulk-import tool needs it again; revokeConsent above still
// covers the one-person-at-a-time cases (unsubscribe, bounce/complaint
// auto-suppression) that are still live.
