import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import EventStatsPanel from "../EventStatsPanel";

export const dynamic = "force-dynamic";

// The Dashboard tab — admin only. STAFF's whole world is Escanear/Lista
// (see ScanAppShell's bottom tabs, which don't even render a Dashboard
// link for STAFF) — landing here directly by URL still has to redirect,
// not show a "hidden" placeholder, since STAFF has no dashboard to see.
export default async function EventDashboardPage({ params }: { params: { eventId: string } }) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") redirect(`/admin/scan/${params.eventId}/scanner`);

  return <EventStatsPanel eventId={params.eventId} />;
}
