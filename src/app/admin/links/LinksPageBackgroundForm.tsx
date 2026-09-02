"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { postSettings, cardStyle, saveButtonStyle } from "../settings/shared";

type MediaType = "image" | "video";

const MAX_VIDEO_BYTES = 20 * 1024 * 1024; // 20MB — matches the server-side cap in
// /api/admin/uploads/links-page-video/route.ts; checked here first for a
// fast local error, but that route is the real enforcement.

// Fondo de la página pública /links — mismo patrón que HomepageEditorForm
// (misma pestaña Imagen-o-GIF/Video, mismo upload cliente-directo para
// video), pero guardando linksPageImageUrl/linksPageVideoUrl en vez de
// los campos de la homepage. No es lo mismo que el fondo de una tarjeta
// individual (eso vive en LinksEditor.tsx, por link).
export default function LinksPageBackgroundForm({
  initialImageUrl,
  initialVideoUrl,
}: {
  initialImageUrl: string | null;
  initialVideoUrl: string | null;
}) {
  const [mediaType, setMediaType] = useState<MediaType>(initialVideoUrl ? "video" : "image");
  const [imageUrl, setImageUrl] = useState(initialImageUrl);
  const [videoUrl, setVideoUrl] = useState(initialVideoUrl);
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
      const res = await fetch("/api/admin/uploads/links-page-image", { method: "POST", body: form });
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
      const blob = await upload(`links-page-videos/${crypto.randomUUID()}.${ext}`, file, {
        access: "public",
        handleUploadUrl: "/api/admin/uploads/links-page-video",
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
      await postSettings({
        linksPageImageUrl: mediaType === "image" ? imageUrl ?? "" : "",
        linksPageVideoUrl: mediaType === "video" ? videoUrl ?? "" : "",
      });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ ...cardStyle, maxWidth: 700, marginBottom: 20 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Fondo de la página</div>
      <p style={{ fontSize: 12, color: "#5b5f6b", marginTop: 0, marginBottom: 16 }}>
        Se aplica a toda la página nailfest.co/links, detrás del logo y de todos los links — igual
        que el fondo de la homepage. Sin nada se ve el verde-azulado de marca.
      </p>

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
                alt="Fondo de /links"
                style={{ maxWidth: 320, maxHeight: 160, borderRadius: 8, display: "block", border: "1px solid #e3e1dc" }}
              />
              <button type="button" onClick={() => setImageUrl(null)} style={removeButtonStyle} aria-label="Quitar imagen">
                ×
              </button>
            </div>
          )}
          <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageChange} disabled={uploading} />
          <p style={{ fontSize: 12, color: "#8a8478", margin: "6px 0 0" }}>
            Un .gif se sube igual que una foto — se anima solo. Máximo 5MB.
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
            .mp4 o .webm, máximo 20MB. Corto y comprimido (5-15 segundos), en loop, sin sonido.
          </p>
        </>
      )}
      {uploading && <p style={{ fontSize: 13, color: "#5b5f6b" }}>Subiendo…</p>}
      {uploadError && <p style={{ fontSize: 13, color: "#c2185b" }}>{uploadError}</p>}

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
        <button type="submit" style={saveButtonStyle} disabled={status === "saving"}>
          {status === "saving" ? "Guardando…" : "Guardar fondo"}
        </button>
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
