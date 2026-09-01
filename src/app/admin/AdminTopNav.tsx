"use client";

import { usePathname } from "next/navigation";
import type { AdminRole } from "@prisma/client";
import AdminNavLink from "./AdminNavLink";
import LogoutButton from "./LogoutButton";

const NAV: { href: string; label: string; adminOnly?: boolean }[] = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/events", label: "Eventos" },
  { href: "/admin/crm", label: "CRM" },
  { href: "/admin/scan", label: "Escáner" },
  // COORDINADOR never gets these two — hidden here AND gated again on
  // their own pages (already ADMIN-only, unchanged), same "nav
  // visibility isn't the real gate" reasoning as CrmLayout/
  // EventModuleShell.
  { href: "/admin/homepage", label: "Editar homepage", adminOnly: true },
  { href: "/admin/settings", label: "Configuración", adminOnly: true },
];

// Wraps every /admin/* page's chrome. Under /admin/scan this renders
// nothing but the bare children, full-bleed, no padding — that whole area
// is its own immersive app shell (Events → Dashboard/Escanear/Lista,
// modeled on a real scanner app), not a page living inside the desktop
// dashboard's top bar and padding. Needs usePathname, hence a client
// component; the server layout that renders this has no other way to
// know the current route (see lib/auth/guard.ts's own comment on why
// nothing here runs on the Edge where middleware could otherwise read
// that for free). STAFF can only ever be under /admin/scan (every other
// section redirects them there), so in practice the desktop chrome below
// never renders for STAFF at all — no role filtering needed for that,
// the pathname check already covers it. COORDINADOR DOES see this chrome
// (Resumen/Eventos/CRM/Escáner all partly theirs) — just with the two
// ADMIN-only items above filtered out.
export default function AdminTopNav({ userLabel, role, children }: { userLabel: string; role: AdminRole; children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin/scan")) return <>{children}</>;

  const nav = role === "ADMIN" ? NAV : NAV.filter((item) => !item.adminOnly);

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
          {nav.map((item) => (
            <AdminNavLink key={item.href} href={item.href} label={item.label} />
          ))}
          <div style={{ flex: 1 }} />
          <span style={{ color: "#8a8478", fontSize: 13, whiteSpace: "nowrap" }}>{userLabel}</span>
          <LogoutButton />
        </nav>
      </header>
      <div style={{ padding: "24px 32px" }}>{children}</div>
    </div>
  );
}
