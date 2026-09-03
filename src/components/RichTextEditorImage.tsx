"use client";

import { useState, type CSSProperties } from "react";
import Image from "@tiptap/extension-image";
import { mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";

// Extends TipTap's stock Image node (src/alt/title only, no way to select
// it and nothing to edit once inserted) with the same per-image controls
// established ticketing-platform editors expose on click: alt text, a
// caption, a left/center/right/none position, and an optional link — plus
// an actual
// selected state (outline + Editar/Eliminar buttons) so an image can be
// picked out and removed instead of only ever deleted by placing the
// cursor next to it and hitting backspace.
//
// Stored as <figure class="tiptap-image" data-align="..."> wrapping the
// <img> (+ optional <a>/<figcaption>) instead of a bare <img> — see
// globals.css's ".event-description figure.tiptap-image" rules for how
// the public event page renders the same position/caption, and
// sanitizeHtml.ts for why figure/figcaption had to be added to the
// allowlist. A bare <img> (every description saved before this shipped)
// still parses and edits fine — see the legacy parseHTML rule below.
export const ImageWithControls = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: "none",
        // Rendered manually in renderHTML below, not auto-composed onto
        // the node's root element the way a plain attribute would be.
        rendered: false,
      },
      caption: {
        default: null,
        rendered: false,
      },
      href: {
        default: null,
        rendered: false,
      },
    };
  },

  parseHTML() {
    return [
      // This extension's own shape (see renderHTML below).
      {
        tag: "figure.tiptap-image",
        getAttrs: (dom) => {
          if (!(dom instanceof HTMLElement)) return false;
          const img = dom.querySelector("img");
          if (!img) return false;
          const link = dom.querySelector("a");
          return {
            src: img.getAttribute("src"),
            alt: img.getAttribute("alt"),
            align: dom.getAttribute("data-align") || "none",
            caption: dom.querySelector("figcaption")?.textContent || null,
            href: link?.getAttribute("href") || null,
          };
        },
      },
      // Legacy shape — a bare <img>, exactly what the stock extension
      // this wraps already parses. Kept so content saved before this
      // feature shipped still loads (align/caption/href fall back to
      // their schema defaults since a plain <img> carries none of them).
      ...(this.parent?.() ?? []),
    ];
  },

  renderHTML({ node }) {
    const { src, alt, align, caption, href } = node.attrs as {
      src: string | null;
      alt: string | null;
      align: string | null;
      caption: string | null;
      href: string | null;
    };

    // The inline style (not just a CSS class) is what keeps this
    // responsive in a confirmation email, not only on the public event
    // page — a class alone only works where globals.css's own
    // `.event-description img` rule is actually loaded, which an email
    // never does (see sanitizeHtml.ts's own comment on why "style" had
    // to join img's allowlist). Same numbers as that CSS rule, just
    // carried on the element itself so they travel with the HTML.
    const imgSpec: [string, Record<string, unknown>] = [
      "img",
      mergeAttributes(this.options.HTMLAttributes, { src, alt, style: "max-width:100%;height:auto;border-radius:8px;" }),
    ];
    // Links always open in a new tab, same as a regular text link in this
    // editor (see RichTextEditor.tsx's handleLink — and sanitizeHtml.ts's
    // transformTags, which forces target/rel on every <a> regardless, so
    // there'd be nothing for a per-image "abrir en pestaña nueva" toggle
    // to actually control).
    const media = href ? ["a", { href, target: "_blank", rel: "noopener noreferrer" }, imgSpec] : imgSpec;
    const children: unknown[] = [media];
    if (caption) children.push(["figcaption", {}, caption]);

    return ["figure", { class: "tiptap-image", "data-align": align || "none" }, ...children];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});

const ALIGN_OPTIONS: { value: string; label: string }[] = [
  { value: "none", label: "Ninguna" },
  { value: "left", label: "Izquierda" },
  { value: "center", label: "Centro" },
  { value: "right", label: "Derecha" },
];

