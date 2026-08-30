"use client";

import { useRef, useState } from "react";
import { postSettings, cardStyle, saveButtonStyle } from "../settings/shared";

export default function HomepageEditorForm({
  initialImageUrl,
  initialTagline,
  initialCtaLabel,
  nextEventLabel,
}: {
  initialImageUrl: string | null;
  initialTagline: string | null;
  initialCtaLabel: string;
  nextEventLabel: string | null;
}) {
  const [imageUrl, setImageUrl] = useState(initialImageUrl);
  const [tagline, setTagline] = useState(initialTagline ?? "");
  const [ctaLabel, setCtaLabel] = useState(initialCtaLabel);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/uploads/homepage-image", { method: "POST", body: form });
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
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      await postSettings({
        homepageImageUrl: imageUrl ?? "",
        homepageTagline: tagline,
        homepageCtaLabel: ctaLabel,
      });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} style={cardStyle}>
      <div className="field">
        <label>
          Próximo evento (automático — se toma del evento publicado más próximo, no se edita aquí)
        </label>
        <p style={{ margin: "0 0 0", fontSize: 14, color: nextEventLabel ? "#17181c" : "#8a8478" }}>
          {nextEventLabel ?? "Ninguno todavía — la homepage muestra 'Próximamente'."}
        </p>
      </div>

      <div className="field" style={{ marginTop: 20 }}>
        <label>Imagen de fondo (opcional — sin ella se usa el verde-azulado de marca)</label>
        {imageUrl && (
          <div style={{ marginBottom: 8, position: "relative", display: "inline-block" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of an arbitrary uploaded URL */}
            <img
              src={imageUrl}
              alt="Fondo de la homepage"
              style={{ maxWidth: 320, maxHeight: 160, borderRadius: 8, display: "block", border: "1px solid #e3e1dc" }}
            />
            <button
              type="button"
              onClick={() => setImageUrl(null)}
              style={{
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
              }}
              aria-label="Quitar imagen"
            >
              ×
            </button>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} disabled={uploading} />
        {uploading && <p style={{ fontSize: 13, color: "#5b5f6b" }}>Subiendo…</p>}
        {uploadError && <p style={{ fontSize: 13, color: "#c2185b" }}>{uploadError}</p>}
      </div>

      <div className="field">
        <label>Eslogan (opcional, debajo de la fecha)</label>
        <input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Donde se reúne el mundo de las uñas" />
      </div>

      <div className="field">
        <label>Texto del botón</label>
        <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} required />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button type="submit" style={saveButtonStyle} disabled={status === "saving"}>
          {status === "saving" ? "Guardando…" : "Guardar"}
        </button>
        <a href="/" target="_blank" rel="noreferrer" style={{ fontSize: 14 }}>
          Ver la homepage ↗
        </a>
        {status === "saved" && <span style={{ color: "#12966b", fontSize: 14 }}>Guardado ✓</span>}
        {status === "error" && <span style={{ color: "#c2185b", fontSize: 14 }}>Error al guardar</span>}
      </div>
    </form>
  );
}
