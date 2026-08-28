"use client";

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

export function track(eventName: "PageView" | "ViewContent" | "InitiateCheckout") {
  const body = {
    eventName,
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
