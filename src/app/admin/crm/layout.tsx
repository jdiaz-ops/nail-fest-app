import { Fraunces } from "next/font/google";
import CrmNavLink from "./CrmNavLink";
import { requirePageUser } from "@/lib/auth/guard";

// Groups the contact-database-facing sections behind one top-level "CRM"
// tab, same pattern as Configuración: a nested sidebar instead of four
// separate top-nav tabs.
const fraunces = Fraunces({ subsets: ["latin"], weight: ["600", "900"] });

const NAV: { href: string; label: string }[] = [
  { href: "/admin/crm/personas", label: "Personas" },
  { href: "/admin/crm/registrations", label: "Inscritos" },
  { href: "/admin/crm/abandonados", label: "Abandonados" },
  { href: "/admin/crm/import", label: "Importar" },
  { href: "/admin/crm/broadcasts", label: "Broadcasts" },
  { href: "/admin/crm/segments", label: "Segmentos" },
];

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  await requirePageUser(["ADMIN"]);
  return (
    <div>
      <h1 className={fraunces.className} style={{ fontWeight: 900, fontSize: 28, marginBottom: 24 }}>
        CRM
      </h1>
      <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
        <nav style={{ width: 200, flex: "0 0 auto" }}>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            {NAV.map((item) => (
              <li key={item.href}>
                <CrmNavLink href={item.href} label={item.label} />
              </li>
            ))}
          </ul>
        </nav>
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      </div>
    </div>
  );
}
