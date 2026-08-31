import { db } from "@/lib/db";
import WhatsAppNavLink from "./WhatsAppNavLink";

export const dynamic = "force-dynamic";

const TABS: { href: string; label: string }[] = [
  { href: "/admin/crm/whatsapp/conexion", label: "Conexión" },
  { href: "/admin/crm/whatsapp/plantillas", label: "Plantillas" },
  { href: "/admin/crm/whatsapp/automatizaciones", label: "Automatizaciones" },
  { href: "/admin/crm/whatsapp/difusiones", label: "Difusiones" },
  { href: "/admin/crm/whatsapp/bandeja", label: "Bandeja" },
];

export default async function WhatsAppLayout({ children }: { children: React.ReactNode }) {
  const unread = await db.whatsAppConversation.aggregate({ _sum: { unreadCount: true } });
  const unreadTotal = unread._sum.unreadCount ?? 0;

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid #e3e1dc", paddingBottom: 12 }}>
        {TABS.map((tab) => (
          <span key={tab.href} style={{ position: "relative" }}>
            <WhatsAppNavLink href={tab.href} label={tab.label} />
            {tab.href.endsWith("/bandeja") && unreadTotal > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: -2,
                  right: -2,
                  background: "#c2185b",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 700,
                  borderRadius: 999,
                  minWidth: 16,
                  height: 16,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 4px",
                }}
              >
                {unreadTotal}
              </span>
            )}
          </span>
        ))}
      </div>
      {children}
    </div>
  );
}
