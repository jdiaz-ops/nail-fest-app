// Shared by every /admin/settings/* form — one place for the save call and
// the reference-matched styling (emerald save button, card shell)
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
  maxWidth: 640,
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
