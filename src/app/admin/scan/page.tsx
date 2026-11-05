import { db } from "@/lib/db";
import { renderQrPngDataUrl } from "@/lib/qr";
import { requirePageUser } from "@/lib/auth/guard";
import { getOrgSettings } from "@/lib/settings";
import { staffSeesEvent } from "@/lib/scanEvents";
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
      select: { id: true, slug: true, name: true, city: true, startsAt: true, endsAt: true, scheduleDays: true },
    }),
    getOrgSettings(),
  ]);
  // The door staff (STAFF) never sees past events (the team, 2026-11-05): only the ones coming up and going on.
  const listed = isAdmin ? events : events.filter((e) => staffSeesEvent(e));

  // Only admin sees this — staff already IS the app, there's nothing to
  // "download" from their own point of view. The QR points a phone that
  // isn't logged in yet straight at this same URL; every /admin/scan/*
  // page redirects to /login and back if there's no session.
  const appUrl = `${process.env.APP_BASE_URL ?? ""}/admin/scan`;
  const downloadQr = isAdmin ? await renderQrPngDataUrl(appUrl) : null;

  return (
    <EventsListClient
      events={listed.map((e) => ({ id: e.id, slug: e.slug, name: e.name, city: e.city, startsAt: e.startsAt.toISOString(), endsAt: e.endsAt?.toISOString() ?? null }))}
      showPast={isAdmin}
      downloadQr={downloadQr}
      downloadUrl={appUrl}
      timezone={orgSettings.timezone}
      language={orgSettings.language}
    />
  );
}
