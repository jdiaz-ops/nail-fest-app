import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import WhatsAppReplyBox from "@/components/WhatsAppReplyBox";
import WhatsAppMarkRead from "@/components/WhatsAppMarkRead";
import CrmPageHeader from "../../../CrmPageHeader";

export const dynamic = "force-dynamic";

export default async function WhatsAppThreadPage({ params }: { params: { id: string } }) {
  const conversation = await db.whatsAppConversation.findUnique({
    where: { id: params.id },
    include: { person: true, messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conversation) notFound();

  const withinWindow = Boolean(conversation.lastInboundAt && Date.now() - conversation.lastInboundAt.getTime() < 24 * 60 * 60 * 1000);
  const name = conversation.person
    ? [conversation.person.firstName, conversation.person.lastName].filter(Boolean).join(" ") || conversation.person.email
    : "Contacto sin identificar";

  return (
    <div>
      <WhatsAppMarkRead conversationId={conversation.id} />
      <Link href="/admin/crm/whatsapp/bandeja" style={{ fontSize: 13, color: "#5b5f6b" }}>
        ← Bandeja
      </Link>
      <CrmPageHeader
        title={name}
        subtitle={`${conversation.phone}${conversation.person ? "" : " — no coincide con ninguna persona del CRM"}`}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {conversation.messages.map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.direction === "OUTBOUND" ? "flex-end" : "flex-start",
              maxWidth: "70%",
              background: m.direction === "OUTBOUND" ? "#ffe4d1" : "#f6f5f2",
              borderRadius: 12,
              padding: "10px 14px",
            }}
          >
            <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{m.body ?? "—"}</div>
            <div style={{ fontSize: 11, color: "#8a8478", marginTop: 4, display: "flex", gap: 8 }}>
              <span>{new Date(m.createdAt).toLocaleString("es-CO")}</span>
              {m.direction === "OUTBOUND" && <span>{m.kind === "TEMPLATE" ? "Plantilla" : "Respuesta"} · {m.status}</span>}
            </div>
          </div>
        ))}
        {conversation.messages.length === 0 && <p style={{ color: "#5b5f6b" }}>Sin mensajes todavía.</p>}
      </div>

      <WhatsAppReplyBox conversationId={conversation.id} windowOpen={withinWindow} />
    </div>
  );
}
