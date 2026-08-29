"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { useEditor, EditorContent, Extension } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Youtube from "@tiptap/extension-youtube";

// No official @tiptap/extension-font-size package exists for TipTap 2 —
// this is the standard small custom extension for it: a `fontSize`
// attribute on the existing textStyle mark (from @tiptap/extension-text-style),
// rendered as inline style, exactly the same mechanism Color already uses
// for text color.
const FontSize = Extension.create({
  name: "fontSize",
  addOptions() {
    return { types: ["textStyle"] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize || null,
            renderHTML: (attributes: { fontSize?: string | null }) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ chain }: any) =>
          chain().setMark("textStyle", { fontSize: size }).run(),
      unsetFontSize:
        () =>
        ({ chain }: any) =>
          chain().setMark("textStyle", { fontSize: null }).run(),
    } as any;
  },
});

const FONT_SIZES = [
  { label: "Normal", value: "" },
  { label: "Pequeño", value: "13px" },
  { label: "Grande", value: "20px" },
  { label: "Muy grande", value: "28px" },
];

async function uploadImage(file: File): Promise<string | null> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/admin/uploads/event-image", { method: "POST", body: form });
  const body = await res.json().catch(() => ({}));
  return res.ok ? body.url : null;
}

// Imperative handle for callers that need to insert content at the
// current cursor position from OUTSIDE the editor — e.g. a merge-tag
// button (see EventConfirmationEditor.tsx) that isn't part of the
// toolbar itself. Optional: every existing call site that doesn't pass a
// ref keeps working exactly as before, forwardRef is additive.
export interface RichTextEditorHandle {
  insertAtCursor: (html: string) => void;
}

