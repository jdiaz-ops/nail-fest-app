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
  const { cookieConsentEnabled } = await getOrgSettings();
  return (
    <html lang="es">
      <body>
        {children}
        {cookieConsentEnabled && <CookieConsentBanner />}
      </body>
    </html>
  );
}
