import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import EventStatsPanel from "../EventStatsPanel";

export const dynamic = "force-dynamic";

// The Dashboard tab — ADMIN and COORDINADOR (see ScanAppShell's own
// scannerRole mapping — "todo en escáner" was the explicit ask for
// Coordinador, and its bottom tab bar already shows Dashboard under that
// same role === "ADMIN" check). STAFF's whole world is Escanear/Lista
// (no Dashboard link rendered for STAFF at all) — landing here directly
// by URL still has to redirect, not show a "hidden" placeholder, since
// STAFF has no dashboard to see. This used to check the real role
// strictly === "ADMIN", which redirected COORDINADOR away from a tab
// their own nav bar shows them — caught while adding the Bandeja tab
// next to it and re-checking every role gate in this shell.
export default async function EventDashboardPage({ params }: { params: { eventId: string } }) {
  const user = await getCurrentUser();
  if (user?.role === "STAFF") redirect(`/admin/scan/${params.eventId}/scanner`);

  return <EventStatsPanel eventId={params.eventId} />;
}