const RichTextEditor = forwardRef<RichTextEditorHandle, { value: string; onChange: (html: string) => void }>(function RichTextEditor(
  { value, onChange },
  ref
) {
  const [showSource, setShowSource] = useState(false);
  const [sourceDraft, setSourceDraft] = useState(value);
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      FontSize,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
      Youtube.configure({ nocookie: true }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { style: "min-height: 160px; padding: 12px; outline: none;" },
    },
    immediatelyRender: false,
  });

  useImperativeHandle(ref, () => ({
    insertAtCursor: (html: string) => {
      editor?.chain().focus().insertContent(html).run();
    },
  }));

  // Keep the editor in sync if `value` changes from outside (e.g.
  // "Copiar detalles de..." pre-filling the form) without fighting the
  // user's own typing — only resets when the editor doesn't already have
  // that content.
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) return null;

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !editor) return;
    setUploading(true);
    const url = await uploadImage(file);
    setUploading(false);
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    } else {
      alert("No se pudo subir la imagen — revisa que el almacenamiento esté activo.");
    }
  }

  function handleVideo() {
    const url = window.prompt("URL del video (YouTube):");
    if (url) editor?.chain().focus().setYoutubeVideo({ src: url }).run();
  }

  function handleLink() {
    const previousUrl = editor?.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL del link:", previousUrl || "https://");
    if (url === null) return;
    if (!url) {
      editor?.chain().focus().unsetLink().run();
      return;
    }
    editor?.chain().focus().setLink({ href: url }).run();
  }

  return (
    <div style={{ border: "1px solid var(--border, #e3e1dc)", borderRadius: 8, overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 2,
          padding: 6,
          borderBottom: "1px solid #e3e1dc",
          background: "#fafaf8",
        }}
      >
        <ToolbarButton title="Ver/editar HTML" active={showSource} onClick={() => { setSourceDraft(editor.getHTML()); setShowSource((s) => !s); }}>
          {"<>"}
        </ToolbarButton>

        <select
          value={
            editor.isActive("heading", { level: 1 })
              ? "h1"
              : editor.isActive("heading", { level: 2 })
                ? "h2"
                : editor.isActive("heading", { level: 3 })
                  ? "h3"
                  : "p"
          }
          onChange={(e) => {
            const v = e.target.value;
            if (v === "p") editor.chain().focus().setParagraph().run();
            else editor.chain().focus().toggleHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 }).run();
          }}
          style={{ fontSize: 13, border: "1px solid #e3e1dc", borderRadius: 6 }}
        >
          <option value="p">Párrafo</option>
          <option value="h1">Título grande</option>
          <option value="h2">Título mediano</option>
          <option value="h3">Título pequeño</option>
        </select>

        <ToolbarButton title="Negrita" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <b>B</b>
        </ToolbarButton>
        <ToolbarButton title="Cursiva" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <i>I</i>
        </ToolbarButton>
        <ToolbarButton title="Subrayado" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <u>U</u>
        </ToolbarButton>

        <input
          type="color"
          title="Color de texto"
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          style={{ width: 28, height: 28, padding: 0, border: "1px solid #e3e1dc", borderRadius: 6, cursor: "pointer" }}
        />

        <select
          title="Tamaño de texto"
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value;
            if (v) (editor.chain().focus() as any).setFontSize(v).run();
            else (editor.chain().focus() as any).unsetFontSize().run();
          }}
          style={{ fontSize: 13, border: "1px solid #e3e1dc", borderRadius: 6 }}
        >
          {FONT_SIZES.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

        <ToolbarButton title="Lista con viñetas" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          •≡
        </ToolbarButton>
        <ToolbarButton title="Lista numerada" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          1≡
        </ToolbarButton>

        <select
          title="Alineación"
          value={["left", "center", "right", "justify"].find((a) => editor.isActive({ textAlign: a })) || "left"}
          onChange={(e) => editor.chain().focus().setTextAlign(e.target.value).run()}
          style={{ fontSize: 13, border: "1px solid #e3e1dc", borderRadius: 6 }}
        >
          <option value="left">Izquierda</option>
          <option value="center">Centro</option>
          <option value="right">Derecha</option>
          <option value="justify">Justificado</option>
        </select>

        <ToolbarButton
          title="Aumentar sangría (dentro de una lista)"
          onClick={() => editor.chain().focus().sinkListItem("listItem").run()}
          disabled={!editor.can().sinkListItem("listItem")}
        >
          →|
        </ToolbarButton>
        <ToolbarButton
          title="Reducir sangría (dentro de una lista)"
          onClick={() => editor.chain().focus().liftListItem("listItem").run()}
          disabled={!editor.can().liftListItem("listItem")}
        >
          |←
        </ToolbarButton>

        <label style={{ display: "inline-flex" }}>
          <ToolbarButton title="Insertar imagen" as="span" disabled={uploading}>
            🖼
          </ToolbarButton>
          <input type="file" accept="image/*" onChange={handleImagePick} style={{ display: "none" }} disabled={uploading} />
        </label>
        <ToolbarButton title="Insertar video (YouTube)" onClick={handleVideo}>
          ▶
        </ToolbarButton>
        <ToolbarButton title="Insertar link" active={editor.isActive("link")} onClick={handleLink}>
          🔗
        </ToolbarButton>
        <ToolbarButton title="Línea horizontal" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          —
        </ToolbarButton>
      </div>

      {showSource ? (
        <div style={{ padding: 8 }}>
          <textarea
            value={sourceDraft}
            onChange={(e) => setSourceDraft(e.target.value)}
            rows={8}
            style={{ width: "100%", fontFamily: "monospace", fontSize: 12, border: "1px solid #e3e1dc", borderRadius: 6, padding: 8 }}
          />
          <button
            type="button"
            onClick={() => {
              editor.commands.setContent(sourceDraft);
              onChange(editor.getHTML());
              setShowSource(false);
            }}
            style={{ marginTop: 6, padding: "6px 14px", borderRadius: 999, border: "none", background: "#1c1310", color: "#fff", fontSize: 12, cursor: "pointer" }}
          >
            Aplicar HTML
          </button>
        </div>
      ) : (
        <EditorContent editor={editor} />
      )}
    </div>
  );
});

export default RichTextEditor;

function ToolbarButton({
  children,
  onClick,
  active,
  disabled,
  title,
  as,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  as?: "span";
}) {
  const style: React.CSSProperties = {
    border: "1px solid " + (active ? "#1c1310" : "#e3e1dc"),
    background: active ? "#1c1310" : "#fff",
    color: active ? "#fff" : "#1c1310",
    borderRadius: 6,
    width: 28,
    height: 28,
    fontSize: 13,
    lineHeight: 1,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.4 : 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
  if (as === "span") {
    return (
      <span title={title} style={style}>
        {children}
      </span>
    );
  }
  return (
    <button type="button" title={title} onClick={onClick} disabled={disabled} style={style}>
      {children}
    </button>
  );
}
