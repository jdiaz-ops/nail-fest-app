"use client";

import { useRef, useState } from "react";
import RichTextEditor from "@/components/RichTextEditor";
import { compressImage } from "@/lib/imageCompression";
import {
  LANDING_CARD_ICONS,
  LANDING_TONES,
  emptyAgendaRow,
  type AgendaRow,
  type LandingBlock,
  type LandingTone,
} from "@/lib/landingBlocks/types";

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
            : type === "faq"
              ? { type: "faq", title: "", items: [] }
              : type === "heading"
                ? { type: "heading", title: "", intro: "" }
                : type === "card"
                  ? { type: "card", eyebrow: "", title: "", html: "", icon: "none", tone: "pink", imageUrl: "" }
                  : type === "agenda"
                    ? { type: "agenda", rows: [emptyAgendaRow()] }
                    : type === "points"
                      ? { type: "points", items: [{ title: "", text: "" }], tone: "pink" }
                      : type === "venue"
                      ? { type: "venue", imageUrl: "", mapsUrl: "" }
                      : { type: "people", items: [{ name: "", handle: "", tag: "", photoUrl: "", tone: "pink" }] };
    onChange([...blocks, block]);
  }

  function updateAt(index: number, block: LandingBlock) {
    onChange(blocks.map((b, i) => (i === index ? block : b)));
  }

  function removeAt(index: number) {
    onChange(blocks.filter((_, i) => i !== index));
  }

  function moveBlock(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
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
              {block.hidden && (
                <div style={{ fontSize: 12, color: "#8a5a1f", background: "#fdf6e3", borderRadius: 6, padding: "6px 10px", marginBottom: 10 }}>
                  Oculto — no se ve en la página hasta que lo vuelvas a mostrar.
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
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
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: block.hidden ? "#b3ada3" : "#5b5f6b",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    flex: 1,
                    textDecoration: block.hidden ? "line-through" : "none",
                  }}
                >
                  {i + 1}. {BLOCK_LABELS[block.type]}
                </span>
                <label
                  title={block.hidden ? "Oculto en la página" : "Visible en la página"}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: block.hidden ? "#8a8478" : "#12966b", cursor: "pointer", flexShrink: 0 }}
                >
                  <input
                    type="checkbox"
                    role="switch"
                    checked={!block.hidden}
                    onChange={(e) => updateAt(i, { ...block, hidden: !e.target.checked })}
                    style={{ width: "auto", margin: 0 }}
                  />
                  {block.hidden ? "Oculto" : "Visible"}
                </label>
                {/* Drag-and-drop above doesn't work on a phone — these do. */}
                <button type="button" onClick={() => moveBlock(i, -1)} disabled={i === 0} title="Subir" aria-label="Subir" style={iconButtonStyle}>
                  ↑
                </button>
                <button type="button" onClick={() => moveBlock(i, 1)} disabled={i === blocks.length - 1} title="Bajar" aria-label="Bajar" style={iconButtonStyle}>
                  ↓
                </button>
                <button type="button" onClick={() => removeAt(i)} title="Quitar bloque" aria-label="Quitar bloque" style={iconButtonStyle}>
                  ×
                </button>
              </div>

              {block.type === "text" && (
                <RichTextEditor value={block.html} onChange={(html) => updateAt(i, { ...block, html })} />
              )}
              {block.type === "image" && <ImageBlockEditor block={block} onChange={(b) => updateAt(i, b)} />}
              {block.type === "gallery" && <GalleryBlockEditor block={block} onChange={(b) => updateAt(i, b)} />}
              {block.type === "faq" && <FaqBlockEditor block={block} onChange={(b) => updateAt(i, b)} />}
              {block.type === "heading" && <HeadingBlockEditor block={block} onChange={(b) => updateAt(i, b)} />}
              {block.type === "card" && <CardBlockEditor block={block} onChange={(b) => updateAt(i, b)} />}
              {block.type === "agenda" && <AgendaBlockEditor block={block} onChange={(b) => updateAt(i, b)} />}
              {block.type === "venue" && <VenueBlockEditor block={block} onChange={(b) => updateAt(i, b)} />}
              {block.type === "people" && <PeopleBlockEditor block={block} onChange={(b) => updateAt(i, b)} />}
              {block.type === "points" && <PointsBlockEditor block={block} onChange={(b) => updateAt(i, b)} />}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {(Object.keys(BLOCK_LABELS) as LandingBlock["type"][]).map((type) => (
          <button key={type} type="button" onClick={() => addBlock(type)} className="secondary" style={addButtonStyle}>
            + {BLOCK_LABELS[type]}
          </button>
        ))}
      </div>
    </div>
  );
}

