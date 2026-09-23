"use client";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

function readCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

/**
 * Fallback for when the real Pixel (MetaPixelScript.tsx) hasn't set its own
 * _fbc yet — blocked by an ad blocker, or just hasn't finished loading.
 * Reconstructs the same cookie by Meta's own documented formula
 * (fb.1.<creation_time_ms>.<fbclid>) so readCookie("_fbc") here and in
 * RegistrationForm.tsx returns something for anyone who arrived from an ad.
 * Call this AFTER giving the real Pixel a chance to set _fbc itself (see
 * EventRegistration.tsx's mount effect) — fbevents.js never overwrites an
 * existing _fbc, so calling this first would always win and the official,
 * Pixel-computed value (correct subdomain index, etc.) would never get
 * used even when the Pixel loaded fine.
 * https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/fbp-and-fbc
 */
export function ensureFbcCookie() {
  if (readCookie("_fbc")) return; // already set — real Pixel got there first, or a prior page
  const fbclid = new URLSearchParams(window.location.search).get("fbclid");
  if (!fbclid) return;
  const fbc = `fb.1.${Date.now()}.${fbclid}`;
  const maxAgeSeconds = 90 * 24 * 60 * 60; // matches the Pixel's own _fbc retention window
  document.cookie = `_fbc=${encodeURIComponent(fbc)}; path=/; max-age=${maxAgeSeconds}`;
}

/**
 * Meta flagged ~10% of PageView events (plus some InitiateCheckout/
 * Purchase) as sending a "modified" fbc — lowercased and/or truncated.
 * Traced this: neither our own reconstruction above nor the real Pixel's
 * own fbc logic ever transforms the value — both read `fbclid` straight
 * from the URL with no changes. So the corruption has to already be in
 * `window.location.search` by the time any of our JS runs — most likely a
 * mobile carrier's data-compression proxy (common on LatAm networks this
 * event advertises to) or an in-app browser rewriting the URL in transit.
 * That's outside anything this codebase controls, so there's no way to
 * recover the original value — the best available mitigation is to
 * recognize when what we have doesn't look like a real fbclid and not
 * send it at all: Meta's diagnostics flag a MODIFIED fbc as a data-quality
 * problem, but a MISSING one (normal for plenty of organic traffic) isn't
 * penalized the same way.
 *
 * Heuristic, not a real signature check (Meta doesn't publish one): a
 * legitimate fbclid is long and, for the common formats Meta issues
 * (IwAR…, PA…), mixes upper and lower case. Flag it as suspect if it's
 * too short to be real, or long enough that a genuine click ID would
 * essentially always contain at least one uppercase letter yet doesn't.
 */
function looksLikeValidFbc(value: string): boolean {
  const match = value.match(/^fb\.\d+\.\d{10,}\.([A-Za-z0-9_-]+)$/);
  const fbclid = match?.[1];
  if (!fbclid) return false;
  if (fbclid.length < 20) return false; // catches truncation
  if (!/[A-Z]/.test(fbclid)) return false; // catches lowercasing
  return true;
}

/** Use this instead of readCookie("_fbc") anywhere an fbc is about to be
 * sent to Meta — see looksLikeValidFbc's comment for why. */
export function getValidFbc(): string | undefined {
  const fbc = readCookie("_fbc");
  return fbc && looksLikeValidFbc(fbc) ? fbc : undefined;
}

/**
 * Meta's diagnostics flagged 100% of PageView/ViewContent/InitiateCheckout
 * CAPI events as missing every single user_data key — traced to this: the
 * real Meta Pixel (MetaPixelScript.tsx) loads asynchronously
 * (`next/script strategy="afterInteractive"`) and is what actually sets
 * `_fbp` (nothing server-side can construct it, see MetaPixelScript.tsx's
 * own comment) — but EventRegistration.tsx used to fire track("PageView")
 * synchronously on mount, before the Pixel script had any real chance to
 * run. For anyone without a `?fbclid=` (so `_fbc` is also empty — see
 * ensureFbcCookie), that PageView carried zero identity signal at all,
 * every single time. Gives `_fbp` up to ~1.2s to show up (typically well
 * under 100ms once the script tag itself loads) before giving up and
 * firing anyway — never blocks longer than that, since a slow/blocked
 * Pixel (ad blockers are common) must never delay the visible page.
 *
 * Exported for the one call site that needs to hold its very first
 * track() calls back — every OTHER track() call in a session happens
 * later (after some real interaction), by which point the Pixel has long
 * since loaded, so this is deliberately not baked into track() itself.
 */
export function waitForFbpCookie(timeoutMs = 1200, intervalMs = 100): Promise<void> {
  return new Promise((resolve) => {
    if (readCookie("_fbp")) return resolve();
    const start = Date.now();
    const id = setInterval(() => {
      if (readCookie("_fbp") || Date.now() - start >= timeoutMs) {
        clearInterval(id);
        resolve();
      }
    }, intervalMs);
  });
}

export function track(eventName: "PageView" | "ViewContent" | "InitiateCheckout") {
  // Shared between the browser Pixel call and the server-side CAPI call
  // below — Meta dedupes on (event_name, event_id), so firing both without
  // a matching id would double-count every event instead of complementing
  // each other. See MetaPixelScript.tsx's comment for the full picture.
  const eventId = crypto.randomUUID();

  window.fbq?.("track", eventName, {}, { eventID: eventId });

  const body = {
    eventName,
    eventId,
    eventSourceUrl: window.location.href,
    fbc: getValidFbc(),
    fbp: readCookie("_fbp"),
  };
  // Best-effort, no await needed by the caller — a failure here must never
  // block the registration UI.
  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {
    /* swallowed on purpose — see /api/track comments */
  });
}
