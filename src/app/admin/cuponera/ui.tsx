"use client";

import type { CSSProperties, ReactNode } from "react";

// The small pieces every /admin/cuponera editor shares — same look as the
// ones in LinksEditor.tsx (switch, icon button, modal), plus the card shell.

export const cardStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #e3e1dc",
  borderRadius: 12,
  padding: 24,
  maxWidth: 900,
  marginTop: 20,
};

export const primaryButtonStyle: CSSProperties = {
  padding: "8px 18px",
  borderRadius: 999,
  border: "none",
  background: "#12966b",
  color: "#fff",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

export const secondaryButtonStyle: CSSProperties = {
  padding: "8px 16px",
  borderRadius: 999,
  border: "1px solid #e3e1dc",
  background: "#fff",
  color: "#17181c",
  fontSize: 13,
  cursor: "pointer",
};

export const mutedText: CSSProperties = { fontSize: 13, color: "#5b5f6b" };

// Every save in these editors announces itself, so the live preview of the
// page (CuponeraPreview) reloads and shows the change.
export const CUPONERA_SAVED_EVENT = "cuponera:guardado";

export function announceCuponeraSaved() {
  window.dispatchEvent(new Event(CUPONERA_SAVED_EVENT));
}

export async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof body?.error === "string" ? body.error : "request_failed");
  if ((init?.method ?? "GET").toUpperCase() !== "GET") announceCuponeraSaved();
  return body as T;
}

export function CardTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
      <div style={{ fontWeight: 700, fontSize: 16 }}>{children}</div>
      {aside}
    </div>
  );
}

export function Pill({ tone, children }: { tone: "green" | "red" | "grey" | "pink" | "amber"; children: ReactNode }) {
  const colors = {
    green: { background: "#e3f6ee", color: "#0d6e4f" },
    red: { background: "#fde8ef", color: "#b0225c" },
    grey: { background: "#f0efec", color: "#5b5f6b" },
    pink: { background: "#fde8ef", color: "#b0225c" },
    amber: { background: "#fff3ea", color: "#a5471a" },
  }[tone];
  return (
    <span style={{ ...colors, padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{children}</span>
  );
}

export function IconButton({
  children,
  onClick,
  disabled,
  title,
  active,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      style={{
        border: "none",
        background: "transparent",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.3 : 1,
        fontSize: 15,
        padding: 4,
        lineHeight: 1,
      }}
    >
      {children}
    </button>
  );
}

export function Switch({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 40,
        height: 24,
        borderRadius: 999,
        border: "none",
        padding: 3,
        display: "flex",
        justifyContent: checked ? "flex-end" : "flex-start",
        background: checked ? "#12966b" : "#d8d5cd",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: "background 0.15s ease",
        flexShrink: 0,
      }}
    >
      <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
    </button>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(28,19,16,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 100,
      }}
    >
      <div
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 12, padding: 24, maxWidth: 480, width: "100%", maxHeight: "85vh", overflowY: "auto" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{ border: "none", background: "transparent", fontSize: 22, lineHeight: 1, cursor: "pointer", color: "#5b5f6b" }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** A brand logo, or its initial when it has none. */
export function BrandMark({ name, logoUrl, size = 32 }: { name: string; logoUrl: string | null; size?: number }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- logo from the brand's Marcolini profile
    return <img src={logoUrl} alt="" width={size} height={size} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  }
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "#e6f9f7",
        color: "#007a74",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: size * 0.45,
        flexShrink: 0,
      }}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

export const copFormatter = new Intl.NumberFormat("es-CO");

export function cop(value: number): string {
  return `$${copFormatter.format(value)}`;
}
