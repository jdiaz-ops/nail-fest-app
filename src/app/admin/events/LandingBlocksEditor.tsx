"use client";

import { useRef, useState } from "react";
import RichTextEditor from "@/components/RichTextEditor";
import type { LandingBlock } from "@/lib/landingBlocks/types";

// Self-service alternative to the plain Description field below — see
// Event.landingBlocks's own schema comment. Controlled component, same
// value/onChange shape as RichTextEditor, so EventForm just treats it as
// one more field on `values` and saves it with everything else on the
// form's single "Guardar cambios" button (unlike the homepage's per-
// section editors, which each save independently — an event's whole page
// is one coherent save here, matching how Description already works).
export default function LandingBlocksEditor({
  blocks,
  onChange,
}: {
  blocks: LandingBlock[];
  onChange: (blocks: LandingBlock[]) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  function addBlock(type: LandingBlock["type"]) {
    const block: LandingBlock =
      type === "text"
        ? { type: "text", html: "" }
        : type === "image"
          ? { type: "image", url: "", caption: "" }
          : type === "gallery"
            ? { type: "gallery", images: [] }
            : { type: "faq", title: "", items: [] };
    onChange([...blocks, block]);
  }

  function updateAt(index: number, block: LandingBlock) {
    onChange(blocks.map((b, i) => (i === index ? block : b)));
  }

  function removeAt(index: number) {
    onChange(blocks.filter((_, i) => i !== index));
  }

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }
    const next = [...blocks];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved!);
    onChange(next);
    setDragIndex(null);
    setOverIndex(null);
  }

  return (
    <div>
      {blocks.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
          {blocks.map((block, i) => (
            <div
              key={i}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragIndex !== null && i !== overIndex) setOverIndex(i);
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(i);
              }}
              style={{
                border: overIndex === i && dragIndex !== null && dragIndex !== i ? "1px solid #12966b" : "1px solid #e3e1dc",
                background: overIndex === i && dragIndex !== null && dragIndex !== i ? "#f0faf6" : "#fff",
                borderRadius: 8,
                padding: 14,
                opacity: dragIndex === i ? 0.4 : 1,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
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
                <span style={{ fontSize: 12, fontWeight: 700, color: "#5b5f6b", textTransform: "uppercase", letterSpacing: "0.04em", flex: 1 }}>
                  {BLOCK_LABELS[block.type]}
                </span>
                <button type="button" onClick={() => removeAt(i)} title="Quitar bloque" style={iconButtonStyle}>
                  ×
                </button>
              </div>

              {block.type === "text" && (
                <RichTextEditor value={block.html} onChange={(html) => updateAt(i, { ...block, html })} />
              )}
              {block.type === "image" && <ImageBlockEditor block={block} onChange={(b) => updateAt(i, b)} />}
              {block.type === "gallery" && <GalleryBlockEditor block={block} onChange={(b) => updateAt(i, b)} />}
              {block.type === "faq" && <FaqBlockEditor block={block} onChange={(b) => updateAt(i, b)} />}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={() => addBlock("text")} className="secondary" style={addButtonStyle}>
          + Texto
        </button>
        <button type="button" onClick={() => addBlock("image")} className="secondary" style={addButtonStyle}>
          + Imagen/GIF
        </button>
        <button type="button" onClick={() => addBlock("gallery")} className="secondary" style={addButtonStyle}>
          + Galería
        </button>
        <button type="button" onClick={() => addBlock("faq")} className="secondary" style={addButtonStyle}>
          + Preguntas frecuentes
        </button>
      </div>
    </div>
  );
}

const BLOCK_LABELS: Record<LandingBlock["type"], string> = {
  text: "Texto",
  image: "Imagen / GIF",
  gallery: "Galería",
  faq: "Preguntas frecuentes",
};

function ImageBlockEditor({
  block,
  onChange,
}: {
  block: Extract<LandingBlock, { type: "image" }>;
  onChange: (block: LandingBlock) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/uploads/event-image", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        onChange({ ...block, url: body.url });
      } else {
        setError(body?.error === "too_large" ? "La imagen pesa más de 5MB." : body?.error === "not_an_image" ? "Ese archivo no es una imagen." : "No se pudo subir la imagen.");
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {block.url && (
        <div style={{ position: "relative", display: "inline-block" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of an arbitrary uploaded URL */}
          <img src={block.url} alt="" style={{ maxWidth: 280, maxHeight: 160, borderRadius: 8, display: "block", border: "1px solid #e3e1dc" }} />
          <button type="button" onClick={() => onChange({ ...block, url: "" })} style={removeImageButtonStyle} aria-label="Quitar imagen">
            ×
          </button>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} disabled={uploading} />
      {uploading && <p style={{ fontSize: 12, color: "#5b5f6b", margin: 0 }}>Subiendo…</p>}
      {error && <p style={{ fontSize: 12, color: "#c2185b", margin: 0 }}>{error}</p>}
      <input
        value={block.caption}
        onChange={(e) => onChange({ ...block, caption: e.target.value })}
        placeholder="Pie de foto (opcional)"
        style={{ maxWidth: 400 }}
      />
    </div>
  );
}

function GalleryBlockEditor({
  block,
  onChange,
}: {
  block: Extract<LandingBlock, { type: "gallery" }>;
  onChange: (block: LandingBlock) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/uploads/event-image", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        onChange({ ...block, images: [...block.images, body.url] });
      } else {
        setError(body?.error === "too_large" ? "La imagen pesa más de 5MB." : body?.error === "not_an_image" ? "Ese archivo no es una imagen." : "No se pudo subir la imagen.");
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removeImage(idx: number) {
    onChange({ ...block, images: block.images.filter((_, i) => i !== idx) });
  }

  function move(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= block.images.length) return;
    const next = [...block.images];
    [next[idx], next[target]] = [next[target]!, next[idx]!];
    onChange({ ...block, images: next });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {block.images.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {block.images.map((url, i) => (
            <div key={url + i} style={{ position: "relative" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of an arbitrary uploaded URL */}
              <img src={url} alt="" style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 6, display: "block", border: "1px solid #e3e1dc" }} />
              <button type="button" onClick={() => removeImage(i)} style={removeImageButtonStyle} aria-label="Quitar foto">
                ×
              </button>
              <div style={{ display: "flex", justifyContent: "center", gap: 2, marginTop: 2 }}>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} title="Mover antes" style={tinyButtonStyle}>
                  ←
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === block.images.length - 1} title="Mover después" style={tinyButtonStyle}>
                  →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} disabled={uploading} />
      {uploading && <p style={{ fontSize: 12, color: "#5b5f6b", margin: 0 }}>Subiendo…</p>}
      {error && <p style={{ fontSize: 12, color: "#c2185b", margin: 0 }}>{error}</p>}
    </div>
  );
}

function FaqBlockEditor({
  block,
  onChange,
}: {
  block: Extract<LandingBlock, { type: "faq" }>;
  onChange: (block: LandingBlock) => void;
}) {
  function updateItem(i: number, item: { question: string; answer: string }) {
    onChange({ ...block, items: block.items.map((it, j) => (j === i ? item : it)) });
  }
  function removeItem(i: number) {
    onChange({ ...block, items: block.items.filter((_, j) => j !== i) });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <input
        value={block.title}
        onChange={(e) => onChange({ ...block, title: e.target.value })}
        placeholder="Título de la sección (opcional, ej. Preguntas frecuentes)"
      />
      {block.items.map((item, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6, border: "1px solid #f0efec", borderRadius: 6, padding: 10 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <input
              value={item.question}
              onChange={(e) => updateItem(i, { ...item, question: e.target.value })}
              placeholder="Pregunta"
              style={{ flex: 1 }}
            />
            <button type="button" onClick={() => removeItem(i)} title="Quitar" style={iconButtonStyle}>
              ×
            </button>
          </div>
          <textarea
            value={item.answer}
            onChange={(e) => updateItem(i, { ...item, answer: e.target.value })}
            placeholder="Respuesta"
            rows={2}
            style={{ width: "100%" }}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange({ ...block, items: [...block.items, { question: "", answer: "" }] })}
        className="secondary"
        style={{ width: "auto", padding: "6px 12px", alignSelf: "flex-start" }}
      >
        + Agregar pregunta
      </button>
    </div>
  );
}

const addButtonStyle: React.CSSProperties = {
  width: "auto",
  padding: "8px 14px",
};

const iconButtonStyle: React.CSSProperties = {
  width: 26,
  height: 26,
  border: "1px solid #e3e1dc",
  borderRadius: 6,
  background: "#fff",
  cursor: "pointer",
  fontSize: 14,
  lineHeight: 1,
  flexShrink: 0,
};

const removeImageButtonStyle: React.CSSProperties = {
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

const tinyButtonStyle: React.CSSProperties = {
  border: "1px solid #e3e1dc",
  borderRadius: 4,
  background: "#fff",
  cursor: "pointer",
  fontSize: 10,
  lineHeight: 1,
  padding: "2px 5px",
};
