import { requirePageUser } from "@/lib/auth/guard";
import WhatsAppInboxList from "@/components/WhatsAppInboxList";

export const dynamic = "force-dynamic";

// The mobile counterpart to /admin/crm/whatsapp/bandeja — same list
// component, same API routes, reused as-is (see WhatsAppInboxList's own
// comment on basePath) so replies during an event go through the exact
// same code path as from the desktop CRM, not a second copy that could
// drift. ADMIN + COORDINADOR only — STAFF's bottom nav never even shows
// this tab (see ScanAppShell), but the route itself is re-gated here too,
// same "nav visibility is never the real gate" pattern as every other
// admin page in this app.
//
// Single-column, not the desktop's persistent list + pane split — a 480px
// mobile shell has no room for a sidebar, so tapping a conversation
// navigates to its own full-screen thread route instead (see [id]/page.tsx).
export default async function ScanBandejaPage({ params }: { params: { eventId: string } }) {
  await requirePageUser(["ADMIN", "COORDINADOR"]);

  return (
    <div style={{ margin: "-16px -16px 0", minHeight: "calc(100dvh - 260px)" }}>
      <WhatsAppInboxList basePath={`/admin/scan/${params.eventId}/bandeja`} />
    </div>
  );
}
