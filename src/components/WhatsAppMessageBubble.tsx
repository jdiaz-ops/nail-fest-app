import { chatTimeLabel } from "@/lib/chatTime";
import { describeWhatsAppSendError, extractMetaErrorCode } from "@/lib/whatsapp/failureCategories";

// One message in a Bandeja thread (CRM desktop and the scan app's phone
// view share it): media first when there is any, the text, then the
// time in the org's timezone and, for what we sent, a Spanish status —
// a failed send turns the bubble red and says why (Meta's code, in
// words), so nobody mistakes it for a delivered message again.

export interface ThreadMessage {
  id: string;
  createdAt: Date;
  direction: "INBOUND" | "OUTBOUND";
  body: string | null;
  messageKind: string;
  status: string;
  errorMessage: string | null;
  generatedByAi: boolean;
  mediaType: string | null;
  mediaId: string | null;
  mediaFilename: string | null;
}

export function toThreadMessage(m: {
  id: string;
  createdAt: Date;
  direction: "INBOUND" | "OUTBOUND";
  body: string | null;
  kind: string;
  status: string;
  errorMessage: string | null;
  generatedByAi: boolean;
  mediaType: string | null;
  mediaId: string | null;
  mediaFilename: string | null;
}): ThreadMessage {
  return {
    id: m.id,
    createdAt: m.createdAt,
    direction: m.direction,
    body: m.body,
    messageKind: m.kind,
    status: m.status,
    errorMessage: m.errorMessage,
    generatedByAi: m.generatedByAi,
    mediaType: m.mediaType,
    mediaId: m.mediaId,
    mediaFilename: m.mediaFilename,
  };
}

const STATUS_LABEL: Record<string, string> = {
  QUEUED: "En cola",
  SENT: "Enviado ✓",
  DELIVERED: "Entregado ✓✓",
  READ: "Leído ✓✓",
  FAILED: "No se entregó",
};

// Meta keeps inbound media for 30 days; past that the proxy 404s, so the
// bubble says so instead of showing a broken player.
const MEDIA_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

// The auto labels describeInbound() stores as `body` for media with no
// caption — hidden under the media itself, shown only when the body is a
// real caption.
function isMediaLabel(body: string, mediaFilename: string | null): boolean {
  return ["📷 Foto", "🎤 Nota de voz", "🎵 Audio", "🎬 Video", "Sticker", `📄 ${mediaFilename ?? "Documento"}`].includes(body);
}

export default function WhatsAppMessageBubble({ message: item, timezone, language, maxWidth = "70%" }: { message: ThreadMessage; timezone: string; language: string; maxWidth?: string }) {
  const failed = item.status === "FAILED";
  return (
    <div
      style={{
        alignSelf: item.direction === "OUTBOUND" ? "flex-end" : "flex-start",
        maxWidth,
        background: failed ? "#fdeaea" : item.direction === "OUTBOUND" ? "#ffe4d1" : "#f6f5f2",
        border: failed ? "1px solid #f0b8b4" : "none",
        borderRadius: 12,
        padding: "10px 14px",
      }}
    >
      {item.mediaId && item.mediaType && <MessageMedia mediaId={item.mediaId} mediaType={item.mediaType} mediaFilename={item.mediaFilename} createdAt={item.createdAt} />}
      {item.body && !(item.mediaId && isMediaLabel(item.body, item.mediaFilename)) && <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{item.body}</div>}
      {!item.body && !item.mediaId && <div style={{ fontSize: 14 }}>—</div>}
      <div style={{ fontSize: 11, color: "#8a8478", marginTop: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span>{chatTimeLabel(item.createdAt, timezone, language)}</span>
        {item.direction === "OUTBOUND" && (
          <span style={failed ? { color: "var(--danger)", fontWeight: 700 } : undefined}>
            {item.messageKind === "TEMPLATE" ? "Plantilla" : "Respuesta"} · {STATUS_LABEL[item.status] ?? item.status}
          </span>
        )}
        {item.generatedByAi && (
          <span title="Respondido automáticamente por el agente de IA" style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: "#5b3fa8", background: "#ece7fb", borderRadius: 999, padding: "1px 7px" }}>
            🤖 IA
          </span>
        )}
      </div>
      {failed && (
        <div style={{ fontSize: 12, color: "#a3251f", marginTop: 4, lineHeight: 1.4 }}>
          {describeWhatsAppSendError(item.errorMessage)}
          {extractMetaErrorCode(item.errorMessage) === 131047 && " Reábrela con una plantilla desde el cuadro de abajo."}
        </div>
      )}
    </div>
  );
}

// An inbound photo / voice note / video / document, through the
// staff-only proxy (api/admin/whatsapp/media/[mediaId]).
function MessageMedia({ mediaId, mediaType, mediaFilename, createdAt }: { mediaId: string; mediaType: string; mediaFilename: string | null; createdAt: Date }) {
  if (Date.now() - createdAt.getTime() > MEDIA_RETENTION_MS) {
    return <div style={{ fontSize: 12.5, color: "#8a8478", fontStyle: "italic", marginBottom: 4 }}>Archivo ya no disponible (WhatsApp lo guarda 30 días).</div>;
  }
  const src = `/api/admin/whatsapp/media/${encodeURIComponent(mediaId)}`;
  const box = { display: "block", maxWidth: 280, borderRadius: 10, marginBottom: 6 } as const;
  if (mediaType === "image") {
    return (
      <a href={src} target="_blank" rel="noreferrer" style={{ display: "block" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- streamed from Meta through our proxy */}
        <img src={src} alt="Foto recibida" loading="lazy" style={{ ...box, maxHeight: 320, objectFit: "cover" }} />
      </a>
    );
  }
  if (mediaType === "sticker") {
    // eslint-disable-next-line @next/next/no-img-element -- streamed from Meta through our proxy
    return <img src={src} alt="Sticker" loading="lazy" style={{ ...box, width: 120, height: 120, objectFit: "contain" }} />;
  }
  if (mediaType === "audio") return <audio controls preload="none" src={src} style={{ ...box, width: 260, maxWidth: "100%" }} />;
  if (mediaType === "video") return <video controls preload="metadata" src={src} style={{ ...box, maxHeight: 320, maxWidth: "100%" }} />;
  const name = mediaFilename ?? "Documento";
  return (
    <a href={`${src}?nombre=${encodeURIComponent(name)}`} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--link)", background: "#fff", borderRadius: 8, padding: "6px 10px", marginBottom: 6, textDecoration: "none" }}>
      📄 {name}
    </a>
  );
}
