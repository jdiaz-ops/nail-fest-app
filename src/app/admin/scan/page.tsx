import { db } from "@/lib/db";
import { renderQrPngDataUrl } from "@/lib/qr";
import { requirePageUser } from "@/lib/auth/guard";
import { getOrgSettings } from "@/lib/settings";
import EventsListClient from "./EventsListClient";

export default async function ScanEventsPage() {
  const user = await requirePageUser(["ADMIN", "STAFF", "COORDINADOR"]);
  // COORDINADOR gets the full scanner experience, same as ADMIN — "todo
  // en escáner" was the explicit ask (unlike everywhere else in the app,
  // there's no narrower scope for this role here).
  const isAdmin = user.role === "ADMIN" || user.role === "COORDINADOR";

  const [events, orgSettings] = await Promise.all([
    db.event.findMany({
      orderBy: { startsAt: "desc" },
      select: { id: true, slug: true, name: true, city: true, startsAt: true, endsAt: true },
    }),
    getOrgSettings(),
  ]);

  // Only admin sees this — staff already IS the app, there's nothing to
  // "download" from their own point of view. The QR points a phone that
  // isn't logged in yet straight at this same URL; every /admin/scan/*
  // page redirects to /login and back if there's no session.
  const appUrl = `${process.env.APP_BASE_URL ?? ""}/admin/scan`;
  const downloadQr = isAdmin ? await renderQrPngDataUrl(appUrl) : null;

  return (
    <EventsListClient
      events={events.map((e) => ({ ...e, startsAt: e.startsAt.toISOString(), endsAt: e.endsAt?.toISOString() ?? null }))}
      downloadQr={downloadQr}
      downloadUrl={appUrl}
      timezone={orgSettings.timezone}
      language={orgSettings.language}
    />
  );
}
