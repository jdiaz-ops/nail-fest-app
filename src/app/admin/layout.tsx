import AdminNavLink from "./AdminNavLink";

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

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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
          {NAV.map((item) => (
            <AdminNavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </nav>
      </header>
      <div style={{ padding: "24px 32px" }}>{children}</div>
    </div>
  );
}
