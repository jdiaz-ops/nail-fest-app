// Zoom — Fase 1 of the virtual-congress integration: one unique join_url
// per registrant, via Zoom's Server-to-Server OAuth (the current
// supported auth method; the old JWT app type is retired). This does NOT
// make a link single-use — Zoom's own API has no such guarantee (verified
// directly against Zoom's developer forum: a shared registrant URL can
// still be opened by more than one person, and the one mitigating setting
// — "don't allow joining from multiple devices" — only stops SIMULTANEOUS
// multi-device use of the same link, not someone using it after another
// person already has). That's exactly why this is called "Fase 1": real
// per-person tracking (who actually joined) without depending on Zoom to
// enforce anything is Fase 2's private-room approach — see the chat
// history/README for that tradeoff, not repeated here.
//
// Required env vars (see docs/PAYMENTS_SETUP.md): ZOOM_ACCOUNT_ID,
// ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET — from a Server-to-Server OAuth app
// created in the Zoom App Marketplace (marketplace.zoom.us), NOT a
// regular OAuth app (no user consent screen, no redirect URL — it
// authenticates as the Zoom ACCOUNT itself). The app needs the
// `meeting:write:registrant` scope (or `webinar:write:registrant` for a
// Webinar) granted at creation.
//
// Every function here is best-effort in the sense that a failure never
// throws past registerParticipant — the caller (lib/registrationConfirmation.ts)
// treats a missing join_url as "couldn't register them for Zoom this
// time," logs it, and still confirms the registration/ticket — a Zoom
// hiccup must never block someone's paid confirmation.

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name} (see lib/zoom.ts's own comment)`);
  return value;
}

interface CachedToken {
  token: string;
  expiresAt: number; // epoch ms
}
let cachedToken: CachedToken | null = null;

/** Server-to-Server OAuth access token — cached in-memory for the
 * process's lifetime (serverless: this just means "often, not always,
 * saves one round trip"; never persisted, nothing sensitive kept beyond
 * one function's lifetime longer than necessary). Tokens last 1h; refreshed
 * a minute early to avoid a request racing an expiry right at the edge. */
async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;

  const basicAuth = Buffer.from(`${env("ZOOM_CLIENT_ID")}:${env("ZOOM_CLIENT_SECRET")}`).toString("base64");
  const res = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${env("ZOOM_ACCOUNT_ID")}`, {
    method: "POST",
    headers: { Authorization: `Basic ${basicAuth}` },
  });
  if (!res.ok) {
    throw new Error(`Zoom OAuth token request failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
  const body = await res.json();
  cachedToken = { token: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return cachedToken.token;
}

export interface ZoomRegistrant {
  email: string;
  firstName: string;
  lastName: string;
}

/** Registers one person as a Zoom meeting/webinar registrant and returns
 * their own personal join_url — null on any failure (missing config,
 * Zoom rejecting the call, or a meeting set to "Manual" registration
 * approval, which withholds join_url from this response entirely and only
 * emails it to the registrant instead — see this function's own note in
 * the setup docs about needing "Automatically Approve" turned on for this
 * to work at all). Never throws — see this module's own top comment. */
export async function registerParticipant(
  meetingOrWebinarId: string,
  isWebinar: boolean,
  registrant: ZoomRegistrant
): Promise<string | null> {
  try {
    const token = await getAccessToken();
    const kind = isWebinar ? "webinars" : "meetings";
    const res = await fetch(`https://api.zoom.us/v2/${kind}/${meetingOrWebinarId}/registrants`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: registrant.email, first_name: registrant.firstName, last_name: registrant.lastName || registrant.firstName }),
    });
    if (!res.ok) {
      console.error("zoom: registerParticipant failed", meetingOrWebinarId, res.status, await res.text().catch(() => ""));
      return null;
    }
    const body = await res.json();
    return body?.join_url ?? null;
  } catch (err) {
    console.error("zoom: registerParticipant threw", meetingOrWebinarId, err);
    return null;
  }
}