// Also the order of the "+ …" buttons below the list.
const BLOCK_LABELS: Record<LandingBlock["type"], string> = {
  heading: "Título de sección",
  text: "Texto",
  image: "Imagen / GIF",
  gallery: "Galería",
  card: "Tarjeta destacada",
  points: "Lista de puntos",
  agenda: "Agenda",
  people: "Personas",
  venue: "Dónde es",
  faq: "Preguntas frecuentes",
};

const TONE_LABELS: Record<LandingTone, string> = { teal: "Turquesa", pink: "Rosa", peach: "Durazno" };
const ICON_LABELS: Record<(typeof LANDING_CARD_ICONS)[number], string> = {
  none: "Sin ícono",
  gift: "Regalo",
  ticket: "Boleta",
  star: "Estrella",
  clock: "Reloj",
};

// Every image block goes through the same compression as the hero and
// the gallery carousel — see lib/imageCompression.ts — except a GIF,
// which a canvas re-encode would freeze on its first frame. Transparent
// PNGs (logos, product cut-outs) keep their transparency.
async function uploadImage(file: File): Promise<{ url: string } | { error: string }> {
  const compressed = file.type === "image/gif" ? file : await compressImage(file, { maxDimension: 1600, quality: 0.85, keepTransparency: true });
  const form = new FormData();
  form.append("file", compressed);
  const res = await fetch("/api/admin/uploads/event-image", { method: "POST", body: form });
  const body = await res.json().catch(() => ({}));
  if (res.ok) return { url: body.url as string };
  return {
    error: body?.error === "too_large" ? "La imagen pesa más de 5MB." : body?.error === "not_an_image" ? "Ese archivo no es una imagen." : "No se pudo subir la imagen.",
  };
}

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
      const result = await uploadImage(file);
      if ("url" in result) onChange({ ...block, url: result.url });
      else setError(result.error);
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
      const result = await uploadImage(file);
      if ("url" in result) onChange({ ...block, images: [...block.images, result.url] });
      else setError(result.error);
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
              <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} title="Mover antes" aria-label="Mover antes" style={moveButtonStyle}>
                  ←
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === block.images.length - 1} title="Mover después" aria-label="Mover después" style={moveButtonStyle}>
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
            <button type="button" onClick={() => removeItem(i)} title="Quitar" aria-label="Quitar" style={iconButtonStyle}>
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

function HeadingBlockEditor({
  block,
  onChange,
}: {
  block: Extract<LandingBlock, { type: "heading" }>;
  onChange: (block: LandingBlock) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <input value={block.title} onChange={(e) => onChange({ ...block, title: e.target.value })} placeholder="Título (ej. Invitado especial)" />
      <textarea
        value={block.intro}
        onChange={(e) => onChange({ ...block, intro: e.target.value })}
        placeholder="Texto de introducción debajo del título (opcional)"
        rows={2}
        style={{ width: "100%" }}
      />
    </div>
  );
}

function ToneSelect({ value, onChange }: { value: LandingTone; onChange: (tone: LandingTone) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as LandingTone)} style={{ width: "auto" }}>
      {LANDING_TONES.map((t) => (
        <option key={t} value={t}>
          {TONE_LABELS[t]}
        </option>
      ))}
    </select>
  );
}

