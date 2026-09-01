import { requirePageUser } from "@/lib/auth/guard";

// No visual shell of its own (each page under here still uses the outer
// /admin/layout.tsx's nav) — this file exists purely to gate the whole
// Eventos section in one place instead of repeating the check in every
// page underneath. COORDINADOR gets the list and an event's own Resumen/
// Reportes/Entradas emitidas — everything more consequential (crear
// evento nuevo, editar evento y entradas, correos del evento,
// confirmación, copiar, borrar) is ADMIN-only and gated again, tighter,
// on its own page (see new/page.tsx, [id]/edit/page.tsx, [id]/
// broadcasts/page.tsx, [id]/confirmation/page.tsx — and EventModuleShell
// for the matching nav/action visibility).
export default async function EventsLayout({ children }: { children: React.ReactNode }) {
  await requirePageUser(["ADMIN", "COORDINADOR"]);
  return <>{children}</>;
}
