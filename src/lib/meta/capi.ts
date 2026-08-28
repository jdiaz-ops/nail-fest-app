import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { hashEmail, hashPhone } from "@/lib/hashing";
import type { SendMetaEventInput } from "./types";

const GRAPH_VERSION = "v21.0";
const MAX_ATTEMPTS = 6;

// Exponential backoff, capped: 1m, 5m, 30m, 2h, 6h, 24h — after MAX_ATTEMPTS
// it's marked FAILED for good and shows up in the admin log for a human to
// look at, rather than retrying forever.
const BACKOFF_MINUTES = [1, 5, 30, 120, 360, 1440];

async function getConnection() {
  const conn = await db.metaConnection.findFirst({ orderBy: { createdAt: "desc" } });
  if (!conn) {
    throw new Error(
      "No MetaConnection configured. Create one with the System User token before sending events — see docs/META_SETUP.md."
    );
  }
  return conn;
}

function buildPayload(input: SendMetaEventInput, testEventCode?: string) {
  const userData: Record<string, string[] | string> = {};
  if (input.userData.email) userData.em = [hashEmail(input.userData.email)];
  if (input.userData.phone) userData.ph = [hashPhone(input.userData.phone)];
  if (input.userData.clientIpAddress) userData.client_ip_address = input.userData.clientIpAddress;
  if (input.userData.clientUserAgent) userData.client_user_agent = input.userData.clientUserAgent;
  if (input.userData.fbc) userData.fbc = input.userData.fbc;
  if (input.userData.fbp) userData.fbp = input.userData.fbp;

  const body: Record<string, unknown> = {
    data: [
      {
        event_name: input.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId, // dedup key, shared with browser Pixel if present
        action_source: "website",
        event_source_url: input.eventSourceUrl,
        user_data: userData,
        ...(input.customData
          ? {
              custom_data: {
                ...(input.customData.value !== undefined ? { value: input.customData.value } : {}),
                ...(input.customData.currency ? { currency: input.customData.currency } : {}),
              },
            }
          : {}),
      },
    ],
  };
  if (testEventCode) body.test_event_code = testEventCode;
  return body;
}

/**
 * Queue a Meta event for sending. Writes the row first (so it's durable and
 * idempotent on eventId even if the process dies mid-send), then makes one
 * best-effort inline attempt. On failure it's left PENDING for
 * /api/meta/retry (cron) to pick up with backoff — never thrown to the
 * caller, since a Meta hiccup must never break registration.
 */
export async function queueMetaEvent(input: SendMetaEventInput): Promise<void> {
  await db.metaEvent.upsert({
    where: { eventId: input.eventId },
    create: {
      eventId: input.eventId,
      eventName: input.eventName,
      registrationId: input.registrationId,
      status: "PENDING",
    },
    // Already queued (e.g. a retried form submit) — leave it alone, the
    // eventId uniqueness is exactly what keeps this idempotent.
    update: {},
  });

  await attemptSend(input);
}

async function attemptSend(input: SendMetaEventInput): Promise<boolean> {
  const record = await db.metaEvent.findUnique({ where: { eventId: input.eventId } });
  if (!record || record.status === "SENT") return true;

  try {
    const conn = await getConnection();
    const token = decryptSecret(conn.systemUserTokenEnc);
    const payload = buildPayload(input, process.env.META_TEST_EVENT_CODE || undefined);

    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${conn.pixelId}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(`Meta CAPI ${res.status}: ${JSON.stringify(json)}`);
    }

    await db.metaEvent.update({
      where: { eventId: input.eventId },
      data: { status: "SENT", sentAt: new Date(), metaResponse: json, attempts: { increment: 1 } },
    });
    return true;
  } catch (err) {
    const attempts = record.attempts + 1;
    const failedForGood = attempts >= MAX_ATTEMPTS;
    const backoffMinutes = BACKOFF_MINUTES[Math.min(attempts - 1, BACKOFF_MINUTES.length - 1)] ?? 1440;
    await db.metaEvent.update({
      where: { eventId: input.eventId },
      data: {
        attempts,
        status: failedForGood ? "FAILED" : "PENDING",
        nextAttemptAt: new Date(Date.now() + backoffMinutes * 60_000),
        metaResponse: { error: err instanceof Error ? err.message : String(err) },
      },
    });
    return false;
  }
}

/**
 * Called by /api/meta/retry (hit on a schedule — e.g. every 5 minutes via
 * cron). Picks up anything due for a retry and re-attempts it.
 */
export async function processDueMetaEvents(limit = 50): Promise<{ attempted: number; sent: number }> {
  const due = await db.metaEvent.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: new Date() } },
    take: limit,
    orderBy: { nextAttemptAt: "asc" },
  });

  let sent = 0;
  for (const row of due) {
    // We only stored eventId/eventName/registrationId — reconstructing full
    // user_data on retry would need re-reading the registration. Simplest
    // correct approach: look the registration back up.
    const registration = row.registrationId
      ? await db.registration.findUnique({ include: { person: true }, where: { id: row.registrationId } })
      : null;
    if (!registration) continue;

    const ok = await attemptSend({
      eventId: row.eventId,
      eventName: row.eventName,
      eventSourceUrl: process.env.APP_BASE_URL ?? "",
      userData: {
        email: registration.person.email,
        phone: registration.person.phone ?? undefined,
        fbc: undefined,
        fbp: undefined,
      },
      registrationId: registration.id,
    });
    if (ok) sent++;
  }

  return { attempted: due.length, sent };
}
