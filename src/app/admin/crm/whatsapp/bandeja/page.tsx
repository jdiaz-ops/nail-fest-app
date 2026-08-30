import Link from "next/link";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import CrmPageHeader from "../../CrmPageHeader";

export const dynamic = "force-dynamic";

type Filter = "all" | "unread" | "mine";

const TABS: { key: Filter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "unread", label: "No leídos" },
  { key: "mine", label: "Asignados a mí" },
];

export default async function WhatsAppBandejaPage({ searchParams }: { searchParams: { filter?: string } }) {
  const user = await requirePageUser(["ADMIN"]);
  const filter: Filter = searchParams.filter === "unread" || searchParams.filter === "mine" ? searchParams.filter : "all";

  const conversations = await db.whatsAppConversation.findMany({
    where: filter === "unread" ? { unreadCount: { gt: 0 } } : filter === "mine" ? { assignedToId: user.id } : undefined,
    orderBy: [{ lastInboundAt: "desc" }, { updatedAt: "desc" }],
    take: 100,
    include: {
      person: true,
      assignedTo: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return (
    <div>
      <CrmPageHeader
        title="Bandeja"
        subtitle="Conversaciones de WhatsApp — respuestas de texto libre solo dentro de las 24h después del último mensaje de la persona."
      />

      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {TABS.map((tab) => {
          const active = filter === tab.key;
          return (
            <Link
              key={tab.key}
              href={tab.key === "all" ? "/admin/crm/whatsapp/bandeja" : `/admin/crm/whatsapp/bandeja?filter=${tab.key}`}
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                fontSize: 13,
                textDecoration: "none",
                color: active ? "#1c1310" : "#5b5f6b",
                background: active ? "#f0efec" : "transparent",
                fontWeight: active ? 600 : 400,
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {conversations.map((c) => {
          const last = c.messages[0];
          const withinWindow = c.lastInboundAt && Date.now() - c.lastInboundAt.getTime() < 24 * 60 * 60 * 1000;
          return (
            <Link
              key={c.id}
              href={`/admin/crm/whatsapp/bandeja/${c.id}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "12px 16px",
                border: "1px solid #e3e1dc",
                borderRadius: 10,
                textDecoration: "none",
                color: "#1c1310",
                background: c.unreadCount > 0 ? "#fff9f4" : "#fff",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: c.unreadCount > 0 ? 700 : 500, display: "flex", alignItems: "center", gap: 8 }}>
                  {c.person ? [c.person.firstName, c.person.lastName].filter(Boolean).join(" ") || c.person.email : "Contacto sin identificar"}
                  {c.assignedTo && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#5b5f6b", background: "#f0efec", borderRadius: 999, padding: "1px 8px" }}>
                      {c.assignedTo.name || c.assignedTo.username}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: "#5b5f6b" }}>{c.phone}</div>
                {last?.body && (
                  <div style={{ fontSize: 13, color: "#8a8478", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 480 }}>
                    {last.direction === "OUTBOUND" ? "Tú: " : ""}
                    {last.body}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                {c.unreadCount > 0 && (
                  <span style={{ background: "#c2185b", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "2px 8px" }}>
                    {c.unreadCount}
                  </span>
                )}
                <span style={{ fontSize: 12, fontWeight: 600, color: withinWindow ? "#12966b" : "#b5b0a6" }}>
                  {withinWindow ? "Ventana abierta" : "Ventana cerrada"}
                </span>
              </div>
            </Link>
          );
        })}
        {conversations.length === 0 && (
          <p style={{ color: "#5b5f6b" }}>
            {filter === "all"
              ? "Aún no hay conversaciones — aparecerán acá en cuanto alguien te escriba o reciba una difusión."
              : "No hay conversaciones que coincidan con este filtro."}
          </p>
        )}
      </div>
    </div>
  );
}
