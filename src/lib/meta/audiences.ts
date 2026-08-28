import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { hashEmail, hashPhone } from "@/lib/hashing";

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
}): Promise<string> {
  const conn = await getConnection();
  const displayName = `${params.baseName} (${params.retentionDays}d)`;

  const rule = JSON.stringify({
    inclusions: {
      operator: "or",
      rules: [
        {
          event_sources: [{ type: "pixel", id: conn.pixelId }],
          retention_seconds: params.retentionDays * 24 * 60 * 60,
          filter: {
            operator: "and",
            filters: [{ field: "event", operator: "=", value: params.eventName }],
          },
        },
      ],
    },
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
 * The three seed audiences from the brief — call once during setup.
 * Each is attempted independently so one failing (website-rule audiences
 * are hitting a Graph API rule-syntax version mismatch as of this writing —
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
  const purchasers = await attempt(() =>
    ensureCustomerListAudience({
      name: "Nail Fest — Purchasers (180d)",
      retentionDays: 180,
    })
  );

  // Purchasers is a customer-list audience — unlike the two rule_v2
  // audiences above, Meta doesn't auto-populate it. Sync it right after
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

  return { landing, checkout, purchasers, purchasersSync };
}

/**
 * Confirmed registrants who granted (and haven't revoked) ADVERTISING
 * consent — the only people allowed to be sent to Meta for ad targeting
 * (Ley 1581 purpose separation, same gate used for the CAPI Purchase event
 * in /api/register). Done as two bulk queries + an in-memory "latest
 * consent per person" reduction instead of hasActiveConsent() in a loop,
 * since this can run over 10,000+ people per event.
 */
async function getAdvertisingConsentedPurchasers(): Promise<
  Array<{ email: string; phone: string | null }>
> {
  const confirmed = await db.person.findMany({
    where: { registrations: { some: { status: "CONFIRMED" } } },
    select: { id: true, email: true, phone: true },
  });
  if (confirmed.length === 0) return [];

  const consents = await db.consent.findMany({
    where: { personId: { in: confirmed.map((p) => p.id) }, purpose: "ADVERTISING" },
    orderBy: { grantedAt: "desc" },
    select: { personId: true, granted: true, revokedAt: true },
  });

  const latestByPerson = new Map<string, { granted: boolean; revokedAt: Date | null }>();
  for (const c of consents) {
    if (!latestByPerson.has(c.personId)) latestByPerson.set(c.personId, c);
  }

  return confirmed
    .filter((p) => {
      const latest = latestByPerson.get(p.id);
      return latest?.granted && !latest.revokedAt;
    })
    .map((p) => ({ email: p.email, phone: p.phone }));
}
