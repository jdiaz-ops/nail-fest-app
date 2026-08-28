// Shared by every /admin/settings/* form — one place for the save call and
// the Ticket-Tailor-matched styling (emerald save button, card shell)
// instead of repeating both across six near-identical components.
import type { CSSProperties } from "react";

export async function postSettings(patch: Record<string, unknown>): Promise<{ ok: boolean }> {
  const res = await fetch("/api/admin/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("save failed");
  return res.json();
}

export const cardStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #e3e1dc",
  borderRadius: 12,
  padding: 32,
  width: "100%",
};

export const saveButtonStyle: CSSProperties = {
  padding: "10px 24px",
  borderRadius: 999,
  border: "none",
  background: "#12966b",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
};

// Every /admin/settings/* page with a single small form pairs it with a
// side panel (live preview, current status, a link to the public page it
// affects) instead of stretching the form itself to fill the row — a
// single text input spanning most of an ultra-wide screen is worse UI,
// not better use of space. The panel is real information, not filler.
export const pageGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 640px) minmax(280px, 360px)",
  gap: 32,
  alignItems: "start",
};

export const sidePanelStyle: CSSProperties = {
  background: "#f6f4f0",
  border: "1px solid #e3e1dc",
  borderRadius: 12,
  padding: 20,
};

export const sidePanelLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "#8a8478",
  marginBottom: 12,
};
