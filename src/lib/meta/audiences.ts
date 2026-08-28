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
      // Betting that type is inferred from `rule` + `pixel_id` instead;
      // unconfirmed until this actually creates the audience.
      customer_file_source: "USER_PROVIDED_ONLY",
      retention_days: params.retentionDays,
      rule: JSON.stringify({
        event: { eq: params.eventName },
      }),
      pixel_id: conn.pixelId,
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

/** The three seed audiences from the brief — call once during setup. */
export async function ensureSeedAudiences() {
  const landing = await ensureWebsiteAudience({
    name: "Nail Fest — Landing visitors (30d)",
    eventName: "PageView",
    retentionDays: 30,
  });
  const checkout = await ensureWebsiteAudience({
    name: "Nail Fest — Checkout started (30d)",
    eventName: "InitiateCheckout",
    retentionDays: 30,
  });
  const purchasers = await ensureCustomerListAudience({
    name: "Nail Fest — Purchasers (180d)",
    retentionDays: 180,
  });
  return { landing, checkout, purchasers };
}
