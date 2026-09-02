"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { postSettings, cardStyle, saveButtonStyle } from "../settings/shared";

type MediaType = "image" | "video";

const MAX_VIDEO_BYTES = 20 * 1024 * 1024; // 20MB — matches the server-side cap in
// /api/admin/uploads/homepage-video/route.ts; checked here first for a fast
// local error, but that route is the real enforcement.

export default function HomepageEditorForm({
  initialImageUrl,
  initialVideoUrl,
  initialTagline,
  initialCtaLabel,
  nextEventLabel,
}: {
  initialImageUrl: string | null;
  initialVideoUrl: string | null;
  initialTagline: string | null;
  initialCtaLabel: string;
  nextEventLabel: string | null;
}) {
  // Video wins if somehow both were ever set — same priority the
  // homepage itself uses (src/app/page.tsx) — so the editor opens on
  // whichever type is actually live.
  const [mediaType, setMediaType] = useState<MediaType>(initialVideoUrl ? "video" : "image");
  const [imageUrl, setImageUrl] = useState(initialImageUrl);
  const [videoUrl, setVideoUrl] = useState(initialVideoUrl);
  const [tagline, setTagline] = useState(initialTagline ?? "");
  const [ctaLabel, setCtaLabel] = useState(initialCtaLabel);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
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
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  // Uploads straight from the browser to Blob storage (see
  // /api/admin/uploads/homepage-video's own comment on why video can't
  // go through a normal server route the way the image does) — this
  // function only asks OUR server for a signed token first, then PUTs
  // the file itself directly to Vercel, never through our own function.
  async function handleVideoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["video/mp4", "video/webm"].includes(file.type)) {
      setUploadError("Ese archivo no es un video mp4 o webm.");
      if (videoInputRef.current) videoInputRef.current.value = "";
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setUploadError("El video pesa más de 20MB — comprímelo o acórtalo (un loop de 5-15 segundos es lo ideal).");
      if (videoInputRef.current) videoInputRef.current.value = "";
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
      const blob = await upload(`homepage-videos/${crypto.randomUUID()}.${ext}`, file, {
        access: "public",
        handleUploadUrl: "/api/admin/uploads/homepage-video",
      });
      setVideoUrl(blob.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "No se pudo subir el video.");
    } finally {
      setUploading(false);
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      // Whichever type isn't the active tab gets saved as "" (cleared) —
      // that's what keeps the two mutually exclusive; see OrgSettings.
      // homepageVideoUrl's own schema comment.
      await postSettings({
        homepageImageUrl: mediaType === "image" ? imageUrl ?? "" : "",
        homepageVideoUrl: mediaType === "video" ? videoUrl ?? "" : "",
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
        <label>Fondo (opcional — sin nada se usa el verde-azulado de marca)</label>

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
                {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of an arbitrary uploaded URL; also covers animated GIFs, which a next/image would freeze */}
                <img
                  src={imageUrl}
                  alt="Fondo de la homepage"
                  style={{ maxWidth: 320, maxHeight: 160, borderRadius: 8, display: "block", border: "1px solid #e3e1dc" }}
                />
                <button type="button" onClick={() => setImageUrl(null)} style={removeButtonStyle} aria-label="Quitar imagen">
                  ×
                </button>
              </div>
            )}
            <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageChange} disabled={uploading} />
            <p style={{ fontSize: 12, color: "#8a8478", margin: "6px 0 0" }}>
              Un .gif se sube igual que una foto — se anima solo, sin nada más que hacer. Máximo 5MB.
            </p>
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
                  style={{ maxWidth: 320, maxHeight: 160, borderRadius: 8, display: "block", border: "1px solid #e3e1dc" }}
                />
                <button type="button" onClick={() => setVideoUrl(null)} style={removeButtonStyle} aria-label="Quitar video">
                  ×
                </button>
              </div>
            )}
            <input ref={videoInputRef} type="file" accept="video/mp4,video/webm" onChange={handleVideoChange} disabled={uploading} />
            <p style={{ fontSize: 12, color: "#8a8478", margin: "6px 0 0" }}>
              .mp4 o .webm, máximo 20MB. Corto y comprimido (5-15 segundos) — se reproduce en loop, sin sonido, y
              quien entre a la página tiene que descargarlo primero.
            </p>
          </>
        )}
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
