"use client";

function readCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
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
