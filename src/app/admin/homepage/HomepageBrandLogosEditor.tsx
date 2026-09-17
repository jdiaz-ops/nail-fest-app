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
// (it's never shown on the public page) — and drag to reorder once
// they're all in (↑/↓-per-click was the first version of this and was
// reported unusable at this scale — moving item 53 to the top took 50+
// clicks).
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

  // Native HTML5 drag-and-drop — no library, ↑/↓-click reordering was
  // reported as unusable once there are dozens of logos (moving one from
  // the bottom to the top took 50+ clicks). dragIndex is which row is
  // being dragged; overIndex is whichever row the pointer is currently
  // over, used only to draw the insertion line — the actual reorder
  // happens once, on drop.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  function handleDrop(targetIndex: number) {
    setLogos((prev) => {
      if (dragIndex === null || dragIndex === targetIndex) return prev;
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(targetIndex, 0, moved!);
      return next;
    });
    setDragIndex(null);
    setOverIndex(null);
  }

  // Checkbox multi-select + "mover arriba/abajo" — drag-and-drop handles
  // fine positioning one at a time; this handles the "grab 15 of these
  // and send them all to the front" case in one click instead of 15
  // separate drags. Keyed by url (stable across reorders), not index.
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleSelected(url: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  // Pulls every selected logo out (keeping their relative order to each
  // other) and drops the whole group at the front or back of the list;
  // everyone else keeps their existing relative order too. Selection
  // itself is left alone afterward — grab another batch and move again,
  // or move the same batch again, without re-selecting.
  function moveSelected(edge: "top" | "bottom") {
    setLogos((prev) => {
      const chosen = prev.filter((l) => selected.has(l.url));
      const rest = prev.filter((l) => !selected.has(l.url));
      if (chosen.length === 0) return prev;
      return edge === "top" ? [...chosen, ...rest] : [...rest, ...chosen];
    });
  }

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
    const removedUrl = logos[index]?.url;
    setLogos((prev) => prev.filter((_, i) => i !== index));
    if (removedUrl) {
      setSelected((prev) => {
        if (!prev.has(removedUrl)) return prev;
        const next = new Set(prev);
        next.delete(removedUrl);
        return next;
      });
    }
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
            {logos.length} logos — arrastra del ⠿ para mover uno, o marca varios y usa los botones para moverlos todos de una vez. El
            nombre es solo para que los reconozcas aquí.
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#5b5f6b" }}>
              <input
                type="checkbox"
                checked={logos.length > 0 && selected.size === logos.length}
                onChange={(e) => setSelected(e.target.checked ? new Set(logos.map((l) => l.url)) : new Set())}
              />
              Seleccionar todos
            </label>
            <span style={{ fontSize: 12.5, color: "#5b5f6b" }}>{selected.size} seleccionados</span>
            <button type="button" onClick={() => moveSelected("top")} disabled={selected.size === 0} style={toolbarButtonStyle}>
              ↑ Mover arriba
            </button>
            <button type="button" onClick={() => moveSelected("bottom")} disabled={selected.size === 0} style={toolbarButtonStyle}>
              ↓ Mover abajo
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 480, overflowY: "auto", paddingRight: 4 }}>
            {logos.map((logo, i) => (
              <div
                key={logo.url}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragIndex !== null && i !== overIndex) setOverIndex(i);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(i);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  border: overIndex === i && dragIndex !== null && dragIndex !== i ? "1px solid #12966b" : "1px solid #e3e1dc",
                  background: selected.has(logo.url) ? "#eef6ff" : overIndex === i && dragIndex !== null && dragIndex !== i ? "#f0faf6" : "#fff",
                  borderRadius: 8,
                  padding: 8,
                  opacity: dragIndex === i ? 0.4 : 1,
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(logo.url)}
                  onChange={() => toggleSelected(logo.url)}
                  style={{ flexShrink: 0 }}
                />
                <span
                  draggable
                  onDragStart={() => setDragIndex(i)}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setOverIndex(null);
                  }}
                  title="Arrastra para reordenar"
                  style={{ cursor: "grab", color: "#8a8478", fontSize: 18, flexShrink: 0, touchAction: "none", userSelect: "none" }}
                >
                  ⠿
                </span>
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
                <button type="button" onClick={() => remove(i)} title="Quitar" style={{ ...iconButtonStyle, color: "#c2185b", flexShrink: 0 }}>
                  ×
                </button>
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

const toolbarButtonStyle: React.CSSProperties = {
  padding: "6px 12px",
  border: "1px solid #e3e1dc",
  borderRadius: 6,
  background: "#fff",
  cursor: "pointer",
  fontSize: 12.5,
  fontWeight: 600,
  color: "#17181c",
};
