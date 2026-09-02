"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface LinkRow {
  id: string;
  title: string;
  url: string;
  enabled: boolean;
}

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
  const [error, setError] = useState<string | null>(null);

  const editingLink = editingId ? initialLinks.find((l) => l.id === editingId) : null;

  async function refresh() {
    router.refresh();
  }

  async function handleSave(id: string, patch: { title: string; url: string; enabled: boolean }) {
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

  async function handleCreate(input: { title: string; url: string }) {
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
            padding: "10px 0",
            fontSize: 14,
            borderBottom: i < initialLinks.length - 1 ? "1px solid #f0efec" : "none",
            opacity: link.enabled ? 1 : 0.5,
          }}
        >
          <span style={{ minWidth: 0 }}>
            <div>{link.title}</div>
            <div style={{ fontSize: 12, color: "#8a8478", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 380 }}>
              {link.url}
            </div>
            {!link.enabled && <span style={{ fontSize: 11, color: "#8a8478" }}>(desactivado)</span>}
          </span>
          <span style={{ display: "flex", gap: 4, flexShrink: 0 }}>
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
          </span>
        </div>
      ))}

      {editingLink && (
        <Modal title="Editar link" onClose={() => setEditingId(null)}>
          <LinkForm
            initial={editingLink}
            busy={busy}
            submitLabel="Guardar"
            onSubmit={(input) => handleSave(editingLink.id, { ...input, enabled: editingLink.enabled })}
            onCancel={() => setEditingId(null)}
            showEnabledToggle
            enabled={editingLink.enabled}
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

function LinkForm({
  initial,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
  showEnabledToggle,
  enabled: initialEnabled,
}: {
  initial?: { title: string; url: string };
  busy: boolean;
  submitLabel: string;
  onSubmit: (input: { title: string; url: string; enabled?: boolean }) => void;
  onCancel: () => void;
  showEnabledToggle?: boolean;
  enabled?: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [enabled, setEnabled] = useState(initialEnabled ?? true);

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
      {showEnabledToggle && (
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Visible en la página pública
        </label>
      )}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancel} style={{ padding: "8px 20px", borderRadius: 999, border: "1px solid #e3e1dc", background: "#fff", fontSize: 13, cursor: "pointer" }}>
          Cancelar
        </button>
        <button
          type="button"
          disabled={busy || !title.trim() || !url.trim()}
          onClick={() => onSubmit({ title: title.trim(), url: url.trim(), ...(showEnabledToggle ? { enabled } : {}) })}
          style={{ padding: "8px 20px", borderRadius: 999, border: "none", background: "#12966b", color: "#fff", fontSize: 13, cursor: "pointer" }}
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
