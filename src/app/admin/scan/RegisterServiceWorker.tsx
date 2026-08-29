"use client";

import { useEffect } from "react";

// Registers public/sw.js, scoped to /admin/scan/ only — see that file's own
// comment for what it fixes (a real browser-level reload while fully
// offline, e.g. Android reclaiming a backgrounded tab under memory
// pressure, previously fell through to Chrome's own "No tienes conexión"
// interstitial with nothing to serve the app shell from). Registration
// failure (older browser, private-mode restrictions, etc.) must never
// break the page itself — every offline-while-loaded feature already
// works without it, this only helps the reload case on top.
export default function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/admin/scan/" }).catch(() => {});
  }, []);
  return null;
}