function CardBlockEditor({
  block,
  onChange,
}: {
  block: Extract<LandingBlock, { type: "card" }>;
  onChange: (block: LandingBlock) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <input
        value={block.eyebrow}
        onChange={(e) => onChange({ ...block, eyebrow: e.target.value })}
        placeholder="Etiqueta pequeña arriba (ej. LLEGA TEMPRANO) — opcional"
      />
      <input value={block.title} onChange={(e) => onChange({ ...block, title: e.target.value })} placeholder="Título de la tarjeta (ej. Bolsa edición especial)" />
      <RichTextEditor value={block.html} onChange={(html) => onChange({ ...block, html })} />
      <ImageField
        label="Foto de la tarjeta (opcional) — ej. la bolsa, el premio del sorteo"
        url={block.imageUrl}
        onChange={(imageUrl) => onChange({ ...block, imageUrl })}
      />
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 400 }}>
          Color
          <ToneSelect value={block.tone} onChange={(tone) => onChange({ ...block, tone })} />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 400 }}>
          Ícono
          <select
            value={block.icon}
            onChange={(e) => onChange({ ...block, icon: e.target.value as (typeof LANDING_CARD_ICONS)[number] })}
            style={{ width: "auto" }}
          >
            {LANDING_CARD_ICONS.map((icon) => (
              <option key={icon} value={icon}>
                {ICON_LABELS[icon]}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

function PointsBlockEditor({
  block,
  onChange,
}: {
  block: Extract<LandingBlock, { type: "points" }>;
  onChange: (block: LandingBlock) => void;
}) {
  type Item = (typeof block.items)[number];
  function updateItem(i: number, item: Item) {
    onChange({ ...block, items: block.items.map((it, j) => (j === i ? item : it)) });
  }
  function moveItem(i: number, dir: -1 | 1) {
    const target = i + dir;
    if (target < 0 || target >= block.items.length) return;
    const next = [...block.items];
    [next[i], next[target]] = [next[target]!, next[i]!];
    onChange({ ...block, items: next });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 400 }}>
        Color de los títulos
        <ToneSelect value={block.tone} onChange={(tone) => onChange({ ...block, tone })} />
      </label>
      {block.items.map((item, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6, border: "1px solid #f0efec", borderRadius: 6, padding: 10 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input value={item.title} onChange={(e) => updateItem(i, { ...item, title: e.target.value })} placeholder="Título (ej. Descubrir)" style={{ flex: 1 }} />
            <button type="button" onClick={() => moveItem(i, -1)} disabled={i === 0} title="Subir" aria-label="Subir" style={iconButtonStyle}>
              ↑
            </button>
            <button type="button" onClick={() => moveItem(i, 1)} disabled={i === block.items.length - 1} title="Bajar" aria-label="Bajar" style={iconButtonStyle}>
              ↓
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...block, items: block.items.filter((_, j) => j !== i) })}
              title="Quitar"
              aria-label="Quitar"
              style={iconButtonStyle}
            >
              ×
            </button>
          </div>
          <textarea
            value={item.text}
            onChange={(e) => updateItem(i, { ...item, text: e.target.value })}
            placeholder="Texto (ej. Lo nuevo de 26 marcas, todas con descuento. Tócalo, pruébalo, llévatelo.)"
            rows={2}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange({ ...block, items: [...block.items, { title: "", text: "" }] })}
        className="secondary"
        style={{ width: "auto", padding: "6px 12px", alignSelf: "flex-start" }}
      >
        + Agregar punto
      </button>
    </div>
  );
}

