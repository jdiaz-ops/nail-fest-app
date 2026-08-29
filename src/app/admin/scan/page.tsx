import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import { requirePageUser } from "@/lib/auth/guard";
import { renderQrPngDataUrl } from "@/lib/qr";
import ScanClient from "./ScanClient";
import ScanTabs from "./ScanTabs";

// Makes "Add to Home Screen" (Android via the manifest, iOS via
// appleWebApp) give this page its own icon/name instead of a generic
// Safari/Chrome tab shortcut — the whole point of being something you can
// put on your phone and open like an app at the door. This is the SAME
// page staff log into on their own phones (see ScanTabs' download-app
// section, admin-only) — there's no separate "mobile app" route, just this
// one, role-gated.
export const metadata: Metadata = {
  title: "Escáner — Nail Fest",
  manifest: "/scan-manifest.webmanifest",
  themeColor: "#00beb5",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "NF Escáner" },
  icons: { apple: "/icon-192.png" },
};

// Only events happening soon (or without an end date yet) are worth
// listing at the door — keeps the picker short instead of scrolling past
// every past edition every time someone opens this on their phone.
export default async function ScanPage() {
  const user = await requirePageUser(["ADMIN", "STAFF"]);
  const isAdmin = user.role === "ADMIN";

  const [events, orgSettings] = await Promise.all([
    db.event.findMany({
      orderBy: { startsAt: "desc" },
      select: { id: true, slug: true, name: true, city: true, startsAt: true },
    }),
    getOrgSettings(),
  ]);

  // Only admin sees this — staff already IS on the app, there's nothing to
  // "download" from their own point of view. The QR points a phone that
  // ISN'T logged in yet straight at this same URL; middleware being gone
  // (see lib/auth/guard.ts), it's the page itself that then redirects to
  // /login and back.
  const appUrl = `${process.env.APP_BASE_URL ?? ""}/admin/scan`;
  const downloadQr = isAdmin ? await renderQrPngDataUrl(appUrl) : null;

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      {isAdmin && <ScanTabs active="scan" />}
      <ScanClient
        events={events.map((e) => ({ ...e, startsAt: e.startsAt.toISOString() }))}
        timezone={orgSettings.timezone}
        language={orgSettings.language}
      />
      {isAdmin && downloadQr && (
        <div style={{ marginTop: 32, padding: 16, border: "1px solid #e3e1dc", borderRadius: 12 }}>
          <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 4 }}>Descargar la app para el staff</h2>
          <p style={{ fontSize: 13, color: "#5b5f6b", marginTop: 0 }}>
            Que cada persona de la puerta escanee este código con SU celular, inicie sesión con su propio
            usuario, y luego lo agregue a su pantalla de inicio (Safari: Compartir → Agregar a inicio.
            Chrome/Android: menú → Instalar app). Una vez que inicie sesión no tiene que volver a
            hacerlo.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a
                data: URI, not a remote image; next/image adds nothing here. */}
            <img src={downloadQr} alt={`Código QR hacia ${appUrl}`} width={140} height={140} style={{ borderRadius: 8, border: "1px solid #e3e1dc" }} />
            <div style={{ fontSize: 13, wordBreak: "break-all", color: "#5b5f6b" }}>{appUrl}</div>
          </div>
        </div>
      )}
    </div>
  );
}
