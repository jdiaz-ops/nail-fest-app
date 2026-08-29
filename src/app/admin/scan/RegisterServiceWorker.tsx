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
    let cancelled = false;

    function warmCurrentPage() {
      if (cancelled) return;
      // Without this, the very FIRST time someone ever opens a scanner
      // page, nothing gets cached at all: the browser already fetched the
      // document and every script/stylesheet BEFORE the worker could
      // exist to intercept any of it (registration only happens
      // client-side, after hydration — a chicken-and-egg gap on the very
      // first load). Left alone, the shell would only start getting
      // cached starting on a SECOND visit or reload — which is exactly
      // the gap a real user hit: they opened this screen once, used it,
      // then lost signal, with nothing yet cached to fall back to. So
      // re-fetch everything THIS page load actually used, right now —
      // those fetches are now controlled, and land in the service
      // worker's cache exactly like any other request would.
      const urls = new Set<string>([window.location.href]);
      document.querySelectorAll("script[src]").forEach((el) => {
        const src = (el as HTMLScriptElement).src;
        if (src && src.startsWith(window.location.origin)) urls.add(src);
      });
      document.querySelectorAll('link[rel="stylesheet"]').forEach((el) => {
        const href = (el as HTMLLinkElement).href;
        if (href && href.startsWith(window.location.origin)) urls.add(href);
      });
      urls.forEach((url) => {
        // cache: "reload" forces a genuine round-trip instead of a silent
        // hit off the browser's own HTTP disk cache — we want this write
        // to prove the resource is actually fetchable right now, not just
        // assume a stale disk entry is good.
        fetch(url, { cache: "reload" }).catch(() => {});
      });
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/admin/scan/" })
      .then(() => navigator.serviceWorker.ready)
      .then(() => {
        if (cancelled) return;
        // .ready resolving (the worker reached "activated") is NOT the
        // same moment this page becomes a controlled client — clients.
        // claim() runs inside 'activate' but the controller assignment on
        // THIS document lands via a separate, slightly later round-trip.
        // Firing the warming fetches right on .ready is a real race:
        // they go out over plain network, succeed, and never touch the
        // service worker's fetch handler at all — confirmed directly
        // (fetches came back 200 but the cache stayed empty). Waiting for
        // an actual controller closes that race for good.
        if (navigator.serviceWorker.controller) {
          warmCurrentPage();
        } else {
          navigator.serviceWorker.addEventListener("controllerchange", warmCurrentPage, { once: true });
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