function AgendaBlockEditor({
  block,
  onChange,
}: {
  block: Extract<LandingBlock, { type: "agenda" }>;
  onChange: (block: LandingBlock) => void;
}) {
  function updateRow(i: number, row: AgendaRow) {
    onChange({ ...block, rows: block.rows.map((r, j) => (j === i ? row : r)) });
  }
  function removeRow(i: number) {
    onChange({ ...block, rows: block.rows.filter((_, j) => j !== i) });
  }
  function moveRow(i: number, dir: -1 | 1) {
    const target = i + dir;
    if (target < 0 || target >= block.rows.length) return;
    const next = [...block.rows];
    [next[i], next[target]] = [next[target]!, next[i]!];
    onChange({ ...block, rows: next });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {block.rows.map((row, i) => {
        const controls = (
          <>
            <ToneSelect value={row.tone} onChange={(tone) => updateRow(i, { ...row, tone })} />
            <button type="button" onClick={() => moveRow(i, -1)} disabled={i === 0} title="Subir" aria-label="Subir" style={iconButtonStyle}>
              ↑
            </button>
            <button type="button" onClick={() => moveRow(i, 1)} disabled={i === block.rows.length - 1} title="Bajar" aria-label="Bajar" style={iconButtonStyle}>
              ↓
            </button>
            <button type="button" onClick={() => removeRow(i)} title="Quitar" aria-label="Quitar" style={iconButtonStyle}>
              ×
            </button>
          </>
        );

        if (row.kind === "day") {
          return (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", background: "#faf9f7", border: "1px solid #f0efec", borderRadius: 6, padding: 10 }}>
              <span style={agendaTagStyle}>Día</span>
              <input
                value={row.chip}
                onChange={(e) => updateRow(i, { ...row, chip: e.target.value })}
                placeholder="Ej. Sábado 7 de noviembre"
                style={{ flex: "1 1 180px" }}
              />
              {controls}
            </div>
          );
        }

        return (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              border: row.sponsored ? "2px solid #f0a8c0" : "1px solid #f0efec",
              borderRadius: 6,
              padding: 10,
            }}
          >
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input
                value={row.chip}
                onChange={(e) => updateRow(i, { ...row, chip: e.target.value })}
                placeholder="Hora (ej. 10:15 a. m.)"
                style={{ flex: "1 1 120px" }}
              />
              {controls}
            </div>
            <input value={row.topic} onChange={(e) => updateRow(i, { ...row, topic: e.target.value })} placeholder="Tema (ej. Manicura Macro)" />
            <input
              value={row.instructor}
              onChange={(e) => updateRow(i, { ...row, instructor: e.target.value })}
              placeholder="Instructor/a (ej. Dayhana Rodríguez)"
            />
            <ImageField label="Foto del instructor/a (opcional)" url={row.photoUrl} round onChange={(photoUrl) => updateRow(i, { ...row, photoUrl })} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                value={row.brand}
                onChange={(e) => updateRow(i, { ...row, brand: e.target.value })}
                placeholder="Marca (ej. AM Glow)"
                style={{ flex: "1 1 140px" }}
              />
              <input
                value={row.handles}
                onChange={(e) => updateRow(i, { ...row, handles: e.target.value })}
                placeholder="Instagram (ej. @amglowspa @dayhana)"
                style={{ flex: "1 1 200px" }}
              />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 400 }}>
              <input type="checkbox" checked={row.sponsored} onChange={(e) => updateRow(i, { ...row, sponsored: e.target.checked })} style={{ width: "auto" }} />
              Marca patrocinadora: destacar esta demostración con &quot;Presentado por&quot; y el nombre de la marca
            </label>
            {row.sponsored && !row.brand && (
              <p style={{ fontSize: 12, color: "#8a5a1f", margin: 0 }}>Escribe el nombre de la marca arriba: es lo que sale junto a &quot;Presentado por&quot;.</p>
            )}
            <input
              value={row.text}
              onChange={(e) => updateRow(i, { ...row, text: e.target.value })}
              placeholder="Nota extra (opcional, ej. Cupos limitados en primera fila)"
            />
          </div>
        );
      })}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => onChange({ ...block, rows: [...block.rows, emptyAgendaRow("session")] })}
          className="secondary"
          style={{ width: "auto", padding: "6px 12px" }}
        >
          + Demostración / charla
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...block, rows: [...block.rows, emptyAgendaRow("day")] })}
          className="secondary"
          style={{ width: "auto", padding: "6px 12px" }}
        >
          + Día
        </button>
      </div>
    </div>
  );
}

