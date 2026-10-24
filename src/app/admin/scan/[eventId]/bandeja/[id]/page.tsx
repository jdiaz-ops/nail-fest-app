import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import { listResendableRegistrations } from "@/lib/whatsapp/sendTicketPdf";
import WhatsAppThreadComposer from "@/components/WhatsAppThreadComposer";
import WhatsAppMarkRead from "@/components/WhatsAppMarkRead";
import ScrollToLatest from "@/components/ScrollToLatest";
import WhatsAppWindowCountdown from "@/components/WhatsAppWindowCountdown";
import WhatsAppTicketActions from "@/components/WhatsAppTicketActions";
import WhatsAppMessageBubble, { toThreadMessage, type ThreadMessage } from "@/components/WhatsAppMessageBubble";
import { getOrgSettings } from "@/lib/settings";
import { listReopenTemplates } from "@/lib/whatsapp/reopenTemplates";
import { chatTimeLabel } from "@/lib/chatTime";

export const dynamic = "force-dynamic";

const WINDOW_MS = 24 * 60 * 60 * 1000;
// See the CRM thread page: recent messages only, opened at the last one.
const RECENT_MESSAGES = 40;

type TimelineItem = ({ kind: "message" } & ThreadMessage) | { kind: "note"; id: string; createdAt: Date; text: string; authorName: string | null };

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
export default async function ScanWhatsAppThreadPage({ params, searchParams }: { params: { eventId: string; id: string }; searchParams: { todos?: string } }) {
  await requirePageUser(["ADMIN", "COORDINADOR"]);
  const showAll = searchParams.todos === "1";

  const conversation = await db.whatsAppConversation.findUnique({
    where: { id: params.id },
    include: {
      person: true,
      _count: { select: { messages: true } },
      messages: { orderBy: { createdAt: "asc" }, ...(showAll ? {} : { take: -RECENT_MESSAGES }) },
      notes: { orderBy: { createdAt: "asc" }, include: { author: true } },
    },
  });
  if (!conversation) notFound();
  const hiddenMessages = showAll ? 0 : Math.max(0, conversation._count.messages - conversation.messages.length);
  const nextUnread = await db.whatsAppConversation.findFirst({
    where: { unreadCount: { gt: 0 }, id: { not: conversation.id } },
    orderBy: [{ lastInboundAt: "desc" }],
    select: { id: true },
  });

  const [resendableRegistrations, orgSettings, reopenTemplates] = await Promise.all([listResendableRegistrations(conversation), getOrgSettings(), listReopenTemplates()]);
  const { timezone, language } = orgSettings;

  const withinWindow = Boolean(conversation.lastInboundAt && Date.now() - conversation.lastInboundAt.getTime() < WINDOW_MS);
  const name = conversation.person
    ? [conversation.person.firstName, conversation.person.lastName].filter(Boolean).join(" ") || conversation.person.email
    : "Contacto sin identificar";

  const timeline: TimelineItem[] = [
    ...conversation.messages.map((m) => ({ kind: "message" as const, ...toThreadMessage(m) })),
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 4 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{name}</div>
            <div style={{ fontSize: 12.5, color: "#8a8478" }}>
              {conversation.phone}
              {!conversation.person && " — no coincide con ninguna persona del CRM"}
            </div>
          </div>
          {nextUnread && (
            <Link href={`/admin/scan/${params.eventId}/bandeja/${nextUnread.id}`} style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 700, color: "var(--link)", textDecoration: "none", border: "1px solid var(--border)", borderRadius: 999, padding: "6px 12px", background: "#fff" }}>
              Siguiente no leído →
            </Link>
          )}
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
          </div>
        </details>
      </div>

      <ScrollToLatest containerId="wa-scan-thread-timeline" dep={`${timeline[timeline.length - 1]?.id ?? ""}-${timeline.length}`} />
      <div id="wa-scan-thread-timeline" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {hiddenMessages > 0 && (
          <Link href={`/admin/scan/${params.eventId}/bandeja/${conversation.id}?todos=1`} style={{ alignSelf: "center", fontSize: 12.5, fontWeight: 600, color: "var(--link)", background: "#f6f5f2", borderRadius: 999, padding: "6px 14px", textDecoration: "none" }}>
            Ver los {hiddenMessages} mensajes anteriores
          </Link>
        )}
        {timeline.map((item) =>
          item.kind === "note" ? (
            <div key={item.id} style={{ alignSelf: "center", maxWidth: "90%", background: "#fdf6e3", border: "1px dashed #e0c477", borderRadius: 8, padding: "8px 12px" }}>
              <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>📝 {item.text}</div>
              <div style={{ fontSize: 11, color: "#8a8478", marginTop: 2 }}>
                Nota interna{item.authorName ? ` · ${item.authorName}` : ""} · {chatTimeLabel(item.createdAt, timezone, language)}
              </div>
            </div>
          ) : (
            <WhatsAppMessageBubble
              key={item.id}
              message={item}
              timezone={timezone}
              language={language}
              maxWidth="82%"
              reactions={{ conversationId: conversation.id, lastInboundAt: conversation.lastInboundAt }}
            />
          )
        )}
        {timeline.length === 0 && <p style={{ color: "#5b5f6b" }}>Sin mensajes todavía.</p>}
      </div>

      <div style={{ flexShrink: 0 }}>
        <WhatsAppTicketActions
          conversationId={conversation.id}
          withinWindow={withinWindow}
          registrations={resendableRegistrations.map((r) => ({
            id: r.id,
            eventName: r.event.name,
            ticketCount: r.ticketCount,
            ownerEmail: r.personId !== conversation.personId ? r.person.email : null,
            showZoomLink: r.event.format !== "IN_PERSON" && Boolean(r.event.zoomMeetingId),
          }))}
        />
      </div>
      <div style={{ borderTop: "1px solid #e3e1dc", padding: 12, flexShrink: 0 }}>
        <WhatsAppThreadComposer conversationId={conversation.id} windowOpen={withinWindow} reopenTemplates={reopenTemplates} firstName={conversation.person?.firstName ?? ""} />
      </div>
    </div>
  );
}
