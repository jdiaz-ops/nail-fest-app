import type { Metadata } from "next";
import RegisterServiceWorker from "./RegisterServiceWorker";

// Makes "Add to Home Screen" (Android via the manifest, iOS via
// appleWebApp) give this whole area its own icon/name instead of a
// generic Safari/Chrome tab shortcut — the whole point of being something
// you can put on your phone and open like an app at the door. Set once
// here so it covers the Events list AND every event's Dashboard/
// Escanear/Lista tabs, not just the old single scan page.
export const metadata: Metadata = {
  title: "Escáner — Nail Fest",
  manifest: "/scan-manifest.webmanifest",
  themeColor: "#00beb5",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "NF Escáner" },
  icons: { apple: "/icon-192.png" },
};

export default function ScanLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RegisterServiceWorker />
      {children}
    </>
  );
}
