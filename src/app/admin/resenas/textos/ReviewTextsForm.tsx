"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { REVIEW_TEXT_FIELDS, REVIEW_TEXT_PAGES, type ReviewTextKey } from "@/lib/reviewPageTexts";

// Edits every line of the attendee's review pages, grouped by page. Each
// field shows the current text (an override or the default); "Texto
// original" puts the default back. Saves the whole map at once.
export default function ReviewTextsForm({ overrides, previewHrefs }: { overrides: Partial<Record<ReviewTextKey, string>>; previewHrefs: { form: string; thanks: string } | null }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<ReviewTextKey, string>>(() => {
    const out = {} as Record<ReviewTextKey, string>;
    for (const f of REVIEW_TEXT_FIELDS) out[f.key] = overrides[f.key] ?? f.default;
    return out;
  });
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = REVIEW_TEXT_FIELDS.some((f) => (values[f.key] ?? "").trim() !== (overrides[f.key] ?? f.default));

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/reviews/textos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    setSaving(false);
    if (!res.ok) {
      setError("No se pudieron guardar los textos. Intenta de nuevo.");
      return;
    }
    setSavedAt(Date.now());
    router.refresh();
  }

  const inputStyle = { width: "100%", boxSizing: "border-box" as const, border: "1px solid #e3e1dc", borderRadius: 10, padding: "9px 12px", font: "inherit", fontSize: 13.5, background: "#fff", color: "#17181c" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", position: "sticky", top: 0, background: "#faf9f7", padding: "8px 0", zIndex: 1 }}>
        <button type="button" onClick={save} disabled={saving || !dirty} style={{ padding: "9px 20px", borderRadius: 999, border: "none", background: dirty ? "#0b2e2c" : "#c9c5bd", color: "#fff", font: "inherit", fontSize: 14, fontWeight: 800, cursor: dirty ? "pointer" : "default" }}>
          {saving ? "Guardando…" : "Guardar textos"}
        </button>
        {dirty ? <span style={{ fontSize: 12, color: "#b25e00", fontWeight: 600 }}>Cambios sin guardar</span> : savedAt ? <span style={{ fontSize: 12, color: "#12966b" }}>Guardado ✓</span> : null}
        {previewHrefs && (
          <span style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a href={previewHrefs.form} target="_blank" rel="noreferrer" style={linkPill}>
              Ver el formulario ↗
            </a>
            <a href={previewHrefs.thanks} target="_blank" rel="noreferrer" style={linkPill}>
              Ver la pantalla de gracias ↗
            </a>
          </span>
        )}
        {error && <span style={{ fontSize: 12.5, color: "var(--danger)", flexBasis: "100%" }}>{error}</span>}
      </div>

      {REVIEW_TEXT_PAGES.map((page) => (
        <section key={page.page} style={{ background: "#fff", border: "1px solid #e3e1dc", borderRadius: 14, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{page.title}</div>
            <div style={{ fontSize: 12.5, color: "#5b5f6b" }}>{page.blurb}</div>
          </div>
          {REVIEW_TEXT_FIELDS.filter((f) => f.page === page.page).map((f) => {
            const value = values[f.key] ?? "";
            const isDefault = value.trim() === f.default;
            return (
              <label key={f.key} style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12.5, fontWeight: 700 }}>
                <span style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                  <span>
                    {f.label}
                    {f.optional && <span style={{ fontWeight: 400, color: "#5b5f6b" }}> (opcional)</span>}
                  </span>
                  {!isDefault && (
                    <button type="button" onClick={() => setValues((v) => ({ ...v, [f.key]: f.default }))} style={{ border: "none", background: "none", color: "#007a74", font: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0 }}>
                      {f.default ? "Texto original" : "Vaciar"}
                    </button>
                  )}
                </span>
                {f.multiline ? (
                  <textarea rows={3} maxLength={600} value={value} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} style={{ ...inputStyle, fontWeight: 400, resize: "vertical" }} />
                ) : (
                  <input type="text" maxLength={600} value={value} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} style={{ ...inputStyle, fontWeight: 400 }} />
                )}
                {f.placeholders && f.placeholders.length > 0 && (
                  <span style={{ fontSize: 11.5, color: "#5b5f6b", fontWeight: 400 }}>
                    Puedes usar {f.placeholders.map((p, i) => (
                      <span key={p}>
                        {i > 0 ? ", " : ""}
                        <code>{p}</code>
                      </span>
                    ))}
                    .
                  </span>
                )}
              </label>
            );
          })}
        </section>
      ))}
    </div>
  );
}

const linkPill = { fontSize: 13, padding: "7px 14px", borderRadius: 999, border: "1px solid #e3e1dc", background: "#fff", color: "#1c1310", textDecoration: "none", whiteSpace: "nowrap" } as const;