// One uploadable picture with its preview and a remove button — the card
// photo, an instructor's headshot, a sponsor's logo.
function ImageField({ label, url, round, onChange }: { label: string; url: string; round?: boolean; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const result = await uploadImage(file);
      if ("url" in result) onChange(result.url);
      else setError(result.error);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12, color: "#5b5f6b" }}>{label}</span>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {url && (
          <div style={{ position: "relative" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of an arbitrary uploaded URL */}
            <img
              src={url}
              alt=""
              style={
                round
                  ? { width: 56, height: 56, objectFit: "cover", borderRadius: "50%", display: "block", border: "1px solid #e3e1dc" }
                  : { maxWidth: 160, maxHeight: 90, borderRadius: 6, display: "block", border: "1px solid #e3e1dc", background: "#f6f5f2" }
              }
            />
            <button type="button" onClick={() => onChange("")} style={removeImageButtonStyle} aria-label="Quitar imagen">
              ×
            </button>
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} disabled={uploading} style={{ flex: 1 }} />
      </div>
      {uploading && <p style={{ fontSize: 12, color: "#5b5f6b", margin: 0 }}>Subiendo…</p>}
      {error && <p style={{ fontSize: 12, color: "#c2185b", margin: 0 }}>{error}</p>}
    </div>
  );
}

const agendaTagStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#8a8478",
};

function VenueBlockEditor({
  block,
  onChange,
}: {
  block: Extract<LandingBlock, { type: "venue" }>;
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
      const result = await uploadImage(file);
      if ("url" in result) onChange({ ...block, imageUrl: result.url });
      else setError(result.error);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ fontSize: 12, color: "#5b5f6b", margin: 0 }}>
        El nombre del lugar, la dirección y los horarios salen solos de los datos del evento (arriba en este mismo
        formulario). Aquí solo agregas una foto del lugar y el enlace de Google Maps, ambos opcionales.
      </p>
      {block.imageUrl && (
        <div style={{ position: "relative", display: "inline-block" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of an arbitrary uploaded URL */}
          <img src={block.imageUrl} alt="" style={{ maxWidth: 280, maxHeight: 160, borderRadius: 8, display: "block", border: "1px solid #e3e1dc" }} />
          <button type="button" onClick={() => onChange({ ...block, imageUrl: "" })} style={removeImageButtonStyle} aria-label="Quitar foto">
            ×
          </button>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} disabled={uploading} />
      {uploading && <p style={{ fontSize: 12, color: "#5b5f6b", margin: 0 }}>Subiendo…</p>}
      {error && <p style={{ fontSize: 12, color: "#c2185b", margin: 0 }}>{error}</p>}
      <input
        value={block.mapsUrl}
        onChange={(e) => onChange({ ...block, mapsUrl: e.target.value })}
        placeholder="Enlace de Google Maps (opcional)"
        inputMode="url"
      />
    </div>
  );
}

