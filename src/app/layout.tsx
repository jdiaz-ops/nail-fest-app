import type { Metadata } from "next";
import "./globals.css";
import { getOrgSettings } from "@/lib/settings";
import CookieConsentBanner from "@/components/CookieConsentBanner";

export const metadata: Metadata = {
  title: "Nail Fest",
  description: "Registro de eventos Nail Fest",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read once here rather than in every page — see /admin/settings/cookie-consent.
  const { cookieConsentEnabled, clarityProjectId } = await getOrgSettings();
  return (
    <html lang="es">
      <body>
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
