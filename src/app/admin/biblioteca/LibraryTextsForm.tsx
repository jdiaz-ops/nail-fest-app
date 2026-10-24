"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  LIBRARY_PAGES,
  LIBRARY_SECTIONS,
  LIBRARY_SECTION_KEYS,
  LIBRARY_TEXTS,
  LIBRARY_TEXT_KEYS,
  type LibrarySectionKey,
  type LibraryTextKey,
  type LibraryTexts,
} from "@/lib/library/texts";
import { api, CardTitle, cardStyle, mutedText, primaryButtonStyle, Switch } from "../cuponera/ui";
import { listOf } from "./ui";

type Status = "idle" | "saving" | "saved" | "error";

// Editar biblioteca → Textos y secciones: every title and text of the
// library's and the instructors' pages, Shorties, the menu and the forms,
// and a switch for each section — page by page, top to bottom as they show.
// An empty box is the usual text (shown in gray).
export default function LibraryTextsForm({
  texts: savedTexts,
  sections: savedSections,
  popularSearches,
  usual,
}: {
  texts: Record<string, string>;
  sections: Record<LibrarySectionKey, boolean>;
  popularSearches: string[];
  usual: LibraryTexts;
}) {
  const router = useRouter();
  const [texts, setTexts] = useState<Record<LibraryTextKey, string>>(
    Object.fromEntries(LIBRARY_TEXT_KEYS.map((k) => [k, savedTexts[k] ?? ""])) as Record<LibraryTextKey, string>,
  );
  const [sections, setSections] = useState(savedSections);
  const [popular, setPopular] = useState(popularSearches.join(", "));
  const [status, setStatus] = useState<Status>("idle");

  async function save() {
    setStatus("saving");
    try {
      await api("/api/admin/library/settings", { method: "PATCH", body: JSON.stringify({ texts, sections, popularSearches: listOf(popular) }) });
      setStatus("saved");
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  const textBox = (key: LibraryTextKey) => {
    const def = LIBRARY_TEXTS[key];
    const long = "long" in def && def.long;
    const props = {
      id: `lib-${key}`,
      value: texts[key],
      maxLength: 400,
      placeholder: usual[key],
      onChange: (e: { target: { value: string } }) => {
        const value = e.target.value;
        setTexts((t) => ({ ...t, [key]: value }));
        setStatus("idle");
      },
    };
    return (
      <div className="field" key={key}>
        <label htmlFor={`lib-${key}`}>{def.label}</label>
        {long ? <textarea rows={2} {...props} /> : <input {...props} />}
      </div>
    );
  };

  return (
    <div style={cardStyle}>
      <CardTitle>Textos y secciones</CardTitle>
      <p style={{ ...mutedText, marginTop: 0 }}>Página por página, de arriba abajo como se ven. Vacío = el texto de siempre (el que se ve en gris).</p>

      {LIBRARY_PAGES.map((page) => {
        const loose = LIBRARY_TEXT_KEYS.filter((k) => LIBRARY_TEXTS[k].page === page.key && !("section" in LIBRARY_TEXTS[k]));
        const pageSections = LIBRARY_SECTION_KEYS.filter((s) => LIBRARY_SECTIONS[s].page === page.key);
        return (
          <div key={page.key} style={{ borderTop: "1px solid #efece7", paddingTop: 14, marginTop: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#5b5f6b", textTransform: "uppercase", letterSpacing: "0.06em" }}>{page.label}</div>
            <div style={{ ...mutedText, fontSize: 12, marginBottom: 10 }}>{page.hint}</div>
            {loose.map(textBox)}
            {page.key === "biblioteca" && (
              <div className="field">
                <label htmlFor="lib-popular">Lo más buscado (separado por comas, hasta 8)</label>
                <input
                  id="lib-popular"
                  value={popular}
                  placeholder="Polygel, Francesa, Retiro, Precios"
                  onChange={(e) => {
                    setPopular(e.target.value);
                    setStatus("idle");
                  }}
                />
              </div>
            )}
            {pageSections.map((s) => {
              const sectionTexts = LIBRARY_TEXT_KEYS.filter((k) => "section" in LIBRARY_TEXTS[k] && (LIBRARY_TEXTS[k] as { section: string }).section === s);
              return (
                <div key={s} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <Switch
                      checked={sections[s]}
                      label={sections[s] ? `${LIBRARY_SECTIONS[s].label}: se ve` : `${LIBRARY_SECTIONS[s].label}: apagada`}
                      onChange={(next) => {
                        setSections((x) => ({ ...x, [s]: next }));
                        setStatus("idle");
                      }}
                    />
                    <span>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{LIBRARY_SECTIONS[s].label}</span>
                      <span style={{ display: "block", ...mutedText, fontSize: 12 }}>{LIBRARY_SECTIONS[s].hint}</span>
                    </span>
                  </div>
                  {sections[s] && sectionTexts.length > 0 && (
                    <div style={{ borderLeft: "3px solid #e6f9f7", paddingLeft: 14, marginLeft: 4 }}>{sectionTexts.map(textBox)}</div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
        <button type="button" style={primaryButtonStyle} disabled={status === "saving"} onClick={save}>
          {status === "saving" ? "Guardando…" : "Guardar textos y secciones"}
        </button>
        {status === "saved" && <span style={{ fontSize: 13, color: "#0d6e4f" }}>Guardado.</span>}
        {status === "error" && <span style={{ fontSize: 13, color: "#b0225c" }}>No se pudo guardar. Vuelve a intentarlo.</span>}
      </div>
    </div>
  );
}
