"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type TextAlign = "LEFT" | "CENTER" | "RIGHT";

interface LinkRow {
  id: string;
  title: string;
  url: string;
  enabled: boolean;
  clickCount: number;
  textAlign: TextAlign;
}

const ALIGN_LABELS: Record<TextAlign, string> = {
  LEFT: "Izquierda",
  CENTER: "Centro",
  RIGHT: "Derecha",
};

const clickFormatter = new Intl.NumberFormat("es-CO");

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? "request_failed");
  }
  return res.json().catch(() => ({}));
}

export default function LinksEditor({ initialLinks }: { initialLinks: LinkRow[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  // Tracked separately from the general `busy` flag so flipping one
  // switch doesn't grey out every row's icons while the request is in
  // flight — same reasoning as WhatsAppAiToggle.tsx's own local `saving`.
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const editingLink = editingId ? initialLinks.find((l) => l.id === editingId) : null;

  async function refresh() {
    router.refresh();
  }

  async function handleSave(id: string, patch: { title: string; url: string; textAlign: TextAlign }) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/links/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      setEditingId(null);
      await refresh();
    } catch {
      setError("No se pudo guardar el link — revisa que la URL sea válida (con https://).");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Borrar este link? Desaparece de la página pública de inmediato.")) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/links/${id}`, { method: "DELETE" });
      await refresh();
    } catch {
      setError("No se pudo borrar el link.");
    } finally {
      setBusy(false);
    }
  }

  async function handleMove(id: string, direction: "up" | "down") {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/links/${id}/move`, { method: "POST", body: JSON.stringify({ direction }) });
      await refresh();
    } catch {
      setError("No se pudo mover el link.");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleEnabled(id: string, next: boolean) {
    setTogglingId(id);
    setError(null);
    try {
      await api(`/api/admin/links/${id}`, { method: "PATCH", body: JSON.stringify({ enabled: next }) });
      await refresh();
    } catch {
      setError("No se pudo cambiar la visibilidad del link.");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleCreate(input: { title: string; url: string; textAlign: TextAlign }) {
    setBusy(true);
    setError(null);
    try {
      await api("/api/admin/links", { method: "POST", body: JSON.stringify(input) });
      setAdding(false);
      await refresh();
    } catch {
      setError("No se pudo crear el link — revisa que la URL sea válida (con https://).");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #e3e1dc", borderRadius: 12, padding: 24, maxWidth: 700 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontWeight: 600 }}>Links</div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          style={{ padding: "8px 16px", borderRadius: 999, border: "none", background: "#1c1310", color: "#fff", fontSize: 13, cursor: "pointer" }}
        >
          + Agregar link
        </button>
      </div>
      <p style={{ fontSize: 12, color: "#5b5f6b", marginTop: 0, marginBottom: 16 }}>
        <a href="/links" target="_blank" rel="noreferrer">
          Ver la página pública ↗
        </a>
      </p>

      {error && <p style={{ color: "#c2185b", fontSize: 13 }}>{error}</p>}

      {initialLinks.length === 0 && <p style={{ fontSize: 13, color: "#8a8478" }}>Todavía no hay links.</p>}

      {initialLinks.map((link, i) => (
        <div
          key={link.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            padding: "10px 0",
            fontSize: 14,
            borderBottom: i < initialLinks.length - 1 ? "1px solid #f0efec" : "none",
            opacity: link.enabled ? 1 : 0.5,
          }}
        >
          <span style={{ minWidth: 0, flex: 1 }}>
            <div>{link.title}</div>
            <div style={{ fontSize: 12, color: "#8a8478", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 380 }}>
              {link.url}
            </div>
            <div style={{ fontSize: 11, color: "#8a8478" }}>{clickFormatter.format(link.clickCount)} clics</div>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <IconButton title="Editar" onClick={() => setEditingId(link.id)} disabled={busy}>
              ✏️
            </IconButton>
            <IconButton title="Subir" onClick={() => handleMove(link.id, "up")} disabled={busy || i === 0}>
              ↑
            </IconButton>
            <IconButton title="Bajar" onClick={() => handleMove(link.id, "down")} disabled={busy || i === initialLinks.length - 1}>
              ↓
            </IconButton>
            <IconButton title="Borrar" onClick={() => handleDelete(link.id)} disabled={busy}>
              🗑️
            </IconButton>
            <Switch
              checked={link.enabled}
              disabled={togglingId === link.id}
              label={link.enabled ? "Visible en la página pública" : "Oculto de la página pública"}
              onChange={(next) => handleToggleEnabled(link.id, next)}
            />
          </span>
        </div>
      ))}

      {editingLink && (
        <Modal title="Editar link" onClose={() => setEditingId(null)}>
          <LinkForm
            initial={editingLink}
            busy={busy}
            submitLabel="Guardar"
            onSubmit={(input) => handleSave(editingLink.id, input)}
            onCancel={() => setEditingId(null)}
          />
        </Modal>
      )}

      {adding && (
        <Modal title="Nuevo link" onClose={() => setAdding(false)}>
          <LinkForm busy={busy} submitLabel="Crear link" onSubmit={handleCreate} onCancel={() => setAdding(false)} />
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
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
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 12, padding: 24, maxWidth: 440, width: "100%", maxHeight: "85vh", overflowY: "auto" }}
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

function IconButton({ children, onClick, disabled, title }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; title: string }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      style={{ border: "none", background: "transparent", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.3 : 1, fontSize: 14, padding: 4 }}
    >
      {children}
    </button>
  );
}

// A real sliding switch (not a native checkbox) — matches the on/off
// toggle in the Linktree reference, sitting directly in the row instead
// of buried in the edit modal, so hiding a link is one click.
function Switch({
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
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
          transition: "transform 0.15s ease",
        }}
      />
    </button>
  );
}

function LinkForm({
  initial,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: { title: string; url: string; textAlign: TextAlign };
  busy: boolean;
  submitLabel: string;
  onSubmit: (input: { title: string; url: string; textAlign: TextAlign }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [textAlign, setTextAlign] = useState<TextAlign>(initial?.textAlign ?? "CENTER");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="field">
        <label>Texto del link</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Datos de contacto" />
      </div>
      <div className="field">
        <label>URL</label>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://wa.me/57..." />
      </div>

      <div className="field">
        <label>Alineación del texto</label>
        <div style={{ display: "flex", gap: 4 }}>
          {(Object.keys(ALIGN_LABELS) as TextAlign[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTextAlign(key)}
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: textAlign === key ? 600 : 400,
                color: textAlign === key ? "#0b2e2c" : "#5b5f6b",
                background: textAlign === key ? "#e6f9f7" : "#f6f5f2",
              }}
            >
              {ALIGN_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancel} style={{ padding: "8px 20px", borderRadius: 999, border: "1px solid #e3e1dc", background: "#fff", fontSize: 13, cursor: "pointer" }}>
          Cancelar
        </button>
        <button
          type="button"
          disabled={busy || !title.trim() || !url.trim()}
          onClick={() => onSubmit({ title: title.trim(), url: url.trim(), textAlign })}
          style={{ padding: "8px 20px", borderRadius: 999, border: "none", background: "#12966b", color: "#fff", fontSize: 13, cursor: "pointer" }}
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
