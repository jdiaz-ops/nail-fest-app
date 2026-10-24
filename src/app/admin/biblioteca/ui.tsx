"use client";

import type { CSSProperties, ReactNode } from "react";

// What Editar biblioteca adds to the cuponera editors' pieces (../cuponera/ui):
// a wider sheet for the long forms, and the form's own small parts.

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(28,19,16,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", zIndex: 100, overflowY: "auto" }}
    >
      <div role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 24, maxWidth: 680, width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{title}</div>
          <button type="button" onClick={onClose} aria-label="Cerrar" style={{ border: "none", background: "transparent", fontSize: 22, lineHeight: 1, cursor: "pointer", color: "#5b5f6b" }}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const rowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: "1px solid #efece7" };

export const twoColumns: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0 16px" };

export function Check({ checked, onChange, label, hint }: { checked: boolean; onChange: (next: boolean) => void; label: string; hint?: string }) {
  return (
    <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", marginBottom: 12 }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 3 }} />
      <span>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
        {hint && <span style={{ display: "block", fontSize: 12, color: "#5b5f6b" }}>{hint}</span>}
      </span>
    </label>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  return <p style={{ color: "#b0225c", fontSize: 13, margin: "0 0 12px" }}>{children}</p>;
}

/** "Sin instructora" etc. in gray inside a select. */
export const emptyOption = "";

/** One line per item of a textarea, without the empty ones. */
export function linesOf(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/** "Polygel, Nail art" → ["Polygel", "Nail art"]. */
export function listOf(text: string): string[] {
  return text
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean);
}
