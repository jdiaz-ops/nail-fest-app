"use client";

import { useRef, useState } from "react";
import { postSettings, cardStyle, saveButtonStyle } from "../settings/shared";

// Same upload route as the hero background (/api/admin/uploads/
// homepage-image) — no need for a second one, it already just returns a
// Blob URL for any image. Each pick uploads immediately and appends to
// the list; the list itself only saves to OrgSettings on "Guardar",
// same two-step (upload now, persist the array later) shape as the
// brand-logo editor below it on this page.
export default function HomepageGalleryEditor({ initialUrls }: { initialUrls: string[] }) {
  const [urls, setUrls] = useState(initialUrls);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleAdd(e: React.ChangeEvent<HTMLInputElement>) {
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
        setUrls((prev) => [...prev, body.url]);
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
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function remove(index: number) {
    setUrls((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    setStatus("saving");
    try {
      await postSettings({ homepageGalleryImageUrls: urls });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div style={{ ...cardStyle, marginTop: 20 }}>
      <label style={{ fontWeight: 600, display: "block", marginBottom: 4 }}>Galería de fotos (opcional)</label>
      <p style={{ fontSize: 13, color: "#5b5f6b", margin: "0 0 14px" }}>
        Se muestra debajo del fondo principal — 4 en fila en computador, 2x2 en celular. Sube fotos ya diseñadas
        (con su propio texto si quieres uno), tal como las vayas a ver publicadas — esta sección no les agrega nada
        encima, solo las acomoda en cuadrícula.
      </p>

      {urls.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          {urls.map((url, i) => (
            <div key={url + i} style={{ position: "relative" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of an arbitrary uploaded URL */}
              <img
                src={url}
                alt=""
                style={{ width: 110, height: 110, objectFit: "cover", borderRadius: 8, display: "block", border: "1px solid #e3e1dc" }}
              />
              <button type="button" onClick={() => remove(i)} style={removeButtonStyle} aria-label="Quitar foto">
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <input ref={inputRef} type="file" accept="image/*" onChange={handleAdd} disabled={uploading} />
      {uploading && <p style={{ fontSize: 13, color: "#5b5f6b" }}>Subiendo…</p>}
      {uploadError && <p style={{ fontSize: 13, color: "#c2185b" }}>{uploadError}</p>}

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
        <button type="button" onClick={save} style={saveButtonStyle} disabled={uploading || status === "saving"}>
          {status === "saving" ? "Guardando…" : "Guardar galería"}
        </button>
        {status === "saved" && <span style={{ color: "#12966b", fontSize: 14 }}>Guardado ✓</span>}
        {status === "error" && <span style={{ color: "#c2185b", fontSize: 14 }}>Error al guardar</span>}
      </div>
    </div>
  );
}

const removeButtonStyle: React.CSSProperties = {
  position: "absolute",
  top: 4,
  right: 4,
  border: "none",
  borderRadius: 999,
  width: 22,
  height: 22,
  background: "rgba(28,19,16,0.7)",
  color: "#fff",
  cursor: "pointer",
  fontSize: 13,
  lineHeight: 1,
};
