import { requirePageUser } from "@/lib/auth/guard";

// No visual shell of its own (each page under here still uses the outer
// /admin/layout.tsx's nav) — this file exists purely to gate the whole
// Eventos section behind ADMIN in one place instead of repeating the check
// in page.tsx, new/page.tsx and [id]/edit/page.tsx separately.
export default async function EventsLayout({ children }: { children: React.ReactNode }) {
  await requirePageUser(["ADMIN"]);
  return <>{children}</>;
}