function ImageNodeView({ node, selected, updateAttributes, deleteNode }: NodeViewProps) {
  const [editing, setEditing] = useState(false);
  const { src, alt, caption, align, href } = node.attrs as {
    src: string;
    alt: string | null;
    caption: string | null;
    align: string | null;
    href: string | null;
  };

  const floated = align === "left" || align === "right";
  const wrapperStyle: CSSProperties = {
    margin: align === "center" ? "10px auto" : floated ? (align === "left" ? "4px 16px 10px 0" : "4px 0 10px 16px") : "10px 0",
    float: floated ? (align as "left" | "right") : "none",
    maxWidth: floated ? "55%" : "100%",
    display: align === "center" ? "table" : "block",
    position: "relative",
  };

  return (
    <NodeViewWrapper as="figure" data-align={align || "none"} style={wrapperStyle}>
      {/* eslint-disable-next-line @next/next/no-img-element -- editor preview of an admin-uploaded Blob URL, not a build-time-known asset */}
      <img
        src={src}
        alt={alt || ""}
        style={{
          display: "block",
          width: "100%",
          borderRadius: 8,
          outline: selected ? "2px solid var(--accent, #00beb5)" : "none",
          outlineOffset: 2,
          cursor: "pointer",
        }}
      />
      {caption && <figcaption style={{ fontSize: 12, color: "#8a8f9c", textAlign: "center", marginTop: 4 }}>{caption}</figcaption>}

      {selected && (
        <div contentEditable={false} style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 4 }}>
          <button type="button" onClick={() => setEditing(true)} style={toolbarButtonStyle}>
            ✎ Editar
          </button>
          <button type="button" onClick={() => deleteNode()} style={{ ...toolbarButtonStyle, color: "#c2185b" }} title="Eliminar imagen">
            🗑
          </button>
        </div>
      )}

      {editing && (
        <ImageEditModal
          initial={{ alt: alt || "", caption: caption || "", align: align || "none", href: href || "" }}
          onCancel={() => setEditing(false)}
          onDelete={() => {
            deleteNode();
            setEditing(false);
          }}
          onSave={(values) => {
            updateAttributes({
              alt: values.alt || null,
              caption: values.caption || null,
              align: values.align,
              href: values.href || null,
            });
            setEditing(false);
          }}
        />
      )}
    </NodeViewWrapper>
  );
}

const toolbarButtonStyle: CSSProperties = {
  border: "1px solid #e3e1dc",
  background: "#fff",
  borderRadius: 6,
  padding: "4px 8px",
  fontSize: 12,
  cursor: "pointer",
  boxShadow: "0 2px 6px rgba(0,0,0,0.16)",
};

function ImageEditModal({
  initial,
  onCancel,
  onDelete,
  onSave,
}: {
  initial: { alt: string; caption: string; align: string; href: string };
  onCancel: () => void;
  onDelete: () => void;
  onSave: (values: { alt: string; caption: string; align: string; href: string }) => void;
}) {
  const [alt, setAlt] = useState(initial.alt);
  const [caption, setCaption] = useState(initial.caption);
  const [align, setAlign] = useState(initial.align);
  const [href, setHref] = useState(initial.href);

  return (
    <div
      contentEditable={false}
      // Stops a click/mousedown inside the modal from reaching
      // ProseMirror's own handlers underneath — without this, interacting
      // with an input here can steal or collapse the image's selection
      // mid-edit.
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(28,19,16,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 200,
      }}
    >
      <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 380, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Editar imagen</h3>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cerrar"
            style={{ border: "none", background: "transparent", fontSize: 20, lineHeight: 1, cursor: "pointer", color: "#5b5f6b" }}
          >
            ×
          </button>
        </div>

        <div className="field">
          <label>Texto alternativo</label>
          <input value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Describe la imagen (accesibilidad, SEO)" />
        </div>

        <div className="field">
          <label>Leyenda</label>
          <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Texto opcional debajo de la imagen" />
        </div>

        <div className="field">
          <label>Posición</label>
          <select value={align} onChange={(e) => setAlign(e.target.value)}>
            {ALIGN_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field" style={{ marginBottom: 18 }}>
          <label>Link (opcional — se abre en pestaña nueva)</label>
          <input value={href} onChange={(e) => setHref(e.target.value)} placeholder="https://..." />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <button
            type="button"
            onClick={onDelete}
            style={{ border: "1px solid #f3c8d8", background: "#fdf1f6", color: "#c2185b", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}
          >
            Eliminar
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={onCancel}
              style={{ border: "1px solid #e3e1dc", background: "#fff", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => onSave({ alt, caption, align, href })}
              style={{ border: "none", background: "#1c1310", color: "#fff", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
