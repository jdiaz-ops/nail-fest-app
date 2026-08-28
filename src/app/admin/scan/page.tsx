import type { Metadata } from "next";
import { db } from "@/lib/db";
import ScanClient from "./ScanClient";

export const dynamic = "force-dynamic";

// Makes "Add to Home Screen" (Android via the manifest, iOS via
// appleWebApp) give this page its own icon/name instead of a generic
// Safari/Chrome tab shortcut — the whole point of the MVP being something
// you can put on your phone and open like an app at the door.
export const metadata: Metadata = {
  title: "Escáner — Nail Fest",
  manifest: "/scan-manifest.webmanifest",
  themeColor: "#c2185b",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "NF Escáner" },
  icons: { apple: "/icon-192.png" },
};

// Only events happening soon (or without an end date yet) are worth
// listing at the door — keeps the picker short instead of scrolling past
// every past edition every time someone opens this on their phone.
export default async function ScanPage() {
  const events = await db.event.findMany({
    orderBy: { startsAt: "desc" },
    select: { id: true, slug: true, name: true, city: true, startsAt: true },
  });

  return <ScanClient events={events.map((e) => ({ ...e, startsAt: e.startsAt.toISOString() }))} />;
}
