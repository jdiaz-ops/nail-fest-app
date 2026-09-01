import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import { getOrgSettings } from "@/lib/settings";
import ScanAppShell from "../ScanAppShell";

export const dynamic = "force-dynamic";

export default async function EventScanLayout({ children, params }: { children: React.ReactNode; params: { eventId: string } }) {
  const user = await requirePageUser(["ADMIN", "STAFF", "COORDINADOR"]);
  const [event, orgSettings] = await Promise.all([
    db.event.findUnique({ where: { id: params.eventId }, select: { id: true, name: true, city: true, startsAt: true, endsAt: true } }),
    getOrgSettings(),
  ]);
  if (!event) notFound();

  // The scanner's own role prop only ever distinguished "full scanner
  // privileges" from "just scan" — COORDINADOR gets the former ("todo en
  // escáner" was the explicit ask), so it maps to the same "ADMIN" value
  // here rather than widening ScanAppShell/ScanAppContext's own type to
  // a third case they'd have to know about.
  const scannerRole: "ADMIN" | "STAFF" = user.role === "STAFF" ? "STAFF" : "ADMIN";

  return (
    <ScanAppShell
      event={{ ...event, startsAt: event.startsAt.toISOString(), endsAt: event.endsAt?.toISOString() ?? null }}
      role={scannerRole}
      timezone={orgSettings.timezone}
      language={orgSettings.language}
    >
      {children}
    </ScanAppShell>
  );
}
