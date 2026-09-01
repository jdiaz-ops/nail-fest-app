import type { ConsentPurpose } from "@prisma/client";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { hashEmail, hashPhone } from "@/lib/hashing";
import { resolveSegment, normalizeFilter, type SegmentFilter } from "@/lib/segments/builder";

const GRAPH_VERSION = "v21.0";

// Same small helper as import-registrations/route.ts's own chunk() — kept
// local here too rather than pulled into a shared utils module, matching
// how this codebase already prefers a duplicated one-liner over a new
// shared dependency for something this small.
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

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
 *
 * `existingAudienceId` — pass the id already stored locally (e.g.
 * SegmentMetaSync.metaAudienceId) when one exists, instead of relying on
 * the name-lookup fallback below. This matters for editing a segment: if
 * the admin RENAMES it, a name-based lookup would find nothing under the
 * new name and silently create a SECOND Meta audience, orphaning the
 * original (still there, still "Populating", just untracked from here on
 * out) — passing the real id renames that same audience in place instead.
 * The name-lookup path stays as the fallback for the case with no stored
 * id yet (first sync ever, or the seed audiences in ensureSeedAudiences).
 *
 * Self-heals when existingAudienceId points at an audience that no longer
 * exists in Meta — an admin can always delete a Custom Audience directly
 * in Ads Manager (the reset move for one that accumulated stale members
 * before PRUNE_STALE_AUDIENCE_MEMBERS existed — see "APP Registros
 * Pereira 2025"), and the next sync shouldn't die on that. Rename-in-place
 * failing is treated as exactly that case: fall through to the
 * name-lookup-or-create path below instead of propagating the error, so
 * the segment just gets a fresh audience under the same name and syncs
 * clean — no manual "forget this id" step needed on the app side.
 */
export async function ensureCustomerListAudience(params: {
  name: string;
  retentionDays: number;
  existingAudienceId?: string | null;
}): Promise<string> {
  const conn = await getConnection();

  if (params.existingAudienceId) {
    try {
      // Rename in place — cheap no-op if the name didn't actually change.
      await graphFetch(params.existingAudienceId, conn.token, {
        method: "POST",
        body: JSON.stringify({ name: params.name }),
      });
      return params.existingAudienceId;
    } catch (err) {
      console.warn(
        `ensureCustomerListAudience: stored metaAudienceId ${params.existingAudienceId} rejected by Meta ` +
          `(likely deleted in Ads Manager) — falling back to name lookup / creating a fresh audience.`,
        err instanceof Error ? err.message : err
      );
    }
  }

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
): Promise<{ batches: number; numReceived: number; numInvalidEntries: number }> {
  const conn = await getConnection();

  const rows = people
    .map((p) => [p.email ? hashEmail(p.email) : "", p.phone ? hashPhone(p.phone) : ""])
    .filter(([em, ph]) => em || ph);

  let batches = 0;
  let numReceived = 0;
  let numInvalidEntries = 0;
  for (let i = 0; i < rows.length; i += UPLOAD_BATCH_SIZE) {
    const batch = rows.slice(i, i + UPLOAD_BATCH_SIZE);
    // Meta's response here (num_received/num_invalid_entries) is the only
    // real signal of whether the upload actually matched — this call
    // succeeding (res.ok, no throw) only means Meta accepted the request,
    // NOT that the hashed rows were valid. Before this, that response body
    // was discarded entirely: a segment could show hundreds of
    // "num_invalid_entries" (bad hash format, wrong normalization, whatever)
    // and this function — and everything reading its result — would still
    // report a clean "OK" sync. Logging the raw body too since Meta's exact
    // field names have drifted across API versions before; better to have
    // it in the function logs than silently coerce something unexpected to
    // 0 and hide a real problem.
    const res = await graphFetch(`${audienceId}/users`, conn.token, {
      method: "POST",
      body: JSON.stringify({
        payload: {
          schema: ["EMAIL", "PHONE"],
          data: batch,
        },
      }),
    });
    console.log("Meta customaudiences/users response (add)", JSON.stringify(res));
    if (typeof res.num_received === "number") numReceived += res.num_received;
    if (typeof res.num_invalid_entries === "number") numInvalidEntries += res.num_invalid_entries;
    batches++;
  }
  return { batches, numReceived, numInvalidEntries };
}

/**
 * The other half syncPeopleToAudience never had: removes people from a
 * Meta Custom Audience via DELETE /{audience_id}/users (same payload
 * shape as the ADD call, different HTTP method — this is Meta's own
 * documented way to remove specific hashed identifiers from a customer-
 * list audience). Only called when PRUNE_STALE_AUDIENCE_MEMBERS is on —
 * see syncSegmentAudience.
 */
async function removePeopleFromAudience(
  audienceId: string,
  people: Array<{ email?: string | null; phone?: string | null }>
): Promise<void> {
  const conn = await getConnection();

  const rows = people
    .map((p) => [p.email ? hashEmail(p.email) : "", p.phone ? hashPhone(p.phone) : ""])
    .filter(([em, ph]) => em || ph);

  for (let i = 0; i < rows.length; i += UPLOAD_BATCH_SIZE) {
    const batch = rows.slice(i, i + UPLOAD_BATCH_SIZE);
    const res = await graphFetch(`${audienceId}/users`, conn.token, {
      method: "DELETE",
      body: JSON.stringify({
        payload: {
          schema: ["EMAIL", "PHONE"],
          data: batch,
        },
      }),
    });
    console.log("Meta customaudiences/users response (remove)", JSON.stringify(res));
  }
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
 *
 * Exported so /admin/crm/segments can show how many of a segment's members
 * actually have ADVERTISING consent — i.e. how many of them really reach
 * Meta once syncSegmentAudience runs, as opposed to the segment's raw
 * "Personas" count. Those two numbers can differ a lot for
 * imported/historical segments (see docs/IMPORT.md's advertising-consent
 * checkbox), and nothing before this surfaced that gap in the UI — a
 * segment could show thousands of "Personas" while its actual Custom
 * Audience on Meta sits under 1,000, with no visible reason why.
 *
 * Batched internally (CONSENT_QUERY_BATCH_SIZE per `IN (...)`) — Postgres
 * caps a single prepared statement at 32,767 bind variables, and the
 * "Masterlist" segment alone already has more people than that (confirmed
 * live: 49,833). One `personId: { in: [...] }` over the whole list blew
 * past that cap with a P2035 the moment a list this large hit this
 * function, however it got called — every caller (this one, the three
 * below) shares the fix by living here instead of in each call site.
 */
const CONSENT_QUERY_BATCH_SIZE = 25_000;

export async function filterByActiveConsent<T extends { id: string }>(
  people: T[],
  purpose: ConsentPurpose
): Promise<T[]> {
  if (people.length === 0) return [];

  const ids = people.map((p) => p.id);
  const consents = (
    await Promise.all(
      chunk(ids, CONSENT_QUERY_BATCH_SIZE).map((idBatch) =>
        db.consent.findMany({
          where: { personId: { in: idBatch }, purpose },
          orderBy: { grantedAt: "desc" },
          select: { personId: true, granted: true, revokedAt: true },
        })
      )
    )
  ).flat();

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

// Turned ON per explicit confirmation (2026-09-01) after confirming the
// exact failure mode live: "APP Registros Pereira 2025"'s Meta History tab
// showed two separate "Added N Rows" events the same day (5,826 then
// 6,216, neither ever removed in between) — Meta's /users endpoint only
// ever adds, so the audience became the UNION of both instead of the
// current, correct list, landing at 7,100-8,400 estimated against 6,216
// real people. removePeopleFromAudience + the diff logic below close that
// gap going forward: every sync now removes whoever dropped out
// (revoked ADVERTISING consent, no longer matches the segment filter,
// etc.) since the last successful sync, before uploading the current list.
//
// Does NOT retroactively fix an audience that already accumulated stale
// members before this was turned on (lastSyncedPersonIds only started
// being recorded once this shipped, so there's no earlier baseline to
// diff against for those) — that needs a one-time manual reset: delete
// the Custom Audience in Meta Ads Manager and let the next sync recreate
// it clean with today's real list. Pereira 2025 is being reset that way
// separately; this flag only prevents the gap from opening again.
const PRUNE_STALE_AUDIENCE_MEMBERS = true;

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
      existingAudienceId: link.metaAudienceId,
    });

    if (PRUNE_STALE_AUDIENCE_MEMBERS) {
      const previousIds = new Set((link.lastSyncedPersonIds as unknown as string[] | null) ?? []);
      const currentIds = new Set(consented.map((p) => p.id));
      const droppedIds = [...previousIds].filter((id) => !currentIds.has(id));
      if (droppedIds.length > 0) {
        // Fetched fresh, chunked the same way filterByActiveConsent is —
        // the same 32,767-bind-variable ceiling applies to any `id: {in:
        // [...]}` this size.
        const dropped = (
          await Promise.all(
            chunk(droppedIds, CONSENT_QUERY_BATCH_SIZE).map((idBatch) =>
              db.person.findMany({ where: { id: { in: idBatch } }, select: { id: true, email: true, phone: true } })
            )
          )
        ).flat();
        await removePeopleFromAudience(audienceId, dropped);
      }
    }

    await syncPeopleToAudience(audienceId, consented);
    await db.segmentMetaSync.update({
      where: { id: link.id },
      data: {
        status: "OK",
        metaAudienceId: audienceId,
        lastSyncedAt: new Date(),
        lastError: null,
        lastSyncedPersonIds: consented.map((p) => p.id),
      },
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
      const filter = normalizeFilter(link.segment.filter as unknown as SegmentFilter);
      const isSimpleEventMatch =
        filter.exclude.length === 0 &&
        filter.include.length === 1 &&
        filter.include[0]?.field === "event" &&
        filter.include[0].eventSlugs.length === 1 &&
        filter.include[0].eventSlugs[0] === eventSlug;
      if (!isSimpleEventMatch || !link.metaAudienceId) continue;

      await syncPeopleToAudience(link.metaAudienceId, [person]);
    }
  } catch (err) {
    console.error("pushNewRegistrantToEventAudiences failed (non-fatal)", err);
  }
}
