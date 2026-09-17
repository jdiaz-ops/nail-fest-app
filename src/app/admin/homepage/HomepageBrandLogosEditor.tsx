"use client";

import { useRef, useState } from "react";
import { postSettings, cardStyle, saveButtonStyle } from "../settings/shared";

interface BrandLogo {
  url: string;
  name: string;
}

// A real brand wall runs into the dozens (see the screenshot that
// prompted this — 53 logo files picked in one file-browser session), so
// this is built around THAT shape: select every file at once, upload
// them all (bounded concurrency, not 53 requests fired at the same
// instant), name each one at your own pace afterward — never required
// up front, since the name only exists for THIS list to stay legible
// (it's never shown on the public page) — and reorder with ↑/↓ once
// they're all in, since "cuál va primero" only makes sense to decide
// after seeing the whole set.
const UPLOAD_CONCURRENCY = 4;

export default function HomepageBrandLogosEditor({
  initialLogos,
  initialTitle,
}: {
  initialLogos: BrandLogo[];
  initialTitle: string | null;
}) {
  const [title, setTitle] = useState(initialTitle ?? "");
  const [logos, setLogos] = useState(initialLogos);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploadErrors([]);
    setUploadProgress({ done: 0, total: files.length });

    const results: BrandLogo[] = [];
    const errors: string[] = [];
    let cursor = 0;
    async function worker() {
      while (cursor < files.length) {
        const file = files[cursor++]!;
        const form = new FormData();
        form.append("file", file);
        try {
          const res = await fetch("/api/admin/uploads/homepage-image", { method: "POST", body: form });
          const body = await res.json().catch(() => ({}));
          if (res.ok) {
            // Name left blank — bulk-picked files rarely have a useful
            // one (the screenshot that prompted this: "NF Square 2026
            // (53).png"), so nothing is auto-derived. Typed in
            // afterward, per logo, in the list below — optional, never
            // blocks the upload or the save.
            results.push({ url: body.url, name: "" });
          } else {
            errors.push(`${file.name}: ${body?.error === "too_large" ? "pesa más de 5MB" : body?.error === "not_an_image" ? "no es una imagen" : "error al subir"}`);
          }
        } catch {
          errors.push(`${file.name}: error de red`);
        }
        setUploadProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
      }
    }
    await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, files.length) }, worker));

    setLogos((prev) => [...prev, ...results]);
    setUploadErrors(errors);
    setUploadProgress(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function renameAt(index: number, name: string) {
    setLogos((prev) => prev.map((l, i) => (i === index ? { ...l, name } : l)));
  }

  function remove(index: number) {
    setLogos((prev) => prev.filter((_, i) => i !== index));
  }

  function move(index: number, direction: -1 | 1) {
    setLogos((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  async function save() {
    setStatus("saving");
    try {
      await postSettings({ homepageBrandLogos: logos, homepageBrandLogosTitle: title });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div style={{ ...cardStyle, marginTop: 20 }}>
      <label style={{ fontWeight: 600, display: "block", marginBottom: 4 }}>Marcas aliadas (opcional)</label>
      <p style={{ fontSize: 13, color: "#5b5f6b", margin: "0 0 14px" }}>
        Una pared de logos debajo de la galería — 6 en fila en computador, 3 en celular.
      </p>

      <div className="field" style={{ marginBottom: 16 }}>
        <label>Título arriba de la sección (opcional)</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ej. Marcas que confían en nosotros" />
      </div>

      <label style={{ fontSize: 12, color: "#5b5f6b", display: "block", marginBottom: 4 }}>
        Selecciona todos los logos de una vez
      </label>
      <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleFiles} disabled={uploadProgress !== null} />
      {uploadProgress && (
        <p style={{ fontSize: 13, color: "#5b5f6b" }}>
          Subiendo {uploadProgress.done} de {uploadProgress.total}…
        </p>
      )}
      {uploadErrors.length > 0 && (
        <div style={{ fontSize: 12, color: "#c2185b", marginTop: 6 }}>
          {uploadErrors.map((e, i) => (
            <p key={i} style={{ margin: "2px 0" }}>
              {e}
            </p>
          ))}
        </div>
      )}

      {logos.length > 0 && (
        <div style={{ marginTop: 16, marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: "#5b5f6b", margin: "0 0 8px" }}>
            {logos.length} logos — usa ↑/↓ para el orden en que se muestran, el nombre es solo para que los reconozcas aquí.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 480, overflowY: "auto", paddingRight: 4 }}>
            {logos.map((logo, i) => (
              <div
                key={logo.url + i}
                style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid #e3e1dc", borderRadius: 8, padding: 8 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of an arbitrary uploaded URL */}
                <img
                  src={logo.url}
                  alt={logo.name || `Logo ${i + 1}`}
                  style={{ width: 44, height: 44, objectFit: "contain", background: "#fff", border: "1px solid #e3e1dc", borderRadius: 6, flexShrink: 0 }}
                />
                <input
                  value={logo.name}
                  onChange={(e) => renameAt(i, e.target.value)}
                  placeholder={`Logo ${i + 1} (sin nombre)`}
                  style={{ flex: 1, padding: "6px 10px", border: "1px solid #e3e1dc", borderRadius: 6, fontSize: 13, minWidth: 0 }}
                />
                <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} title="Subir" style={iconButtonStyle}>
                    ↑
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === logos.length - 1} title="Bajar" style={iconButtonStyle}>
                    ↓
                  </button>
                  <button type="button" onClick={() => remove(i)} title="Quitar" style={{ ...iconButtonStyle, color: "#c2185b" }}>
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button type="button" onClick={save} style={saveButtonStyle} disabled={uploadProgress !== null || status === "saving"}>
          {status === "saving" ? "Guardando…" : "Guardar marcas"}
        </button>
        {status === "saved" && <span style={{ color: "#12966b", fontSize: 14 }}>Guardado ✓</span>}
        {status === "error" && <span style={{ color: "#c2185b", fontSize: 14 }}>Error al guardar</span>}
      </div>
    </div>
  );
}

const iconButtonStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  border: "1px solid #e3e1dc",
  borderRadius: 6,
  background: "#fff",
  cursor: "pointer",
  fontSize: 14,
  lineHeight: 1,
};
