import AdminNavLink from "./AdminNavLink";
import LogoutButton from "./LogoutButton";
import { requirePageUser } from "@/lib/auth/guard";

// Full-width dark top bar, matching Ticket Tailor's dashboard shell — the
// nav items are our real sections (no Orders/Products/Promote stand-ins;
// see the settings work's discussion on why those don't map to anything
// here). Content below is full-bleed too; individual pages set their own
// internal max-width where it matters (forms, cards), same as Ticket
// Tailor's own settings panels do inside a full-width shell.
const NAV: { href: string; label: string }[] = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/events", label: "Eventos" },
  { href: "/admin/crm", label: "CRM" },
  { href: "/admin/scan", label: "Escáner" },
  { href: "/admin/settings", label: "Configuración" },
];

// Every /admin/* page inherits this layout, so this is where "must be
// logged in" is enforced once for the whole section — see
// lib/auth/guard.ts's own comment on why this can't also be middleware
// (Prisma can't run on the Edge runtime this app's middleware used to run
// on; the real DB-backed check has to live in a Node-runtime layout or
// route handler instead). Role-SPECIFIC restrictions (e.g. only ADMIN may
// see Resumen/Eventos/CRM/Configuración) live one level deeper, in each of
// those section's own layout/page — this outer layout only cares "is
// anyone logged in at all", and hides the nav entirely for STAFF, whose
// only reachable page is /admin/scan.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  const isAdmin = user.role === "ADMIN";

  return (
    <div>
      <header style={{ background: "#14141c" }}>
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "12px 32px",
            overflowX: "auto",
          }}
        >
          <span style={{ color: "#fff", fontWeight: 700, marginRight: 20, whiteSpace: "nowrap" }}>Nail Fest</span>
          {isAdmin && NAV.map((item) => <AdminNavLink key={item.href} href={item.href} label={item.label} />)}
          <div style={{ flex: 1 }} />
          <span style={{ color: "#8a8478", fontSize: 13, whiteSpace: "nowrap" }}>{user.name || user.username}</span>
          <LogoutButton />
        </nav>
      </header>
      <div style={{ padding: "24px 32px" }}>{children}</div>
    </div>
  );
}
