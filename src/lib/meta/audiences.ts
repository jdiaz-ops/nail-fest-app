import type { ConsentPurpose } from "@prisma/client";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { hashEmail, hashPhone } from "@/lib/hashing";
import { resolveSegment, type SegmentFilter } from "@/lib/segments/builder";

const GRAPH_VERSION = "v21.0";

async function getConnection() {
  const conn = await db.metaConnection.findFirst({ orderBy: { createdAt: "desc" } });
  if (!conn) throw new Error("No MetaConnection configured — see docs/META_SETUP.md.");
  return { ...conn, token: decryptSecret(conn.systemUserTokenEnc) };
}

async function graphFetch(path: string, token: string, init?: RequestInit) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Meta Graph API ${res.status} on ${path}: ${JSON.stringify(json)}`);
  return json;
}

/**
 * Website-rule audiences (Landing visitors, Checkout started): created ONCE
 * — Meta auto-populates them from the Pixel/CAPI events we're already
 * sending. There is no per-user "sync" step for these; sending the events
 * IS the sync.
 *
 * Lookup is by `baseName` (a stable label, e.g. "Nail Fest — Landing
 * visitors"), NOT the full display name — the display name bakes in the
 * retention window (e.g. "(180d)") so it stays accurate, but if that
 * changes we want to UPDATE the existing audience in place (keeping its id
 * and accumulated population/match score), not create a duplicate that
 * starts "Populating" from zero.
 */
export async function ensureWebsiteAudience(params: {
  baseName: string;
  eventName: "PageView" | "InitiateCheckout";
  retentionDays: number;
  /** Set for "started X but never finished" audiences (e.g. carritos
   * abandonados = InitiateCheckout minus Purchase) — still 100% pixel-side,
   * no personal data of ours ever leaves for this one either. Unlike the
   * two include-only rules above (each individually confirmed against a
   * live ad account), this `exclusions` block follows Meta's documented
   * rule_v2 shape but hasn't been confirmed live yet — if Meta rejects the
   * syntax, this seed audience fails independently (see the `attempt()`
   * wrapper below) without blocking Landing visitors/Checkout started/
   * Purchasers. */
  excludeEventName?: "Purchase";
}): Promise<string> {
  const conn = await getConnection();
  const displayName = `${params.baseName} (${params.retentionDays}d)`;
  const retentionSeconds = params.retentionDays * 24 * 60 * 60;

  const rule = JSON.stringify({
    inclusions: {
      operator: "or",
      rules: [
        {
          event_sources: [{ type: "pixel", id: conn.pixelId }],
          retention_seconds: retentionSeconds,
          filter: {
            operator: "and",
            filters: [{ field: "event", operator: "=", value: params.eventName }],
          },
        },
      ],
    },
    ...(params.excludeEventName && {
      exclusions: {
        operator: "or",
        rules: [
          {
            event_sources: [{ type: "pixel", id: conn.pixelId }],
            retention_seconds: retentionSeconds,
            filter: {
              operator: "and",
              filters: [{ field: "event", operator: "=", value: params.excludeEventName }],
            },
          },
        ],
      },
    }),
  });

  const existing = await graphFetch(
    `act_${conn.adAccountId}/customaudiences?fields=id,name&limit=200`,
    conn.token
  );
  const found = (existing.data as Array<{ id: string; name: string }> | undefined)?.find(
    (a) => a.name === displayName || a.name.startsWith(`${params.baseName} (`)
  );

  if (found) {
    if (found.name !== displayName) {
      // Same audience, retention window changed since last run — update in
      // place rather than duplicate.
      await graphFetch(found.id, conn.token, {
        method: "POST",
        body: JSON.stringify({ name: displayName, rule, retention_days: params.retentionDays }),
      });
    }
    return found.id;
  }

  const created = await graphFetch(`act_${conn.adAccountId}/customaudiences`, conn.token, {
    method: "POST",
    body: JSON.stringify({
      name: displayName,
      // No `subtype` — confirmed against a live account that the API
      // rejects it outright ("parameter 'subtype' is not supported").
      // Type is inferred from `rule` (website-rule audience) instead.
      customer_file_source: "USER_PROVIDED_ONLY",
      retention_days: params.retentionDays,
      // Modern "rule_v2" schema — the flat `{"event":{"eq":...}}` shape is
      // what Meta rejected as "too old". This nested inclusions/rules/filter
      // shape is the current format; the pixel and lookback window now live
      // inside the rule itself (event_sources / retention_seconds) instead
      // of as top-level `pixel_id`.
      rule,
    }),
  });
  return created.id as string;
}

/**
 * Customer-list audience (Purchasers, and any CRM segment from the segment
 * builder): NOT auto-populated — this is the one that needs an explicit
 * batch upload of hashed identifiers. Meta dedupes on ingest as long as
 * hashing is normalized consistently (see lib/hashing.ts).
 */
export async function ensureCustomerListAudience(params: {
  name: string;
  retentionDays: number;
}): Promise<string> {
  const conn = await getConnection();

  const existing = await graphFetch(
    `act_${conn.adAccountId}/customaudiences?fields=id,name&limit=200`,
    conn.token
  );
  const found = (existing.data as Array<{ id: string; name: string }> | undefined)?.find(
    (a) => a.name === params.name
  );
  if (found) return found.id;

  const created = await graphFetch(`act_${conn.adAccountId}/customaudiences`, conn.token, {
    method: "POST",
    body: JSON.stringify({
      name: params.name,
      // Unlike the rule_v2 audiences above (where Meta infers the type from
      // the rule and rejects an explicit `subtype`), a customer-list
      // audience has no rule to infer from — Meta requires `subtype` here
      // ("(#100) Missing parameter(s): subtype", confirmed live).
      subtype: "CUSTOM",
      customer_file_source: "USER_PROVIDED_ONLY",
      retention_days: params.retentionDays,
    }),
  });
  return created.id as string;
}

const UPLOAD_BATCH_SIZE = 10_000; // Meta's per-request cap on /users

export async function syncPeopleToAudience(
  audienceId: string,
  people: Array<{ email?: string | null; phone?: string | null }>
): Promise<{ batches: number }> {
  const conn = await getConnection();

  const rows = people
    .map((p) => [p.email ? hashEmail(p.email) : "", p.phone ? hashPhone(p.phone) : ""])
    .filter(([em, ph]) => em || ph);

  let batches = 0;
  for (let i = 0; i < rows.length; i += UPLOAD_BATCH_SIZE) {
    const chunk = rows.slice(i, i + UPLOAD_BATCH_SIZE);
    await graphFetch(`${audienceId}/users`, conn.token, {
      method: "POST",
      body: JSON.stringify({
        payload: {
          schema: ["EMAIL", "PHONE"],
          data: chunk,
        },
      }),
    });
    batches++;
  }
  return { batches };
}

type SeedAudienceResult = { id: string } | { error: string };

async function attempt(fn: () => Promise<string>): Promise<SeedAudienceResult> {
  try {
    return { id: await fn() };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * The seed audiences from the brief — call once during setup (also
 * re-run daily by the cron, see /api/meta/sync-audiences). Each is
 * attempted independently so one failing (website-rule audiences are
 * hitting a Graph API rule-syntax version mismatch as of this writing —
 * see docs/META_SETUP.md) doesn't block the others, notably Purchasers,
 * which doesn't use `rule` at all and is the one that actually needs to
 * stay in sync automatically.
 */
export async function ensureSeedAudiences() {
  const landing = await attempt(() =>
    ensureWebsiteAudience({
      baseName: "Nail Fest — Landing visitors",
      eventName: "PageView",
      retentionDays: 180,
    })
  );
  const checkout = await attempt(() =>
    ensureWebsiteAudience({
      baseName: "Nail Fest — Checkout started",
      eventName: "InitiateCheckout",
      retentionDays: 180,
    })
  );
  // Real cart abandoners: reached checkout but never completed it. Pixel-only
  // (InitiateCheckout minus Purchase), same as Landing visitors/Checkout
  // started above — deliberately NOT a customer-list upload of these
  // people's real email/phone. Someone in this group never submitted the
  // registration form, so they never granted ANY consent (see the comment
  // in /admin/crm/abandonados) — sending their identifiers to Meta would
  // have no Ley 1581 basis, unlike Purchasers below which only includes
  // people who did consent.
  const abandonedCarts = await attempt(() =>
    ensureWebsiteAudience({
      baseName: "Nail Fest — Carritos abandonados",
      eventName: "InitiateCheckout",
      excludeEventName: "Purchase",
      retentionDays: 180,
    })
  );
  const purchasers = await attempt(() =>
    ensureCustomerListAudience({
      name: "Nail Fest — Purchasers (180d)",
      retentionDays: 180,
    })
  );

  // Purchasers is a customer-list audience — unlike the rule_v2 audiences
  // above, Meta doesn't auto-populate it. Sync it right after
  // creating/finding it, so clicking this button once actually leaves it
  // with members instead of "Ready" but empty.
  let purchasersSync: SeedAudienceResult | undefined;
  if ("id" in purchasers) {
    purchasersSync = await attempt(async () => {
      const people = await getAdvertisingConsentedPurchasers();
      const { batches } = await syncPeopleToAudience(purchasers.id, people);
      return `${people.length} personas, ${batches} lote(s)`;
    });
  }

  return { landing, checkout, abandonedCarts, purchasers, purchasersSync };
}

/**
 * Filters a list of people down to those who granted (and haven't revoked)
 * consent for the given purpose — the gate that decides who's allowed to
 * be sent to Meta for ad targeting (Ley 1581 purpose separation, same rule
 * used for the CAPI Purchase event in /api/register). One bulk query + an
 * in-memory "latest consent per person" reduction instead of
 * hasActiveConsent() in a loop, since this can run over 10,000+ people.
 */
async function filterByActiveConsent<T extends { id: string }>(
  people: T[],
  purpose: ConsentPurpose
): Promise<T[]> {
  if (people.length === 0) return [];

  const consents = await db.consent.findMany({
    where: { personId: { in: people.map((p) => p.id) }, purpose },
    orderBy: { grantedAt: "desc" },
    select: { personId: true, granted: true, revokedAt: true },
  });

  const latestByPerson = new Map<string, { granted: boolean; revokedAt: Date | null }>();
  for (const c of consents) {
    if (!latestByPerson.has(c.personId)) latestByPerson.set(c.personId, c);
  }

  return people.filter((p) => {
    const latest = latestByPerson.get(p.id);
    return latest?.granted && !latest.revokedAt;
  });
}

async function getAdvertisingConsentedPurchasers(): Promise<
  Array<{ email: string; phone: string | null }>
> {
  const confirmed = await db.person.findMany({
    where: { registrations: { some: { status: "CONFIRMED" } } },
    select: { id: true, email: true, phone: true },
  });
  return filterByActiveConsent(confirmed, "ADVERTISING");
}

/**
 * Full resync of ONE segment's Meta Custom Audience — resolve the filter,
 * keep only ADVERTISING-consented people, upsert the audience, upload the
 * whole current member list. Called from three places: the cron loop
 * below (syncAllSegmentAudiences), immediately after a segment is created
 * in /admin/segments (so the audience exists right away, not after up to a
 * day's wait for the cron), and nowhere else — this is the "full resync"
 * path; pushNewRegistrantToEventAudiences() below is the cheap incremental
 * path used on every new registration instead of calling this per-person.
 */
export async function syncSegmentAudience(
  segmentId: string
): Promise<{ status: "OK"; audienceId: string; memberCount: number } | { status: "ERROR"; error: string }> {
  const link = await db.segmentMetaSync.findUnique({ where: { segmentId }, include: { segment: true } });
  if (!link) return { status: "ERROR", error: "Segment not linked for Meta sync." };

  try {
    const people = await resolveSegment(link.segment.filter as unknown as SegmentFilter);
    const consented = await filterByActiveConsent(people, "ADVERTISING");
    const audienceId = await ensureCustomerListAudience({
      name: `Nail Fest — ${link.segment.name}`,
      retentionDays: 180,
    });
    await syncPeopleToAudience(audienceId, consented);
    await db.segmentMetaSync.update({
      where: { id: link.id },
      data: { status: "OK", metaAudienceId: audienceId, lastSyncedAt: new Date(), lastError: null },
    });
    return { status: "OK", audienceId, memberCount: consented.length };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await db.segmentMetaSync.update({ where: { id: link.id }, data: { status: "ERROR", lastError: error } });
    return { status: "ERROR", error };
  }
}

/**
 * Automatic segment → Meta Custom Audience sync for every linked segment.
 * Called on a schedule by /api/meta/sync-audiences (Vercel Cron, same
 * mechanism as the Meta CAPI retry job) — this is the reconciliation
 * safety net: it catches consent revocations, `attended` segments that
 * change as check-in data comes in, and anything the per-registration
 * incremental push (below) missed or can't handle (multi-condition
 * filters). One segment failing doesn't stop the others.
 */
export async function syncAllSegmentAudiences(): Promise<{ synced: number; failed: number }> {
  const links = await db.segmentMetaSync.findMany({ select: { segmentId: true } });

  let synced = 0;
  let failed = 0;
  for (const link of links) {
    const result = await syncSegmentAudience(link.segmentId);
    if (result.status === "OK") synced++;
    else failed++;
  }
  return { synced, failed };
}

/**
 * Cheap, near-real-time counterpart to syncSegmentAudience(): pushes ONE
 * newly-registered person to every segment's Meta audience that simply
 * means "registered to this event" — no full resync (re-uploading a
 * 5,000-person audience for every single new signup doesn't scale and
 * wastes API calls for no benefit; Meta dedupes on ingest but that's not
 * free). Only handles the common single-condition case
 * (`include: [{ field: "event", eventSlug }]`, no other include/exclude
 * conditions) — anything with city/profession/exclude conditions needs the
 * full resolveSegment() pass, so it's left to the cron instead of
 * re-implementing filter evaluation for one person here. Silently a no-op
 * for a segment that hasn't completed its first full sync yet (no
 * audienceId to push to) — the cron/first-sync will pick them up.
 *
 * Never throws — called from /api/register right after a registration
 * completes; a Meta hiccup here must not fail someone's registration.
 */
export async function pushNewRegistrantToEventAudiences(
  eventSlug: string,
  person: { id: string; email: string; phone: string | null }
): Promise<void> {
  try {
    if (!(await filterByActiveConsent([person], "ADVERTISING")).length) return;

    const links = await db.segmentMetaSync.findMany({
      where: { status: "OK", metaAudienceId: { not: null } },
      include: { segment: true },
    });

    for (const link of links) {
      const filter = link.segment.filter as unknown as SegmentFilter;
      const isSimpleEventMatch =
        filter.exclude.length === 0 &&
        filter.include.length === 1 &&
        filter.include[0]?.field === "event" &&
        filter.include[0].eventSlug === eventSlug;
      if (!isSimpleEventMatch || !link.metaAudienceId) continue;

      await syncPeopleToAudience(link.metaAudienceId, [person]);
    }
  } catch (err) {
    console.error("pushNewRegistrantToEventAudiences failed (non-fatal)", err);
  }
}
