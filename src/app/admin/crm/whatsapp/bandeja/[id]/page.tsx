import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import WhatsAppThreadComposer from "@/components/WhatsAppThreadComposer";
import WhatsAppMarkRead from "@/components/WhatsAppMarkRead";
import WhatsAppWindowCountdown from "@/components/WhatsAppWindowCountdown";
import WhatsAppAssignAgent from "@/components/WhatsAppAssignAgent";
import WhatsAppPersonLabels from "@/components/WhatsAppPersonLabels";
import CrmPageHeader from "../../../CrmPageHeader";

export const dynamic = "force-dynamic";

const WINDOW_MS = 24 * 60 * 60 * 1000;

// One merged, chronological timeline entry — either a real WhatsApp
// message or an internal note, so the thread reads top-to-bottom the way
// the conversation (and the team's own commentary on it) actually
// happened, instead of two disconnected lists.
type TimelineItem =
  | { kind: "message"; id: string; createdAt: Date; direction: "INBOUND" | "OUTBOUND"; body: string | null; messageKind: string; status: string }
  | { kind: "note"; id: string; createdAt: Date; text: string; authorName: string | null };

export default async function WhatsAppThreadPage({ params }: { params: { id: string } }) {
  const conversation = await db.whatsAppConversation.findUnique({
    where: { id: params.id },
    include: {
      person: { include: { labels: true } },
      assignedTo: true,
      messages: { orderBy: { createdAt: "asc" } },
      notes: { orderBy: { createdAt: "asc" }, include: { author: true } },
    },
  });
  if (!conversation) notFound();

  const [agents, orgSettings, lastRegistration] = await Promise.all([
    db.adminUser.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    getOrgSettings(),
    conversation.personId
      ? db.registration.findFirst({ where: { personId: conversation.personId }, orderBy: { createdAt: "desc" } })
      : null,
  ]);

  const withinWindow = Boolean(conversation.lastInboundAt && Date.now() - conversation.lastInboundAt.getTime() < WINDOW_MS);
  const name = conversation.person
    ? [conversation.person.firstName, conversation.person.lastName].filter(Boolean).join(" ") || conversation.person.email
    : "Contacto sin identificar";

  const timeline: TimelineItem[] = [
    ...conversation.messages.map((m) => ({
      kind: "message" as const,
      id: m.id,
      createdAt: m.createdAt,
      direction: m.direction,
      body: m.body,
      messageKind: m.kind,
      status: m.status,
    })),
    ...conversation.notes.map((n) => ({
      kind: "note" as const,
      id: n.id,
      createdAt: n.createdAt,
      text: n.text,
      authorName: n.author?.name ?? n.author?.username ?? null,
    })),
  ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const optInSource = lastRegistration
    ? [lastRegistration.utmSource, lastRegistration.utmMedium, lastRegistration.utmCampaign].filter(Boolean).join(" / ") || "Registro directo"
    : "—";

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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24, alignItems: "start" }}>
        <div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            {timeline.map((item) =>
              item.kind === "note" ? (
                <div key={item.id} style={{ alignSelf: "center", maxWidth: "85%", background: "#fdf6e3", border: "1px dashed #e0c477", borderRadius: 8, padding: "8px 12px" }}>
                  <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>📝 {item.text}</div>
                  <div style={{ fontSize: 11, color: "#8a8478", marginTop: 2 }}>
                    Nota interna{item.authorName ? ` · ${item.authorName}` : ""} · {new Date(item.createdAt).toLocaleString("es-CO")}
                  </div>
                </div>
              ) : (
                <div
                  key={item.id}
                  style={{
                    alignSelf: item.direction === "OUTBOUND" ? "flex-end" : "flex-start",
                    maxWidth: "70%",
                    background: item.direction === "OUTBOUND" ? "#ffe4d1" : "#f6f5f2",
                    borderRadius: 12,
                    padding: "10px 14px",
                  }}
                >
                  <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{item.body ?? "—"}</div>
                  <div style={{ fontSize: 11, color: "#8a8478", marginTop: 4, display: "flex", gap: 8 }}>
                    <span>{new Date(item.createdAt).toLocaleString("es-CO")}</span>
                    {item.direction === "OUTBOUND" && (
                      <span>
                        {item.messageKind === "TEMPLATE" ? "Plantilla" : "Respuesta"} · {item.status}
                      </span>
                    )}
                  </div>
                </div>
              )
            )}
            {timeline.length === 0 && <p style={{ color: "#5b5f6b" }}>Sin mensajes todavía.</p>}
          </div>

          <WhatsAppThreadComposer conversationId={conversation.id} windowOpen={withinWindow} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <SidebarSection title="Ventana de mensajería">
            <WhatsAppWindowCountdown lastInboundAt={conversation.lastInboundAt?.toISOString() ?? null} />
          </SidebarSection>

          <SidebarSection title="Agente asignado">
            <WhatsAppAssignAgent
              conversationId={conversation.id}
              agents={agents.map((a) => ({ id: a.id, label: a.name || a.username }))}
              assignedToId={conversation.assignedToId}
            />
          </SidebarSection>

          <SidebarSection title="Etiquetas">
            {conversation.personId ? (
              <WhatsAppPersonLabels conversationId={conversation.id} labels={conversation.person?.labels ?? []} />
            ) : (
              <span style={{ fontSize: 12, color: "#8a8478" }}>Sin contacto vinculado del CRM todavía.</span>
            )}
          </SidebarSection>

          <SidebarSection title="Datos del contacto">
            <SnapshotRow label="Cliente desde" value={new Date(conversation.createdAt).toLocaleDateString("es-CO")} />
            <SnapshotRow
              label="Último mensaje suyo"
              value={conversation.lastInboundAt ? new Date(conversation.lastInboundAt).toLocaleString("es-CO") : "—"}
            />
            <SnapshotRow label="Idioma" value={orgSettings.language === "es" ? "Español" : orgSettings.language} />
            <SnapshotRow label="País" value="Colombia" />
            <SnapshotRow label="Zona horaria" value={orgSettings.timezone} />
            <SnapshotRow label="Origen del contacto" value={optInSource} />
          </SidebarSection>
        </div>
      </div>
    </div>
  );
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid #e3e1dc", borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#5b5f6b", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function SnapshotRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
      <span style={{ color: "#8a8478" }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: "right" }}>{value}</span>
    </div>
  );
}
