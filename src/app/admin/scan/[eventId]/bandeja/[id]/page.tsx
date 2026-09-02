import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import { listResendableRegistrations } from "@/lib/whatsapp/sendTicketPdf";
import WhatsAppThreadComposer from "@/components/WhatsAppThreadComposer";
import WhatsAppMarkRead from "@/components/WhatsAppMarkRead";
import WhatsAppWindowCountdown from "@/components/WhatsAppWindowCountdown";
import WhatsAppSendTicketButton from "@/components/WhatsAppSendTicketButton";

export const dynamic = "force-dynamic";

const WINDOW_MS = 24 * 60 * 60 * 1000;

type TimelineItem =
  | {
      kind: "message";
      id: string;
      createdAt: Date;
      direction: "INBOUND" | "OUTBOUND";
      body: string | null;
      messageKind: string;
      status: string;
      generatedByAi: boolean;
    }
  | { kind: "note"; id: string; createdAt: Date; text: string; authorName: string | null };

// Mobile counterpart to bandeja/[id]/page.tsx — same timeline + composer,
// deliberately WITHOUT that page's 300px sidebar (agent assignment, AI
// toggle, labels, editing the person's own fields): none of that is what
// "contestar durante el evento" needs, and there's no room for it at
// 480px wide anyway. What stays, because it's genuinely useful mid-event
// — someone's at the door saying they never got their ticket — is the
// messaging-window countdown and the resend-ticket button, tucked into a
// single collapsible "Detalles" section (same <details> pattern
// ScanAppShell's own device-label field already uses) so the thread
// itself, not the sidebar, is what fills the screen. Full sidebar tools
// stay desktop-only, in the real CRM.
export default async function ScanWhatsAppThreadPage({ params }: { params: { eventId: string; id: string } }) {
  await requirePageUser(["ADMIN", "COORDINADOR"]);

  const conversation = await db.whatsAppConversation.findUnique({
    where: { id: params.id },
    include: {
      person: true,
      messages: { orderBy: { createdAt: "asc" } },
      notes: { orderBy: { createdAt: "asc" }, include: { author: true } },
    },
  });
  if (!conversation) notFound();

  const resendableRegistrations = conversation.personId ? await listResendableRegistrations(conversation.personId) : [];

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
      generatedByAi: m.generatedByAi,
    })),
    ...conversation.notes.map((n) => ({
      kind: "note" as const,
      id: n.id,
      createdAt: n.createdAt,
      text: n.text,
      authorName: n.author?.name ?? n.author?.username ?? null,
    })),
  ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  return (
    <div style={{ margin: "-16px -16px 0", display: "flex", flexDirection: "column", minHeight: "calc(100dvh - 172px)" }}>
      <WhatsAppMarkRead conversationId={conversation.id} />

      <div style={{ padding: "10px 16px", borderBottom: "1px solid #e3e1dc", flexShrink: 0 }}>
        <Link
          href={`/admin/scan/${params.eventId}/bandeja`}
          style={{ fontSize: 12.5, color: "var(--link)", textDecoration: "none", fontWeight: 600 }}
        >
          ← Bandeja
        </Link>
        <div style={{ fontWeight: 700, fontSize: 15, marginTop: 4 }}>{name}</div>
        <div style={{ fontSize: 12.5, color: "#8a8478" }}>
          {conversation.phone}
          {!conversation.person && " — no coincide con ninguna persona del CRM"}
        </div>
      </div>

      <div style={{ padding: "10px 16px", borderBottom: "1px solid #e3e1dc", flexShrink: 0 }}>
        <details>
          <summary style={{ fontSize: 12.5, color: "#5b5f6b", cursor: "pointer" }}>Detalles</summary>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#8a8478", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                Ventana de mensajería
              </div>
              <WhatsAppWindowCountdown lastInboundAt={conversation.lastInboundAt?.toISOString() ?? null} />
            </div>
            {conversation.personId && resendableRegistrations.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#8a8478", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                  Entradas
                </div>
                {!withinWindow && (
                  <p style={{ fontSize: 12, color: "#8a5a1f", margin: "0 0 8px" }}>
                    Ventana cerrada — no se puede reenviar un PDF hasta que la persona vuelva a escribir.
                  </p>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {resendableRegistrations.map((r) => (
                    <div key={r.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 500 }}>{r.event.name}</span>
                      <span style={{ fontSize: 11, color: "#8a8478" }}>{r.id.slice(-8).toUpperCase()}</span>
                      {withinWindow && <WhatsAppSendTicketButton conversationId={conversation.id} registrationId={r.id} />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </details>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {timeline.map((item) =>
          item.kind === "note" ? (
            <div key={item.id} style={{ alignSelf: "center", maxWidth: "90%", background: "#fdf6e3", border: "1px dashed #e0c477", borderRadius: 8, padding: "8px 12px" }}>
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
                maxWidth: "82%",
                background: item.direction === "OUTBOUND" ? "#ffe4d1" : "#f6f5f2",
                borderRadius: 12,
                padding: "10px 14px",
              }}
            >
              <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{item.body ?? "—"}</div>
              <div style={{ fontSize: 11, color: "#8a8478", marginTop: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span>{new Date(item.createdAt).toLocaleString("es-CO")}</span>
                {item.direction === "OUTBOUND" && (
                  <span>
                    {item.messageKind === "TEMPLATE" ? "Plantilla" : "Respuesta"} · {item.status}
                  </span>
                )}
                {item.generatedByAi && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 3,
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#5b3fa8",
                      background: "#ece7fb",
                      borderRadius: 999,
                      padding: "1px 7px",
                    }}
                  >
                    🤖 IA
                  </span>
                )}
              </div>
            </div>
          )
        )}
        {timeline.length === 0 && <p style={{ color: "#5b5f6b" }}>Sin mensajes todavía.</p>}
      </div>

      <div style={{ borderTop: "1px solid #e3e1dc", padding: 12, flexShrink: 0 }}>
        <WhatsAppThreadComposer conversationId={conversation.id} windowOpen={withinWindow} />
      </div>
    </div>
  );
}
