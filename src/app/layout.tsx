import type { Metadata } from "next";
import "./globals.css";
import { getOrgSettings } from "@/lib/settings";
import CookieConsentBanner from "@/components/CookieConsentBanner";

export const metadata: Metadata = {
  title: "Nail Fest",
  description: "Registro de eventos Nail Fest",
};

// Nothing under this layout is prerendered at build time. Every real page
// is already dynamic; the one static page Next generated (/_not-found)
// rendered this layout at build time, which meant a database query inside
// `next build` — and a build that failed whenever the database was slow to
// answer from Vercel's build container (2026-10-12).
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read once here rather than in every page — see /admin/settings/cookie-consent.
  const { cookieConsentEnabled, clarityProjectId } = await getOrgSettings();
  return (
    <html lang="es">
      <body>
        {/* Plan B for every image that goes through Next's optimizer
            (/_next/image): since 2026-10-19 Vercel answers 404 to those
            requests on this project, with the source files perfectly
            reachable, so the event hero, the galleries and the admin
            thumbnails all showed as broken images for anyone without a
            cached copy. When an <img> whose source is an optimizer URL
            fails, this swaps it to the original file (the `url` param)
            and drops the srcset so the browser doesn't retry the
            optimizer. Covers next/image and the hand-built
            optimizedSrc() tags alike, runs in the capture phase so it
            sees errors from images that render before React hydrates,
            and is a no-op while the optimizer works. Inline and first in
            <body> on purpose: it has to be registered before the first
            image fails. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){function raw(s){try{var u=new URL(s,location.origin);if(u.pathname!=="/_next/image")return null;return u.searchParams.get("url")}catch(e){return null}}
window.addEventListener("error",function(ev){var el=ev.target;if(!el||el.tagName!=="IMG"||el.dataset.nfRaw)return;var f=raw(el.currentSrc||el.src);if(!f)return;el.dataset.nfRaw="1";el.removeAttribute("srcset");el.removeAttribute("sizes");el.src=f},true)})();`,
          }}
        />
        {children}
        {cookieConsentEnabled && <CookieConsentBanner />}
        {/* Microsoft Clarity — see /admin/settings/analytics. Site-wide (not
            just the event pages) so it also covers the homepage funnel, not
            only checkout. Only rendered when an admin has actually set a
            project id — no script tag at all otherwise, same "off means
            off" posture as the cookie banner above. Clarity's own snippet,
            unmodified. */}
        {clarityProjectId && (
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", ${JSON.stringify(clarityProjectId)});`,
            }}
          />
        )}
      </body>
    </html>
  );
}
