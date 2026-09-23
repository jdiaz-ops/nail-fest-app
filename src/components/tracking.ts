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
 * Meta's own Pixel auto-sets the _fbc cookie when someone lands via an ad
 * click (?fbclid=...) — this site has no Pixel (CAPI-only, see
 * /api/track), so nothing was ever setting it, meaning every event's `fbc`
 * field was silently empty even though the code was already wired to send
 * it. Reconstructs the same cookie by Meta's own documented formula
 * (fb.1.<creation_time_ms>.<fbclid>) so readCookie("_fbc") here and in
 * RegistrationForm.tsx starts actually returning something for anyone who
 * arrived from an ad. Call once, early — before the first track() call —
 * so PageView onward all carry it.
 * https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/fbp-and-fbc
 */
export function ensureFbcCookie() {
  if (readCookie("_fbc")) return; // already set — this page earlier, or a real Pixel
  const fbclid = new URLSearchParams(window.location.search).get("fbclid");
  if (!fbclid) return;
  const fbc = `fb.1.${Date.now()}.${fbclid}`;
  const maxAgeSeconds = 90 * 24 * 60 * 60; // matches the Pixel's own _fbc retention window
  document.cookie = `_fbc=${encodeURIComponent(fbc)}; path=/; max-age=${maxAgeSeconds}`;
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
    fbc: readCookie("_fbc"),
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
