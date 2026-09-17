"use client";

import { useRef, useState } from "react";
import { postSettings, cardStyle, saveButtonStyle } from "../settings/shared";

interface BrandLogo {
  url: string;
  name: string;
}

// "Un módulo para subir uno a uno cada logo" — a brand wall grows a
// handful at a time in practice, so the flow is: pick the logo image
// (uploads immediately), type the brand's name, "Agregar a la lista".
// The name is never shown on the public page (the logo speaks for
// itself there) — it exists purely so the list below is legible once
// it's more than a few nearly-identical white squares.
export default function HomepageBrandLogosEditor({ initialLogos }: { initialLogos: BrandLogo[] }) {
  const [logos, setLogos] = useState(initialLogos);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [pendingName, setPendingName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
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
        setPendingUrl(body.url);
      } else {
        setUploadError(
          body?.error === "blob_not_configured"
            ? "El almacenamiento de imágenes no está activo todavía."
            : body?.error === "not_an_image"
              ? "Ese archivo no es una imagen."
              : body?.error === "too_large"
                ? "La imagen pesa más de 5MB."
                : "No se pudo subir el logo."
        );
      }
    } finally {
      setUploading(false);
    }
  }

  function addToList() {
    if (!pendingUrl || !pendingName.trim()) return;
    setLogos((prev) => [...prev, { url: pendingUrl, name: pendingName.trim() }]);
    setPendingUrl(null);
    setPendingName("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function remove(index: number) {
    setLogos((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    setStatus("saving");
    try {
      await postSettings({ homepageBrandLogos: logos });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div style={{ ...cardStyle, marginTop: 20 }}>
      <label style={{ fontWeight: 600, display: "block", marginBottom: 4 }}>Marcas aliadas (opcional)</label>
      <p style={{ fontSize: 13, color: "#5b5f6b", margin: "0 0 14px" }}>
        Una pared de logos debajo de la galería — 6 en fila en computador, 3 en celular. Sube cada logo uno por
        uno; el nombre no se muestra en la página (el logo ya lo dice), es solo para que reconozcas cuál es cuál
        aquí abajo.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end", marginBottom: 16 }}>
        <div>
          <label style={{ fontSize: 12, color: "#5b5f6b", display: "block", marginBottom: 4 }}>1. Logo</label>
          <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} disabled={uploading} />
        </div>
        {pendingUrl && (
          <>
            <div>
              <label style={{ fontSize: 12, color: "#5b5f6b", display: "block", marginBottom: 4 }}>2. Nombre de la marca</label>
              <input
                value={pendingName}
                onChange={(e) => setPendingName(e.target.value)}
                placeholder="ej. Dyson"
                style={{ padding: "8px 12px", border: "1px solid #e3e1dc", borderRadius: 8, fontSize: 14 }}
              />
            </div>
            <button type="button" onClick={addToList} disabled={!pendingName.trim()}>
              Agregar a la lista
            </button>
          </>
        )}
      </div>
      {uploading && <p style={{ fontSize: 13, color: "#5b5f6b" }}>Subiendo…</p>}
      {uploadError && <p style={{ fontSize: 13, color: "#c2185b" }}>{uploadError}</p>}
      {pendingUrl && (
        <div style={{ marginBottom: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- admin preview before adding to the list */}
          <img
            src={pendingUrl}
            alt="Logo recién subido"
            style={{ width: 72, height: 72, objectFit: "contain", background: "#fff", border: "1px solid #e3e1dc", borderRadius: 8, padding: 8 }}
          />
        </div>
      )}

      {logos.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
          {logos.map((logo, i) => (
            <div key={logo.url + i} style={{ position: "relative", textAlign: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of an arbitrary uploaded URL */}
              <img
                src={logo.url}
                alt={logo.name}
                style={{
                  width: 90,
                  height: 90,
                  objectFit: "contain",
                  background: "#fff",
                  border: "1px solid #e3e1dc",
                  borderRadius: 8,
                  padding: 8,
                  display: "block",
                }}
              />
              <p style={{ fontSize: 11, color: "#5b5f6b", margin: "4px 0 0", maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {logo.name}
              </p>
              <button type="button" onClick={() => remove(i)} style={removeButtonStyle} aria-label={`Quitar ${logo.name}`}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button type="button" onClick={save} style={saveButtonStyle} disabled={uploading || status === "saving"}>
          {status === "saving" ? "Guardando…" : "Guardar marcas"}
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
  width: 20,
  height: 20,
  background: "rgba(28,19,16,0.7)",
  color: "#fff",
  cursor: "pointer",
  fontSize: 12,
  lineHeight: 1,
};
