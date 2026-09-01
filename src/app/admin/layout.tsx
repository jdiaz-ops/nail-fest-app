import AdminTopNav from "./AdminTopNav";
import { requirePageUser } from "@/lib/auth/guard";

// Every /admin/* page inherits this layout, so this is where "must be
// logged in" is enforced once for the whole section — see
// lib/auth/guard.ts's own comment on why this can't also be middleware
// (Prisma can't run on the Edge runtime this app's middleware used to run
// on; the real DB-backed check has to live in a Node-runtime layout or
// route handler instead). Role-SPECIFIC restrictions (e.g. only ADMIN may
// see Resumen/Eventos/CRM/Configuración) live one level deeper, in each of
// those section's own layout/page. See AdminTopNav for why /admin/scan
// gets none of this chrome — it's its own app shell.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();

  return (
    <AdminTopNav userLabel={user.name || user.username} role={user.role}>
      {children}
    </AdminTopNav>
  );
}
