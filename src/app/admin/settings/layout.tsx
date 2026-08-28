import { Fraunces } from "next/font/google";
import SettingsNavLink from "./SettingsNavLink";

// Ticket Tailor's "Box office settings" — nivel 1 (cuenta completa), as
// opposed to any single event's own settings (nivel 2, still to come).
// Styled to match their real admin panel closely (per the screenshot
// review): the coral/salmon active state, the slab-serif display heading,
// the emerald save buttons — scoped to this settings section only, not a
// site-wide reskin.
const fraunces = Fraunces({ subsets: ["latin"], weight: ["600", "900"] });

const EDIT_NAV: { href: string; label: string }[] = [
  { href: "/admin/settings/basic", label: "Datos básicos" },
  { href: "/admin/settings/contact", label: "Contacto" },
  { href: "/admin/settings/privacy", label: "Política de privacidad" },
  { href: "/admin/settings/banned-emails", label: "Correos bloqueados" },
  { href: "/admin/settings/cookie-consent", label: "Aviso de cookies" },
  { href: "/admin/settings/self-serve", label: "Autoservicio" },
];

const MANAGE_NAV: { href: string; label: string }[] = [
  { href: "/admin/settings/integrations", label: "Integraciones" },
];

// Not real routes yet — nothing to configure (no integración externa que
// use una API key propia, ningún dominio conectado a Vercel todavía).
// Shown greyed-out rather than hidden so the shape of Ticket Tailor's
// "Manage" group stays visible — same reasoning as the roadmap items in
// the infra-audit doc, just inline here.
const MANAGE_PLACEHOLDERS = ["API", "Dominio propio"];

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
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 2, marginBottom: 24 }}>
            {EDIT_NAV.map((item) => (
              <li key={item.href}>
                <SettingsNavLink href={item.href} label={item.label} />
              </li>
            ))}
          </ul>

          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "#8a8478", marginBottom: 8 }}>
            Administrar
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            {MANAGE_NAV.map((item) => (
              <li key={item.href}>
                <SettingsNavLink href={item.href} label={item.label} />
              </li>
            ))}
            {MANAGE_PLACEHOLDERS.map((label) => (
              <li key={label} style={{ padding: "8px 12px", fontSize: 14, color: "#b5b0a6", cursor: "default" }}>
                {label}
              </li>
            ))}
          </ul>
        </nav>
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      </div>
    </div>
  );
}
