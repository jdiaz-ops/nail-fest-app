"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";

type MediaType = "image" | "video";

interface LinkRow {
  id: string;
  title: string;
  url: string;
  enabled: boolean;
  imageUrl: string | null;
  videoUrl: string | null;
}

const MAX_VIDEO_BYTES = 20 * 1024 * 1024; // 20MB — matches the server-side cap in
// /api/admin/uploads/link-video/route.ts; checked here first for a fast
// local error, but that route is the real enforcement.

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

  async function handleSave(
    id: string,
    patch: { title: string; url: string; enabled: boolean; imageUrl: string; videoUrl: string }
  ) {
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

  async function handleCreate(input: { title: string; url: string; imageUrl: string; videoUrl: string }) {
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
          {(link.imageUrl || link.videoUrl) && (
            // eslint-disable-next-line @next/next/no-img-element -- small admin-only thumbnail, also covers animated GIFs
            <img
              src={link.imageUrl ?? undefined}
              alt=""
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                objectFit: "cover",
                flexShrink: 0,
                background: link.videoUrl ? "#0b2e2c" : undefined,
              }}
            />
          )}
          <span style={{ minWidth: 0, flex: 1 }}>
            <div>
              {link.title} {(link.imageUrl || link.videoUrl) && <span title="Tiene fondo">🖼️</span>}
            </div>
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
  initial?: { title: string; url: string; imageUrl: string | null; videoUrl: string | null };
  busy: boolean;
  submitLabel: string;
  onSubmit: (input: { title: string; url: string; imageUrl: string; videoUrl: string; enabled?: boolean }) => void;
  onCancel: () => void;
  showEnabledToggle?: boolean;
  enabled?: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [enabled, setEnabled] = useState(initialEnabled ?? true);
  // Same "video wins if somehow both were ever set" priority as the
  // homepage editor — opens on whichever type is actually live.
  const [mediaType, setMediaType] = useState<MediaType>(initial?.videoUrl ? "video" : "image");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? null);
  const [videoUrl, setVideoUrl] = useState(initial?.videoUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/uploads/link-image", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setImageUrl(body.url);
      } else {
        setUploadError(
          body?.error === "blob_not_configured"
            ? "El almacenamiento de imágenes no está activo todavía."
            : body?.error === "not_an_image"
              ? "Ese archivo no es una imagen."
              : body?.error === "too_large"
                ? "La imagen pesa más de 5MB."
                : "No se pudo subir la imagen."
        );
      }
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  // Same client-direct-upload as HomepageEditorForm.tsx's handleVideoChange
  // — see that component's own comment for why.
  async function handleVideoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["video/mp4", "video/webm"].includes(file.type)) {
      setUploadError("Ese archivo no es un video mp4 o webm.");
      if (videoInputRef.current) videoInputRef.current.value = "";
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setUploadError("El video pesa más de 20MB — comprímelo o acórtalo.");
      if (videoInputRef.current) videoInputRef.current.value = "";
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
      const blob = await upload(`link-videos/${crypto.randomUUID()}.${ext}`, file, {
        access: "public",
        handleUploadUrl: "/api/admin/uploads/link-video",
      });
      setVideoUrl(blob.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "No se pudo subir el video.");
    } finally {
      setUploading(false);
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  }

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
        <label>Fondo de la tarjeta (opcional — sin nada se ve como un link simple)</label>

        <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
          {(
            [
              { key: "image" as const, label: "Imagen o GIF" },
              { key: "video" as const, label: "Video" },
            ]
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setMediaType(tab.key)}
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: mediaType === tab.key ? 600 : 400,
                color: mediaType === tab.key ? "#0b2e2c" : "#5b5f6b",
                background: mediaType === tab.key ? "#e6f9f7" : "#f6f5f2",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {mediaType === "image" ? (
          <>
            {imageUrl && (
              <div style={{ marginBottom: 8, position: "relative", display: "inline-block" }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of an arbitrary uploaded URL; also covers animated GIFs */}
                <img
                  src={imageUrl}
                  alt="Fondo del link"
                  style={{ maxWidth: 280, maxHeight: 140, borderRadius: 8, display: "block", border: "1px solid #e3e1dc" }}
                />
                <button type="button" onClick={() => setImageUrl(null)} style={removeButtonStyle} aria-label="Quitar imagen">
                  ×
                </button>
              </div>
            )}
            <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageChange} disabled={uploading} />
            <p style={{ fontSize: 12, color: "#8a8478", margin: "6px 0 0" }}>Un .gif se anima solo. Máximo 5MB.</p>
          </>
        ) : (
          <>
            {videoUrl && (
              <div style={{ marginBottom: 8, position: "relative", display: "inline-block" }}>
                <video
                  src={videoUrl}
                  autoPlay
                  muted
                  loop
                  playsInline
                  style={{ maxWidth: 280, maxHeight: 140, borderRadius: 8, display: "block", border: "1px solid #e3e1dc" }}
                />
                <button type="button" onClick={() => setVideoUrl(null)} style={removeButtonStyle} aria-label="Quitar video">
                  ×
                </button>
              </div>
            )}
            <input ref={videoInputRef} type="file" accept="video/mp4,video/webm" onChange={handleVideoChange} disabled={uploading} />
            <p style={{ fontSize: 12, color: "#8a8478", margin: "6px 0 0" }}>.mp4 o .webm, máximo 20MB, en loop sin sonido.</p>
          </>
        )}
        {uploading && <p style={{ fontSize: 13, color: "#5b5f6b" }}>Subiendo…</p>}
        {uploadError && <p style={{ fontSize: 13, color: "#c2185b" }}>{uploadError}</p>}
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
          onClick={() =>
            onSubmit({
              title: title.trim(),
              url: url.trim(),
              // Whichever type isn't the active tab is saved as "" — keeps
              // the two mutually exclusive, same as the homepage editor.
              imageUrl: mediaType === "image" ? imageUrl ?? "" : "",
              videoUrl: mediaType === "video" ? videoUrl ?? "" : "",
              ...(showEnabledToggle ? { enabled } : {}),
            })
          }
          style={{ padding: "8px 20px", borderRadius: 999, border: "none", background: "#12966b", color: "#fff", fontSize: 13, cursor: "pointer" }}
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

const removeButtonStyle: React.CSSProperties = {
  position: "absolute",
  top: 6,
  right: 6,
  border: "none",
  borderRadius: 999,
  width: 24,
  height: 24,
  background: "rgba(28,19,16,0.7)",
  color: "#fff",
  cursor: "pointer",
  fontSize: 14,
  lineHeight: 1,
};
