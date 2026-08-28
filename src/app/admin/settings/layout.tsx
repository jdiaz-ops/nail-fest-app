import { Fraunces } from "next/font/google";
import SettingsNavLink from "./SettingsNavLink";

// Ticket Tailor's "Box office settings" — nivel 1 (cuenta completa), as
// opposed to any single event's own settings (nivel 2, still to come).
// Styled to match their real admin panel closely (per the screenshot
// review): the coral/salmon active state, the slab-serif display heading,
// the emerald save buttons — scoped to this settings section only, not a
// site-wide reskin.
const fraunces = Fraunces({ subsets: ["latin"], weight: ["600", "900"] });

const NAV: { href: string; label: string }[] = [
  { href: "/admin/settings/basic", label: "Datos básicos" },
  { href: "/admin/settings/contact", label: "Contacto" },
  { href: "/admin/settings/privacy", label: "Política de privacidad" },
  { href: "/admin/settings/banned-emails", label: "Correos bloqueados" },
  { href: "/admin/settings/cookie-consent", label: "Aviso de cookies" },
  { href: "/admin/settings/self-serve", label: "Autoservicio" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <h1 className={fraunces.className} style={{ fontWeight: 900, fontSize: 28, marginBottom: 24 }}>
        Configuración general
      </h1>
      <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
        <nav style={{ width: 200, flex: "0 0 auto" }}>
          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "#8a8478", marginBottom: 8 }}>
            Editar
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            {NAV.map((item) => (
              <li key={item.href}>
                <SettingsNavLink href={item.href} label={item.label} />
              </li>
            ))}
          </ul>
        </nav>
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      </div>
    </div>
  );
}
