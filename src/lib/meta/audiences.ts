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
 * IS the sync. This function is idempotent by name so it's safe to call on
 * every deploy.
 */
export async function ensureWebsiteAudience(params: {
  name: string;
  eventName: "PageView" | "InitiateCheckout";
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
      rule: JSON.stringify({
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
      }),
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
      // Same reasoning as the website audience above — no `subtype`, the
      // API infers CUSTOM from customer_file_source alone with no `rule`.
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
      name: "Nail Fest — Landing visitors (30d)",
      eventName: "PageView",
      retentionDays: 30,
    })
  );
  const checkout = await attempt(() =>
    ensureWebsiteAudience({
      name: "Nail Fest — Checkout started (30d)",
      eventName: "InitiateCheckout",
      retentionDays: 30,
    })
  );
  const purchasers = await attempt(() =>
    ensureCustomerListAudience({
      name: "Nail Fest — Purchasers (180d)",
      retentionDays: 180,
    })
  );
  return { landing, checkout, purchasers };
}