function PeopleBlockEditor({
  block,
  onChange,
}: {
  block: Extract<LandingBlock, { type: "people" }>;
  onChange: (block: LandingBlock) => void;
}) {
  type Person = (typeof block.items)[number];
  function updateItem(i: number, item: Person) {
    onChange({ ...block, items: block.items.map((p, j) => (j === i ? item : p)) });
  }
  function removeItem(i: number) {
    onChange({ ...block, items: block.items.filter((_, j) => j !== i) });
  }
  function moveItem(i: number, dir: -1 | 1) {
    const target = i + dir;
    if (target < 0 || target >= block.items.length) return;
    const next = [...block.items];
    [next[i], next[target]] = [next[target]!, next[i]!];
    onChange({ ...block, items: next });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ fontSize: 12, color: "#5b5f6b", margin: 0 }}>
        Salen como tarjetas deslizables. La foto es opcional — sin foto, la tarjeta muestra las iniciales del nombre en
        el color elegido.
      </p>
      {block.items.map((person, i) => (
        <PersonEditor
          key={i}
          person={person}
          first={i === 0}
          last={i === block.items.length - 1}
          onChange={(p) => updateItem(i, p)}
          onMove={(dir) => moveItem(i, dir)}
          onRemove={() => removeItem(i)}
        />
      ))}
      <button
        type="button"
        onClick={() => onChange({ ...block, items: [...block.items, { name: "", handle: "", tag: "", photoUrl: "", tone: "pink" }] })}
        className="secondary"
        style={{ width: "auto", padding: "6px 12px", alignSelf: "flex-start" }}
      >
        + Agregar persona
      </button>
    </div>
  );
}

function PersonEditor({
  person,
  first,
  last,
  onChange,
  onMove,
  onRemove,
}: {
  person: Extract<LandingBlock, { type: "people" }>["items"][number];
  first: boolean;
  last: boolean;
  onChange: (person: Extract<LandingBlock, { type: "people" }>["items"][number]) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
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
      const result = await uploadImage(file);
      if ("url" in result) onChange({ ...person, photoUrl: result.url });
      else setError(result.error);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, border: "1px solid #f0efec", borderRadius: 6, padding: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input value={person.name} onChange={(e) => onChange({ ...person, name: e.target.value })} placeholder="Nombre" style={{ flex: 1 }} />
        <button type="button" onClick={() => onMove(-1)} disabled={first} title="Subir" aria-label="Subir" style={iconButtonStyle}>
          ↑
        </button>
        <button type="button" onClick={() => onMove(1)} disabled={last} title="Bajar" aria-label="Bajar" style={iconButtonStyle}>
          ↓
        </button>
        <button type="button" onClick={onRemove} title="Quitar" aria-label="Quitar" style={iconButtonStyle}>
          ×
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          value={person.handle}
          onChange={(e) => onChange({ ...person, handle: e.target.value })}
          placeholder="@instagram (opcional)"
          style={{ flex: "1 1 140px" }}
        />
        <input
          value={person.tag}
          onChange={(e) => onChange({ ...person, tag: e.target.value })}
          placeholder="Etiqueta (ej. Panel · Sáb 3:15)"
          style={{ flex: "1 1 160px" }}
        />
        <ToneSelect value={person.tone} onChange={(tone) => onChange({ ...person, tone })} />
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {person.photoUrl && (
          <div style={{ position: "relative" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of an arbitrary uploaded URL */}
            <img src={person.photoUrl} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: "50%", display: "block", border: "1px solid #e3e1dc" }} />
            <button type="button" onClick={() => onChange({ ...person, photoUrl: "" })} style={removeImageButtonStyle} aria-label="Quitar foto">
              ×
            </button>
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} disabled={uploading} style={{ flex: 1 }} />
      </div>
      {uploading && <p style={{ fontSize: 12, color: "#5b5f6b", margin: 0 }}>Subiendo…</p>}
      {error && <p style={{ fontSize: 12, color: "#c2185b", margin: 0 }}>{error}</p>}
    </div>
  );
}

const addButtonStyle: React.CSSProperties = {
  width: "auto",
  padding: "8px 14px",
};

const iconButtonStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  border: "1px solid #e3e1dc",
  borderRadius: 6,
  background: "#fff",
  cursor: "pointer",
  fontSize: 14,
  lineHeight: 1,
  flexShrink: 0,
};

const moveButtonStyle: React.CSSProperties = {
  flex: 1,
  height: 30,
  border: "1px solid #e3e1dc",
  borderRadius: 4,
  background: "#fff",
  cursor: "pointer",
  fontSize: 14,
  lineHeight: 1,
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
