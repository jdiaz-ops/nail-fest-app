import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import { formatDateInTz } from "@/lib/dateFormat";
import { getCurrentUser } from "@/lib/auth/session";
import EventModuleShell from "../EventModuleShell";

// Wraps every /admin/events/[id]/* page (summary, reports, tickets,
// broadcasts, edit, confirmation) in the shared left-nav module shell —
// see EventModuleShell's own comment. requirePageUser(["ADMIN",
// "COORDINADOR"]) already runs one level up in admin/events/layout.tsx,
// so this only fetches the event itself (and the current role, so
// EventModuleShell knows which nav items/actions to hide for
// COORDINADOR — the real gate for those still lives on each of those
// pages themselves, this is only visibility).
export default async function EventShellLayout({ children, params }: { children: React.ReactNode; params: { id: string } }) {
  const [event, orgSettings, user] = await Promise.all([
    db.event.findUnique({ where: { id: params.id } }),
    getOrgSettings(),
    getCurrentUser(),
  ]);
  if (!event) notFound();

  const eventWhen =
    formatDateInTz(event.startsAt, { dateStyle: "medium", timeStyle: "short" }, orgSettings.timezone, orgSettings.language) +
    (event.endsAt
      ? ` – ${formatDateInTz(event.endsAt, { dateStyle: "medium", timeStyle: "short" }, orgSettings.timezone, orgSettings.language)}`
      : "");

  return (
    <EventModuleShell
      eventId={event.id}
      eventName={event.name}
      eventWhen={eventWhen}
      statusLabel={event.status === "PUBLISHED" ? "Publicado" : "Borrador"}
      eventSlug={event.slug}
      isAdmin={user?.role === "ADMIN"}
    >
      {children}
    </EventModuleShell>
  );
}
