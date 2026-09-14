import { Fraunces } from "next/font/google";
import CrmNavLink from "./CrmNavLink";
import { requirePageUser } from "@/lib/auth/guard";

// Groups the contact-database-facing sections behind one top-level "CRM"
// tab, same pattern as Configuración: a nested sidebar instead of four
// separate top-nav tabs.
const fraunces = Fraunces({ subsets: ["latin"], weight: ["600", "900"] });

// "Inscritos" (una fila por inscripción, con su fuente de tráfico —
// vivía en /admin/crm/registrations) se eliminó — duplicaba casi toda su
// tabla con Entradas emitidas (dentro de cada evento), y la única
// columna real que no tenía equivalente ahí (Fuente/utmSource) se movió
// a Entradas emitidas en vez de seguir mostrándose en dos sitios. Ver el
// historial de git si hace falta recuperar la página.
const NAV: { href: string; label: string; adminOnly?: boolean }[] = [
  { href: "/admin/crm/personas", label: "Personas" },
  { href: "/admin/crm/ciudades", label: "Limpiar ciudades" },
  { href: "/admin/crm/abandonados", label: "Abandonados" },
  // Importar/Broadcasts/Segmentos: COORDINADOR doesn't get these — hidden
  // here AND gated again on each own page (see those pages' own
  // requirePageUser call), same "nav visibility isn't the real gate"
  // reasoning as EventModuleShell.
  { href: "/admin/crm/import", label: "Importar", adminOnly: true },
  { href: "/admin/crm/broadcasts", label: "Broadcasts", adminOnly: true },
  { href: "/admin/crm/whatsapp", label: "WhatsApp" },
  { href: "/admin/crm/segments", label: "Segmentos", adminOnly: true },
  // Corrige código de país equivocado/ausente + fusiona duplicados por
  // teléfono — a diferencia de Supresiones/Etiquetar/Higiene (retiradas,
  // eran herramientas de migración de una sola vez), esto se queda: cada
  // tanda nueva de registros produce ambos patrones de nuevo.
  { href: "/admin/crm/telefonos", label: "Teléfonos y WhatsApp", adminOnly: true },
  // Supresiones / Etiquetar por lista / Higiene de la lista existieron
  // aquí como herramientas de prueba (import de una lista externa de
  // Brevo, chequeo de calidad de correo/teléfono) — retiradas a pedido
  // explícito. Ver el historial de git si hace falta recuperar alguna.
];

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser(["ADMIN", "COORDINADOR"]);
  const nav = user.role === "ADMIN" ? NAV : NAV.filter((item) => !item.adminOnly);
  return (
    <div>
      <h1 className={fraunces.className} style={{ fontWeight: 900, fontSize: 28, marginBottom: 24 }}>
        CRM
      </h1>
      <div className="admin-sidebar-layout">
        <nav className="admin-sidebar-nav" style={{ width: 200, flex: "0 0 auto" }}>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            {nav.map((item) => (
              <li key={item.href}>
                <CrmNavLink href={item.href} label={item.label} />
              </li>
            ))}
          </ul>
        </nav>
        <div className="admin-sidebar-content">{children}</div>
      </div>
    </div>
  );
}
