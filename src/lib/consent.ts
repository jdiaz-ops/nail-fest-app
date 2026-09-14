import { Prisma, type ConsentPurpose } from "@prisma/client";
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

/** Same write as revokeConsent, for many people at once — built for
 * importing an external suppression list (e.g. a previous ESP's own
 * bounced/complained/unsubscribed export, from before this app ever sent
 * a single email) where looping revokeConsent one person at a time would
 * mean two round trips PER person; at a few thousand people that's
 * minutes, easily past a serverless function's timeout. Two queries
 * total instead: one UPDATE closes out whichever row is each person's
 * current latest for this purpose (only the latest one can be "active"
 * per hasActiveConsent's own read rule), one bulk INSERT appends the
 * fresh granted:false row for every person named — same two-write shape
 * revokeConsent always does, just batched. Idempotent to call again
 * later with an overlapping list: a person with no active row just gets
 * another harmless revoked row appended. */
export async function revokeConsentBulk(personIds: string[], purpose: ConsentPurpose): Promise<void> {
  if (personIds.length === 0) return;
  const now = new Date();

  await db.$executeRaw(Prisma.sql`
    UPDATE "Consent" c
    SET "revokedAt" = ${now}
    FROM (
      SELECT DISTINCT ON ("personId") id
      FROM "Consent"
      WHERE "personId" IN (${Prisma.join(personIds)}) AND purpose = ${purpose}::"ConsentPurpose"
      ORDER BY "personId", "grantedAt" DESC
    ) latest
    WHERE c.id = latest.id
  `);

  await db.consent.createMany({
    data: personIds.map((personId) => ({ personId, purpose, granted: false, revokedAt: now })),
  });
}

/** Just the person ids — the part every "actual reachable pool for a
 * channel" query below shares (everyone whose LATEST Consent row for
 * this purpose is granted and not revoked, same rule as
 * hasActiveConsent/bulkActiveConsent). Kept separate from the chunked
 * findMany step so each caller selects only the column it actually needs
 * (email for the email-quality checker, phone for the phone-quality one)
 * instead of duplicating this same DISTINCT ON query per column. */
async function getActiveConsentPersonIds(purpose: ConsentPurpose): Promise<string[]> {
  const rows = await db.$queryRaw<Array<{ personId: string }>>(Prisma.sql`
    SELECT "personId" FROM (
      SELECT DISTINCT ON ("personId") "personId", granted, "revokedAt"
      FROM "Consent"
      WHERE purpose = ${purpose}::"ConsentPurpose"
      ORDER BY "personId", "grantedAt" DESC
    ) latest
    WHERE granted = true AND "revokedAt" IS NULL
  `);
  return rows.map((r) => r.personId);
}

/** The actual reachable pool for a channel, returned as {id, email}
 * instead of just a count — for anything that needs to actually DO
 * something with that list (the "Con consentimiento de marketing" tile
 * only needed the count; the email-quality checker in
 * lib/email/qualityCheck.ts needs the real addresses). A 40k+ IN-list in
 * one shot is one raw query away from awkward, chunking it is one extra
 * loop for a lot less risk. */
export async function getActiveConsentEmails(purpose: ConsentPurpose): Promise<{ id: string; email: string }[]> {
  const personIds = await getActiveConsentPersonIds(purpose);

  const CHUNK_SIZE = 2000;
  const people: { id: string; email: string }[] = [];
  for (let i = 0; i < personIds.length; i += CHUNK_SIZE) {
    const chunk = personIds.slice(i, i + CHUNK_SIZE);
    const rowsChunk = await db.person.findMany({ where: { id: { in: chunk } }, select: { id: true, email: true } });
    people.push(...rowsChunk);
  }
  return people;
}

/** Same idea, for the phone-quality checker — everyone with active
 * consent for this purpose, with whatever phone they have on file,
 * INCLUDING null/empty ones on purpose: "this person has consent but
 * nothing we could actually message them on" is itself one of the
 * findings that checker reports. */
export async function getActiveConsentPhones(purpose: ConsentPurpose): Promise<{ id: string; phone: string | null }[]> {
  const personIds = await getActiveConsentPersonIds(purpose);

  const CHUNK_SIZE = 2000;
  const people: { id: string; phone: string | null }[] = [];
  for (let i = 0; i < personIds.length; i += CHUNK_SIZE) {
    const chunk = personIds.slice(i, i + CHUNK_SIZE);
    const rowsChunk = await db.person.findMany({ where: { id: { in: chunk } }, select: { id: true, phone: true } });
    people.push(...rowsChunk);
  }
  return people;
}
