import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import { getOrgSettings } from "@/lib/settings";
import ScanAppShell from "../ScanAppShell";

export const dynamic = "force-dynamic";

export default async function EventScanLayout({ children, params }: { children: React.ReactNode; params: { eventId: string } }) {
  const user = await requirePageUser(["ADMIN", "STAFF"]);
  const [event, orgSettings] = await Promise.all([
    db.event.findUnique({ where: { id: params.eventId }, select: { id: true, name: true, city: true, startsAt: true, endsAt: true } }),
    getOrgSettings(),
  ]);
  if (!event) notFound();

  return (
    <ScanAppShell
      event={{ ...event, startsAt: event.startsAt.toISOString(), endsAt: event.endsAt?.toISOString() ?? null }}
      role={user.role}
      timezone={orgSettings.timezone}
      language={orgSettings.language}
    >
      {children}
    </ScanAppShell>
  );
}
