// Scanner app shell cache — registered ONLY for /admin/scan/* (see
// RegisterServiceWorker.tsx), so this has zero effect anywhere else on
// the site. What this actually fixes: without it, all the offline logic
// in lib/offlineScan.ts / useOfflineScanEngine.ts only works as long as
// the page stays loaded in memory — the moment the browser needs to
// re-fetch the page itself (a real reload, or Android reclaiming a
// backgrounded tab's process under memory pressure, which happens often
// when someone backgrounds the app to flip on airplane mode) there was
// nothing to serve it from, and Chrome's own "No tienes conexión"
// interstitial took over instead of the app. This caches the app shell
// (HTML/JS/CSS, whatever a page under /admin/scan actually requests) as
// it's fetched, so a later fetch failure can fall back to that cache
// instead of failing outright.
//
// Deliberately excludes /api/* entirely — every data read this app
// needs offline already goes through the roster/queue in localStorage
// (see lib/offlineScan.ts), which has its own freshness indicator shown
// to the user ("Datos: N personas · hace X"); a second, silently-stale
// cache of the same API responses here would just be a second source of
// truth to disagree with the first. POST requests (the actual scan
// submissions) are never intercepted either — those already have their
// own offline handling in useOfflineScanEngine's submitToken.

const CACHE_NAME = "nf-scan-shell-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("nf-scan-shell-") && k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // scan submissions and every other write stay untouched
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // see the file's own comment on why

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        // Network-first: whenever there IS a connection, always use the
        // real, current response — the cache is purely a fallback for
        // when the network fetch itself fails, never a way to skip it.
        const fresh = await fetch(req);
        if (fresh && fresh.ok && fresh.type === "basic") {
          // event.waitUntil, not a bare call: without it the browser is
          // free to kill this worker the instant respondWith's promise
          // settles, racing the still-pending cache write — silently
          // losing exactly the entry a future offline reload needs. That
          // race matters most under the same memory pressure that made
          // this whole file necessary in the first place.
          event.waitUntil(cache.put(req, fresh.clone()));
        }
        return fresh;
      } catch {
        // ignoreVary: true is deliberate, not an oversight. Next.js sets
        // Vary: RSC, Next-Router-State-Tree, Next-Router-Prefetch on every
        // page response, to tell caches an RSC/client-router fetch and a
        // plain full-page request for the SAME URL are different things.
        // That's correct for Next's own purposes, but wrong for us: this
        // cache exists purely so a genuine browser-level reload (which
        // sends none of those headers) has *something* to fall back to,
        // and a strict Vary match means an entry written by Next's own
        // client-side router (which does send them) never matches that
        // reload's request — a confirmed real miss, not a hypothetical
        // one (verified directly: the same URL, same person, comes back
        // 200 with one header set and 500 with the RSC set). Any
        // previously-cached copy of this URL is strictly better than the
        // "never cached" fallback below, so ignore Vary entirely here.
        const cached = await cache.match(req, { ignoreVary: true });
        if (cached) return cached;
        if (req.mode === "navigate") {
          // Only reachable for a URL genuinely never visited while
          // online (so there's nothing cached to fall back to) — a
          // real, if rare, first-time-offline case. A plain, honest
          // message beats the browser's own blank interstitial.
          return new Response(
            "<!doctype html><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>" +
              "<body style='font-family:system-ui,-apple-system,sans-serif;padding:40px 24px;text-align:center;color:#5b5f6b;background:#faf9f7'>" +
              "<h1 style='color:#14141c;font-size:20px'>Sin conexión</h1>" +
              "<p>Esta pantalla no se había abierto antes con internet en este celular, así que no hay una copia guardada para mostrarla sin conexión.</p>" +
              "<p>Conéctate una vez para cargarla, y luego seguirá funcionando sin conexión.</p>" +
              "</body>",
            { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
          );
        }
        throw new Error("offline and not cached");
      }
    })()
  );
});
