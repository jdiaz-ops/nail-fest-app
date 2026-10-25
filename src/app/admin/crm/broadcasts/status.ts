// A send's state in words, the same on Broadcasts' history and on each
// send's own page — La Mesa's editions brought «Programado» and
// «Cancelado» (2026-10-25).
export const BROADCAST_STATUS: Record<string, { label: string; bg: string; ink: string }> = {
  SENT: { label: "Enviado", bg: "#e8f6ef", ink: "#0e6b4c" },
  SENDING: { label: "Enviando", bg: "#fdf1e6", ink: "#8a5a1f" },
  QUEUED: { label: "Programado", bg: "#e8eefc", ink: "#22479b" },
  DRAFT: { label: "Borrador", bg: "#f6f5f2", ink: "#5b5f6b" },
  CANCELLED: { label: "Cancelado", bg: "#f6f5f2", ink: "#5b5f6b" },
};

export function broadcastStatus(status: string): { label: string; bg: string; ink: string } {
  return BROADCAST_STATUS[status] ?? { label: status, bg: "#f6f5f2", ink: "#5b5f6b" };
}
